/**
 * 100% Client-Side Video Subtitle Extractor (.mkv & .mp4 / .m4v)
 *
 * Reads large local video files (2 GB – 15 GB+) in streaming chunks using File.slice()
 * without uploading anything to the server and without loading the video into RAM.
 *
 * - MKV (Matroska): Custom streaming EBML parser that reads SeekHead/Info/Tracks
 *   and skips non-subtitle video/audio blocks directly via file offsets.
 *   Supports S_TEXT/UTF8, S_TEXT/ASS, S_TEXT/SSA, S_TEXT/WEBVTT (plus zlib/header-stripping).
 * - MP4 / M4V: Dynamically imports `mp4box` only when needed, parses `moov` with
 *   mdat discarded, and reads only subtitle sample byte ranges (tx3g, wvtt, sbtl, text, stpp).
 */

export type VideoContainerFormat = "mkv" | "mp4";

export interface VideoSubtitleTrack {
  /** Track number (MKV TrackNumber) or track ID (MP4 track.id) */
  id: number;
  /** Container format */
  container: VideoContainerFormat;
  /** Raw codec identifier, e.g. S_TEXT/UTF8, S_TEXT/ASS, tx3g, wvtt, S_HDMV/PGS */
  codec: string;
  /** ISO 639-2 or BCP-47 language code, e.g. "eng", "por", "pt-BR", "und" */
  language: string;
  /** Human-readable Portuguese language label */
  languageLabel: string;
  /** Track display name from container metadata */
  name: string;
  /** Friendly combined label for UI */
  displayLabel: string;
  /** Whether this track can be extracted as clean text (.srt) */
  isTextBased: boolean;
  /** Whether this track is image-based (Blu-ray PGS, DVD VobSub, etc.) */
  isImageBased: boolean;
  isDefault?: boolean;
  isForced?: boolean;
}

export interface VideoInspectionResult {
  format: VideoContainerFormat;
  tracks: VideoSubtitleTrack[];
  textTracks: VideoSubtitleTrack[];
  imageTracks: VideoSubtitleTrack[];
}

export interface ExtractionProgress {
  /** 0 to 100 */
  percent: number;
  /** Human-readable status message */
  message: string;
  loadedBytes: number;
  totalBytes: number;
}

export interface ExtractOptions {
  onProgress?: (progress: ExtractionProgress) => void;
  signal?: AbortSignal;
}

export interface ExtractionResult {
  srt: string;
  cueCount: number;
  suggestedFileName: string;
  track: VideoSubtitleTrack;
}

export type VideoExtractorErrorCode =
  | "UNSUPPORTED_FORMAT"
  | "NO_SUBTITLES"
  | "IMAGE_ONLY_SUBTITLES"
  | "EMPTY_TRACK"
  | "CANCELLED"
  | "PARSE_ERROR";

export class VideoExtractorError extends Error {
  readonly code: VideoExtractorErrorCode;

  constructor(code: VideoExtractorErrorCode, message: string) {
    super(message);
    this.name = "VideoExtractorError";
    this.code = code;
  }
}

export const FRIENDLY_MESSAGES = {
  NO_SUBTITLES:
    "Este arquivo de vídeo não possui nenhuma faixa de legenda embutida (ou a legenda está colada na imagem do vídeo). Tente baixar um arquivo .srt separado e envie acima.",
  IMAGE_ONLY_SUBTITLES:
    "Este vídeo contém apenas legendas em formato de imagem (PGS / VobSub, comum em rips de Blu-ray e DVD), que não podem ser extraídas diretamente como texto. Tente baixar um arquivo .srt separado e envie acima.",
  UNSUPPORTED_FORMAT:
    "Formato de vídeo não suportado. Selecione um arquivo .mkv, .mp4 ou .m4v.",
  EMPTY_TRACK:
    "A faixa de legenda selecionada não contém falas de texto extraíveis.",
  CANCELLED: "Extração cancelada pelo usuário.",
} as const;

interface RawCue {
  startMs: number;
  endMs: number;
  text: string;
}

// ============================================================================
// Language & Formatting Helpers
// ============================================================================

const LANGUAGE_MAP: Record<string, string> = {
  eng: "Inglês",
  en: "Inglês",
  por: "Português",
  pt: "Português",
  "pt-br": "Português (Brasil)",
  "pt-pt": "Português (Portugal)",
  spa: "Espanhol",
  es: "Espanhol",
  fre: "Francês",
  fra: "Francês",
  fr: "Francês",
  ger: "Alemão",
  deu: "Alemão",
  de: "Alemão",
  ita: "Italiano",
  it: "Italiano",
  jpn: "Japonês",
  ja: "Japonês",
  kor: "Coreano",
  ko: "Coreano",
  chi: "Chinês",
  zho: "Chinês",
  zh: "Chinês",
  rus: "Russo",
  ru: "Russo",
  ara: "Árabe",
  ar: "Árabe",
  hin: "Hindi",
  hi: "Hindi",
  dut: "Holandês",
  nld: "Holandês",
  nl: "Holandês",
  pol: "Polonês",
  pl: "Polonês",
  tur: "Turco",
  tr: "Turco",
  swe: "Sueco",
  sv: "Sueco",
  nor: "Norueguês",
  no: "Norueguês",
  dan: "Dinamarquês",
  da: "Dinamarquês",
  fin: "Finlandês",
  fi: "Finlandês",
  cze: "Tcheco",
  ces: "Tcheco",
  hun: "Húngaro",
  hu: "Húngaro",
  gre: "Grego",
  ell: "Grego",
  heb: "Hebraico",
  he: "Hebraico",
  tha: "Tailandês",
  th: "Tailandês",
  vie: "Vietnamita",
  vi: "Vietnamita",
  ind: "Indonésio",
  id: "Indonésio",
  ukr: "Ucraniano",
  uk: "Ucraniano",
  rum: "Romeno",
  ron: "Romeno",
  und: "Idioma não especificado",
  "": "Idioma não especificado",
};

export function getLanguageLabel(code: string | undefined): string {
  const normalized = (code ?? "").trim().toLowerCase();
  if (!normalized) return LANGUAGE_MAP[""];
  if (LANGUAGE_MAP[normalized]) return LANGUAGE_MAP[normalized];
  const base = normalized.split(/[-_]/)[0];
  if (LANGUAGE_MAP[base]) return LANGUAGE_MAP[base];
  return code!.toUpperCase();
}

function buildTrackDisplayLabel(
  languageLabel: string,
  name: string,
  codec: string,
  isForced?: boolean
): string {
  const parts: string[] = [languageLabel];
  if (name && name.toLowerCase() !== languageLabel.toLowerCase()) {
    parts.push(name);
  }
  if (isForced && !name.toLowerCase().includes("forced")) {
    parts.push("Forçada");
  }
  const shortCodec = codec
    .replace(/^S_TEXT\//i, "")
    .replace(/^S_HDMV\//i, "")
    .replace(/^S_/i, "")
    .toUpperCase();
  return `${parts.join(" — ")} (${shortCodec})`;
}

export function formatSrtTimestamp(ms: number): string {
  const safe = Math.max(0, Math.round(ms));
  const hours = Math.floor(safe / 3_600_000);
  const minutes = Math.floor((safe % 3_600_000) / 60_000);
  const seconds = Math.floor((safe % 60_000) / 1_000);
  const millis = safe % 1_000;

  return (
    String(hours).padStart(2, "0") +
    ":" +
    String(minutes).padStart(2, "0") +
    ":" +
    String(seconds).padStart(2, "0") +
    "," +
    String(millis).padStart(3, "0")
  );
}

/**
 * Strips ASS/SSA override tags ({\...}), vector drawings ({\p1}...{\p0}),
 * and converts ASS line breaks (\N, \n, \h) into clean SRT text.
 */
export function cleanAssSubtitleText(rawPayload: string): string {
  let text = rawPayload.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // In Matroska S_TEXT/ASS and S_TEXT/SSA, block payload has 8 comma-separated
  // fields before Text: ReadOrder,Layer,Style,Name,MarginL,MarginR,MarginV,Effect,Text
  let commaCount = 0;
  let splitIndex = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === ",") {
      commaCount++;
      if (commaCount === 8) {
        splitIndex = i + 1;
        break;
      }
    }
  }
  if (splitIndex !== -1) {
    text = text.slice(splitIndex);
  }

  // Remove ASS vector drawing commands ({\p1}...{\p0})
  text = text.replace(
    /\{\\[^}]*\\p[1-9][^}]*\}[\s\S]*?(?:\{\\[^}]*\\p0[^}]*\}|$)/g,
    ""
  );

  // Strip all ASS/SSA override tag blocks {...}
  text = text.replace(/\{[^}]*\}/g, "");

  // Convert ASS line breaks and hard spaces
  text = text
    .replace(/\\N/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\\h/g, " ");

  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join("\n")
    .trim();
}

/**
 * Cleans WebVTT cue text into clean SRT-compatible text.
 */
export function cleanVttSubtitleText(rawPayload: string): string {
  return rawPayload
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    // Strip VTT inline timestamps like <00:01:02.500>
    .replace(/<\d{1,2}:\d{2}(?::\d{2})?\.\d{3}>/g, "")
    // Strip voice/class/ruby tags while keeping <i>, <b>, <u>
    .replace(/<\/?(?:c(?:\.[^>\s]+)?|v(?:\s+[^>]*)?|lang(?:\s+[^>]*)?|ruby|rt)>/gi, "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join("\n")
    .trim();
}

function buildSrtFromCues(cues: RawCue[]): { srt: string; cueCount: number } {
  const valid = cues
    .map((c) => ({
      startMs: Math.max(0, c.startMs),
      endMs: c.endMs,
      text: c.text.trim(),
    }))
    .filter((c) => c.text.length > 0);

  if (valid.length === 0) {
    return { srt: "", cueCount: 0 };
  }

  // Stable sort by start timestamp
  valid.sort((a, b) => a.startMs - b.startMs);

  const blocks: string[] = [];
  for (let i = 0; i < valid.length; i++) {
    const cue = valid[i];
    let endMs = cue.endMs;
    if (!Number.isFinite(endMs) || endMs <= cue.startMs) {
      const next = valid[i + 1];
      endMs = next
        ? Math.min(Math.max(cue.startMs + 500, next.startMs - 10), cue.startMs + 4000)
        : cue.startMs + 3000;
    }

    blocks.push(
      `${i + 1}\n${formatSrtTimestamp(cue.startMs)} --> ${formatSrtTimestamp(endMs)}\n${cue.text}`
    );
  }

  return {
    srt: blocks.join("\n\n") + "\n",
    cueCount: blocks.length,
  };
}

export function buildExtractedFileName(
  videoFileName: string,
  track: VideoSubtitleTrack
): string {
  const lastDot = videoFileName.lastIndexOf(".");
  const base = lastDot > 0 ? videoFileName.slice(0, lastDot) : videoFileName;
  const langSuffix =
    track.language && track.language.toLowerCase() !== "und"
      ? `.${track.language.toLowerCase().replace(/[^a-z0-9-]/g, "")}`
      : "";
  return `${base}${langSuffix}.srt`;
}

function yieldToMainThread(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function checkAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new VideoExtractorError("CANCELLED", FRIENDLY_MESSAGES.CANCELLED);
  }
}

// ============================================================================
// Format Detection
// ============================================================================

export async function detectVideoFormat(
  file: Blob & { name?: string }
): Promise<VideoContainerFormat | null> {
  const headerLen = Math.min(12, file.size);
  if (headerLen >= 4) {
    const header = new Uint8Array(await file.slice(0, headerLen).arrayBuffer());
    // EBML / Matroska magic: 0x1A 0x45 0xDF 0xA3
    if (
      header[0] === 0x1a &&
      header[1] === 0x45 &&
      header[2] === 0xdf &&
      header[3] === 0xa3
    ) {
      return "mkv";
    }
    // MP4 / ISO BMFF magic: "ftyp" at offset 4..7
    if (
      headerLen >= 8 &&
      header[4] === 0x66 &&
      header[5] === 0x74 &&
      header[6] === 0x79 &&
      header[7] === 0x70
    ) {
      return "mp4";
    }
  }

  const lower = (file.name ?? "").toLowerCase();
  if (lower.endsWith(".mkv") || lower.endsWith(".mks") || lower.endsWith(".webm")) {
    return "mkv";
  }
  if (lower.endsWith(".mp4") || lower.endsWith(".m4v") || lower.endsWith(".mov")) {
    return "mp4";
  }

  return null;
}

// ============================================================================
// MKV (Matroska / EBML) Streaming Parser via File.slice()
// ============================================================================

const EBML_ID = {
  EBML: 0x1a45dfa3,
  SEGMENT: 0x18538067,
  SEEK_HEAD: 0x114d9b74,
  SEEK: 0x4dbb,
  SEEK_ID: 0x53ab,
  SEEK_POSITION: 0x53ac,
  INFO: 0x1549a966,
  TIMESTAMP_SCALE: 0x2ad7b1,
  TRACKS: 0x1654ae6b,
  TRACK_ENTRY: 0xae,
  TRACK_NUMBER: 0xd7,
  TRACK_TYPE: 0x83,
  FLAG_DEFAULT: 0x88,
  FLAG_FORCED: 0x55aa,
  DEFAULT_DURATION: 0x23e383,
  NAME: 0x536e,
  LANGUAGE: 0x22b59c,
  LANGUAGE_BCP47: 0x22b59d,
  CODEC_ID: 0x86,
  CONTENT_ENCODINGS: 0x6d80,
  CONTENT_ENCODING: 0x6240,
  CONTENT_COMPRESSION: 0x5034,
  CONTENT_COMP_ALGO: 0x4254,
  CONTENT_COMP_SETTINGS: 0x4255,
  CLUSTER: 0x1f43b675,
  CLUSTER_TIMESTAMP: 0xe7,
  SIMPLE_BLOCK: 0xa3,
  BLOCK_GROUP: 0xa0,
  BLOCK: 0xa1,
  BLOCK_DURATION: 0x9b,
  CUES: 0x1c53bb6b,
  ATTACHMENTS: 0x1941a469,
  CHAPTERS: 0x1043a770,
  TAGS: 0x1254c367,
} as const;

const SEGMENT_TOP_LEVEL_IDS = new Set<number>([
  EBML_ID.EBML,
  EBML_ID.SEEK_HEAD,
  EBML_ID.INFO,
  EBML_ID.TRACKS,
  EBML_ID.CLUSTER,
  EBML_ID.CUES,
  EBML_ID.ATTACHMENTS,
  EBML_ID.CHAPTERS,
  EBML_ID.TAGS,
]);

const MKV_TEXT_CODECS = new Set([
  "S_TEXT/UTF8",
  "S_TEXT/ASCII",
  "S_TEXT/ASS",
  "S_TEXT/SSA",
  "S_TEXT/WEBVTT",
  "S_ASS",
  "S_SSA",
]);

const MKV_IMAGE_CODECS = new Set([
  "S_HDMV/PGS",
  "S_VOBSUB",
  "S_VOBSUB/ZLIB",
  "S_DVBSUB",
  "S_HDMV/TEXTST",
]);

interface MkvInternalTrack extends VideoSubtitleTrack {
  defaultDurationNs: number;
  compressionAlgo: number | null;
  compressionSettings: Uint8Array | null;
}

interface MkvMetadata {
  segmentDataOffset: number;
  segmentEnd: number;
  timestampScaleNs: number;
  tracks: MkvInternalTrack[];
}

/**
 * Buffered random-access reader over a Blob/File using File.slice().
 * Keeps RAM usage constant (~4 MB) regardless of file size (even 15 GB+).
 */
class SliceReader {
  readonly size: number;
  private readonly blob: Blob;
  private readonly chunkSize: number;
  private buffer: Uint8Array = new Uint8Array(0);
  private bufStart = 0;
  private bufEnd = 0;

  constructor(blob: Blob, chunkSize: number = 4 * 1024 * 1024) {
    this.blob = blob;
    this.size = blob.size;
    this.chunkSize = chunkSize;
  }

  async ensure(filePos: number, needed: number): Promise<boolean> {
    if (filePos < 0 || filePos >= this.size) return false;
    const actualNeeded = Math.min(needed, this.size - filePos);
    if (filePos >= this.bufStart && filePos + actualNeeded <= this.bufEnd) {
      return true;
    }

    const readLen = Math.max(this.chunkSize, actualNeeded);
    const end = Math.min(this.size, filePos + readLen);
    const arrayBuf = await this.blob.slice(filePos, end).arrayBuffer();
    this.buffer = new Uint8Array(arrayBuf);
    this.bufStart = filePos;
    this.bufEnd = filePos + this.buffer.length;
    return this.bufEnd - filePos >= actualNeeded;
  }

  async readBytes(filePos: number, length: number): Promise<Uint8Array> {
    if (length <= 0) return new Uint8Array(0);
    if (length > this.chunkSize) {
      const end = Math.min(this.size, filePos + length);
      return new Uint8Array(await this.blob.slice(filePos, end).arrayBuffer());
    }
    const ok = await this.ensure(filePos, length);
    if (!ok) {
      const available = Math.max(0, Math.min(length, this.size - filePos));
      if (available === 0) return new Uint8Array(0);
      await this.ensure(filePos, available);
      const start = filePos - this.bufStart;
      return this.buffer.subarray(start, start + available);
    }
    const start = filePos - this.bufStart;
    return this.buffer.subarray(start, start + length);
  }

  async readElementHeader(
    filePos: number
  ): Promise<{ id: number; size: number; unknownSize: boolean; headerLength: number } | null> {
    if (filePos >= this.size) return null;
    const ok = await this.ensure(filePos, Math.min(12, this.size - filePos));
    if (!ok) return null;

    const base = filePos - this.bufStart;
    const idRes = decodeVintId(this.buffer, base);
    if (!idRes) return null;

    const sizePos = base + idRes.length;
    if (sizePos >= this.buffer.length) return null;
    const sizeRes = decodeVintSize(this.buffer, sizePos);
    if (!sizeRes) return null;

    return {
      id: idRes.value,
      size: sizeRes.value,
      unknownSize: sizeRes.unknown,
      headerLength: idRes.length + sizeRes.length,
    };
  }
}

function decodeVintId(
  buf: Uint8Array,
  offset: number
): { value: number; length: number } | null {
  if (offset >= buf.length) return null;
  const first = buf[offset];
  if (first === 0) return null;

  let length = 1;
  let mask = 0x80;
  while (length <= 4 && (first & mask) === 0) {
    mask >>= 1;
    length++;
  }
  if (length > 4 || offset + length > buf.length) return null;

  let value = first;
  for (let i = 1; i < length; i++) {
    value = value * 256 + buf[offset + i];
  }
  return { value, length };
}

function decodeVintSize(
  buf: Uint8Array,
  offset: number
): { value: number; length: number; unknown: boolean } | null {
  if (offset >= buf.length) return null;
  const first = buf[offset];
  if (first === 0) return null;

  let length = 1;
  let mask = 0x80;
  while (length <= 8 && (first & mask) === 0) {
    mask >>= 1;
    length++;
  }
  if (length > 8 || offset + length > buf.length) return null;

  const firstData = first & (mask - 1);
  let value = firstData;
  let allOnes = firstData === mask - 1;

  for (let i = 1; i < length; i++) {
    const b = buf[offset + i];
    if (b !== 0xff) allOnes = false;
    value = value * 256 + b;
  }

  return { value, length, unknown: allOnes };
}

function readUint(buf: Uint8Array, offset: number, length: number): number {
  let val = 0;
  for (let i = 0; i < length; i++) {
    val = val * 256 + buf[offset + i];
  }
  return val;
}

const utf8Decoder = new TextDecoder("utf-8", { fatal: false });

function parseMkvInfo(buf: Uint8Array): number {
  let pos = 0;
  let timestampScaleNs = 1_000_000;

  while (pos < buf.length) {
    const idRes = decodeVintId(buf, pos);
    if (!idRes) break;
    pos += idRes.length;
    const sizeRes = decodeVintSize(buf, pos);
    if (!sizeRes) break;
    pos += sizeRes.length;
    const dataEnd = Math.min(buf.length, pos + sizeRes.value);

    if (idRes.value === EBML_ID.TIMESTAMP_SCALE && sizeRes.value > 0 && sizeRes.value <= 8) {
      timestampScaleNs = readUint(buf, pos, sizeRes.value);
    }

    pos = dataEnd;
  }

  return timestampScaleNs;
}

function parseMkvSeekHead(buf: Uint8Array): Map<number, number> {
  const seeks = new Map<number, number>();
  let pos = 0;

  while (pos < buf.length) {
    const idRes = decodeVintId(buf, pos);
    if (!idRes) break;
    pos += idRes.length;
    const sizeRes = decodeVintSize(buf, pos);
    if (!sizeRes) break;
    pos += sizeRes.length;
    const end = Math.min(buf.length, pos + sizeRes.value);

    if (idRes.value === EBML_ID.SEEK) {
      let inner = pos;
      let targetId: number | null = null;
      let targetPos: number | null = null;

      while (inner < end) {
        const cid = decodeVintId(buf, inner);
        if (!cid) break;
        inner += cid.length;
        const csize = decodeVintSize(buf, inner);
        if (!csize) break;
        inner += csize.length;
        const cend = Math.min(end, inner + csize.value);

        if (cid.value === EBML_ID.SEEK_ID && csize.value <= 4) {
          targetId = readUint(buf, inner, csize.value);
        } else if (cid.value === EBML_ID.SEEK_POSITION && csize.value <= 8) {
          targetPos = readUint(buf, inner, csize.value);
        }
        inner = cend;
      }

      if (targetId !== null && targetPos !== null && !seeks.has(targetId)) {
        seeks.set(targetId, targetPos);
      }
    }

    pos = end;
  }

  return seeks;
}

function parseContentEncodings(buf: Uint8Array): {
  algo: number | null;
  settings: Uint8Array | null;
} {
  let algo: number | null = null;
  let settings: Uint8Array | null = null;

  const walk = (start: number, end: number) => {
    let pos = start;
    while (pos < end) {
      const idRes = decodeVintId(buf, pos);
      if (!idRes) break;
      pos += idRes.length;
      const sizeRes = decodeVintSize(buf, pos);
      if (!sizeRes) break;
      pos += sizeRes.length;
      const elemEnd = Math.min(end, pos + sizeRes.value);

      if (
        idRes.value === EBML_ID.CONTENT_ENCODING ||
        idRes.value === EBML_ID.CONTENT_COMPRESSION
      ) {
        if (idRes.value === EBML_ID.CONTENT_COMPRESSION && algo === null) {
          // Per Matroska spec, default ContentCompAlgo is 0 (zlib) when element is present
          algo = 0;
        }
        walk(pos, elemEnd);
      } else if (idRes.value === EBML_ID.CONTENT_COMP_ALGO) {
        algo = readUint(buf, pos, sizeRes.value);
      } else if (idRes.value === EBML_ID.CONTENT_COMP_SETTINGS) {
        settings = buf.slice(pos, elemEnd);
      }

      pos = elemEnd;
    }
  };

  walk(0, buf.length);
  return { algo, settings };
}

function parseMkvTracks(buf: Uint8Array): MkvInternalTrack[] {
  const tracks: MkvInternalTrack[] = [];
  let pos = 0;

  while (pos < buf.length) {
    const idRes = decodeVintId(buf, pos);
    if (!idRes) break;
    pos += idRes.length;
    const sizeRes = decodeVintSize(buf, pos);
    if (!sizeRes) break;
    pos += sizeRes.length;
    const entryEnd = Math.min(buf.length, pos + sizeRes.value);

    if (idRes.value === EBML_ID.TRACK_ENTRY) {
      let trackNumber = 0;
      let trackType = 0;
      let codec = "";
      let language = "und";
      let languageBcp47 = "";
      let name = "";
      let isDefault = true;
      let isForced = false;
      let defaultDurationNs = 0;
      let compressionAlgo: number | null = null;
      let compressionSettings: Uint8Array | null = null;

      let inner = pos;
      while (inner < entryEnd) {
        const cid = decodeVintId(buf, inner);
        if (!cid) break;
        inner += cid.length;
        const csize = decodeVintSize(buf, inner);
        if (!csize) break;
        inner += csize.length;
        const cend = Math.min(entryEnd, inner + csize.value);

        switch (cid.value) {
          case EBML_ID.TRACK_NUMBER:
            trackNumber = readUint(buf, inner, csize.value);
            break;
          case EBML_ID.TRACK_TYPE:
            trackType = readUint(buf, inner, csize.value);
            break;
          case EBML_ID.CODEC_ID:
            codec = utf8Decoder.decode(buf.subarray(inner, cend)).replace(/\0+$/, "").trim();
            break;
          case EBML_ID.LANGUAGE:
            language = utf8Decoder.decode(buf.subarray(inner, cend)).replace(/\0+$/, "").trim();
            break;
          case EBML_ID.LANGUAGE_BCP47:
            languageBcp47 = utf8Decoder.decode(buf.subarray(inner, cend)).replace(/\0+$/, "").trim();
            break;
          case EBML_ID.NAME:
            name = utf8Decoder.decode(buf.subarray(inner, cend)).replace(/\0+$/, "").trim();
            break;
          case EBML_ID.FLAG_DEFAULT:
            isDefault = readUint(buf, inner, csize.value) !== 0;
            break;
          case EBML_ID.FLAG_FORCED:
            isForced = readUint(buf, inner, csize.value) !== 0;
            break;
          case EBML_ID.DEFAULT_DURATION:
            defaultDurationNs = readUint(buf, inner, csize.value);
            break;
          case EBML_ID.CONTENT_ENCODINGS: {
            const enc = parseContentEncodings(buf.subarray(inner, cend));
            compressionAlgo = enc.algo;
            compressionSettings = enc.settings;
            break;
          }
        }

        inner = cend;
      }

      // TrackType 0x11 (17) = Subtitle
      const upperCodec = codec.toUpperCase();
      const isSubtitleTrack =
        trackType === 0x11 ||
        MKV_TEXT_CODECS.has(upperCodec) ||
        MKV_IMAGE_CODECS.has(upperCodec);

      if (isSubtitleTrack && trackNumber > 0) {
        const effectiveLang = languageBcp47 || language || "und";
        const languageLabel = getLanguageLabel(effectiveLang);
        const isTextBased = MKV_TEXT_CODECS.has(upperCodec);
        const isImageBased =
          MKV_IMAGE_CODECS.has(upperCodec) ||
          upperCodec.includes("PGS") ||
          upperCodec.includes("VOBSUB") ||
          upperCodec.includes("DVBSUB");

        tracks.push({
          id: trackNumber,
          container: "mkv",
          codec,
          language: effectiveLang,
          languageLabel,
          name,
          displayLabel: buildTrackDisplayLabel(languageLabel, name, codec, isForced),
          isTextBased,
          isImageBased,
          isDefault,
          isForced,
          defaultDurationNs,
          compressionAlgo,
          compressionSettings,
        });
      }
    }

    pos = entryEnd;
  }

  return tracks;
}

async function readMkvMetadata(
  file: Blob,
  signal?: AbortSignal
): Promise<MkvMetadata> {
  const reader = new SliceReader(file, 512 * 1024);
  let pos = 0;

  // 1. Read EBML Header
  const ebmlHeader = await reader.readElementHeader(pos);
  if (!ebmlHeader || ebmlHeader.id !== EBML_ID.EBML) {
    throw new VideoExtractorError(
      "PARSE_ERROR",
      "Não foi possível ler o cabeçalho deste arquivo MKV. O arquivo pode estar corrompido."
    );
  }
  pos += ebmlHeader.headerLength + ebmlHeader.size;

  // 2. Find Segment
  let segmentDataOffset = -1;
  let segmentEnd = file.size;

  while (pos < file.size) {
    checkAborted(signal);
    const hdr = await reader.readElementHeader(pos);
    if (!hdr) break;
    if (hdr.id === EBML_ID.SEGMENT) {
      segmentDataOffset = pos + hdr.headerLength;
      segmentEnd = hdr.unknownSize
        ? file.size
        : Math.min(file.size, segmentDataOffset + hdr.size);
      break;
    }
    if (hdr.unknownSize) break;
    pos += hdr.headerLength + hdr.size;
  }

  if (segmentDataOffset === -1) {
    throw new VideoExtractorError(
      "PARSE_ERROR",
      "Estrutura Matroska (Segment) não encontrada neste arquivo."
    );
  }

  // 3. Scan top-level Segment elements before the first Cluster (and collect SeekHead)
  let timestampScaleNs = 1_000_000;
  let foundInfo = false;
  let foundTracks = false;
  let tracks: MkvInternalTrack[] = [];
  const seekPositions = new Map<number, number>();

  pos = segmentDataOffset;
  let elementsScanned = 0;

  while (pos < segmentEnd && elementsScanned < 128) {
    checkAborted(signal);
    const hdr = await reader.readElementHeader(pos);
    if (!hdr) break;
    elementsScanned++;

    const dataStart = pos + hdr.headerLength;
    const dataEnd = hdr.unknownSize
      ? segmentEnd
      : Math.min(segmentEnd, dataStart + hdr.size);

    if (hdr.id === EBML_ID.CLUSTER) {
      // Reached media clusters; stop linear header scan
      break;
    }

    if (hdr.id === EBML_ID.SEEK_HEAD && hdr.size <= 2 * 1024 * 1024) {
      const data = await reader.readBytes(dataStart, hdr.size);
      for (const [k, v] of parseMkvSeekHead(data)) {
        if (!seekPositions.has(k)) seekPositions.set(k, v);
      }
    } else if (hdr.id === EBML_ID.INFO && hdr.size <= 2 * 1024 * 1024) {
      const data = await reader.readBytes(dataStart, hdr.size);
      timestampScaleNs = parseMkvInfo(data);
      foundInfo = true;
    } else if (hdr.id === EBML_ID.TRACKS && hdr.size <= 8 * 1024 * 1024) {
      const data = await reader.readBytes(dataStart, hdr.size);
      tracks = parseMkvTracks(data);
      foundTracks = true;
    }

    if (foundInfo && foundTracks) break;
    if (hdr.unknownSize) break;
    pos = dataEnd;
  }

  // 4. If Info or Tracks are at the end of the file, jump via SeekHead!
  if (!foundInfo && seekPositions.has(EBML_ID.INFO)) {
    const infoPos = segmentDataOffset + seekPositions.get(EBML_ID.INFO)!;
    const hdr = await reader.readElementHeader(infoPos);
    if (hdr && hdr.id === EBML_ID.INFO && hdr.size <= 2 * 1024 * 1024) {
      const data = await reader.readBytes(infoPos + hdr.headerLength, hdr.size);
      timestampScaleNs = parseMkvInfo(data);
    }
  }

  if (!foundTracks && seekPositions.has(EBML_ID.TRACKS)) {
    const tracksPos = segmentDataOffset + seekPositions.get(EBML_ID.TRACKS)!;
    const hdr = await reader.readElementHeader(tracksPos);
    if (hdr && hdr.id === EBML_ID.TRACKS && hdr.size <= 8 * 1024 * 1024) {
      const data = await reader.readBytes(tracksPos + hdr.headerLength, hdr.size);
      tracks = parseMkvTracks(data);
    }
  }

  return {
    segmentDataOffset,
    segmentEnd,
    timestampScaleNs,
    tracks,
  };
}

async function decompressZlib(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") {
    return data;
  }
  try {
    const ds = new DecompressionStream("deflate");
    const writer = ds.writable.getWriter();
    writer.write(new Uint8Array(data));
    writer.close();
    const out = await new Response(ds.readable).arrayBuffer();
    return new Uint8Array(out);
  } catch {
    return data;
  }
}

async function decodeMkvBlockPayload(
  payload: Uint8Array,
  track: MkvInternalTrack
): Promise<string> {
  let bytes = payload;

  if (track.compressionAlgo === 0) {
    bytes = await decompressZlib(bytes);
  } else if (track.compressionAlgo === 3 && track.compressionSettings) {
    const combined = new Uint8Array(track.compressionSettings.length + bytes.length);
    combined.set(track.compressionSettings, 0);
    combined.set(bytes, track.compressionSettings.length);
    bytes = combined;
  }

  const rawText = utf8Decoder.decode(bytes);
  const upperCodec = track.codec.toUpperCase();

  if (
    upperCodec === "S_TEXT/ASS" ||
    upperCodec === "S_TEXT/SSA" ||
    upperCodec === "S_ASS" ||
    upperCodec === "S_SSA"
  ) {
    return cleanAssSubtitleText(rawText);
  }

  if (upperCodec === "S_TEXT/WEBVTT") {
    return cleanVttSubtitleText(rawText);
  }

  return rawText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

function parseBlockHeader(
  buf: Uint8Array
): { trackNumber: number; relativeTimestamp: number; payloadOffset: number } | null {
  const trackVint = decodeVintSize(buf, 0);
  if (!trackVint) return null;
  const headerLen = trackVint.length + 3; // +2 signed int16 relTime +1 flags
  if (buf.length < headerLen) return null;

  const hi = buf[trackVint.length];
  const lo = buf[trackVint.length + 1];
  let relTime = (hi << 8) | lo;
  if (relTime >= 0x8000) relTime -= 0x10000;

  return {
    trackNumber: trackVint.value,
    relativeTimestamp: relTime,
    payloadOffset: headerLen,
  };
}

async function extractMkvTrack(
  file: Blob & { name?: string },
  trackId: number,
  options?: ExtractOptions
): Promise<ExtractionResult> {
  const signal = options?.signal;
  const onProgress = options?.onProgress;

  onProgress?.({
    percent: 0,
    message: "Lendo estrutura do vídeo MKV...",
    loadedBytes: 0,
    totalBytes: file.size,
  });

  const meta = await readMkvMetadata(file, signal);
  const targetTrack = meta.tracks.find((t) => t.id === trackId);
  if (!targetTrack) {
    throw new VideoExtractorError("NO_SUBTITLES", FRIENDLY_MESSAGES.NO_SUBTITLES);
  }
  if (!targetTrack.isTextBased) {
    throw new VideoExtractorError(
      "IMAGE_ONLY_SUBTITLES",
      FRIENDLY_MESSAGES.IMAGE_ONLY_SUBTITLES
    );
  }

  const timecodeScaleMs = meta.timestampScaleNs / 1_000_000;
  const defaultDurationMs =
    targetTrack.defaultDurationNs > 0 ? targetTrack.defaultDurationNs / 1_000_000 : 0;

  // Use a 4 MB sliding window for high throughput & low memory on 2GB-15GB+ files
  const reader = new SliceReader(file, 4 * 1024 * 1024);
  const cues: RawCue[] = [];

  let pos = meta.segmentDataOffset;
  let lastProgressReport = 0;
  let lastYieldTime = Date.now();

  const reportProgress = async (currentPos: number) => {
    const now = Date.now();
    const pct =
      file.size > 0 ? Math.min(99, Math.floor((currentPos / file.size) * 100)) : 0;
    if (pct !== lastProgressReport || now - lastYieldTime >= 60) {
      lastProgressReport = pct;
      onProgress?.({
        percent: pct,
        message: `Lendo faixas do vídeo... ${pct}%`,
        loadedBytes: currentPos,
        totalBytes: file.size,
      });
    }
    if (now - lastYieldTime >= 40) {
      lastYieldTime = now;
      await yieldToMainThread();
    }
  };

  while (pos < meta.segmentEnd) {
    checkAborted(signal);
    const hdr = await reader.readElementHeader(pos);
    if (!hdr) break;

    const dataStart = pos + hdr.headerLength;
    const dataEnd = hdr.unknownSize
      ? meta.segmentEnd
      : Math.min(meta.segmentEnd, dataStart + hdr.size);

    if (hdr.id !== EBML_ID.CLUSTER) {
      if (hdr.unknownSize) break;
      pos = dataEnd;
      await reportProgress(pos);
      continue;
    }

    // Parse inside Cluster
    let clusterPos = dataStart;
    let clusterTimestamp = 0;

    while (clusterPos < dataEnd) {
      checkAborted(signal);
      const child = await reader.readElementHeader(clusterPos);
      if (!child) {
        clusterPos = dataEnd;
        break;
      }

      // If this Cluster had unknown size, stop when we hit the next Segment-level element
      if (hdr.unknownSize && SEGMENT_TOP_LEVEL_IDS.has(child.id)) {
        pos = clusterPos;
        break;
      }

      const childStart = clusterPos + child.headerLength;
      const childEnd = child.unknownSize
        ? dataEnd
        : Math.min(dataEnd, childStart + child.size);

      if (child.id === EBML_ID.CLUSTER_TIMESTAMP && child.size <= 8) {
        const tsBytes = await reader.readBytes(childStart, child.size);
        clusterTimestamp = readUint(tsBytes, 0, tsBytes.length);
      } else if (child.id === EBML_ID.SIMPLE_BLOCK) {
        // Peek only the first 4 bytes to check TrackNumber before reading payload!
        // This skips 99.9% of video/audio frames without copying them.
        const peekLen = Math.min(11, child.size);
        if (peekLen >= 4) {
          const peek = await reader.readBytes(childStart, peekLen);
          const trackVint = decodeVintSize(peek, 0);
          if (trackVint && trackVint.value === trackId) {
            const fullBlock = await reader.readBytes(childStart, child.size);
            const parsedBlock = parseBlockHeader(fullBlock);
            if (parsedBlock && parsedBlock.payloadOffset < fullBlock.length) {
              const text = await decodeMkvBlockPayload(
                fullBlock.subarray(parsedBlock.payloadOffset),
                targetTrack
              );
              if (text) {
                const startMs = Math.round(
                  (clusterTimestamp + parsedBlock.relativeTimestamp) * timecodeScaleMs
                );
                cues.push({
                  startMs,
                  endMs: defaultDurationMs > 0 ? Math.round(startMs + defaultDurationMs) : -1,
                  text,
                });
              }
            }
          }
        }
      } else if (child.id === EBML_ID.BLOCK_GROUP) {
        let bgPos = childStart;
        let matchedBlock: Uint8Array | null = null;
        let blockDuration: number | null = null;
        let isOtherTrack = false;

        while (bgPos < childEnd) {
          const bgChild = await reader.readElementHeader(bgPos);
          if (!bgChild) break;
          const bgDataStart = bgPos + bgChild.headerLength;
          const bgDataEnd = bgChild.unknownSize
            ? childEnd
            : Math.min(childEnd, bgDataStart + bgChild.size);

          if (bgChild.id === EBML_ID.BLOCK) {
            const peekLen = Math.min(11, bgChild.size);
            if (peekLen >= 4) {
              const peek = await reader.readBytes(bgDataStart, peekLen);
              const trackVint = decodeVintSize(peek, 0);
              if (trackVint && trackVint.value === trackId) {
                matchedBlock = (await reader.readBytes(bgDataStart, bgChild.size)).slice();
              } else {
                // Not our subtitle track; skip the rest of this BlockGroup immediately!
                isOtherTrack = true;
                break;
              }
            }
          } else if (bgChild.id === EBML_ID.BLOCK_DURATION && bgChild.size <= 8) {
            const durBytes = await reader.readBytes(bgDataStart, bgChild.size);
            blockDuration = readUint(durBytes, 0, durBytes.length);
          }

          if (bgChild.unknownSize) break;
          bgPos = bgDataEnd;
        }

        if (!isOtherTrack && matchedBlock) {
          const parsedBlock = parseBlockHeader(matchedBlock);
          if (parsedBlock && parsedBlock.payloadOffset < matchedBlock.length) {
            const text = await decodeMkvBlockPayload(
              matchedBlock.subarray(parsedBlock.payloadOffset),
              targetTrack
            );
            if (text) {
              const startMs = Math.round(
                (clusterTimestamp + parsedBlock.relativeTimestamp) * timecodeScaleMs
              );
              const durMs =
                blockDuration !== null
                  ? blockDuration * timecodeScaleMs
                  : defaultDurationMs;
              cues.push({
                startMs,
                endMs: durMs > 0 ? Math.round(startMs + durMs) : -1,
                text,
              });
            }
          }
        }
      }

      if (child.unknownSize) {
        clusterPos = dataEnd;
        break;
      }
      clusterPos = childEnd;
    }

    if (!hdr.unknownSize || clusterPos >= dataEnd) {
      pos = clusterPos;
    }

    await reportProgress(pos);
  }

  const { srt, cueCount } = buildSrtFromCues(cues);
  if (cueCount === 0) {
    throw new VideoExtractorError("EMPTY_TRACK", FRIENDLY_MESSAGES.EMPTY_TRACK);
  }

  onProgress?.({
    percent: 100,
    message: "Legenda extraída com sucesso!",
    loadedBytes: file.size,
    totalBytes: file.size,
  });

  return {
    srt,
    cueCount,
    suggestedFileName: buildExtractedFileName(file.name ?? "video.mkv", targetTrack),
    track: targetTrack,
  };
}

// ============================================================================
// MP4 / M4V Parser via dynamic import("mp4box")
// ============================================================================

const MP4_TEXT_CODEC_PREFIXES = ["tx3g", "wvtt", "sbtl", "text", "stpp"];
const MP4_IMAGE_CODEC_PREFIXES = ["mp4s", "subp", "dvd_subtitle", "c608", "c708"];

function readBlobSliceViaFileReader(blob: Blob): Promise<ArrayBuffer> {
  if (typeof FileReader !== "undefined") {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result as ArrayBuffer);
      fr.onerror = () => reject(fr.error ?? new Error("Falha ao ler trecho do arquivo."));
      fr.readAsArrayBuffer(blob);
    });
  }
  return blob.arrayBuffer();
}

function decodeTx3gSample(data: Uint8Array): string {
  if (data.length < 2) return "";
  const textLen = (data[0] << 8) | data[1];
  if (textLen === 0 || 2 + textLen > data.length) return "";
  return utf8Decoder
    .decode(data.subarray(2, 2 + textLen))
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
}

function decodeWvttSample(data: Uint8Array): string {
  const texts: string[] = [];
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  const parseBoxes = (start: number, end: number) => {
    let pos = start;
    while (pos + 8 <= end) {
      let boxSize = view.getUint32(pos, false);
      const boxType = String.fromCharCode(
        data[pos + 4],
        data[pos + 5],
        data[pos + 6],
        data[pos + 7]
      );
      if (boxSize === 0) boxSize = end - pos;
      if (boxSize < 8 || pos + boxSize > end) break;

      const contentStart = pos + 8;
      const contentEnd = pos + boxSize;

      if (boxType === "vttc") {
        parseBoxes(contentStart, contentEnd);
      } else if (boxType === "payl") {
        const raw = utf8Decoder.decode(data.subarray(contentStart, contentEnd));
        const cleaned = cleanVttSubtitleText(raw);
        if (cleaned) texts.push(cleaned);
      }

      pos += boxSize;
    }
  };

  parseBoxes(0, data.length);
  return texts.join("\n").trim();
}

function decodeStppSample(data: Uint8Array): string {
  const xml = utf8Decoder.decode(data);
  const paragraphs: string[] = [];
  const pRegex = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  let match: RegExpExecArray | null;
  while ((match = pRegex.exec(xml)) !== null) {
    const text = match[1]
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
    if (text) paragraphs.push(text);
  }
  return paragraphs.join("\n").trim();
}

function decodeMp4SubtitleSample(data: Uint8Array, codec: string): string {
  const lower = codec.toLowerCase();
  if (lower.startsWith("wvtt")) {
    return decodeWvttSample(data);
  }
  if (lower.startsWith("stpp")) {
    return decodeStppSample(data);
  }
  return decodeTx3gSample(data);
}

function classifyMp4Track(track: {
  id: number;
  codec?: string;
  language?: string;
  name?: string;
  type?: string;
}): VideoSubtitleTrack | null {
  const codec = (track.codec ?? "").trim();
  const lowerCodec = codec.toLowerCase();

  const isTextBased = MP4_TEXT_CODEC_PREFIXES.some((p) => lowerCodec.startsWith(p));
  const isImageBased = MP4_IMAGE_CODEC_PREFIXES.some((p) => lowerCodec.startsWith(p));
  const isSubType = track.type === "subtitles";

  if (!isSubType && !isTextBased && !isImageBased) {
    return null;
  }

  const language = (track.language ?? "und").trim() || "und";
  const languageLabel = getLanguageLabel(language);
  const name = (track.name ?? "").replace(/\0+$/, "").trim();

  return {
    id: track.id,
    container: "mp4",
    codec: codec || "tx3g",
    language,
    languageLabel,
    name,
    displayLabel: buildTrackDisplayLabel(languageLabel, name, codec || "tx3g"),
    isTextBased: isTextBased || (isSubType && !isImageBased),
    isImageBased,
  };
}

async function parseMp4MovieHeader(
  file: Blob,
  signal?: AbortSignal,
  onProgress?: (progress: ExtractionProgress) => void
) {
  // Dynamically import mp4box so it never bloats the initial Next.js bundle
  const MP4Box = await import("mp4box");
  // keepMdatData = false skips mdat payloads, letting us find `moov` in ms even on 15 GB files!
  const mp4boxfile = MP4Box.createFile(false);

  let readyMovie: Awaited<ReturnType<typeof mp4boxfile.getInfo>> | null = null;
  let parseError: string | null = null;

  mp4boxfile.onReady = (info) => {
    readyMovie = info;
  };
  mp4boxfile.onError = (_module, msg) => {
    parseError = msg;
  };

  const CHUNK_SIZE = 2 * 1024 * 1024;
  let offset = 0;
  let iterations = 0;

  while (offset < file.size && !readyMovie && !parseError) {
    checkAborted(signal);
    const end = Math.min(file.size, offset + CHUNK_SIZE);
    const buf = (await readBlobSliceViaFileReader(
      file.slice(offset, end)
    )) as ArrayBuffer & { fileStart: number };
    buf.fileStart = offset;

    const nextOffset = mp4boxfile.appendBuffer(buf);

    if (typeof nextOffset === "number" && nextOffset > offset) {
      offset = nextOffset;
    } else if (typeof nextOffset === "number" && nextOffset !== offset && nextOffset >= 0) {
      offset = nextOffset;
    } else {
      offset = end;
    }

    iterations++;
    if (iterations > 20_000) break;

    if (onProgress && iterations % 4 === 0) {
      const pct = Math.min(30, Math.floor((offset / Math.max(1, file.size)) * 30));
      onProgress({
        percent: pct,
        message: `Analisando faixas do vídeo MP4... ${pct}%`,
        loadedBytes: offset,
        totalBytes: file.size,
      });
      await yieldToMainThread();
    }
  }

  mp4boxfile.flush();

  if (parseError) {
    throw new VideoExtractorError(
      "PARSE_ERROR",
      `Não foi possível ler a estrutura deste arquivo MP4 (${parseError}).`
    );
  }

  if (!readyMovie) {
    throw new VideoExtractorError(
      "PARSE_ERROR",
      "Não foi possível localizar os metadados (moov) deste arquivo MP4."
    );
  }

  return { mp4boxfile, movie: readyMovie as ReturnType<typeof mp4boxfile.getInfo> };
}

async function inspectMp4Tracks(
  file: Blob,
  signal?: AbortSignal
): Promise<VideoSubtitleTrack[]> {
  const { movie } = await parseMp4MovieHeader(file, signal);
  const tracks: VideoSubtitleTrack[] = [];
  const seen = new Set<number>();

  for (const t of [...movie.subtitleTracks, ...movie.tracks]) {
    if (seen.has(t.id)) continue;
    seen.add(t.id);
    const classified = classifyMp4Track(t);
    if (classified) {
      tracks.push(classified);
    }
  }

  return tracks;
}

async function extractMp4Track(
  file: Blob & { name?: string },
  trackId: number,
  options?: ExtractOptions
): Promise<ExtractionResult> {
  const signal = options?.signal;
  const onProgress = options?.onProgress;

  onProgress?.({
    percent: 0,
    message: "Analisando faixas do vídeo MP4...",
    loadedBytes: 0,
    totalBytes: file.size,
  });

  const { mp4boxfile, movie } = await parseMp4MovieHeader(file, signal, onProgress);

  const rawTrack = movie.tracks.find((t) => t.id === trackId);
  const targetTrack = rawTrack ? classifyMp4Track(rawTrack) : null;
  if (!targetTrack) {
    throw new VideoExtractorError("NO_SUBTITLES", FRIENDLY_MESSAGES.NO_SUBTITLES);
  }
  if (!targetTrack.isTextBased) {
    throw new VideoExtractorError(
      "IMAGE_ONLY_SUBTITLES",
      FRIENDLY_MESSAGES.IMAGE_ONLY_SUBTITLES
    );
  }

  const cues: RawCue[] = [];
  const samplesInfo = mp4boxfile.getTrackSamplesInfo(trackId);

  if (samplesInfo && samplesInfo.length > 0 && !movie.isFragmented) {
    // Fast random-access path: read ONLY the tiny subtitle sample byte ranges via File.slice()!
    // Works in <1s and <5MB RAM even on 15 GB MP4 files.
    const totalSamples = samplesInfo.length;
    let lastYield = Date.now();

    for (let i = 0; i < totalSamples; i++) {
      checkAborted(signal);
      const sample = samplesInfo[i];
      if (!sample || sample.size <= 0 || sample.offset < 0 || sample.offset >= file.size) {
        continue;
      }

      const sliceEnd = Math.min(file.size, sample.offset + sample.size);
      const ab = await readBlobSliceViaFileReader(file.slice(sample.offset, sliceEnd));
      const text = decodeMp4SubtitleSample(new Uint8Array(ab), targetTrack.codec);

      if (text) {
        const timescale = sample.timescale || rawTrack?.timescale || 1000;
        const startMs = Math.round(((sample.cts ?? sample.dts) / timescale) * 1000);
        const durMs = Math.round((sample.duration / timescale) * 1000);
        cues.push({
          startMs,
          endMs: durMs > 0 ? startMs + durMs : -1,
          text,
        });
      }

      if (i % 25 === 0 || i === totalSamples - 1) {
        const pct = Math.min(99, 30 + Math.floor(((i + 1) / totalSamples) * 69));
        onProgress?.({
          percent: pct,
          message: `Lendo faixas do vídeo... ${pct}%`,
          loadedBytes: Math.floor(((i + 1) / totalSamples) * file.size),
          totalBytes: file.size,
        });
        if (Date.now() - lastYield >= 40) {
          lastYield = Date.now();
          await yieldToMainThread();
        }
      }
    }
  } else {
    // Fragmented MP4 fallback: stream chunks through mp4box extraction callbacks
    const MP4Box = await import("mp4box");
    const streamFile = MP4Box.createFile(true);

    streamFile.onReady = () => {
      streamFile.setExtractionOptions(trackId, null, { nbSamples: 50 });
      streamFile.start();
    };

    streamFile.onSamples = (_id, _user, samples) => {
      for (const sample of samples) {
        if (!sample.data || sample.data.length === 0) continue;
        const text = decodeMp4SubtitleSample(sample.data, targetTrack.codec);
        if (text) {
          const timescale = sample.timescale || rawTrack?.timescale || 1000;
          const startMs = Math.round(((sample.cts ?? sample.dts) / timescale) * 1000);
          const durMs = Math.round((sample.duration / timescale) * 1000);
          cues.push({
            startMs,
            endMs: durMs > 0 ? startMs + durMs : -1,
            text,
          });
        }
      }
      if (samples.length > 0) {
        streamFile.releaseUsedSamples(trackId, samples[samples.length - 1].number);
      }
    };

    const CHUNK_SIZE = 2 * 1024 * 1024;
    let offset = 0;
    let lastYield = Date.now();

    while (offset < file.size) {
      checkAborted(signal);
      const end = Math.min(file.size, offset + CHUNK_SIZE);
      const buf = (await readBlobSliceViaFileReader(
        file.slice(offset, end)
      )) as ArrayBuffer & { fileStart: number };
      buf.fileStart = offset;
      streamFile.appendBuffer(buf);
      offset = end;

      const pct = Math.min(99, Math.floor((offset / Math.max(1, file.size)) * 100));
      onProgress?.({
        percent: pct,
        message: `Lendo faixas do vídeo... ${pct}%`,
        loadedBytes: offset,
        totalBytes: file.size,
      });

      if (Date.now() - lastYield >= 40) {
        lastYield = Date.now();
        await yieldToMainThread();
      }
    }

    streamFile.flush();
  }

  const { srt, cueCount } = buildSrtFromCues(cues);
  if (cueCount === 0) {
    throw new VideoExtractorError("EMPTY_TRACK", FRIENDLY_MESSAGES.EMPTY_TRACK);
  }

  onProgress?.({
    percent: 100,
    message: "Legenda extraída com sucesso!",
    loadedBytes: file.size,
    totalBytes: file.size,
  });

  return {
    srt,
    cueCount,
    suggestedFileName: buildExtractedFileName(file.name ?? "video.mp4", targetTrack),
    track: targetTrack,
  };
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Inspects a local `.mkv` or `.mp4` / `.m4v` video file and lists all embedded
 * subtitle tracks (both extractable text tracks and image-based tracks like PGS/VobSub).
 *
 * Reads only the container headers via File.slice() — fast even on 15 GB+ files.
 */
export async function inspectVideoSubtitles(
  file: Blob & { name?: string },
  signal?: AbortSignal
): Promise<VideoInspectionResult> {
  checkAborted(signal);

  const format = await detectVideoFormat(file);
  if (!format) {
    throw new VideoExtractorError(
      "UNSUPPORTED_FORMAT",
      FRIENDLY_MESSAGES.UNSUPPORTED_FORMAT
    );
  }

  let tracks: VideoSubtitleTrack[];
  if (format === "mkv") {
    const meta = await readMkvMetadata(file, signal);
    tracks = meta.tracks.map(
      ({ defaultDurationNs: _d, compressionAlgo: _a, compressionSettings: _s, ...pub }) =>
        pub
    );
  } else {
    tracks = await inspectMp4Tracks(file, signal);
  }

  const textTracks = tracks.filter((t) => t.isTextBased);
  const imageTracks = tracks.filter((t) => !t.isTextBased && t.isImageBased);

  // Order text-based tracks first
  const sortedTracks = [...textTracks, ...tracks.filter((t) => !t.isTextBased)];

  return {
    format,
    tracks: sortedTracks,
    textTracks,
    imageTracks,
  };
}

/**
 * Extracts the chosen subtitle track from a local `.mkv` or `.mp4`/`.m4v` file
 * and returns a clean, valid `.srt` string.
 */
export async function extractSubtitleTrack(
  file: Blob & { name?: string },
  track: VideoSubtitleTrack,
  options?: ExtractOptions
): Promise<ExtractionResult> {
  checkAborted(options?.signal);

  if (!track.isTextBased) {
    throw new VideoExtractorError(
      "IMAGE_ONLY_SUBTITLES",
      FRIENDLY_MESSAGES.IMAGE_ONLY_SUBTITLES
    );
  }

  if (track.container === "mkv") {
    return extractMkvTrack(file, track.id, options);
  }
  return extractMp4Track(file, track.id, options);
}
