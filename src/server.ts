import './config/env.js';
import app from './app.js';
import { initSentry } from './config/sentry.js';
import connectDB from './config/db.js';

import { createServer } from 'http';
import { initSocket } from './config/socket.js';
import { connectRedis } from './config/redis.js';
import './workers/reportWorker.js';

const PORT = process.env.PORT || 5000;
const httpServer = createServer(app);

// Initialize Sentry
initSentry();

// Initialize Socket.io
initSocket(httpServer);

const startServer = async () => {
    try {
        await connectDB();
        await connectRedis();

        httpServer.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();
