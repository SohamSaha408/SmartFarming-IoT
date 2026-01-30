import { Model, DataTypes, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export type DeviceType = 'soil_sensor' | 'water_pump' | 'valve' | 'weather_station' | 'npk_sensor';
export type DeviceStatus = 'active' | 'inactive' | 'maintenance' | 'offline';

interface IoTDeviceAttributes {
  id: string;
  farmId: string;
  deviceType: DeviceType;
  deviceId: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  status: DeviceStatus;
  firmwareVersion: string | null;
  lastSeenAt: Date | null;
  batteryLevel: number | null;
  metadata: object | null;
  createdAt?: Date;
  updatedAt?: Date;
}

interface IoTDeviceCreationAttributes extends Optional<IoTDeviceAttributes, 'id' | 'name' | 'latitude' | 'longitude' | 'status' | 'firmwareVersion' | 'lastSeenAt' | 'batteryLevel' | 'metadata'> { }

class IoTDevice extends Model<IoTDeviceAttributes, IoTDeviceCreationAttributes> implements IoTDeviceAttributes {
  public id!: string;
  public farmId!: string;
  public deviceType!: DeviceType;
  public deviceId!: string;
  public name!: string;
  public latitude!: number | null;
  public longitude!: number | null;
  public status!: DeviceStatus;
  public firmwareVersion!: string | null;
  public lastSeenAt!: Date | null;
  public batteryLevel!: number | null;
  public metadata!: object | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

IoTDevice.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    farmId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'farms',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    deviceType: {
      type: DataTypes.ENUM('soil_sensor', 'water_pump', 'valve', 'weather_station', 'npk_sensor'),
      allowNull: false,
    },
    deviceId: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Hardware device ID (MAC address or serial)'
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: 'Unnamed Device'
    },
    latitude: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: true,
    },
    longitude: {
      type: DataTypes.DECIMAL(11, 8),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive', 'maintenance', 'offline'),
      defaultValue: 'active',
    },
    firmwareVersion: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    lastSeenAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    batteryLevel: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 0,
        max: 100
      }
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Additional device configuration'
    }
  },
  {
    sequelize,
    tableName: 'iot_devices',
    modelName: 'IoTDevice',
    underscored: true,
    indexes: [
      {
        fields: ['farm_id']
      },
      {
        fields: ['device_type']
      },
      {
        fields: ['status']
      },
      {
        unique: true,
        fields: ['device_id']
      }
    ]
  }
);

export default IoTDevice;
