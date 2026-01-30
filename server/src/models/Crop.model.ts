import { Model, DataTypes, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export type CropStatus = 'active' | 'harvested' | 'failed' | 'planned';

interface CropAttributes {
  id: string;
  farmId: string;
  cropType: string;
  variety: string | null;
  plantedDate: Date | null;
  expectedHarvestDate: Date | null;
  actualHarvestDate: Date | null;
  status: CropStatus;
  zoneBoundary: object | null;
  areaHectares: number | null;
  expectedYieldKg: number | null;
  actualYieldKg: number | null;
  notes: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

interface CropCreationAttributes extends Optional<CropAttributes, 'id' | 'variety' | 'plantedDate' | 'expectedHarvestDate' | 'actualHarvestDate' | 'status' | 'zoneBoundary' | 'areaHectares' | 'expectedYieldKg' | 'actualYieldKg' | 'notes'> { }

class Crop extends Model<CropAttributes, CropCreationAttributes> implements CropAttributes {
  public id!: string;
  public farmId!: string;
  public cropType!: string;
  public variety!: string | null;
  public plantedDate!: Date | null;
  public expectedHarvestDate!: Date | null;
  public actualHarvestDate!: Date | null;
  public status!: CropStatus;
  public zoneBoundary!: object | null;
  public areaHectares!: number | null;
  public expectedYieldKg!: number | null;
  public actualYieldKg!: number | null;
  public notes!: string | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Crop.init(
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
    cropType: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    variety: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    plantedDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    expectedHarvestDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    actualHarvestDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('active', 'harvested', 'failed', 'planned'),
      defaultValue: 'active',
    },
    zoneBoundary: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'GeoJSON Polygon for crop zone within farm'
    },
    areaHectares: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    expectedYieldKg: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    actualYieldKg: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    }
  },
  {
    sequelize,
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
  }
);

export default Crop;
