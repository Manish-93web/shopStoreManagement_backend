const mongoose = require('mongoose');
require('dotenv').config();

async function listUsers() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const User = mongoose.model('User', new mongoose.Schema({ email: String, storeId: mongoose.Schema.Types.ObjectId, role: String, createdAt: Date }));
        const users = await User.find().sort({ createdAt: -1 });
        console.log(`--- FOUND ${users.length} USERS ---`);
        users.forEach(u => {
            console.log(`EMAIL: ${u.email} | ROLE: ${u.role} | ID: ${u._id}`);
        });
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

listUsers();
