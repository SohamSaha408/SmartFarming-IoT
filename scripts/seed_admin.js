
const { Sequelize, DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';
const dbUrl = process.env.DATABASE_URL;

const dialectOptions = isProduction && process.env.DB_SSL !== 'false'
    ? { ssl: { require: true, rejectUnauthorized: false } }
    : undefined;

const sequelize = dbUrl
    ? new Sequelize(dbUrl, {
        dialect: 'postgres',
        logging: false,
        dialectOptions,
        define: {
            underscored: true
        }
    })
    : new Sequelize(
        process.env.DB_NAME || 'smart_agri',
        process.env.DB_USER || 'postgres',
        process.env.DB_PASSWORD || 'smartagri123',
        {
            host: process.env.DB_HOST || 'postgres',
            port: parseInt(process.env.DB_PORT || '5432'),
            dialect: 'postgres',
            logging: false,
            dialectOptions,
            define: {
                underscored: true
            }
        }
    );

const Farmer = sequelize.define('Farmer', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
    },
    phone: {
        type: DataTypes.STRING(15),
        allowNull: false,
        unique: true,
    },
    password: {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
    name: {
        type: DataTypes.STRING(100),
        allowNull: true,
    },
    email: {
        type: DataTypes.STRING(255),
        allowNull: true,
    },
    address: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    profileImage: {
        type: DataTypes.STRING(500),
        allowNull: true,
    },
    isVerified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    lastLoginAt: {
        type: DataTypes.DATE,
        allowNull: true,
    }
}, {
    tableName: 'farmers',
    timestamps: true
});

async function seedAdmin() {
    try {
        await sequelize.authenticate();
        console.log('Connected to database.');
        // FORCE sync to recreate table with correct underscored columns
        await Farmer.sync({ force: true });
        console.log('Farmers table synced (force created).');


        const email = 'admin@smartagri.com';
        const password = 'admin123';
        const phone = '+919999999999'; // Dummy phone for admin

        const hashedPassword = await bcrypt.hash(password, 10);

        const match = await Farmer.findOne({ where: { email } });

        if (match) {
            console.log('Admin already exists. Updating password...');
            await match.update({ password: hashedPassword, isVerified: true });
            console.log('Admin updated.');
        } else {
            console.log('Creating admin user...');
            await Farmer.create({
                email,
                phone,
                password: hashedPassword,
                name: 'Admin User',
                isVerified: true
            });
            console.log('Admin user created successfully.');
        }

        process.exit(0);
    } catch (error) {
        console.error('Seeding failed:', error);
        process.exit(1);
    }
}

seedAdmin();
