import { Model, DataTypes, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export type IrrigationStatus = 'pending' | 'scheduled' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
export type IrrigationTrigger = 'manual' | 'auto' | 'schedule' | 'sensor';

interface IrrigationScheduleAttributes {
  id: string;
  farmId: string;
  cropId: string | null;
  deviceId: string | null;
  scheduledTime: Date;
  durationMinutes: number;
  waterVolumeLiters: number | null;
  status: IrrigationStatus;
  triggeredBy: IrrigationTrigger;
  executedAt: Date | null;
  completedAt: Date | null;
  actualVolumeLiters: number | null;
  notes: string | null;
  weatherCondition: object | null;
  createdAt?: Date;
  updatedAt?: Date;
}

interface IrrigationScheduleCreationAttributes extends Optional<IrrigationScheduleAttributes, 'id' | 'cropId' | 'deviceId' | 'waterVolumeLiters' | 'status' | 'executedAt' | 'completedAt' | 'actualVolumeLiters' | 'notes' | 'weatherCondition'> { }

class IrrigationSchedule extends Model<IrrigationScheduleAttributes, IrrigationScheduleCreationAttributes> implements IrrigationScheduleAttributes {
  public id!: string;
  public farmId!: string;
  public cropId!: string | null;
  public deviceId!: string | null;
  public scheduledTime!: Date;
  public durationMinutes!: number;
  public waterVolumeLiters!: number | null;
  public status!: IrrigationStatus;
  public triggeredBy!: IrrigationTrigger;
  public executedAt!: Date | null;
  public completedAt!: Date | null;
  public actualVolumeLiters!: number | null;
  public notes!: string | null;
  public weatherCondition!: object | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

IrrigationSchedule.init(
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
    cropId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'crops',
        key: 'id'
      },
      onDelete: 'SET NULL'
    },
    deviceId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'iot_devices',
        key: 'id'
      },
      onDelete: 'SET NULL'
    },
    scheduledTime: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    durationMinutes: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1
      }
    },
    waterVolumeLiters: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('pending', 'scheduled', 'in_progress', 'completed', 'failed', 'cancelled'),
      defaultValue: 'pending',
    },
    triggeredBy: {
      type: DataTypes.ENUM('manual', 'auto', 'schedule', 'sensor'),
      allowNull: false,
    },
    executedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    actualVolumeLiters: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    weatherCondition: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Weather data at time of scheduling'
    }
  },
  {
    sequelize,
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
  }
);

export default IrrigationSchedule;
