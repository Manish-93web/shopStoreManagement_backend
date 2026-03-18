import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

async function createSuperAdmin() {
    try {
        await mongoose.connect(process.env.MONGODB_URI!);
        console.log('Connected to MongoDB');

        const adminEmail = 'admin@retailsync.com';
        const existingAdmin = await User.findOne({ email: adminEmail });

        if (existingAdmin) {
            console.log('Super Admin already exists:', adminEmail);
            existingAdmin.role = 'SUPER_ADMIN';
            await existingAdmin.save();
            console.log('Ensured role is SUPER_ADMIN');
        } else {
            const admin = await User.create({
                name: 'System Administrator',
                email: adminEmail,
                password: 'admin123',
                role: 'SUPER_ADMIN',
                isActive: true
            });
            console.log('Super Admin created successfully:', adminEmail);
        }
    } catch (err) {
        console.error('Error creating Super Admin:', err);
    } finally {
        await mongoose.disconnect();
    }
}

createSuperAdmin();
