const mongoose = require('mongoose');
require('dotenv').config();

async function checkUserStores() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const User = mongoose.model('User', new mongoose.Schema({ email: String, storeId: mongoose.Schema.Types.ObjectId, stores: [mongoose.Schema.Types.ObjectId], role: String }));
        const users = await User.find({ role: 'STORE_OWNER' });
        console.log(`--- FOUND ${users.length} OWNERS ---`);
        users.forEach(u => {
            console.log(`EMAIL: ${u.email} | ID: ${u._id} | storeId: ${u.storeId} | stores: ${u.stores}`);
        });
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

checkUserStores();
