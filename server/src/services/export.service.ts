/**
 * export.service.ts
 * Generates PDF farm reports (PDFKit) and CSV sensor exports.
 *
 * PDF:  GET /api/farms/:id/export/pdf
 *       Sections: farm summary, 30-day sensor averages, NPK panel,
 *                 NDVI bar-chart trend, irrigation history, device list.
 *
 * CSV:  GET /api/farms/:id/export/csv
 *       All raw sensor readings for the last 30 days, streamed row-by-row.
 */
import PDFDocument from 'pdfkit';
import { Response }  from 'express';
import { Op }        from 'sequelize';
import {
    Farm, Crop, CropHealth, IoTDevice,
    SensorReading, IrrigationSchedule,
} from '../models';

// ── Colour palette ────────────────────────────────────────────────────────────
const C = {
    green:  '#16a34a',
    dark:   '#111827',
    muted:  '#6b7280',
    light:  '#f9fafb',
    border: '#e5e7eb',
    amber:  '#d97706',
    red:    '#dc2626',
    white:  '#ffffff',
};

// ── Pure helpers ──────────────────────────────────────────────────────────────
const fmt = (v: number | null | undefined, dec = 1): string =>
    v != null ? Number(v).toFixed(dec) : '—';

const avgOf = (arr: (number | null | undefined)[]): number | null => {
    const vals = arr.filter((v): v is number => v != null && !isNaN(Number(v)))
                    .map(Number);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function ndviLabel(v: number | null): string {
    if (v == null) return 'No data';
    if (v >= 0.7)  return 'Dense vegetation';
    if (v >= 0.5)  return 'Healthy';
    if (v >= 0.3)  return 'Moderate stress';
    if (v >= 0.1)  return 'Stressed';
    return 'Bare soil / Critical';
}

// ── PDF drawing primitives ────────────────────────────────────────────────────

function hRule(doc: PDFKit.PDFDocument, y: number, color = C.border) {
    doc.save().moveTo(40, y).lineTo(555, y)
        .strokeColor(color).lineWidth(0.5).stroke().restore();
}

function sectionHeader(doc: PDFKit.PDFDocument, title: string) {
    const y = doc.y + 12;
    doc.rect(40, y, 515, 26).fill(C.green);
    doc.fontSize(10).fillColor(C.white).font('Helvetica-Bold')
        .text(title.toUpperCase(), 50, y + 8);
    doc.font('Helvetica').fillColor(C.dark);
    doc.y = y + 36;
}

/** Render a grid of KPI tiles. cols = tiles per row. */
function kpiRow(
    doc: PDFKit.PDFDocument,
    pairs: [string, string][],
    cols = 3
) {
    const colW  = Math.floor(515 / cols);
    const tileH = 46;
    const gap   = 4;
    const startY = doc.y;
    pairs.forEach(([label, value], i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x   = 40 + col * (colW + gap);
        const y   = startY + row * (tileH + gap);
        doc.rect(x, y, colW - gap, tileH).fill(C.light)
            .rect(x, y, colW - gap, tileH).strokeColor(C.border).lineWidth(0.5).stroke();
        doc.fontSize(7).fillColor(C.muted).font('Helvetica')
            .text(label.toUpperCase(), x + 8, y + 7, { width: colW - 20, lineBreak: false });
        doc.fontSize(14).fillColor(C.dark).font('Helvetica-Bold')
            .text(value, x + 8, y + 18, { width: colW - 20, lineBreak: false });
    });
    const rows = Math.ceil(pairs.length / cols);
    doc.y = startY + rows * (tileH + gap) + 6;
    doc.font('Helvetica').fillColor(C.dark);
}

/** Draw a table header bar. */
function tHead(doc: PDFKit.PDFDocument, cols: string[], widths: number[]) {
    const y = doc.y;
    doc.rect(40, y, widths.reduce((a, b) => a + b, 0), 20).fill('#f3f4f6');
    let x = 40;
    cols.forEach((col, i) => {
        doc.fontSize(7.5).fillColor(C.muted).font('Helvetica-Bold')
            .text(col, x + 4, y + 6, { width: widths[i] - 8, lineBreak: false });
        x += widths[i];
    });
    doc.y = y + 20;
    doc.font('Helvetica').fillColor(C.dark);
}

/** Draw a single table row (auto-page-break if needed). */
function tRow(
    doc: PDFKit.PDFDocument,
    cells: string[],
    widths: number[],
    shade: boolean
) {
    if (doc.y > doc.page.height - 80) { doc.addPage(); doc.y = 40; }
    const rowH  = 18;
    const totalW = widths.reduce((a, b) => a + b, 0);
    const y = doc.y;
    if (shade) doc.rect(40, y, totalW, rowH).fill('#fafafa');
    let x = 40;
    cells.forEach((cell, i) => {
        doc.fontSize(7.5).fillColor(C.dark).font('Helvetica')
            .text(cell, x + 4, y + 5, { width: widths[i] - 8, lineBreak: false });
        x += widths[i];
    });
    hRule(doc, y + rowH);
    doc.y = y + rowH;
}

// ── PDF report ────────────────────────────────────────────────────────────────

export const generateFarmPDF = async (
    farmId: string,
    farmerId: string,
    res: Response
): Promise<void> => {
    const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // ── 1. Ownership check ────────────────────────────────────────────────────
    const farm = await Farm.findOne({ where: { id: farmId, farmerId } });
    if (!farm) { res.status(404).json({ error: 'Farm not found' }); return; }

    // ── 2. Fetch all data in parallel ─────────────────────────────────────────
    const [crops, devices, irrigations] = await Promise.all([
        Crop.findAll({ where: { farmId } }),
        IoTDevice.findAll({ where: { farmId } }),
        IrrigationSchedule.findAll({
            where: { farmId, scheduledTime: { [Op.gte]: since30 } },
            order: [['scheduledTime', 'DESC']],
            limit: 50,
        }),
    ]);

    // Crop health: query via Crop so the farmId filter is clean
    const cropIds = crops.map(c => c.id);
    const healthRecords = cropIds.length
        ? await CropHealth.findAll({
            where: { cropId: { [Op.in]: cropIds }, recordedAt: { [Op.gte]: since30 } },
            order: [['recordedAt', 'DESC']],
            limit: 60,
        })
        : [];

    // Sensor readings
    const deviceIds = devices.map(d => d.id);
    const readings = deviceIds.length
        ? await SensorReading.findAll({
            where: { deviceId: { [Op.in]: deviceIds }, recordedAt: { [Op.gte]: since30 } },
            order: [['recordedAt', 'DESC']],
            limit: 2000,
        })
        : [];

    // ── 3. Derive aggregates ──────────────────────────────────────────────────
    const avgMoisture   = avgOf(readings.map(r => r.soilMoisture));
    const avgAirTemp    = avgOf(readings.map(r => r.airTemperature));
    const avgHumidity   = avgOf(readings.map(r => r.airHumidity));
    const avgLight      = avgOf(readings.map(r => r.lightIntensity));
    const avgNitrogen   = avgOf(readings.map(r => r.nitrogenLevel));
    const avgPhosphorus = avgOf(readings.map(r => r.phosphorusLevel));
    const avgPotassium  = avgOf(readings.map(r => r.potassiumLevel));

    // FIX: clamp NDVI to [0,1] — raw value can be negative, would break bar chart math
    const latestNDVI = healthRecords.length
        ? clamp(parseFloat(healthRecords[0].ndviValue as any ?? '0'), 0, 1)
        : null;

    const completedIrr  = irrigations.filter(i => i.status === 'completed');
    const totalIrrMin   = completedIrr.reduce((s, i) => s + i.durationMinutes, 0);

    // ── 4. Initialise PDFKit (buffered pages for footer) ─────────────────────
    const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition',
        `attachment; filename="farm-report-${farm.name.replace(/\s+/g, '_')}-` +
        `${new Date().toISOString().slice(0, 10)}.pdf"`);
    doc.pipe(res);

    // ── 5. Cover header bar ───────────────────────────────────────────────────
    doc.rect(0, 0, 595, 88).fill(C.green);
    doc.fontSize(22).fillColor(C.white).font('Helvetica-Bold')
        .text('Smart Agri IoT', 40, 20);
    doc.fontSize(11).font('Helvetica').fillColor('#d1fae5')
        .text('Farm Performance Report  ·  Last 30 Days', 40, 48);
    doc.fontSize(8.5).fillColor('#a7f3d0')
        .text(`Generated ${new Date().toLocaleDateString('en-IN',
            { day: '2-digit', month: 'long', year: 'numeric' })}`, 40, 66);
    doc.y = 108;

    // ── 6. Farm summary ───────────────────────────────────────────────────────
    sectionHeader(doc, 'Farm Summary');
    kpiRow(doc, [
        ['Farm name',    farm.name],
        ['Location',     [farm.village, farm.district, farm.state].filter(Boolean).join(', ') || '—'],
        ['Area',         farm.areaHectares ? `${farm.areaHectares} ha` : '—'],
        ['Land type',    farm.landType ?? '—'],
        ['Soil pH',      fmt(farm.soilPh as any, 1)],
        ['Active crops', String(crops.filter(c => c.status === 'active').length)],
    ], 3);

    // ── 7. 30-day sensor averages ─────────────────────────────────────────────
    sectionHeader(doc, '30-Day Sensor Averages');
    kpiRow(doc, [
        ['Soil moisture',   avgMoisture   != null ? `${fmt(avgMoisture)}%`              : '—'],
        ['Air temperature', avgAirTemp    != null ? `${fmt(avgAirTemp)} °C`             : '—'],
        ['Air humidity',    avgHumidity   != null ? `${fmt(avgHumidity)}%`              : '—'],
        ['Light intensity', avgLight      != null ? `${Math.round(avgLight!)} lux`      : '—'],
        ['Total readings',  String(readings.length)],
        ['Devices active',  String(devices.filter(d => d.status === 'active').length)],
    ], 3);

    // ── 8. NPK nutrients ──────────────────────────────────────────────────────
    if (avgNitrogen != null || avgPhosphorus != null || avgPotassium != null) {
        sectionHeader(doc, 'Soil Nutrient Averages (NPK)');
        kpiRow(doc, [
            ['Nitrogen (N)',   avgNitrogen   != null ? `${fmt(avgNitrogen)} ppm`   : '—'],
            ['Phosphorus (P)', avgPhosphorus != null ? `${fmt(avgPhosphorus)} ppm` : '—'],
            ['Potassium (K)',  avgPotassium  != null ? `${fmt(avgPotassium)} ppm`  : '—'],
        ], 3);
    }

    // ── 9. NDVI trend bar chart ───────────────────────────────────────────────
    sectionHeader(doc, 'NDVI Vegetation Health Trend');

    if (healthRecords.length === 0) {
        doc.fontSize(9).fillColor(C.muted)
            .text('No health records available for the last 30 days.', 50, doc.y + 4);
        doc.y += 24;
    } else {
        // Take up to 28 most-recent records, show oldest → newest (left→right)
        const sparkData = healthRecords.slice(0, 28).reverse();
        const chartX = 50;
        const chartY = doc.y + 8;
        const chartH = 55;
        const barW   = Math.max(8, Math.floor(460 / sparkData.length) - 2);

        // FIX: clamp each NDVI to [0,1] before computing bar height —
        //      negative NDVI (water/shadow) would give negative barH and crash PDFKit
        sparkData.forEach((h, i) => {
            const rawNdvi = h.ndviValue != null ? parseFloat(h.ndviValue as any) : 0;
            const ndvi    = clamp(rawNdvi, 0, 1);
            const barH    = Math.max(2, Math.round(ndvi * chartH));
            const color   = ndvi >= 0.5 ? C.green : ndvi >= 0.3 ? C.amber : C.red;
            doc.rect(chartX + i * (barW + 2), chartY + chartH - barH, barW, barH)
               .fill(color);
        });

        // Y-axis reference lines + labels
        [1.0, 0.5, 0.0].forEach(level => {
            const lineY = chartY + chartH - Math.round(level * chartH);
            doc.save().moveTo(chartX - 4, lineY).lineTo(chartX + 470, lineY)
               .strokeColor(C.border).lineWidth(0.3).stroke().restore();
            doc.fontSize(6.5).fillColor(C.muted)
               .text(level.toFixed(1), 36, lineY - 3, { width: 12, align: 'right' });
        });

        // Colour legend
        doc.y = chartY + chartH + 8;
        [[C.green, '≥ 0.5 Healthy'], [C.amber, '0.3–0.5 Moderate'], [C.red, '< 0.3 Stressed']]
            .forEach(([color, label], i) => {
                const lx = chartX + i * 150;
                doc.rect(lx, doc.y, 10, 8).fill(color as string);
                doc.fontSize(7).fillColor(C.dark).text(label as string, lx + 13, doc.y, { width: 130 });
            });
        doc.y += 14;

        doc.fontSize(9).fillColor(C.dark).font('Helvetica-Bold')
            .text(`Latest NDVI: ${latestNDVI != null ? latestNDVI.toFixed(3) : '—'}`, 50, doc.y)
            .font('Helvetica').fillColor(C.muted)
            .text(`  ${ndviLabel(latestNDVI)}`, { continued: false });
        doc.y += 8;
    }

    // ── 10. Irrigation history ────────────────────────────────────────────────
    sectionHeader(doc, 'Irrigation History (Last 30 Days)');
    kpiRow(doc, [
        ['Total events',     String(irrigations.length)],
        ['Completed',        String(completedIrr.length)],
        ['Total runtime',    `${totalIrrMin} min`],
        ['Sensor-triggered', String(irrigations.filter(i => i.triggeredBy === 'sensor').length)],
    ], 4);

    if (irrigations.length > 0) {
        const iW = [88, 60, 70, 75, 60, 122];  // total = 475
        tHead(doc, ['Scheduled', 'Duration', 'Status', 'Triggered', 'Water (L)', 'Notes'], iW);
        irrigations.slice(0, 25).forEach((irr, idx) => {
            tRow(doc, [
                new Date(irr.scheduledTime).toLocaleDateString('en-IN'),
                `${irr.durationMinutes} min`,
                irr.status,
                irr.triggeredBy,
                fmt(irr.waterVolumeLiters as any, 0),
                (irr.notes ?? '—').slice(0, 32),
            ], iW, idx % 2 === 1);
        });
        if (irrigations.length > 25) {
            doc.fontSize(7.5).fillColor(C.muted)
               .text(`… and ${irrigations.length - 25} more events — download CSV for full data.`,
                     50, doc.y + 5);
            doc.y += 16;
        }
    } else {
        doc.fontSize(9).fillColor(C.muted).text('No irrigation events in this period.', 50, doc.y + 4);
        doc.y += 20;
    }

    // ── 11. Device table ──────────────────────────────────────────────────────
    if (devices.length > 0) {
        sectionHeader(doc, 'IoT Devices');
        const dW = [150, 100, 80, 145];
        tHead(doc, ['Device ID', 'Type', 'Status', 'Last Seen'], dW);
        devices.forEach((d, idx) => {
            tRow(doc, [
                d.deviceId,
                d.deviceType,
                d.status,
                d.lastSeenAt
                    ? new Date(d.lastSeenAt).toLocaleString('en-IN')
                    : '—',
            ], dW, idx % 2 === 1);
        });
    }

    // ── 12. Footer on every buffered page ─────────────────────────────────────
    // FIX: use doc.page.height instead of hardcoded 820/826 so it works on any
    //      page size, and won't overlap content that runs close to the bottom.
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
        doc.switchToPage(range.start + i);
        const footerY = doc.page.height - 22;
        hRule(doc, footerY - 4);
        doc.fontSize(7).fillColor(C.muted)
            .text(
                `Smart Agri IoT  ·  ${farm.name}  ·  Page ${i + 1} of ${range.count}`,
                40, footerY, { align: 'center', width: 515 }
            );
    }

    doc.end();
};

// ── CSV export ────────────────────────────────────────────────────────────────

export const generateSensorCSV = async (
    farmId: string,
    farmerId: string,
    res: Response
): Promise<void> => {
    const farm = await Farm.findOne({ where: { id: farmId, farmerId } });
    if (!farm) { res.status(404).json({ error: 'Farm not found' }); return; }

    const devices = await IoTDevice.findAll({ where: { farmId } });
    if (!devices.length) {
        res.status(404).json({ error: 'No devices found for this farm' });
        return;
    }

    const deviceIds = devices.map(d => d.id);
    // Map internal UUID → hardware deviceId for the CSV (human-readable)
    const deviceMap: Record<string, string> = Object.fromEntries(
        devices.map(d => [d.id, d.deviceId])
    );

    const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const readings = await SensorReading.findAll({
        where: {
            deviceId: { [Op.in]: deviceIds },
            recordedAt: { [Op.gte]: since30 },
        },
        order: [['recordedAt', 'DESC']],
    });

    const filename = `sensor-readings-${farm.name.replace(/\s+/g, '_')}-` +
                     `${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    // UTF-8 BOM so Excel opens it correctly
    res.write('\uFEFF');

    const COLS = [
        'timestamp', 'device_id',
        'soil_moisture_%', 'soil_temperature_c', 'soil_ph',
        'air_temperature_c', 'air_humidity_%', 'light_intensity_lux',
        'nitrogen_ppm', 'phosphorus_ppm', 'potassium_ppm',
    ];
    res.write(COLS.join(',') + '\r\n');

    // Stream rows — no full buffer, constant memory regardless of row count
    for (const r of readings) {
        const cells = [
            new Date(r.recordedAt).toISOString(),
            deviceMap[r.deviceId] ?? r.deviceId,
            r.soilMoisture    ?? '',
            r.soilTemperature ?? '',
            r.soilPh          ?? '',
            r.airTemperature  ?? '',
            r.airHumidity     ?? '',
            r.lightIntensity  ?? '',
            r.nitrogenLevel   ?? '',
            r.phosphorusLevel ?? '',
            r.potassiumLevel  ?? '',
        ];
        res.write(cells.join(',') + '\r\n');
    }

    res.end();
};
