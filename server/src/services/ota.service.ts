/**
 * ota.service.ts
 * Business logic for OTA firmware management.
 *
 * Responsibilities:
 *  - Save uploaded .bin and compute SHA-256
 *  - Deactivate previous firmware for the same deviceType
 *  - Serve the current active firmware record to ESP32 check requests
 *  - Record that a device has installed a firmware version
 */
import fs   from 'fs';
import path from 'path';
import crypto from 'crypto';
import OtaFirmware from '../models/OtaFirmware.model';
import IoTDevice   from '../models/IoTDevice.model';
import { logger }  from '../utils/logger';
import { Op }      from 'sequelize';

// Firmware files live in <project_root>/ota_firmware/
export const OTA_DIR = path.join(__dirname, '../../../../ota_firmware');

/** Ensure the storage directory exists */
export function ensureOtaDir() {
  if (!fs.existsSync(OTA_DIR)) fs.mkdirSync(OTA_DIR, { recursive: true });
}

/** Compute SHA-256 of a file, returns hex string */
function sha256OfFile(filePath: string): string {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

/** Compare semver strings — returns true if a > b */
function isNewer(a: string, b: string): boolean {
  const parse = (s: string) => s.replace(/^v/, '').split('.').map(Number);
  const [ma, mia, pa] = parse(a);
  const [mb, mib, pb] = parse(b);
  if (ma !== mb) return ma > mb;
  if (mia !== mib) return mia > mib;
  return pa > pb;
}

export interface UploadFirmwareParams {
  deviceType: string;
  version: string;
  tmpPath: string;       // path where multer placed the file
  originalName: string;
  releaseNotes?: string;
  uploadedBy: string;
}

/** Save a newly uploaded firmware, deactivate old records, return DB row */
export async function saveFirmware(params: UploadFirmwareParams): Promise<OtaFirmware> {
  ensureOtaDir();

  const checksum  = sha256OfFile(params.tmpPath);
  const safeVer   = params.version.replace(/[^a-zA-Z0-9._-]/g, '');
  const safeDT    = params.deviceType.replace(/[^a-zA-Z0-9_-]/g, '');
  const fileName  = `firmware_${safeDT}_v${safeVer}.bin`;
  const destPath  = path.join(OTA_DIR, fileName);

  // Move from multer temp to permanent store
  fs.renameSync(params.tmpPath, destPath);

  const fileSizeBytes = fs.statSync(destPath).size;

  // Deactivate all previous firmware for this deviceType
  await OtaFirmware.update(
    { isActive: false },
    { where: { deviceType: params.deviceType, isActive: true } }
  );

  const record = await OtaFirmware.create({
    deviceType:    params.deviceType,
    version:       params.version,
    fileName,
    filePath:      destPath,
    fileSizeBytes,
    checksum,
    releaseNotes:  params.releaseNotes || null,
    isActive:      true,
    uploadedBy:    params.uploadedBy,
  });

  logger.info(`[OTA] New firmware saved: ${fileName} (${fileSizeBytes} bytes, SHA256: ${checksum})`);
  return record;
}

/**
 * Check whether a new firmware is available for a given device.
 * Called by the ESP32 on boot via GET /api/devices/:id/ota/check
 *
 * Returns:
 *   { updateAvailable: false }                    – already up to date
 *   { updateAvailable: true, version, size, checksum, downloadUrl }
 */
export async function checkForUpdate(
  deviceDbId: string,
  currentVersion: string
): Promise<{ updateAvailable: false } | {
  updateAvailable: true;
  version: string;
  fileSizeBytes: number;
  checksum: string;
  downloadUrl: string;
  releaseNotes: string | null;
}> {
  const device = await IoTDevice.findByPk(deviceDbId);
  if (!device) throw new Error('Device not found');

  // Try exact device type first, fall back to '*' wildcard
  const firmware = await OtaFirmware.findOne({
    where: {
      isActive: true,
      deviceType: { [Op.in]: [device.deviceType, '*'] },
    },
    order: [['createdAt', 'DESC']],
  });

  if (!firmware) return { updateAvailable: false };
  if (!isNewer(firmware.version, currentVersion)) return { updateAvailable: false };

  const downloadUrl = `/api/devices/${deviceDbId}/ota/download`;

  return {
    updateAvailable: true,
    version:       firmware.version,
    fileSizeBytes: firmware.fileSizeBytes,
    checksum:      firmware.checksum,
    downloadUrl,
    releaseNotes:  firmware.releaseNotes,
  };
}

/**
 * Return the active firmware record for a device so the route can
 * stream the binary file.
 */
export async function getActiveFirmware(deviceDbId: string): Promise<OtaFirmware | null> {
  const device = await IoTDevice.findByPk(deviceDbId);
  if (!device) return null;

  return OtaFirmware.findOne({
    where: {
      isActive: true,
      deviceType: { [Op.in]: [device.deviceType, '*'] },
    },
    order: [['createdAt', 'DESC']],
  });
}

/**
 * Record that a device successfully installed a firmware version.
 * Updates IoTDevice.firmwareVersion so the dashboard can display it.
 */
export async function confirmInstall(deviceDbId: string, version: string): Promise<void> {
  await IoTDevice.update(
    { firmwareVersion: version },
    { where: { id: deviceDbId } }
  );
  logger.info(`[OTA] Device ${deviceDbId} confirmed install of v${version}`);
}

/** Return all firmware records (for the dashboard list) */
export async function listFirmware(deviceType?: string): Promise<OtaFirmware[]> {
  const where: any = {};
  if (deviceType) where.deviceType = deviceType;
  return OtaFirmware.findAll({ where, order: [['createdAt', 'DESC']] });
}
