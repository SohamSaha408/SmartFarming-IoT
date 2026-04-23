import { Model, DataTypes, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface OTPAttributes {
  id: string;
  phone: string;
  otp: string;
  expiresAt: Date;
  isUsed: boolean;
  attempts: number;
  createdAt?: Date;
  updatedAt?: Date;
}

interface OTPCreationAttributes extends Optional<OTPAttributes, 'id' | 'isUsed' | 'attempts'> { }

class OTP extends Model<OTPAttributes, OTPCreationAttributes> implements OTPAttributes {
  public id!: string;
  public phone!: string;
  public otp!: string;
  public expiresAt!: Date;
  public isUsed!: boolean;
  public attempts!: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  public isExpired(): boolean {
    return new Date() > this.expiresAt;
  }

  public isValid(inputOtp: string): boolean {
    return !this.isUsed && !this.isExpired() && this.otp === inputOtp;
  }
}

OTP.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    phone: {
      type: DataTypes.STRING(15),
      allowNull: false,
    },
    otp: {
      type: DataTypes.STRING(10),
      allowNull: false,
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    isUsed: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    attempts: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    }
  },
  {
    sequelize,
    tableName: 'otps',
    modelName: 'OTP',
    indexes: [
      {
        fields: ['phone', 'otp']
      }
    ]
  }
);

export default OTP;
