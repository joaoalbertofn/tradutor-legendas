import crypto from "crypto";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  computeLogsSummary,
  queryTranslationLogs,
  saveTranslationLog,
  TranslationLogPayloadSchema,
} from "./translationLogs";
import {
  createAdminSessionToken,
  isAdminCookieValid,
  verifyAdminPassword,
} from "./adminAuth";

describe("translationLogs & adminAuth", () => {
  let tempFile: string;
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    tempFile = path.join(
      os.tmpdir(),
      `traduz-legendas-test-logs-${crypto.randomUUID()}.json`
    );
    delete process.env.SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_ANON_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    process.env.LOCAL_LOGS_PATH = tempFile;
    process.env.ADMIN_SECRET = "super-secret-test-key";
    vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
    await fs.rm(tempFile, { force: true }).catch(() => {});
  });

  it("saves and queries paginated logs using local JSON fallback", async () => {
    const payload1 = TranslationLogPayloadSchema.parse({
      sessionId: crypto.randomUUID(),
      fileName: "episode01.srt",
      extension: ".srt",
      sourceType: "file_upload",
      status: "success",
      extractionDurationMs: 0,
      translationDurationMs: 8500,
      totalCues: 420,
      totalChunks: 11,
      retriesCount: 1,
      totalPromptTokens: 45_000,
      totalOutputTokens: 18_000,
      estimatedCostUsd: 0.01755,
    });

    const payload2 = TranslationLogPayloadSchema.parse({
      sessionId: crypto.randomUUID(),
      fileName: "movie.mkv.srt",
      extension: ".srt",
      sourceType: "video_extraction",
      status: "error",
      errorMessage: "Timeout no lote 3",
      extractionDurationMs: 2400,
      translationDurationMs: 35_000,
      totalCues: 1200,
      totalChunks: 30,
      retriesCount: 4,
      totalPromptTokens: 120_000,
      totalOutputTokens: 40_000,
      estimatedCostUsd: 0.042,
    });

    const saved1 = await saveTranslationLog(payload1);
    const saved2 = await saveTranslationLog(payload2);

    expect(saved1.source).toBe("local");
    expect(saved2.source).toBe("local");

    const all = await queryTranslationLogs({ page: 1, pageSize: 10 });
    expect(all.source).toBe("local");
    expect(all.logs).toHaveLength(2);
    expect(all.logs[0].fileName).toBe("movie.mkv.srt");
    expect(all.summary.totalTranslated).toBe(1);
    expect(all.summary.totalErrors).toBe(1);
    expect(all.summary.totalRetries).toBe(5);
    expect(all.summary.totalChunks).toBe(41);
    expect(all.summary.retryRate).toBeCloseTo(5 / 41, 4);

    const onlyErrors = await queryTranslationLogs({
      page: 1,
      pageSize: 10,
      status: "error",
    });
    expect(onlyErrors.logs).toHaveLength(1);
    expect(onlyErrors.logs[0].status).toBe("error");
  });

  it("computes summary metrics and bottleneck thresholds accurately", () => {
    const summary = computeLogsSummary(
      [
        {
          status: "success",
          sourceType: "file_upload",
          totalCues: 100,
          totalChunks: 3,
          retriesCount: 0,
          totalPromptTokens: 10_000,
          totalOutputTokens: 5_000,
          estimatedCostUsd: 0.0045,
          translationDurationMs: 5_000,
          extractionDurationMs: 0,
        },
        {
          status: "success",
          sourceType: "video_extraction",
          totalCues: 200,
          totalChunks: 5,
          retriesCount: 1,
          totalPromptTokens: 20_000,
          totalOutputTokens: 10_000,
          estimatedCostUsd: 0.009,
          translationDurationMs: 12_000,
          extractionDurationMs: 3_000,
        },
        {
          status: "success",
          sourceType: "file_upload",
          totalCues: 900,
          totalChunks: 23,
          retriesCount: 2,
          totalPromptTokens: 90_000,
          totalOutputTokens: 45_000,
          estimatedCostUsd: 0.0405,
          translationDurationMs: 40_000,
          extractionDurationMs: 0,
        },
      ],
      6.0
    );

    expect(summary.totalTranslated).toBe(3);
    expect(summary.totalCuesTranslated).toBe(1200);
    expect(summary.totalCostUsd).toBeCloseTo(0.054, 6);
    expect(summary.totalCostBrl).toBeCloseTo(0.324, 6);
    expect(summary.avgDurationMs).toBe(19_000);
    expect(summary.avgExtractionDurationMs).toBe(3_000);
    expect(summary.bottlenecks.slowDurationThresholdMs).toBe(40_000);
    expect(summary.bottlenecks.highTokensThreshold).toBe(135_000);
  });

  it("verifies ADMIN_SECRET password and signed session cookie", () => {
    expect(verifyAdminPassword("super-secret-test-key")).toBe(true);
    expect(verifyAdminPassword("wrong-password")).toBe(false);

    const token = createAdminSessionToken();
    expect(token).toBeTruthy();
    expect(isAdminCookieValid(token ?? undefined)).toBe(true);
    expect(isAdminCookieValid("tampered-token")).toBe(false);
  });
});
