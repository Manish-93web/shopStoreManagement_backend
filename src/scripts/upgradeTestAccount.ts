import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Store from '../models/Store.js';
import Plan from '../models/Plan.js';

dotenv.config();

async function upgradeTestAccount() {
    try {
        await mongoose.connect(process.env.MONGODB_URI!);
        console.log('Connected to MongoDB');

        // Find the Enterprise plan
        const enterprisePlan = await Plan.findOne({ name: 'Enterprise', isActive: true });
        if (!enterprisePlan) {
            console.error('Enterprise plan not found. Run seedPlans.ts first.');
            process.exit(1);
        }
        console.log('Enterprise plan found:', enterprisePlan._id);

        // Find the user
        const user = await User.findOne({ email: 'test@gmail.com' });
        if (!user) {
            console.error('User test@gmail.com not found.');
            process.exit(1);
        }
        console.log('User found:', user.name, '| Role:', user.role);

        // Update all stores owned by this user
        const result = await Store.updateMany(
            { owner: user._id },
            {
                $set: {
                    subscriptionPlan: enterprisePlan._id,
                    subscriptionStatus: 'Active',
                    // Grant all known features explicitly too
                    featuresEnabled: [
                        'POS Access',
                        'Inventory Management',
                        'Basic Analytics',
                        'Advanced Finance',
                        'AI Predictions',
                        'White-labeling'
                    ]
                }
            }
        );

        console.log(`\n✅ Updated ${result.modifiedCount} store(s) for test@gmail.com`);
        console.log('   Plan: Enterprise');
        console.log('   Status: Active');
        console.log('   All features enabled!');
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

upgradeTestAccount();
