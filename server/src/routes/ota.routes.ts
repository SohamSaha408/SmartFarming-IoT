/**
 * ota.routes.ts  — Over-the-Air firmware update endpoints
 *
 * POST /api/ota/upload/:deviceId   — farmer uploads a .bin file for a device
 * GET  /api/ota/check/:deviceId    — ESP32 polls: returns 304 if up-to-date,
 *                                    200 + binary stream if new firmware exists
 * GET  /api/ota/version/:deviceId  — returns latest version metadata (JSON)
 * DELETE /api/ota/:deviceId        — removes stored firmware for a device
 *
 * The ESP32 combined node calls GET /api/ota/check/:deviceId on every boot
 * and sends its current version in the X-Firmware-Version header.
 * If a newer version is stored, the server streams the .bin file back.
 */
import { Router, Response, Request } from 'express';
import { param } from 'express-validator';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { validate } from '../middleware/validation.middleware';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import IoTDevice from '../models/IoTDevice.model';
import { logger } from '../utils/logger';

const router = Router();
const FIRMWARE_DIR = path.join(__dirname, '../../firmware');

// Ensure firmware directory exists at startup
if (!fs.existsSync(FIRMWARE_DIR)) fs.mkdirSync(FIRMWARE_DIR, { recursive: true });

// ── Multer: accept only .bin files, max 4 MB ─────────────────────────────────
const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, FIRMWARE_DIR),
    filename:    (req, _file, cb) => {
        const deviceId = req.params.deviceId ?? 'unknown';
        cb(null, `${deviceId}.bin`);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 4 * 1024 * 1024 }, // 4 MB — typical ESP32 flash budget
    fileFilter: (_req, file, cb) => {
        if (file.originalname.endsWith('.bin')) cb(null, true);
        else cb(new Error('Only .bin firmware files are accepted'));
    },
});

// ── Helper: read/write version metadata ──────────────────────────────────────
interface FirmwareMeta { version: string; uploadedAt: string; size: number; deviceId: string }

const metaPath = (deviceId: string) => path.join(FIRMWARE_DIR, `${deviceId}.json`);

const readMeta = (deviceId: string): FirmwareMeta | null => {
    try { return JSON.parse(fs.readFileSync(metaPath(deviceId), 'utf8')); }
    catch { return null; }
};

const writeMeta = (deviceId: string, meta: FirmwareMeta) =>
    fs.writeFileSync(metaPath(deviceId), JSON.stringify(meta, null, 2));

// ── POST /api/ota/upload/:deviceId  (farmer-authenticated) ──────────────────
router.post(
    '/upload/:deviceId',
    authenticate,
    validate([param('deviceId').notEmpty()]),
    (req: AuthRequest, res: Response, next) => {
        upload.single('firmware')(req as any, res as any, next);
    },
    async (req: AuthRequest, res: Response) => {
        try {
            const { deviceId } = req.params;
            const version = (req.body.version as string | undefined)?.trim() || '1.0.0';

            // Verify device belongs to this farmer
            const device = await IoTDevice.findOne({
                where: { deviceId },
                include: [{ association: 'farm', where: { farmerId: req.farmer!.id }, required: true }],
            });
            if (!device) {
                fs.unlinkSync((req as any).file?.path ?? '');
                res.status(404).json({ error: 'Device not found or access denied' });
                return;
            }

            if (!(req as any).file) {
                res.status(400).json({ error: 'No .bin file attached' });
                return;
            }

            const meta: FirmwareMeta = {
                version,
                uploadedAt: new Date().toISOString(),
                size:       (req as any).file.size,
                deviceId,
            };
            writeMeta(deviceId, meta);

            logger.info(`[OTA] Firmware v${version} uploaded for device ${deviceId} (${meta.size} bytes)`);
            res.json({ message: 'Firmware uploaded successfully', ...meta });
        } catch (err) {
            logger.error('[OTA] Upload error:', err);
            res.status(500).json({ error: 'Firmware upload failed' });
        }
    }
);

// ── GET /api/ota/check/:deviceId  (called by ESP32 — no auth token needed) ──
// ESP32 sends: X-Firmware-Version: 1.0.0
// Returns 304 if up-to-date, 200 + binary if newer version exists
router.get(
    '/check/:deviceId',
    validate([param('deviceId').notEmpty()]),
    async (req: Request, res: Response) => {
        try {
            const { deviceId } = req.params;
            const currentVersion = (req.headers['x-firmware-version'] as string | undefined) ?? '0.0.0';

            const meta = readMeta(deviceId);
            if (!meta) {
                res.status(404).json({ error: 'No firmware stored for this device' });
                return;
            }

            const binPath = path.join(FIRMWARE_DIR, `${deviceId}.bin`);
            if (!fs.existsSync(binPath)) {
                res.status(404).json({ error: 'Firmware file missing' });
                return;
            }

            // Semantic version compare: if stored <= current, nothing to do
            if (meta.version <= currentVersion) {
                res.status(304).end(); // ESP32 interprets 304 as "already up to date"
                return;
            }

            logger.info(`[OTA] Serving firmware v${meta.version} to device ${deviceId} (currently v${currentVersion})`);
            res.setHeader('Content-Type', 'application/octet-stream');
            res.setHeader('Content-Disposition', `attachment; filename="${deviceId}.bin"`);
            res.setHeader('X-Firmware-Version', meta.version);
            res.setHeader('Content-Length', String(meta.size));
            fs.createReadStream(binPath).pipe(res);
        } catch (err) {
            logger.error('[OTA] Check error:', err);
            res.status(500).json({ error: 'OTA check failed' });
        }
    }
);

// ── GET /api/ota/version/:deviceId  (farmer-authenticated — check metadata) ──
router.get(
    '/version/:deviceId',
    authenticate,
    validate([param('deviceId').notEmpty()]),
    async (req: AuthRequest, res: Response) => {
        const meta = readMeta(req.params.deviceId);
        if (!meta) {
            res.status(404).json({ error: 'No firmware stored for this device' });
            return;
        }
        res.json(meta);
    }
);

// ── DELETE /api/ota/:deviceId  (farmer-authenticated — remove firmware) ──────
router.delete(
    '/:deviceId',
    authenticate,
    validate([param('deviceId').notEmpty()]),
    async (req: AuthRequest, res: Response) => {
        try {
            const { deviceId } = req.params;
            const binPath  = path.join(FIRMWARE_DIR, `${deviceId}.bin`);
            const jsonPath = metaPath(deviceId);
            if (fs.existsSync(binPath))  fs.unlinkSync(binPath);
            if (fs.existsSync(jsonPath)) fs.unlinkSync(jsonPath);
            res.json({ message: `Firmware for ${deviceId} removed` });
        } catch (err) {
            logger.error('[OTA] Delete error:', err);
            res.status(500).json({ error: 'Failed to remove firmware' });
        }
    }
);

export default router;
