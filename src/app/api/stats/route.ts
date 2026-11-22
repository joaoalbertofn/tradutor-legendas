import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getRedis } from "@/lib/redis";
import {
  claimStatsIncrement,
  claimUserStatsIncrement,
  extractClientIp,
  isOriginAllowed,
} from "@/lib/quota";

const STATS_KEY = "stats:subtitles_translated";

export async function GET() {
  try {
    const redis = getRedis();

    if (redis) {
      const total = Number((await redis.get<number>(STATS_KEY)) ?? 0);
      return NextResponse.json({
        totalTranslated: total,
        source: "redis",
      });
    }

    return NextResponse.json({
      totalTranslated: 0,
      source: "fallback",
    });
  } catch (error) {
    console.error("[GET /api/stats] Error:", error);
    return NextResponse.json(
      {
        totalTranslated: 0,
        source: "fallback",
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

    const { userId } = await auth();
    const ip = extractClientIp(request);
    const claimed = userId
      ? await claimUserStatsIncrement(sessionId, userId)
      : await claimStatsIncrement(sessionId, ip);
    const redis = getRedis();

    if (!claimed) {
      const currentTotal = redis
        ? Number((await redis.get<number>(STATS_KEY)) ?? 0)
        : 0;
      return NextResponse.json({
        totalTranslated: currentTotal,
        source: redis ? "redis" : "fallback",
      });
    }

    if (redis) {
      const total = await redis.incr(STATS_KEY);
      return NextResponse.json({
        totalTranslated: total,
        source: "redis",
      });
    }

    return NextResponse.json({
      totalTranslated: 0,
      source: "fallback",
    });
  } catch (error) {
    console.error("[POST /api/stats] Error:", error);
    return NextResponse.json(
      { error: "Falha ao atualizar estatísticas." },
      { status: 500 }
    );
  }
}
