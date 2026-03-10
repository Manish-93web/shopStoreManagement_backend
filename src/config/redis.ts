import { createClient } from 'redis';

const redisClient = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('error', (err) => console.log('Redis Client Error', err));

export const connectRedis = async () => {
    try {
        await redisClient.connect();
        console.log('Redis Connected');
    } catch (error) {
        console.error('Redis connection failed:', error);
    }
};

export default redisClient;
