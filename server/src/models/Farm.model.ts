import { Model, DataTypes, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export type LandType = 'alluvial' | 'black' | 'red' | 'laterite' | 'desert' | 'mountain' | 'forest';

interface FarmAttributes {
  id: string;
  farmerId: string;
  name: string;
  latitude: number;
  longitude: number;
  boundary: object | null; // GeoJSON polygon
  areaHectares: number | null;
  landType: LandType | null;
  soilPh: number | null;
  district: string | null;
  state: string | null;
  village: string | null;
  pincode: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

interface FarmCreationAttributes extends Optional<FarmAttributes, 'id' | 'boundary' | 'areaHectares' | 'landType' | 'soilPh' | 'district' | 'state' | 'village' | 'pincode'> { }

class Farm extends Model<FarmAttributes, FarmCreationAttributes> implements FarmAttributes {
  public id!: string;
  public farmerId!: string;
  public name!: string;
  public latitude!: number;
  public longitude!: number;
  public boundary!: object | null;
  public areaHectares!: number | null;
  public landType!: LandType | null;
  public soilPh!: number | null;
  public district!: string | null;
  public state!: string | null;
  public village!: string | null;
  public pincode!: string | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Farm.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    farmerId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'farmers',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    latitude: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: false,
      validate: {
        min: -90,
        max: 90
      }
    },
    longitude: {
      type: DataTypes.DECIMAL(11, 8),
      allowNull: false,
      validate: {
        min: -180,
        max: 180
      }
    },
    boundary: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'GeoJSON Polygon representing farm boundary'
    },
    areaHectares: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    landType: {
      type: DataTypes.ENUM('alluvial', 'black', 'red', 'laterite', 'desert', 'mountain', 'forest'),
      allowNull: true,
    },
    soilPh: {
      type: DataTypes.DECIMAL(3, 1),
      allowNull: true,
      validate: {
        min: 0,
        max: 14
      }
    },
    district: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    state: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    village: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    pincode: {
      type: DataTypes.STRING(10),
      allowNull: true,
    }
  },
  {
    sequelize,
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
  }
);

export default Farm;
