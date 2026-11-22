import crypto from "crypto";
import type { NextRequest } from "next/server";
import { getRedis } from "./redis";
import type { QuotaInfo } from "./types";

export const DAILY_SUBTITLE_LIMIT = 3;
export const MAX_CHUNKS_PER_SESSION = 100; // Up to 4,000 blocks per file (~3.5h movie)
const SESSION_TTL_SECONDS = 2 * 60 * 60; // 2 hours
const DEFAULT_GLOBAL_DAILY_LIMIT = 150;

interface MemorySession {
  ip: string;
  chunksUsed: number;
  successfulChunks: number;
  counted: boolean;
  expiresAt: number;
}

type RedisSessionHash = {
  ip: string;
  chunksUsed: number;
  successfulChunks: number;
  counted: number;
};

const globalForQuota = globalThis as unknown as {
  __dailyQuotaMap?: Map<string, number>;
  __sessionMap?: Map<string, MemorySession>;
};

const dailyQuotaMap = (globalForQuota.__dailyQuotaMap ??= new Map<string, number>());
const sessionMap = (globalForQuota.__sessionMap ??= new Map<string, MemorySession>());

function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

function getSecondsUntilEndOfUtcDay(): number {
  const now = new Date();
  const tomorrow = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0,
    0,
    0
  );
  return Math.max(60, Math.ceil((tomorrow - now.getTime()) / 1000));
}

function isUnlimitedLocalDev(): boolean {
  return (
    process.env.NODE_ENV === "development" &&
    process.env.ENFORCE_QUOTA_IN_DEV !== "true"
  );
}

function getGlobalDailyLimit(): number {
  const parsed = Number(process.env.GLOBAL_DAILY_SUBTITLE_LIMIT);
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.floor(parsed);
  }
  return DEFAULT_GLOBAL_DAILY_LIMIT;
}

function getSigningSecret(): string {
  return (
    process.env.SESSION_SECRET?.trim() ||
    process.env.GEMINI_API_KEY?.trim() ||
    "local-dev-ephemeral-secret"
  );
}

function hashIp(ip: string): string {
  return crypto
    .createHmac("sha256", getSigningSecret())
    .update(ip)
    .digest("hex")
    .slice(0, 16);
}

function signSessionToken(uuid: string, ipHash: string, expSec: number): string {
  const payload = `${uuid}.${expSec}`;
  const sig = crypto
    .createHmac("sha256", getSigningSecret())
    .update(`${payload}.${ipHash}`)
    .digest("hex")
    .slice(0, 24);
  return `${payload}.${sig}`;
}

function verifySessionToken(
  token: string,
  ipHash: string
): { valid: boolean; uuid?: string; expired?: boolean } {
  const parts = token.split(".");
  if (parts.length !== 3) return { valid: false };

  const [uuid, expStr, sig] = parts;
  const expSec = Number(expStr);
  if (!uuid || !Number.isFinite(expSec) || !sig) {
    return { valid: false };
  }

  const expectedToken = signSessionToken(uuid, ipHash, expSec);
  const expectedSig = expectedToken.split(".")[2];

  const sigBuf = Buffer.from(sig, "utf8");
  const expectedBuf = Buffer.from(expectedSig, "utf8");
  if (
    sigBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(sigBuf, expectedBuf)
  ) {
    return { valid: false };
  }

  if (Math.floor(Date.now() / 1000) > expSec) {
    return { valid: false, expired: true };
  }

  return { valid: true, uuid };
}

function sweepMemoryMaps(): void {
  const now = Date.now();
  const todayPrefix = `quota:subtitles:${getTodayKey()}:`;

  if (sessionMap.size > 200) {
    for (const [key, session] of sessionMap.entries()) {
      if (now > session.expiresAt) {
        sessionMap.delete(key);
      }
    }
  }

  if (dailyQuotaMap.size > 200) {
    for (const key of dailyQuotaMap.keys()) {
      if (!key.startsWith(todayPrefix)) {
        dailyQuotaMap.delete(key);
      }
    }
  }
}

/**
 * Extracts client IP prioritizing trusted Vercel edge headers to reduce X-Forwarded-For spoofing.
 */
export function extractClientIp(request: NextRequest): string {
  const vercelForwarded = request.headers.get("x-vercel-forwarded-for");
  if (vercelForwarded) {
    const first = vercelForwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length > 0) {
      return parts[0];
    }
  }

  return "127.0.0.1";
}

/**
 * Blocks cross-origin API abuse in production while allowing same-origin requests.
 */
export function isOriginAllowed(request: NextRequest): boolean {
  if (process.env.NODE_ENV !== "production") {
    return true;
  }

  const origin = request.headers.get("origin");
  const host =
    request.headers.get("x-forwarded-host") || request.headers.get("host");

  if (!origin) {
    // Allow non-browser or same-origin requests where Origin is omitted, unless explicitly cross-site
    const fetchSite = request.headers.get("sec-fetch-site");
    if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "same-site" && fetchSite !== "none") {
      return false;
    }
    return true;
  }

  if (!host) return false;

  try {
    const originHost = new URL(origin).host;
    return originHost === host;
  } catch {
    return false;
  }
}

export async function getQuotaForIp(ip: string): Promise<QuotaInfo> {
  if (isUnlimitedLocalDev()) {
    return {
      used: 0,
      limit: DAILY_SUBTITLE_LIMIT,
      remaining: 999,
      source: getRedis() ? "redis" : "memory",
      unlimited: true,
    };
  }

  const redis = getRedis();
  const dayKey = `quota:subtitles:${getTodayKey()}:${hashIp(ip)}`;

  if (redis) {
    const raw = await redis.get<number>(dayKey);
    const used = Number(raw ?? 0);
    return {
      used,
      limit: DAILY_SUBTITLE_LIMIT,
      remaining: Math.max(0, DAILY_SUBTITLE_LIMIT - used),
      source: "redis",
    };
  }

  const used = dailyQuotaMap.get(dayKey) ?? 0;
  return {
    used,
    limit: DAILY_SUBTITLE_LIMIT,
    remaining: Math.max(0, DAILY_SUBTITLE_LIMIT - used),
    source: "memory",
  };
}

export async function startTranslationSession(
  ip: string
): Promise<
  | { allowed: true; sessionId: string; quota: QuotaInfo }
  | { allowed: false; quota: QuotaInfo; reason?: string }
> {
  const redis = getRedis();
  const ipHash = hashIp(ip);
  const today = getTodayKey();
  const dayKey = `quota:subtitles:${today}:${ipHash}`;
  const globalDayKey = `quota:global:${today}`;
  const globalLimit = getGlobalDailyLimit();

  const uuid = crypto.randomUUID();
  const expSec = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const sessionId = signSessionToken(uuid, ipHash, expSec);

  // Unlimited in local development (`npm run dev`), strictly enforced in production & tests
  if (isUnlimitedLocalDev()) {
    sweepMemoryMaps();
    if (redis) {
      const sessionKey = `session:translate:${uuid}`;
      await redis.hset(sessionKey, {
        ip: ipHash,
        chunksUsed: 0,
        successfulChunks: 0,
        counted: 0,
      });
      await redis.expire(sessionKey, SESSION_TTL_SECONDS);
    } else {
      sessionMap.set(uuid, {
        ip: ipHash,
        chunksUsed: 0,
        successfulChunks: 0,
        counted: false,
        expiresAt: expSec * 1000,
      });
    }

    return {
      allowed: true,
      sessionId,
      quota: {
        used: 0,
        limit: DAILY_SUBTITLE_LIMIT,
        remaining: 999,
        source: redis ? "redis" : "memory",
        unlimited: true,
      },
    };
  }

  if (redis) {
    const ttl = getSecondsUntilEndOfUtcDay();

    // Check global daily emergency cap first
    const globalCurrent = Number((await redis.get<number>(globalDayKey)) ?? 0);
    if (globalCurrent >= globalLimit) {
      const quota = await getQuotaForIp(ip);
      return {
        allowed: false,
        quota,
        reason:
          "A plataforma atingiu o limite diário global de traduções gratuitas. Tente novamente amanhã.",
      };
    }

    const current = Number((await redis.get<number>(dayKey)) ?? 0);
    if (current >= DAILY_SUBTITLE_LIMIT) {
      return {
        allowed: false,
        quota: {
          used: current,
          limit: DAILY_SUBTITLE_LIMIT,
          remaining: 0,
          source: "redis",
        },
      };
    }

    const newCount = await redis.incr(dayKey);
    if (newCount === 1) {
      await redis.expire(dayKey, ttl);
    }

    if (newCount > DAILY_SUBTITLE_LIMIT) {
      await redis.decr(dayKey);
      return {
        allowed: false,
        quota: {
          used: DAILY_SUBTITLE_LIMIT,
          limit: DAILY_SUBTITLE_LIMIT,
          remaining: 0,
          source: "redis",
        },
      };
    }

    const newGlobal = await redis.incr(globalDayKey);
    if (newGlobal === 1) {
      await redis.expire(globalDayKey, ttl);
    }

    const sessionKey = `session:translate:${uuid}`;
    await redis.hset(sessionKey, {
      ip: ipHash,
      chunksUsed: 0,
      successfulChunks: 0,
      counted: 0,
    });
    await redis.expire(sessionKey, SESSION_TTL_SECONDS);

    return {
      allowed: true,
      sessionId,
      quota: {
        used: newCount,
        limit: DAILY_SUBTITLE_LIMIT,
        remaining: Math.max(0, DAILY_SUBTITLE_LIMIT - newCount),
        source: "redis",
      },
    };
  }

  // In-memory fallback
  sweepMemoryMaps();
  const current = dailyQuotaMap.get(dayKey) ?? 0;
  if (current >= DAILY_SUBTITLE_LIMIT) {
    return {
      allowed: false,
      quota: {
        used: current,
        limit: DAILY_SUBTITLE_LIMIT,
        remaining: 0,
        source: "memory",
      },
    };
  }

  const newCount = current + 1;
  dailyQuotaMap.set(dayKey, newCount);
  sessionMap.set(uuid, {
    ip: ipHash,
    chunksUsed: 0,
    successfulChunks: 0,
    counted: false,
    expiresAt: expSec * 1000,
  });

  return {
    allowed: true,
    sessionId,
    quota: {
      used: newCount,
      limit: DAILY_SUBTITLE_LIMIT,
      remaining: Math.max(0, DAILY_SUBTITLE_LIMIT - newCount),
      source: "memory",
    },
  };
}

export async function validateTranslationSession(
  sessionId: string,
  ip: string
): Promise<{ valid: boolean; reason?: string }> {
  const ipHash = hashIp(ip);
  const tokenCheck = verifySessionToken(sessionId, ipHash);

  if (!tokenCheck.valid || !tokenCheck.uuid) {
    return {
      valid: false,
      reason: tokenCheck.expired
        ? "Sessão de tradução expirada."
        : "Sessão de tradução inválida ou não autorizada.",
    };
  }

  const uuid = tokenCheck.uuid;
  const redis = getRedis();

  if (redis) {
    const sessionKey = `session:translate:${uuid}`;
    const session = await redis.hgetall<RedisSessionHash>(sessionKey);
    if (!session || !session.ip) {
      return { valid: false, reason: "Sessão de tradução expirada ou encerrada." };
    }
    if (session.ip !== ipHash) {
      return { valid: false, reason: "Sessão não pertence ao endereço de origem." };
    }

    // Atomic increment prevents race conditions with 3 concurrent workers
    const updatedChunks = await redis.hincrby(sessionKey, "chunksUsed", 1);
    if (updatedChunks > MAX_CHUNKS_PER_SESSION) {
      return {
        valid: false,
        reason: "Limite máximo de lotes excedido para esta legenda.",
      };
    }

    return { valid: true };
  }

  const session = sessionMap.get(uuid);
  if (!session) {
    // Signature + IP + expiration were already verified via HMAC-SHA256 above
    // Recreate local tracking entry after a serverless cold start
    sessionMap.set(uuid, {
      ip: ipHash,
      chunksUsed: 1,
      successfulChunks: 0,
      counted: false,
      expiresAt: Date.now() + SESSION_TTL_SECONDS * 1000,
    });
    return { valid: true };
  }

  if (Date.now() > session.expiresAt) {
    sessionMap.delete(uuid);
    return { valid: false, reason: "Sessão de tradução expirada." };
  }

  if (session.chunksUsed >= MAX_CHUNKS_PER_SESSION) {
    return {
      valid: false,
      reason: "Limite máximo de lotes excedido para esta legenda.",
    };
  }

  session.chunksUsed += 1;
  return { valid: true };
}

export async function markSessionChunkSuccess(
  sessionId: string,
  ip: string
): Promise<void> {
  const ipHash = hashIp(ip);
  const tokenCheck = verifySessionToken(sessionId, ipHash);
  if (!tokenCheck.valid || !tokenCheck.uuid) return;

  const uuid = tokenCheck.uuid;
  const redis = getRedis();

  if (redis) {
    const sessionKey = `session:translate:${uuid}`;
    await redis.hincrby(sessionKey, "successfulChunks", 1);
    return;
  }

  const session = sessionMap.get(uuid);
  if (session) {
    session.successfulChunks += 1;
  }
}

/**
 * Only refunds quota when 0 chunks succeeded, preventing infinite-translation refund abuse.
 */
export async function refundTranslationSession(
  sessionId: string,
  ip: string
): Promise<{ refunded: boolean; quota: QuotaInfo }> {
  const ipHash = hashIp(ip);
  const tokenCheck = verifySessionToken(sessionId, ipHash);
  if (!tokenCheck.valid || !tokenCheck.uuid) {
    return { refunded: false, quota: await getQuotaForIp(ip) };
  }

  const uuid = tokenCheck.uuid;
  const today = getTodayKey();
  const dayKey = `quota:subtitles:${today}:${ipHash}`;
  const globalDayKey = `quota:global:${today}`;
  const redis = getRedis();

  if (redis) {
    const sessionKey = `session:translate:${uuid}`;
    const session = await redis.hgetall<RedisSessionHash>(sessionKey);

    if (
      session &&
      session.ip === ipHash &&
      Number(session.successfulChunks ?? 0) === 0
    ) {
      // Atomic delete ensures concurrent refund requests cannot double-decrement
      const deleted = await redis.del(sessionKey);
      if (deleted === 1) {
        const current = Number((await redis.get<number>(dayKey)) ?? 0);
        if (current > 0) {
          await redis.decr(dayKey);
        }
        const globalCurrent = Number((await redis.get<number>(globalDayKey)) ?? 0);
        if (globalCurrent > 0) {
          await redis.decr(globalDayKey);
        }
        return { refunded: true, quota: await getQuotaForIp(ip) };
      }
    }
    return { refunded: false, quota: await getQuotaForIp(ip) };
  }

  const session = sessionMap.get(uuid);
  if (session && session.ip === ipHash && session.successfulChunks === 0) {
    sessionMap.delete(uuid);
    const current = dailyQuotaMap.get(dayKey) ?? 0;
    if (current > 0) {
      dailyQuotaMap.set(dayKey, current - 1);
    }
    return { refunded: true, quota: await getQuotaForIp(ip) };
  }

  return { refunded: false, quota: await getQuotaForIp(ip) };
}

/**
 * Atomically claims a one-time stats increment for a completed session.
 */
export async function claimStatsIncrement(
  sessionId: string,
  ip: string
): Promise<boolean> {
  const ipHash = hashIp(ip);
  const tokenCheck = verifySessionToken(sessionId, ipHash);
  if (!tokenCheck.valid || !tokenCheck.uuid) return false;

  const uuid = tokenCheck.uuid;
  const redis = getRedis();

  if (redis) {
    const sessionKey = `session:translate:${uuid}`;
    const session = await redis.hgetall<RedisSessionHash>(sessionKey);
    if (!session || session.ip !== ipHash) return false;
    if (Number(session.successfulChunks ?? 0) <= 0) return false;

    const countClaim = await redis.hincrby(sessionKey, "counted", 1);
    return countClaim === 1;
  }

  const session = sessionMap.get(uuid);
  if (!session || session.ip !== ipHash) return false;
  if (session.successfulChunks <= 0 || session.counted) return false;

  session.counted = true;
  return true;
}
