
const { Sequelize, DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const sequelize = new Sequelize(
    process.env.DB_NAME || 'smart_agri',
    process.env.DB_USER || 'postgres',
    process.env.DB_PASSWORD || 'smartagri123',
    {
        host: process.env.DB_HOST || 'postgres',
        port: parseInt(process.env.DB_PORT || '5432'),
        dialect: 'postgres',
        logging: false,
    }
);

const Farmer = sequelize.define('Farmer', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    phone: { type: DataTypes.STRING(15), allowNull: false, unique: true },
    password: { type: DataTypes.STRING(255), allowNull: false },
    name: { type: DataTypes.STRING(100), allowNull: true },
    email: { type: DataTypes.STRING(255), allowNull: true },
    // Add all fields to match DB to avoid errors
    address: { type: DataTypes.TEXT, allowNull: true },
    profileImage: { type: DataTypes.STRING(500), allowNull: true },
    isVerified: { type: DataTypes.BOOLEAN, defaultValue: false },
    lastLoginAt: { type: DataTypes.DATE, allowNull: true }
}, {
    tableName: 'farmers',
    timestamps: true
});

async function debugAuth() {
    try {
        await sequelize.authenticate();
        console.log('DB Connected.');

        const identifier = 'admin@smartagri.com';
        const password = 'admin123';

        console.log(`Testing login for: '${identifier}' with password '${password}'`);

        let farmer;
        const trimmedIdentifier = identifier.trim();

        if (trimmedIdentifier.includes('@')) {
            console.log('Identifier detected as EMAIL.');
            farmer = await Farmer.findOne({ where: { email: trimmedIdentifier } });
        } else {
            console.log('Identifier detected as PHONE.');
            farmer = await Farmer.findOne({ where: { phone: trimmedIdentifier } });
        }

        if (!farmer) {
            console.error('❌ User NOT FOUND for identifier:', trimmedIdentifier);
            process.exit(1);
        }

        console.log('✅ User FOUND in DB.');
        console.log('Stored Hash:', farmer.password);

        const isValid = await bcrypt.compare(password, farmer.password);
        console.log(`Bcrypt Comparison Result: ${isValid} ${isValid ? '✅' : '❌'}`);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit();
    }
}

debugAuth();
