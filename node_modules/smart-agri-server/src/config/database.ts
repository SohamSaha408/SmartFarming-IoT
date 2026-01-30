import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';
const dbUrl = process.env.DATABASE_URL;

const dialectOptions = isProduction && process.env.DB_SSL !== 'false'
  ? {
    ssl: {
      require: true,
      rejectUnauthorized: false,
    },
  }
  : undefined;

export const sequelize = dbUrl
  ? new Sequelize(dbUrl, {
    dialect: 'postgres',
    logging: isProduction ? false : console.log,
    dialectOptions,
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    define: {
      timestamps: true,
      underscored: true,
    }
  })
  : new Sequelize(
    process.env.DB_NAME || 'smart_agri',
    process.env.DB_USER || 'postgres',
    process.env.DB_PASSWORD || 'password',
    {
      host: process.env.DB_HOST || 'postgres', // Default to docker service name if not set
      port: parseInt(process.env.DB_PORT || '5432'),
      dialect: 'postgres',
      logging: isProduction ? false : console.log,
      dialectOptions,
      pool: {
        max: 10,
        min: 0,
        acquire: 30000,
        idle: 10000
      },
      define: {
        timestamps: true,
        underscored: true,
      }
    }
  );

export const testConnection = async (): Promise<boolean> => {
  try {
    await sequelize.authenticate();
    console.log('Database connection has been established successfully.');
    return true;
  } catch (error) {
    console.error('Unable to connect to the database:', error);
    return false;
  }
};
