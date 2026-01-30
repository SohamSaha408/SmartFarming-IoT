
const { Sequelize, DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';
const dbUrl = process.env.DATABASE_URL;

const sequelize = dbUrl
    ? new Sequelize(dbUrl, {
        dialect: 'postgres',
        logging: false,
    })
    : new Sequelize(
        process.env.DB_NAME || 'smart_agri',
        process.env.DB_USER || 'postgres',
        process.env.DB_PASSWORD || 'password',
        {
            host: process.env.DB_HOST || 'postgres',
            port: parseInt(process.env.DB_PORT || '5432'),
            dialect: 'postgres',
            logging: false,
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
    isVerified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
}, {
    tableName: 'farmers',
    timestamps: true
});

async function checkUser() {
    try {
        await sequelize.authenticate();
        console.log('Connected to database.');

        const email = 'admin@smartagri.com';
        const passwordToTest = 'admin123';

        const farmer = await Farmer.findOne({ where: { email } });

        if (!farmer) {
            console.error('❌ User not found with email:', email);

            // List all users to see what's there
            const allFarmers = await Farmer.findAll();
            console.log('Total farmers found:', allFarmers.length);
            allFarmers.forEach(f => console.log(`- ${f.phone} | ${f.email}`));

        } else {
            console.log('✅ User found:', farmer.email);
            console.log('   Phone:', farmer.phone);
            console.log('   Hash:', farmer.password);

            const isMatch = await bcrypt.compare(passwordToTest, farmer.password);
            console.log(`   Password '${passwordToTest}' match? ${isMatch ? 'YES ✅' : 'NO ❌'}`);
        }

    } catch (error) {
        console.error('Check failed:', error);
    } finally {
        process.exit();
    }
}

checkUser();
