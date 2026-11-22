export type SubtitleFormat = "srt" | "vtt";

export type TranslationStyle = "natural" | "faithful" | "slang";

export interface SubtitleBlock {
  /** Sequential 1-based internal ID used for strict 1:1 translation mapping */
  id: number;
  /** Original cue index/identifier (preserved verbatim; may be empty in VTT) */
  index: string;
  /** Original timestamp line including any VTT cue settings (never sent to AI) */
  timestamp: string;
  /** Original dialogue text, including inline HTML/VTT tags and internal newlines */
  text: string;
  /** Optional non-cue blocks (e.g. VTT NOTE/STYLE) immediately preceding this cue */
  prefix?: string;
}

export interface ParsedSubtitle {
  format: SubtitleFormat;
  /** Preserved VTT header (WEBVTT, metadata, STYLE, REGION, leading NOTEs) */
  header: string;
  blocks: SubtitleBlock[];
  /** Preserved trailing non-cue blocks (if any) */
  trailing: string;
  lineEnding: "\r\n" | "\n";
  hasBom: boolean;
}

export interface TranslationItem {
  id: number;
  text: string;
}

export interface QuotaInfo {
  used: number;
  limit: number;
  remaining: number;
  source: "redis" | "memory";
  unlimited?: boolean;
}

export type CreditPlanId = "10_credits" | "50_credits";

export interface UserCreditsInfo {
  userId: string;
  freeUsedToday: number;
  freeLimit: number;
  freeRemaining: number;
  freeResetAt: string;
  paidCredits: number;
  paidExpiresAt: string | null;
  totalAvailable: number;
  updatedAt: string;
  source: "supabase" | "memory";
  unlimited?: boolean;
}

export interface StatsResponse {
  totalTranslated: number;
  source: "redis" | "fallback";
  quota?: QuotaInfo;
}

export interface SessionResponse {
  sessionId: string;
  credits?: UserCreditsInfo;
  quota?: QuotaInfo;
  consumedFrom?: "free" | "paid";
  unlimited?: boolean;
}

export type TranslationStatus =
  | "idle"
  | "translating"
  | "completed"
  | "error"
  | "cancelled";

export type SubtitleExtension = ".srt" | ".vtt";

export type TranslationSourceType = "file_upload" | "video_extraction";

export type TranslationLogStatus = "success" | "error" | "cancelled";

export interface TranslationChunkMetrics {
  promptTokens: number;
  outputTokens: number;
  totalTokens?: number;
  durationMs: number;
}

export interface TranslationLogPayload {
  sessionId: string;
  fileName: string;
  extension: SubtitleExtension;
  sourceType: TranslationSourceType;
  status: TranslationLogStatus;
  errorMessage?: string | null;
  model?: string | null;
  extractionDurationMs: number;
  translationDurationMs: number;
  totalCues: number;
  totalChunks: number;
  retriesCount: number;
  totalPromptTokens: number;
  totalOutputTokens: number;
  estimatedCostUsd: number;
}

export interface TranslationLogRecord extends TranslationLogPayload {
  id: string;
  createdAt: string;
}

export interface TranslationLogsSummary {
  totalRuns: number;
  totalTranslated: number;
  totalErrors: number;
  totalCancelled: number;
  totalCuesTranslated: number;
  totalCostUsd: number;
  totalCostBrl: number;
  totalPromptTokens: number;
  totalOutputTokens: number;
  avgDurationMs: number;
  avgExtractionDurationMs: number;
  totalChunks: number;
  totalRetries: number;
  retryRate: number;
  bottlenecks: {
    slowDurationThresholdMs: number;
    highTokensThreshold: number;
  };
}

export interface TranslationLogsListResponse {
  logs: TranslationLogRecord[];
  summary: TranslationLogsSummary;
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
  source: "supabase" | "local";
  usdToBrlRate: number;
}
