import IORedis from 'ioredis';
import { env } from '../lib/env.js';
import { logger } from '../lib/logger.js';

type RedisClient = any;
let client: RedisClient | null = null;

export function getRedis(): RedisClient | null {
  if (client) return client;
  try {
    // ioredis ESM typings can be finicky across versions; treat constructor as any for compatibility.
    const RedisCtor: any = IORedis as any;
    client = new RedisCtor(env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 }) as RedisClient;
    client.on('error', (err: unknown) => logger.warn({ err }, 'redis error'));
    return client;
  } catch (err) {
    logger.warn({ err }, 'redis unavailable');
    return null;
  }
}

