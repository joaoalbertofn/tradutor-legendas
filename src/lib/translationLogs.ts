import crypto from "crypto";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { z } from "zod";
import {
  calculateEstimatedCostUsd,
  convertUsdToBrl,
  getUsdToBrlRate,
} from "./pricing";
import type {
  TranslationLogPayload,
  TranslationLogRecord,
  TranslationLogsListResponse,
  TranslationLogsSummary,
  TranslationLogStatus,
} from "./types";

const MAX_LOCAL_LOGS = 2000;

export const TranslationLogPayloadSchema = z.object({
  sessionId: z.string().uuid(),
  fileName: z.string().trim().min(1).max(300),
  extension: z.enum([".srt", ".vtt"]),
  sourceType: z.enum(["file_upload", "video_extraction"]),
  status: z.enum(["success", "error", "cancelled"]).default("success"),
  errorMessage: z.string().max(500).nullable().optional(),
  model: z.string().max(100).nullable().optional(),
  extractionDurationMs: z.number().min(0).max(86_400_000).default(0),
  translationDurationMs: z.number().min(0).max(86_400_000).default(0),
  totalCues: z.number().int().min(0).max(1_000_000).default(0),
  totalChunks: z.number().int().min(0).max(100_000).default(0),
  retriesCount: z.number().int().min(0).max(100_000).default(0),
  totalPromptTokens: z.number().int().min(0).max(1_000_000_000).default(0),
  totalOutputTokens: z.number().int().min(0).max(1_000_000_000).default(0),
  estimatedCostUsd: z.number().min(0).max(10_000).optional(),
});

interface SupabaseRow {
  id: string;
  session_id: string;
  file_name: string;
  extension: ".srt" | ".vtt";
  source_type: "file_upload" | "video_extraction";
  status: TranslationLogStatus;
  error_message: string | null;
  model: string | null;
  extraction_duration_ms: number;
  translation_duration_ms: number;
  total_cues: number;
  total_chunks: number;
  retries_count: number;
  total_prompt_tokens: number;
  total_output_tokens: number;
  estimated_cost_usd: number | string;
  created_at: string;
}

interface SupabaseConfig {
  url: string;
  key: string;
}

function getSupabaseConfig(): SupabaseConfig | null {
  const url = (
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  )?.trim();
  const key = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )?.trim();

  if (!url || !key) return null;
  return { url: url.replace(/\/+$/, ""), key };
}

function buildSupabaseHeaders(
  key: string,
  extra?: Record<string, string>
): Record<string, string> {
  const headers: Record<string, string> = {
    apikey: key,
    ...(extra ?? {}),
  };
  if (key.startsWith("eyJ")) {
    headers.Authorization = `Bearer ${key}`;
  }
  return headers;
}

function getLocalLogPaths(): string[] {
  const custom = process.env.LOCAL_LOGS_PATH?.trim();
  if (custom) return [custom];
  return [
    path.join(process.cwd(), ".data", "translation-logs.json"),
    path.join(os.tmpdir(), "traduz-legendas-logs.json"),
  ];
}

const globalForLogs = globalThis as unknown as {
  __localTranslationLogs?: TranslationLogRecord[];
};

function mapRowToRecord(row: SupabaseRow): TranslationLogRecord {
  return {
    id: row.id,
    sessionId: row.session_id,
    fileName: row.file_name,
    extension: row.extension,
    sourceType: row.source_type,
    status: row.status,
    errorMessage: row.error_message,
    model: row.model,
    extractionDurationMs: Number(row.extraction_duration_ms) || 0,
    translationDurationMs: Number(row.translation_duration_ms) || 0,
    totalCues: Number(row.total_cues) || 0,
    totalChunks: Number(row.total_chunks) || 0,
    retriesCount: Number(row.retries_count) || 0,
    totalPromptTokens: Number(row.total_prompt_tokens) || 0,
    totalOutputTokens: Number(row.total_output_tokens) || 0,
    estimatedCostUsd: Number(row.estimated_cost_usd) || 0,
    createdAt: row.created_at,
  };
}

function mapPayloadToSupabaseInsert(payload: TranslationLogPayload) {
  return {
    session_id: payload.sessionId,
    file_name: payload.fileName,
    extension: payload.extension,
    source_type: payload.sourceType,
    status: payload.status,
    error_message: payload.errorMessage ?? null,
    model: payload.model ?? null,
    extraction_duration_ms: Math.round(payload.extractionDurationMs),
    translation_duration_ms: Math.round(payload.translationDurationMs),
    total_cues: payload.totalCues,
    total_chunks: payload.totalChunks,
    retries_count: payload.retriesCount,
    total_prompt_tokens: payload.totalPromptTokens,
    total_output_tokens: payload.totalOutputTokens,
    estimated_cost_usd: payload.estimatedCostUsd,
  };
}

async function readLocalLogs(): Promise<TranslationLogRecord[]> {
  for (const filePath of getLocalLogPaths()) {
    try {
      const raw = await fs.readFile(filePath, "utf8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        globalForLogs.__localTranslationLogs = parsed;
        return parsed as TranslationLogRecord[];
      }
    } catch {
      // Try next fallback path
    }
  }
  return globalForLogs.__localTranslationLogs ?? [];
}

async function writeLocalLogs(records: TranslationLogRecord[]): Promise<void> {
  const trimmed = records.slice(0, MAX_LOCAL_LOGS);
  globalForLogs.__localTranslationLogs = trimmed;

  for (const filePath of getLocalLogPaths()) {
    try {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, JSON.stringify(trimmed, null, 2), "utf8");
      return;
    } catch {
      // Fallback to next path (e.g. /tmp on read-only serverless FS)
    }
  }
}

async function saveToLocalFallback(
  payload: TranslationLogPayload
): Promise<TranslationLogRecord> {
  const record: TranslationLogRecord = {
    ...payload,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };

  console.info("[translation_log]", JSON.stringify(record));

  const existing = await readLocalLogs();
  existing.unshift(record);
  await writeLocalLogs(existing);

  return record;
}

export async function saveTranslationLog(
  rawPayload: z.infer<typeof TranslationLogPayloadSchema>
): Promise<{ record: TranslationLogRecord; source: "supabase" | "local" }> {
  const estimatedCostUsd =
    typeof rawPayload.estimatedCostUsd === "number" &&
    Number.isFinite(rawPayload.estimatedCostUsd)
      ? Number(rawPayload.estimatedCostUsd.toFixed(8))
      : calculateEstimatedCostUsd(
          rawPayload.totalPromptTokens,
          rawPayload.totalOutputTokens,
          rawPayload.model ?? undefined
        );

  const payload: TranslationLogPayload = {
    ...rawPayload,
    extractionDurationMs: Math.round(rawPayload.extractionDurationMs),
    translationDurationMs: Math.round(rawPayload.translationDurationMs),
    estimatedCostUsd,
  };

  const supabase = getSupabaseConfig();
  if (!supabase) {
    const record = await saveToLocalFallback(payload);
    return { record, source: "local" };
  }

  try {
    const res = await fetch(`${supabase.url}/rest/v1/translation_logs`, {
      method: "POST",
      headers: buildSupabaseHeaders(supabase.key, {
        "Content-Type": "application/json",
        Prefer: "return=representation",
      }),
      body: JSON.stringify(mapPayloadToSupabaseInsert(payload)),
      cache: "no-store",
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Supabase HTTP ${res.status}: ${errText}`);
    }

    const rows = (await res.json()) as SupabaseRow[];
    if (Array.isArray(rows) && rows.length > 0) {
      return { record: mapRowToRecord(rows[0]), source: "supabase" };
    }

    return {
      record: {
        ...payload,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      },
      source: "supabase",
    };
  } catch (error) {
    console.error(
      "[translationLogs] Failed to persist to Supabase, falling back to local log:",
      error
    );
    const record = await saveToLocalFallback(payload);
    return { record, source: "local" };
  }
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * p) - 1)
  );
  return sorted[idx];
}

export function computeLogsSummary(
  records: Pick<
    TranslationLogRecord,
    | "status"
    | "sourceType"
    | "totalCues"
    | "totalChunks"
    | "retriesCount"
    | "totalPromptTokens"
    | "totalOutputTokens"
    | "estimatedCostUsd"
    | "translationDurationMs"
    | "extractionDurationMs"
  >[],
  usdToBrlRate: number = getUsdToBrlRate()
): TranslationLogsSummary {
  let totalTranslated = 0;
  let totalErrors = 0;
  let totalCancelled = 0;
  let totalCuesTranslated = 0;
  let totalCostUsd = 0;
  let totalPromptTokens = 0;
  let totalOutputTokens = 0;
  let totalChunks = 0;
  let totalRetries = 0;

  const durations: number[] = [];
  const extractionDurations: number[] = [];
  const tokenTotals: number[] = [];

  for (const r of records) {
    if (r.status === "success") {
      totalTranslated += 1;
      totalCuesTranslated += r.totalCues;
    } else if (r.status === "error") {
      totalErrors += 1;
    } else {
      totalCancelled += 1;
    }

    totalCostUsd += r.estimatedCostUsd;
    totalPromptTokens += r.totalPromptTokens;
    totalOutputTokens += r.totalOutputTokens;
    totalChunks += r.totalChunks;
    totalRetries += r.retriesCount;

    if (r.translationDurationMs > 0) {
      durations.push(r.translationDurationMs);
    }
    if (r.sourceType === "video_extraction" && r.extractionDurationMs > 0) {
      extractionDurations.push(r.extractionDurationMs);
    }
    const tokens = r.totalPromptTokens + r.totalOutputTokens;
    if (tokens > 0) {
      tokenTotals.push(tokens);
    }
  }

  const avgDurationMs =
    durations.length > 0
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 0;

  const avgExtractionDurationMs =
    extractionDurations.length > 0
      ? Math.round(
          extractionDurations.reduce((a, b) => a + b, 0) /
            extractionDurations.length
        )
      : 0;

  const retryRate = totalChunks > 0 ? totalRetries / totalChunks : 0;

  const slowDurationThresholdMs =
    durations.length >= 3
      ? Math.max(10_000, percentile(durations, 0.85))
      : 30_000;

  const highTokensThreshold =
    tokenTotals.length >= 3
      ? Math.max(25_000, percentile(tokenTotals, 0.85))
      : 100_000;

  const roundedCostUsd = Number(totalCostUsd.toFixed(8));

  return {
    totalRuns: records.length,
    totalTranslated,
    totalErrors,
    totalCancelled,
    totalCuesTranslated,
    totalCostUsd: roundedCostUsd,
    totalCostBrl: convertUsdToBrl(roundedCostUsd, usdToBrlRate),
    totalPromptTokens,
    totalOutputTokens,
    avgDurationMs,
    avgExtractionDurationMs,
    totalChunks,
    totalRetries,
    retryRate,
    bottlenecks: {
      slowDurationThresholdMs,
      highTokensThreshold,
    },
  };
}

export interface QueryLogsOptions {
  page?: number;
  pageSize?: number;
  status?: "all" | TranslationLogStatus;
}

export async function queryTranslationLogs(
  options: QueryLogsOptions = {}
): Promise<TranslationLogsListResponse> {
  const page = Math.max(1, Math.floor(options.page ?? 1));
  const pageSize = Math.min(100, Math.max(5, Math.floor(options.pageSize ?? 15)));
  const statusFilter = options.status ?? "all";
  const usdToBrlRate = getUsdToBrlRate();

  const supabase = getSupabaseConfig();
  if (supabase) {
    try {
      const offset = (page - 1) * pageSize;
      const statusQuery =
        statusFilter !== "all" ? `&status=eq.${encodeURIComponent(statusFilter)}` : "";

      const [pageRes, summaryRes] = await Promise.all([
        fetch(
          `${supabase.url}/rest/v1/translation_logs?select=*${statusQuery}&order=created_at.desc&limit=${pageSize}&offset=${offset}`,
          {
            headers: buildSupabaseHeaders(supabase.key, {
              Prefer: "count=exact",
            }),
            cache: "no-store",
          }
        ),
        fetch(
          `${supabase.url}/rest/v1/translation_logs?select=status,source_type,total_cues,total_chunks,retries_count,total_prompt_tokens,total_output_tokens,estimated_cost_usd,translation_duration_ms,extraction_duration_ms&order=created_at.desc&limit=5000`,
          {
            headers: buildSupabaseHeaders(supabase.key),
            cache: "no-store",
          }
        ),
      ]);

      if (!pageRes.ok) {
        throw new Error(`Supabase query failed with HTTP ${pageRes.status}`);
      }

      const contentRange = pageRes.headers.get("content-range") ?? "";
      const totalMatch = contentRange.match(/\/(\d+)$/);
      const pageRows = (await pageRes.json()) as SupabaseRow[];
      const logs = pageRows.map(mapRowToRecord);

      const summaryRows = summaryRes.ok
        ? ((await summaryRes.json()) as SupabaseRow[])
        : pageRows;
      const summaryRecords = summaryRows.map((row) => ({
        status: row.status,
        sourceType: row.source_type,
        totalCues: Number(row.total_cues) || 0,
        totalChunks: Number(row.total_chunks) || 0,
        retriesCount: Number(row.retries_count) || 0,
        totalPromptTokens: Number(row.total_prompt_tokens) || 0,
        totalOutputTokens: Number(row.total_output_tokens) || 0,
        estimatedCostUsd: Number(row.estimated_cost_usd) || 0,
        translationDurationMs: Number(row.translation_duration_ms) || 0,
        extractionDurationMs: Number(row.extraction_duration_ms) || 0,
      }));

      const totalItems = totalMatch ? Number(totalMatch[1]) : logs.length;
      const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

      return {
        logs,
        summary: computeLogsSummary(summaryRecords, usdToBrlRate),
        pagination: {
          page,
          pageSize,
          totalItems,
          totalPages,
        },
        source: "supabase",
        usdToBrlRate,
      };
    } catch (error) {
      console.error(
        "[translationLogs] Failed to query Supabase, falling back to local logs:",
        error
      );
    }
  }

  const allLocal = await readLocalLogs();
  const filtered =
    statusFilter === "all"
      ? allLocal
      : allLocal.filter((log) => log.status === statusFilter);

  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const logs = filtered.slice(start, start + pageSize);

  return {
    logs,
    summary: computeLogsSummary(allLocal, usdToBrlRate),
    pagination: {
      page: safePage,
      pageSize,
      totalItems,
      totalPages,
    },
    source: "local",
    usdToBrlRate,
  };
}
