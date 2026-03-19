import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Store from '../models/Store.js';
import Plan from '../models/Plan.js';

dotenv.config();

async function fixStorePlans() {
    try {
        await mongoose.connect(process.env.MONGODB_URI!);
        console.log('Connected to MongoDB');

        const freePlan = await Plan.findOne({ name: 'Free', isActive: true });
        if (!freePlan) {
            console.error('Free plan not found. Run seedPlans.ts first.');
            process.exit(1);
        }
        console.log('Free plan ID:', freePlan._id);

        const result = await Store.updateMany(
            { subscriptionPlan: { $exists: false } },
            { $set: { subscriptionPlan: freePlan._id } }
        );
        const result2 = await Store.updateMany(
            { subscriptionPlan: null },
            { $set: { subscriptionPlan: freePlan._id } }
        );

        console.log(`Updated ${result.modifiedCount + result2.modifiedCount} stores with Free plan.`);
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

fixStorePlans();
