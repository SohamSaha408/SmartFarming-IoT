"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
class Farm extends sequelize_1.Model {
}
Farm.init({
    id: {
        type: sequelize_1.DataTypes.UUID,
        defaultValue: sequelize_1.DataTypes.UUIDV4,
        primaryKey: true,
    },
    farmerId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'farmers',
            key: 'id'
        },
        onDelete: 'CASCADE'
    },
    name: {
        type: sequelize_1.DataTypes.STRING(100),
        allowNull: false,
    },
    latitude: {
        type: sequelize_1.DataTypes.DECIMAL(10, 8),
        allowNull: false,
        validate: {
            min: -90,
            max: 90
        }
    },
    longitude: {
        type: sequelize_1.DataTypes.DECIMAL(11, 8),
        allowNull: false,
        validate: {
            min: -180,
            max: 180
        }
    },
    boundary: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'GeoJSON Polygon representing farm boundary'
    },
    areaHectares: {
        type: sequelize_1.DataTypes.DECIMAL(10, 2),
        allowNull: true,
    },
    landType: {
        type: sequelize_1.DataTypes.ENUM('alluvial', 'black', 'red', 'laterite', 'desert', 'mountain', 'forest'),
        allowNull: true,
    },
    soilPh: {
        type: sequelize_1.DataTypes.DECIMAL(3, 1),
        allowNull: true,
        validate: {
            min: 0,
            max: 14
        }
    },
    district: {
        type: sequelize_1.DataTypes.STRING(100),
        allowNull: true,
    },
    state: {
        type: sequelize_1.DataTypes.STRING(100),
        allowNull: true,
    },
    village: {
        type: sequelize_1.DataTypes.STRING(100),
        allowNull: true,
    },
    pincode: {
        type: sequelize_1.DataTypes.STRING(10),
        allowNull: true,
    }
}, {
    sequelize: database_1.sequelize,
    tableName: 'farms',
    modelName: 'Farm',
    underscored: true,
    indexes: [
        {
            fields: ['farmer_id']
        },
        {
            fields: ['land_type']
        }
    ]
});
exports.default = Farm;
//# sourceMappingURL=Farm.model.js.map