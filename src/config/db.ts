import mongoose from 'mongoose';
import dns from 'dns';

// The local network's DNS resolver can't resolve mongodb+srv SRV records,
// so point Node at public DNS servers that can.
dns.setServers(['8.8.8.8', '1.1.1.1']);

const connectDB = async (): Promise<void> => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI || '');
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error: any) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

export default connectDB;
