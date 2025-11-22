import Redis from 'ioredis';

let redis: Redis | null = null;

export function getRedis(): Redis | null {
  if (redis) return redis;
  const url = process.env.REDIS_URL;
  if (!url) return null;
  try {
    redis = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
      enableReadyCheck: false,
    });
    // Attempt connect but don't throw hard if fails
    redis.connect().catch(err => {
      console.warn('[redis] connect failed, falling back to in-memory', err?.message);
    });
    return redis;
  } catch (e: any) {
    console.warn('[redis] init error', e?.message);
    return null;
  }
}

export async function redisGetJSON<T>(key: string): Promise<T | null> {
  const r = getRedis();
  if (!r) return null;
  try {
    const val = await r.get(key);
    if (!val) return null;
    return JSON.parse(val) as T;
  } catch {
    return null;
  }
}

export async function redisSetJSON(key: string, value: any, ttlSeconds: number): Promise<void> {
  const r = getRedis();
  if (!r) return;
  try {
    await r.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch {}
}
