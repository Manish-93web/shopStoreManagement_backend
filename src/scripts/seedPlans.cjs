const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const plans = [
    {
        name: 'Free',
        price: 0,
        billingCycle: 'monthly',
        maxUsers: 2,
        maxStores: 1,
        maxProducts: 100,
        features: ['Inventory Management', 'Basic Analytics'],
        isActive: true
    },
    {
        name: 'Basic',
        price: 29,
        billingCycle: 'monthly',
        maxUsers: 5,
        maxStores: 1,
        maxProducts: 500,
        features: ['POS Access', 'Inventory Management', 'Basic Analytics'],
        isActive: true
    },
    {
        name: 'Premium',
        price: 99,
        billingCycle: 'monthly',
        maxUsers: 20,
        maxStores: 5,
        maxProducts: 2000,
        features: ['POS Access', 'Inventory Management', 'Basic Analytics', 'Advanced Finance'],
        isActive: true
    },
    {
        name: 'Enterprise',
        price: 299,
        billingCycle: 'monthly',
        maxUsers: 0, // Unlimited
        maxStores: 0, // Unlimited
        maxProducts: 0, // Unlimited
        features: ['POS Access', 'Inventory Management', 'Basic Analytics', 'Advanced Finance', 'AI Predictions', 'White-labeling'],
        isActive: true
    }
];

// Mock Schema for seeding
const PlanSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    price: { type: Number, required: true },
    billingCycle: { type: String, enum: ['monthly', 'yearly'], default: 'monthly' },
    features: [{ type: String }],
    maxUsers: { type: Number, default: 5 },
    maxStores: { type: Number, default: 1 },
    maxProducts: { type: Number, default: 100 },
    isActive: { type: Boolean, default: true },
}, { timestamps: true });

const Plan = mongoose.models.Plan || mongoose.model('Plan', PlanSchema);

async function seedPlans() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        for (const planData of plans) {
            await Plan.findOneAndUpdate(
                { name: planData.name },
                planData,
                { upsert: true, new: true }
            );
            console.log(`Plan seeded: ${planData.name}`);
        }

        console.log('All plans seeded successfully');
        process.exit(0);
    } catch (error) {
        console.error('Error seeding plans:', error);
        process.exit(1);
    }
}

seedPlans();
