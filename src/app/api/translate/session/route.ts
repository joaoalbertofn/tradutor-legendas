import { NextRequest, NextResponse } from "next/server";
import {
  DAILY_SUBTITLE_LIMIT,
  extractClientIp,
  isOriginAllowed,
  refundTranslationSession,
  startTranslationSession,
} from "@/lib/quota";

export async function POST(request: NextRequest) {
  try {
    if (!isOriginAllowed(request)) {
      return NextResponse.json(
        { error: "Origem não autorizada." },
        { status: 403 }
      );
    }

    const ip = extractClientIp(request);
    const result = await startTranslationSession(ip);

    if (!result.allowed) {
      return NextResponse.json(
        {
          error:
            result.reason ??
            `Limite diário atingido (${DAILY_SUBTITLE_LIMIT} legendas por dia por IP). Tente novamente amanhã.`,
          quota: result.quota,
        },
        { status: 429 }
      );
    }

    return NextResponse.json({
      sessionId: result.sessionId,
      quota: result.quota,
    });
  } catch (error) {
    console.error("[POST /api/translate/session] Error:", error);
    return NextResponse.json(
      { error: "Erro interno ao iniciar sessão de tradução." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!isOriginAllowed(request)) {
      return NextResponse.json(
        { error: "Origem não autorizada." },
        { status: 403 }
      );
    }

    const ip = extractClientIp(request);
    const body = await request.json().catch(() => ({}));
    const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
    if (!sessionId) {
      return NextResponse.json({ error: "sessionId ausente." }, { status: 400 });
    }

    const { refunded, quota } = await refundTranslationSession(sessionId, ip);
    return NextResponse.json({ refunded, quota });
  } catch (error) {
    console.error("[DELETE /api/translate/session] Error:", error);
    return NextResponse.json(
      { error: "Erro ao estornar sessão." },
      { status: 500 }
    );
  }
}
