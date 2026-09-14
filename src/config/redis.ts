import { createClient } from 'redis';

const redisClient = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
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
    } catch (error) {
        console.error('Redis connection failed. Performance might be affected.');
    }
};

// Per-store, per-resource cache "generation" — bump it once on any write instead
// of scanning/deleting every cached key variant (KEYS is O(N) and blocks Redis in
// production). Reads embed the current version in their cache key, so bumping the
// version makes every previously-cached read for that store+resource instantly
// stale; the old entries just expire on their own TTL rather than being actively
// deleted. `resource` defaults to 'products' for existing callers — pass e.g.
// 'orders' for a separate namespace so unrelated writes don't cross-invalidate.
export const getCacheVersion = async (storeId: string, resource = 'products'): Promise<string> => {
    if (process.env.SKIP_REDIS === 'true') return '1';
    const v = await redisClient.get(`v:${resource}:${storeId}`);
    return v || '1';
};

export const bumpCacheVersion = async (storeId: string, resource = 'products'): Promise<void> => {
    if (process.env.SKIP_REDIS === 'true') return;
    await redisClient.incr(`v:${resource}:${storeId}`);
};

// Generic fixed-TTL cache-aside helper for read-heavy, expensive-aggregation
// endpoints (analytics/reports) that don't need write-invalidation — a few
// seconds/minutes of staleness on a dashboard chart is an acceptable tradeoff,
// unlike stock counts, which is why this is separate from the version-based
// product cache above.
export const withCache = async <T>(
    key: string,
    ttlSeconds: number,
    fetcher: () => Promise<T>
): Promise<{ value: T; fromCache: boolean }> => {
    if (process.env.SKIP_REDIS !== 'true') {
        const cached = await redisClient.get(key);
        if (cached) return { value: JSON.parse(cached), fromCache: true };
    }
    const value = await fetcher();
    if (process.env.SKIP_REDIS !== 'true') {
        await redisClient.setEx(key, ttlSeconds, JSON.stringify(value));
    }
    return { value, fromCache: false };
};

export default redisClient;
