"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.testConnection = exports.sequelize = void 0;
const sequelize_1 = require("sequelize");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const isProduction = process.env.NODE_ENV === 'production';
const dbUrl = process.env.DATABASE_URL;
const isRemoteDb = process.env.DATABASE_URL?.includes('neon.tech');
const useSsl = isProduction || isRemoteDb || process.env.DB_SSL === 'true';
const dialectOptions = useSsl
    ? {
        ssl: {
            require: true,
            rejectUnauthorized: false,
        },
    }
    : undefined;
exports.sequelize = dbUrl
    ? new sequelize_1.Sequelize(dbUrl, {
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
    : new sequelize_1.Sequelize(process.env.DB_NAME || 'smart_agri', process.env.DB_USER || 'postgres', process.env.DB_PASSWORD || 'password', {
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
    });
const testConnection = async () => {
    try {
        await exports.sequelize.authenticate();
        console.log('Database connection has been established successfully.');
        return true;
    }
    catch (error) {
        console.error('Unable to connect to the database:', error);
        return false;
    }
};
exports.testConnection = testConnection;
//# sourceMappingURL=database.js.map