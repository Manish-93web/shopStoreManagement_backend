import { createClient } from 'redis';
const redisClient = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
});
redisClient.on('error', (err) => console.log('Redis Client Error', err));
export const connectRedis = async () => {
    if (process.env.SKIP_REDIS === 'true') {
        console.log('Redis skipped (SKIP_REDIS=true)');
        return;
    }
    try {
        await redisClient.connect();
        console.log('Redis Connected');
    }
    catch (error) {
        console.error('Redis connection failed. Performance might be affected.');
    }
};
export default redisClient;
