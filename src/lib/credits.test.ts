import { beforeEach, describe, expect, it } from "vitest";
import {
  __resetMemoryCreditsStore,
  checkAndConsumeCredit,
  getUserCredits,
  grantPaidCreditsFromPayment,
  refundUserCredit,
} from "./credits";

describe("credits business rules & lazy resets", () => {
  beforeEach(() => {
    process.env.CREDITS_FORCE_MEMORY = "true";
    __resetMemoryCreditsStore();
  });

  it("consumes free credits first (up to 3), then paid credits, then returns 402", async () => {
    const userId = "user_clerk_1";
    const t0 = new Date("2026-11-21T12:00:00.000Z");

    // Grant 2 paid credits
    const grant = await grantPaidCreditsFromPayment({
      externalPaymentId: "bill_001",
      userId,
      creditsToAdd: 2,
      amountCents: 100,
      status: "PAID",
      now: t0,
    });
    expect(grant.credited).toBe(true);
    expect(grant.credits?.paidCredits).toBe(2);

    // 1st, 2nd, 3rd consumptions must use free quota first
    for (let i = 1; i <= 3; i++) {
      const res = await checkAndConsumeCredit(userId, t0);
      expect(res.allowed).toBe(true);
      if (!res.allowed) return;
      expect(res.consumedFrom).toBe("free");
      expect(res.credits.freeUsedToday).toBe(i);
      expect(res.credits.paidCredits).toBe(2);
    }

    // 4th and 5th consumptions must use paid credits
    const c4 = await checkAndConsumeCredit(userId, t0);
    expect(c4.allowed).toBe(true);
    if (!c4.allowed) return;
    expect(c4.consumedFrom).toBe("paid");
    expect(c4.credits.paidCredits).toBe(1);

    const c5 = await checkAndConsumeCredit(userId, t0);
    expect(c5.allowed).toBe(true);
    if (!c5.allowed) return;
    expect(c5.consumedFrom).toBe("paid");
    expect(c5.credits.paidCredits).toBe(0);

    // 6th consumption must fail with 402 Payment Required
    const c6 = await checkAndConsumeCredit(userId, t0);
    expect(c6.allowed).toBe(false);
    if (c6.allowed) return;
    expect(c6.status).toBe(402);
    expect(c6.credits.totalAvailable).toBe(0);
  });

  it("lazily resets free_used_today and expires paid_credits after 24h without a cron job", async () => {
    const userId = "user_clerk_2";
    const t0 = new Date("2026-11-21T12:00:00.000Z");

    await grantPaidCreditsFromPayment({
      externalPaymentId: "bill_002",
      userId,
      creditsToAdd: 10,
      amountCents: 100,
      status: "PAID",
      now: t0,
    });

    // Exhaust all 3 free credits
    await checkAndConsumeCredit(userId, t0);
    await checkAndConsumeCredit(userId, t0);
    await checkAndConsumeCredit(userId, t0);

    const beforeReset = await getUserCredits(userId, t0);
    expect(beforeReset.freeUsedToday).toBe(3);
    expect(beforeReset.paidCredits).toBe(10);

    // Advance 24h + 1 minute -> both free_used_today and paid_credits should reset lazily
    const tAfter24h = new Date(t0.getTime() + 24 * 60 * 60 * 1000 + 60_000);
    const afterReset = await getUserCredits(userId, tAfter24h);
    expect(afterReset.freeUsedToday).toBe(0);
    expect(afterReset.freeRemaining).toBe(3);
    expect(afterReset.paidCredits).toBe(0);
    expect(afterReset.paidExpiresAt).toBeNull();
  });

  it("enforces idempotency on duplicate external_payment_id webhooks", async () => {
    const userId = "user_clerk_3";
    const t0 = new Date("2026-11-21T12:00:00.000Z");

    const first = await grantPaidCreditsFromPayment({
      externalPaymentId: "bill_dup_123",
      userId,
      creditsToAdd: 50,
      amountCents: 300,
      status: "PAID",
      now: t0,
    });
    expect(first.credited).toBe(true);
    expect(first.alreadyProcessed).toBe(false);
    expect(first.credits?.paidCredits).toBe(50);

    const duplicate = await grantPaidCreditsFromPayment({
      externalPaymentId: "bill_dup_123",
      userId,
      creditsToAdd: 50,
      amountCents: 300,
      status: "PAID",
      now: t0,
    });
    expect(duplicate.credited).toBe(false);
    expect(duplicate.alreadyProcessed).toBe(true);

    const balance = await getUserCredits(userId, t0);
    expect(balance.paidCredits).toBe(50);
  });

  it("refunds credit back to the original bucket when 0 chunks succeeded", async () => {
    const userId = "user_clerk_4";
    const t0 = new Date("2026-11-21T12:00:00.000Z");

    const consumed = await checkAndConsumeCredit(userId, t0);
    expect(consumed.allowed).toBe(true);
    if (!consumed.allowed) return;
    expect(consumed.credits.freeUsedToday).toBe(1);

    const refunded = await refundUserCredit(userId, consumed.consumedFrom, t0);
    expect(refunded.freeUsedToday).toBe(0);
    expect(refunded.freeRemaining).toBe(3);
  });
});
