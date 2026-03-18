import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

async function findStore() {
    try {
        if (!process.env.MONGODB_URI) {
            console.error('MONGODB_URI not found in environment');
            process.exit(1);
        }
        await mongoose.connect(process.env.MONGODB_URI);
        
        // Define minimal schema for discovery
        const StoreSchema = new mongoose.Schema({ 
            name: String, 
            owner: mongoose.Schema.Types.ObjectId 
        }, { strict: false });
        
        const Store = mongoose.models.Store || mongoose.model('Store', StoreSchema);
        
        const store = await Store.findOne().sort({ createdAt: -1 });
        if (store) {
            console.log('STORE_ID:', store._id.toString());
            console.log('OWNER_ID:', store.owner.toString());
            console.log('STORE_NAME:', store.get('name'));
        } else {
            console.log('No store found');
        }
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

findStore();
