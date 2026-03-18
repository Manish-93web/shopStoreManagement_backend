const mongoose = require('mongoose');
require('dotenv').config();

async function checkSettings() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const Settings = mongoose.model('Settings', new mongoose.Schema({ storeId: mongoose.Schema.Types.ObjectId }, { strict: false }));
        const settings = await Settings.find();
        console.log(`--- FOUND ${settings.length} SETTINGS ---`);
        settings.forEach(s => {
            console.log(JSON.stringify(s, null, 2));
        });
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

checkSettings();
