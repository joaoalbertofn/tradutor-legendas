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
  decrementIpFreeUsage,
  extractClientIp,
  getQuotaForIp,
  incrementIpFreeUsage,
  isOriginAllowed,
  isUnlimitedLocalDev,
  refundTranslationSession,
  startTranslationSession,
} from "@/lib/quota";

/**
 * Starts a subtitle translation session:
 * - In local development (`npm run dev`, unless ENFORCE_QUOTA_IN_DEV=true): unlimited, no login required.
 * - Anonymous users: up to 3 free translations/day per IP without login; after exhaustion, returns 401
 *   (`FREE_LIMIT_LOGIN_REQUIRED`) so the UI prompts login to check/buy credits.
 * - Authenticated users: shares the 3 free/day limit with the IP and uses paid credits beyond that;
 *   if no credits remain, returns 402 (`INSUFFICIENT_CREDITS`).
 */
export async function POST(request: NextRequest) {
  try {
    if (!isOriginAllowed(request)) {
      return NextResponse.json(
        { error: "Origem não autorizada." },
        { status: 403 }
      );
    }

    const ip = extractClientIp(request);
    const { userId } = await auth();

    // Unlimited local development mode (no login required, no credit consumed)
    if (isUnlimitedLocalDev()) {
      if (userId) {
        const credits = await getUserCredits(userId);
        const sessionId = await createUserTranslationSession(userId, "free");
        return NextResponse.json({
          sessionId,
          credits: { ...credits, unlimited: true },
          consumedFrom: "free",
          unlimited: true,
        });
      }

      const ipSession = await startTranslationSession(ip);
      if (ipSession.allowed) {
        return NextResponse.json({
          sessionId: ipSession.sessionId,
          quota: ipSession.quota,
          consumedFrom: "free",
          unlimited: true,
        });
      }
    }

    // Authenticated user flow: free daily quota (shared with IP) first, then paid credits
    if (userId) {
      const ipQuota = await getQuotaForIp(ip);
      const consumeResult = await checkAndConsumeCredit(userId, new Date(), {
        ipFreeUsed: ipQuota.used,
      });

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

      if (consumeResult.consumedFrom === "free") {
        await incrementIpFreeUsage(ip);
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
    }

    // Anonymous user flow: 3 free translations/day without login
    const ipSession = await startTranslationSession(ip);
    if (!ipSession.allowed) {
      return NextResponse.json(
        {
          error:
            ipSession.reason ??
            "Você já usou suas 3 traduções grátis de hoje. Faça login para verificar seus créditos ou adquirir mais traduções.",
          code: "FREE_LIMIT_LOGIN_REQUIRED",
          quota: ipSession.quota,
        },
        { status: 401 }
      );
    }

    return NextResponse.json({
      sessionId: ipSession.sessionId,
      quota: ipSession.quota,
      consumedFrom: "free",
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
 * Refunds 1 credit/quota unit if 0 chunks succeeded in the session (prevents loss on immediate errors).
 */
export async function DELETE(request: NextRequest) {
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
      return NextResponse.json({ error: "sessionId ausente." }, { status: 400 });
    }

    const ip = extractClientIp(request);
    const { userId } = await auth();

    if (isUnlimitedLocalDev()) {
      const quota = await getQuotaForIp(ip);
      if (userId) {
        const credits = await getUserCredits(userId);
        return NextResponse.json({
          refunded: false,
          credits: { ...credits, unlimited: true },
          quota,
        });
      }
      return NextResponse.json({ refunded: false, quota });
    }

    if (userId) {
      const eligibility = await consumeRefundEligibilityForUserSession(
        sessionId,
        userId
      );
      if (eligibility.eligible && eligibility.consumedFrom) {
        if (eligibility.consumedFrom === "free") {
          await decrementIpFreeUsage(ip);
        }
        const ipQuota = await getQuotaForIp(ip);
        const credits = await refundUserCredit(userId, eligibility.consumedFrom);
        return NextResponse.json({
          refunded: true,
          credits: await getUserCredits(userId, new Date(), {
            ipFreeUsed: ipQuota.used,
          }).catch(() => credits),
          quota: ipQuota,
        });
      }

      const ipQuota = await getQuotaForIp(ip);
      const credits = await getUserCredits(userId, new Date(), {
        ipFreeUsed: ipQuota.used,
      });
      return NextResponse.json({ refunded: false, credits, quota: ipQuota });
    }

    const refundResult = await refundTranslationSession(sessionId, ip);
    return NextResponse.json(refundResult);
  } catch (error) {
    console.error("[DELETE /api/translate/session] Error:", error);
    return NextResponse.json(
      { error: "Erro ao estornar sessão." },
      { status: 500 }
    );
  }
}
