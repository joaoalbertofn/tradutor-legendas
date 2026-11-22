import { Redis } from "@upstash/redis";

let redisClient: Redis | null | undefined;

/**
 * Returns an Upstash Redis client if environment variables are configured,
 * or null so callers can gracefully fall back to localStorage / in-memory storage.
 */
export function getRedis(): Redis | null {
  if (redisClient !== undefined) {
    return redisClient;
  }

  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

  if (!url || !token) {
    redisClient = null;
    return null;
  }

  redisClient = new Redis({ url, token });
  return redisClient;
}
