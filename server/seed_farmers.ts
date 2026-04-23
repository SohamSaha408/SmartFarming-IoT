
import dotenv from 'dotenv';
// Load from root .env which we fixed
dotenv.config();

import { Farmer } from './src/models';
import { sequelize } from './src/config/database';
import bcrypt from 'bcryptjs';

async function seedAdmin() {
    try {
        console.log('Connecting to database...');
        await sequelize.authenticate();
        console.log('Connected!');

        const adminPhone = '+919876543210';
        const adminEmail = 'admin@smartagri.com';
        const password = 'admin123';

        console.log('Checking for existing admin...');
        const existingFarmer = await Farmer.findOne({
            where: sequelize.or(
                { phone: adminPhone },
                { email: adminEmail }
            )
        });

        if (existingFarmer) {
            console.log('Admin user already exists:', existingFarmer.toJSON());
            // Optional: Update password
            const hashedPassword = await bcrypt.hash(password, 10);
            await existingFarmer.update({ password: hashedPassword, isVerified: true });
            console.log('Updated admin password to: admin123');
        } else {
            console.log('Creating admin user...');
            const hashedPassword = await bcrypt.hash(password, 10);
            const newFarmer = await Farmer.create({
                phone: adminPhone,
                email: adminEmail,
                password: hashedPassword,
                name: 'Admin Farmer',
                isVerified: true
            });
            console.log('Admin user created successfully:', newFarmer.toJSON());
        }

    } catch (error) {
        console.error('Error seeding admin:', error);
    } finally {
        await sequelize.close();
    }
}

seedAdmin();
