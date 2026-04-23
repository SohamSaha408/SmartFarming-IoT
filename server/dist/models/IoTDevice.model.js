"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
class IoTDevice extends sequelize_1.Model {
}
IoTDevice.init({
    id: {
        type: sequelize_1.DataTypes.UUID,
        defaultValue: sequelize_1.DataTypes.UUIDV4,
        primaryKey: true,
    },
    farmId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'farms',
            key: 'id'
        },
        onDelete: 'CASCADE'
    },
    deviceType: {
        type: sequelize_1.DataTypes.ENUM('soil_sensor', 'water_pump', 'valve', 'weather_station', 'npk_sensor'),
        allowNull: false,
    },
    deviceId: {
        type: sequelize_1.DataTypes.STRING(100),
        allowNull: false,
        comment: 'Hardware device ID (MAC address or serial)'
    },
    name: {
        type: sequelize_1.DataTypes.STRING(100),
        allowNull: false,
        defaultValue: 'Unnamed Device'
    },
    latitude: {
        type: sequelize_1.DataTypes.DECIMAL(10, 8),
        allowNull: true,
    },
    longitude: {
        type: sequelize_1.DataTypes.DECIMAL(11, 8),
        allowNull: true,
    },
    status: {
        type: sequelize_1.DataTypes.ENUM('active', 'inactive', 'maintenance', 'offline'),
        defaultValue: 'active',
    },
    firmwareVersion: {
        type: sequelize_1.DataTypes.STRING(20),
        allowNull: true,
    },
    lastSeenAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
    },
    batteryLevel: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: true,
        validate: {
            min: 0,
            max: 100
        }
    },
    metadata: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'Additional device configuration'
    }
}, {
    sequelize: database_1.sequelize,
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
});
exports.default = IoTDevice;
//# sourceMappingURL=IoTDevice.model.js.map