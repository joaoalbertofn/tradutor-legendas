import { describe, it, expect } from "vitest";
import {
  startTranslationSession,
  validateTranslationSession,
  markSessionChunkSuccess,
  refundTranslationSession,
  claimStatsIncrement,
  createUserTranslationSession,
  validateUserTranslationSession,
  markUserSessionChunkSuccess,
} from "./quota";

describe("quota & session security", () => {
  it("rejects forged UUID session tokens even without Redis", async () => {
    const forged = "11111111-2222-4333-8444-555555555555";
    const result = await validateTranslationSession(forged, "203.0.113.10");
    expect(result.valid).toBe(false);
  });

  it("binds HMAC-signed sessions to the originating IP", async () => {
    const ipA = "203.0.113.20";
    const ipB = "203.0.113.21";

    const started = await startTranslationSession(ipA);
    expect(started.allowed).toBe(true);
    if (!started.allowed) return;

    const validSameIp = await validateTranslationSession(started.sessionId, ipA);
    expect(validSameIp.valid).toBe(true);

    const invalidOtherIp = await validateTranslationSession(started.sessionId, ipB);
    expect(invalidOtherIp.valid).toBe(false);
  });

  it("allows refund when 0 chunks succeeded, but blocks refund after chunks succeed", async () => {
    const ip = "203.0.113.30";

    // Session 1: 0 chunks succeeded -> refund allowed
    const s1 = await startTranslationSession(ip);
    expect(s1.allowed).toBe(true);
    if (!s1.allowed) return;
    expect(s1.quota.used).toBe(1);

    const r1 = await refundTranslationSession(s1.sessionId, ip);
    expect(r1.refunded).toBe(true);
    expect(r1.quota.used).toBe(0);

    // Session 2: 1 chunk succeeded -> refund MUST be blocked
    const s2 = await startTranslationSession(ip);
    expect(s2.allowed).toBe(true);
    if (!s2.allowed) return;

    await validateTranslationSession(s2.sessionId, ip);
    await markSessionChunkSuccess(s2.sessionId, ip);

    const r2 = await refundTranslationSession(s2.sessionId, ip);
    expect(r2.refunded).toBe(false);
    expect(r2.quota.used).toBe(1);
  });

  it("enforces one-time idempotent stats increment only after successful chunks", async () => {
    const ip = "203.0.113.40";
    const s = await startTranslationSession(ip);
    expect(s.allowed).toBe(true);
    if (!s.allowed) return;

    // Cannot claim before any chunk succeeded
    expect(await claimStatsIncrement(s.sessionId, ip)).toBe(false);

    await markSessionChunkSuccess(s.sessionId, ip);

    // First claim succeeds, second replay is rejected
    expect(await claimStatsIncrement(s.sessionId, ip)).toBe(true);
    expect(await claimStatsIncrement(s.sessionId, ip)).toBe(false);
  });

  it("tracks hasSuccessfulChunk on user sessions to avoid redundant Redis writes", async () => {
    const userId = "user_test_opt_1";
    const sessionId = await createUserTranslationSession(userId, "free");

    const firstCheck = await validateUserTranslationSession(sessionId, userId);
    expect(firstCheck.valid).toBe(true);
    expect(firstCheck.hasSuccessfulChunk).toBe(false);

    await markUserSessionChunkSuccess(sessionId, userId);

    const secondCheck = await validateUserTranslationSession(sessionId, userId);
    expect(secondCheck.valid).toBe(true);
    expect(secondCheck.hasSuccessfulChunk).toBe(true);
  });
});
