import { NextRequest, NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";
import {
  claimStatsIncrement,
  extractClientIp,
  getQuotaForIp,
  isOriginAllowed,
} from "@/lib/quota";

const STATS_KEY = "stats:subtitles_translated";

export async function GET(request: NextRequest) {
  try {
    const ip = extractClientIp(request);
    const [redis, quota] = [getRedis(), await getQuotaForIp(ip)];

    if (redis) {
      const total = Number((await redis.get<number>(STATS_KEY)) ?? 0);
      return NextResponse.json({
        totalTranslated: total,
        source: "redis",
        quota,
      });
    }

    return NextResponse.json({
      totalTranslated: 0,
      source: "fallback",
      quota,
    });
  } catch (error) {
    console.error("[GET /api/stats] Error:", error);
    return NextResponse.json(
      {
        totalTranslated: 0,
        source: "fallback",
        quota: { used: 0, limit: 3, remaining: 3, source: "memory" },
      },
      { status: 200 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!isOriginAllowed(request)) {
      return NextResponse.json(
        { error: "Origem não autorizada." },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId obrigatório para contabilizar tradução." },
        { status: 400 }
      );
    }

    const ip = extractClientIp(request);
    const claimed = await claimStatsIncrement(sessionId, ip);
    const redis = getRedis();
    const quota = await getQuotaForIp(ip);

    if (!claimed) {
      const currentTotal = redis
        ? Number((await redis.get<number>(STATS_KEY)) ?? 0)
        : 0;
      return NextResponse.json({
        totalTranslated: currentTotal,
        source: redis ? "redis" : "fallback",
        quota,
      });
    }

    if (redis) {
      const total = await redis.incr(STATS_KEY);
      return NextResponse.json({
        totalTranslated: total,
        source: "redis",
        quota,
      });
    }

    return NextResponse.json({
      totalTranslated: 0,
      source: "fallback",
      quota,
    });
  } catch (error) {
    console.error("[POST /api/stats] Error:", error);
    return NextResponse.json(
      { error: "Falha ao atualizar estatísticas." },
      { status: 500 }
    );
  }
}
