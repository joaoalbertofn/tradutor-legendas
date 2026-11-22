import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  checkAndConsumeCredit,
  getUserCredits,
  refundUserCredit,
} from "@/lib/credits";
import {
  consumeRefundEligibilityForUserSession,
  createUserTranslationSession,
  isOriginAllowed,
} from "@/lib/quota";

/**
 * Starts a subtitle translation session for the authenticated Clerk user.
 * Consumes 1 credit (free daily quota first, then paid credits) and returns a
 * signed `sessionId` so subsequent chunks of the same file do not deduct extra credits.
 */
export async function POST(request: NextRequest) {
  try {
    if (!isOriginAllowed(request)) {
      return NextResponse.json(
        { error: "Origem não autorizada." },
        { status: 403 }
      );
    }

    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        {
          error: "Faça login para iniciar a tradução.",
          code: "AUTH_REQUIRED",
        },
        { status: 401 }
      );
    }

    const consumeResult = await checkAndConsumeCredit(userId);
    if (!consumeResult.allowed) {
      return NextResponse.json(
        {
          error: consumeResult.error,
          code: "INSUFFICIENT_CREDITS",
          credits: consumeResult.credits,
        },
        { status: 402 }
      );
    }

    const sessionId = await createUserTranslationSession(
      userId,
      consumeResult.consumedFrom
    );

    return NextResponse.json({
      sessionId,
      credits: consumeResult.credits,
      consumedFrom: consumeResult.consumedFrom,
    });
  } catch (error) {
    console.error("[POST /api/translate/session] Error:", error);
    return NextResponse.json(
      { error: "Erro interno ao iniciar sessão de tradução." },
      { status: 500 }
    );
  }
}

/**
 * Refunds 1 credit if 0 chunks succeeded in the session (prevents credit loss on immediate errors).
 */
export async function DELETE(request: NextRequest) {
  try {
    if (!isOriginAllowed(request)) {
      return NextResponse.json(
        { error: "Origem não autorizada." },
        { status: 403 }
      );
    }

    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Autenticação obrigatória." },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
    if (!sessionId) {
      return NextResponse.json({ error: "sessionId ausente." }, { status: 400 });
    }

    const eligibility = await consumeRefundEligibilityForUserSession(
      sessionId,
      userId
    );
    if (eligibility.eligible && eligibility.consumedFrom) {
      const credits = await refundUserCredit(userId, eligibility.consumedFrom);
      return NextResponse.json({ refunded: true, credits });
    }

    const credits = await getUserCredits(userId);
    return NextResponse.json({ refunded: false, credits });
  } catch (error) {
    console.error("[DELETE /api/translate/session] Error:", error);
    return NextResponse.json(
      { error: "Erro ao estornar sessão." },
      { status: 500 }
    );
  }
}
