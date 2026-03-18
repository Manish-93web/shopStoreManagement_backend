const mongoose = require('mongoose');
require('dotenv').config();

async function findOwner() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const User = mongoose.model('User', new mongoose.Schema({ email: String, storeId: mongoose.Schema.Types.ObjectId, role: String }));
        const user = await User.findOne({ _id: '67d94cf4b32b492c9bc301ba' });
        if (user) {
            console.log('OWNER_EMAIL:', user.email);
            console.log('OWNER_STORE_ID:', user.storeId?.toString());
        } else {
            console.log('Owner not found');
        }
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

findOwner();
