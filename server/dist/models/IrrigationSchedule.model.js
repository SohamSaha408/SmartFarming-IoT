"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
class IrrigationSchedule extends sequelize_1.Model {
}
IrrigationSchedule.init({
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
    cropId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'crops',
            key: 'id'
        },
        onDelete: 'SET NULL'
    },
    deviceId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'iot_devices',
            key: 'id'
        },
        onDelete: 'SET NULL'
    },
    scheduledTime: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
    },
    durationMinutes: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        validate: {
            min: 1
        }
    },
    waterVolumeLiters: {
        type: sequelize_1.DataTypes.DECIMAL(10, 2),
        allowNull: true,
    },
    status: {
        type: sequelize_1.DataTypes.ENUM('pending', 'scheduled', 'in_progress', 'completed', 'failed', 'cancelled'),
        defaultValue: 'pending',
    },
    triggeredBy: {
        type: sequelize_1.DataTypes.ENUM('manual', 'auto', 'schedule', 'sensor'),
        allowNull: false,
    },
    executedAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
    },
    completedAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
    },
    actualVolumeLiters: {
        type: sequelize_1.DataTypes.DECIMAL(10, 2),
        allowNull: true,
    },
    notes: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: true,
    },
    weatherCondition: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'Weather data at time of scheduling'
    }
}, {
    sequelize: database_1.sequelize,
    tableName: 'irrigation_schedules',
    modelName: 'IrrigationSchedule',
    underscored: true,
    indexes: [
        {
            fields: ['farm_id']
        },
        {
            fields: ['crop_id']
        },
        {
            fields: ['status']
        },
        {
            fields: ['scheduled_time']
        }
    ]
});
exports.default = IrrigationSchedule;
//# sourceMappingURL=IrrigationSchedule.model.js.map