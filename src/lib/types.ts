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

export interface StatsResponse {
  totalTranslated: number;
  source: "redis" | "fallback";
  quota: QuotaInfo;
}

export interface SessionResponse {
  sessionId: string;
  quota: QuotaInfo;
}

export type TranslationStatus =
  | "idle"
  | "translating"
  | "completed"
  | "error"
  | "cancelled";
