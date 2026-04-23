import { Model, DataTypes, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface OtaFirmwareAttributes {
  id: string;
  deviceType: string;      // e.g. 'combined_node', 'sensor_node', or '*' for all
  version: string;         // semver string e.g. "1.2.3"
  fileName: string;        // stored filename on disk
  filePath: string;        // absolute server path to .bin
  fileSizeBytes: number;
  checksum: string;        // SHA-256 hex of the .bin
  releaseNotes: string | null;
  isActive: boolean;       // only the active record is served to devices
  uploadedBy: string;      // farmerId of uploader
  createdAt?: Date;
  updatedAt?: Date;
}

interface OtaFirmwareCreation
  extends Optional<OtaFirmwareAttributes, 'id' | 'releaseNotes' | 'isActive'> {}

class OtaFirmware
  extends Model<OtaFirmwareAttributes, OtaFirmwareCreation>
  implements OtaFirmwareAttributes {
  public id!: string;
  public deviceType!: string;
  public version!: string;
  public fileName!: string;
  public filePath!: string;
  public fileSizeBytes!: number;
  public checksum!: string;
  public releaseNotes!: string | null;
  public isActive!: boolean;
  public uploadedBy!: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

OtaFirmware.init(
  {
    id:            { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    deviceType:    { type: DataTypes.STRING(50),  allowNull: false },
    version:       { type: DataTypes.STRING(20),  allowNull: false },
    fileName:      { type: DataTypes.STRING(255), allowNull: false },
    filePath:      { type: DataTypes.STRING(500), allowNull: false },
    fileSizeBytes: { type: DataTypes.INTEGER,     allowNull: false },
    checksum:      { type: DataTypes.STRING(64),  allowNull: false, comment: 'SHA-256 hex' },
    releaseNotes:  { type: DataTypes.TEXT,        allowNull: true  },
    isActive:      { type: DataTypes.BOOLEAN,     defaultValue: true },
    uploadedBy:    { type: DataTypes.UUID,        allowNull: false },
  },
  {
    sequelize,
    tableName: 'ota_firmware',
    modelName: 'OtaFirmware',
    underscored: true,
    indexes: [
      { fields: ['device_type'] },
      { fields: ['is_active'] },
    ],
  }
);

export default OtaFirmware;
