"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
class Crop extends sequelize_1.Model {
}
Crop.init({
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
    cropType: {
        type: sequelize_1.DataTypes.STRING(50),
        allowNull: false,
    },
    variety: {
        type: sequelize_1.DataTypes.STRING(100),
        allowNull: true,
    },
    plantedDate: {
        type: sequelize_1.DataTypes.DATEONLY,
        allowNull: true,
    },
    expectedHarvestDate: {
        type: sequelize_1.DataTypes.DATEONLY,
        allowNull: true,
    },
    actualHarvestDate: {
        type: sequelize_1.DataTypes.DATEONLY,
        allowNull: true,
    },
    status: {
        type: sequelize_1.DataTypes.ENUM('active', 'harvested', 'failed', 'planned'),
        defaultValue: 'active',
    },
    zoneBoundary: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'GeoJSON Polygon for crop zone within farm'
    },
    areaHectares: {
        type: sequelize_1.DataTypes.DECIMAL(10, 2),
        allowNull: true,
    },
    expectedYieldKg: {
        type: sequelize_1.DataTypes.DECIMAL(10, 2),
        allowNull: true,
    },
    actualYieldKg: {
        type: sequelize_1.DataTypes.DECIMAL(10, 2),
        allowNull: true,
    },
    notes: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: true,
    }
}, {
    sequelize: database_1.sequelize,
    tableName: 'crops',
    modelName: 'Crop',
    underscored: true,
    indexes: [
        {
            fields: ['farm_id']
        },
        {
            fields: ['status']
        },
        {
            fields: ['crop_type']
        }
    ]
});
exports.default = Crop;
//# sourceMappingURL=Crop.model.js.map