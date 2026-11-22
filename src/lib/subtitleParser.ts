import type { ParsedSubtitle, SubtitleBlock, SubtitleFormat } from "./types";

const SRT_TIMESTAMP_REGEX =
  /^\d{1,2}:\d{2}:\d{2}[,.]\d{3}\s*-->\s*\d{1,2}:\d{2}:\d{2}[,.]\d{3}(?:\s+.*)?$/;

const VTT_TIMESTAMP_REGEX =
  /^(?:\d{1,2}:)?\d{2}:\d{2}\.\d{3}\s*-->\s*(?:\d{1,2}:)?\d{2}:\d{2}\.\d{3}(?:\s+.*)?$/;

export const CHUNK_SIZE = 70;
export const FULL_CONTEXT_BLOCK_THRESHOLD = 500;
export const MAX_FULL_CONTEXT_CHARS = 80_000;
export const CONTEXT_INTRO_BLOCKS = 15;
export const CONTEXT_WINDOW_BEFORE = 20;
export const CONTEXT_WINDOW_AFTER = 20;

/**
 * Decodes a subtitle ArrayBuffer supporting UTF-8 (with or without BOM),
 * UTF-16 LE/BE, and falling back cleanly to Windows-1252 / ISO-8859-1 for legacy .srt files.
 */
export function decodeSubtitleBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);

  if (bytes.length >= 2) {
    // UTF-16 LE BOM
    if (bytes[0] === 0xff && bytes[1] === 0xfe) {
      return new TextDecoder("utf-16le").decode(bytes);
    }
    // UTF-16 BE BOM
    if (bytes[0] === 0xfe && bytes[1] === 0xff) {
      return new TextDecoder("utf-16be").decode(bytes);
    }
  }

  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

export function detectFormat(content: string, fileName?: string): SubtitleFormat {
  const clean = content.replace(/^\uFEFF/, "").trimStart();
  if (clean.startsWith("WEBVTT")) {
    return "vtt";
  }
  if (fileName?.toLowerCase().endsWith(".vtt")) {
    return "vtt";
  }
  return "srt";
}

function isTimestampLine(line: string, format: SubtitleFormat): boolean {
  const trimmed = line.trim();
  if (format === "vtt") {
    return VTT_TIMESTAMP_REGEX.test(trimmed) || SRT_TIMESTAMP_REGEX.test(trimmed);
  }
  return SRT_TIMESTAMP_REGEX.test(trimmed);
}

function isVttNonCueBlock(segment: string): boolean {
  const firstLine = segment.split("\n")[0]?.trim() ?? "";
  return (
    firstLine.startsWith("WEBVTT") ||
    firstLine.startsWith("NOTE") ||
    firstLine.startsWith("STYLE") ||
    firstLine.startsWith("REGION")
  );
}

/**
 * Parses an .srt or .vtt subtitle string into structured blocks while preserving
 * 100% of headers, cue indices, timestamps, cue settings, inline tags, and line endings.
 */
export function parseSubtitle(rawContent: string, fileName?: string): ParsedSubtitle {
  const hasBom = rawContent.startsWith("\uFEFF");
  const withoutBom = hasBom ? rawContent.slice(1) : rawContent;
  const lineEnding: "\r\n" | "\n" = withoutBom.includes("\r\n") ? "\r\n" : "\n";
  const normalized = withoutBom.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const format = detectFormat(normalized, fileName);

  const rawSegments = normalized.split(/\n[ \t]*\n+/);
  const blocks: SubtitleBlock[] = [];
  const headerSegments: string[] = [];
  let pendingPrefixSegments: string[] = [];
  let seenFirstCue = false;
  let nextId = 1;

  for (const rawSegment of rawSegments) {
    const segment = rawSegment.replace(/^\n+|\n+$/g, "");
    if (!segment.trim()) {
      continue;
    }

    const lines = segment.split("\n");
    const tsIndex = lines.findIndex((line) => isTimestampLine(line, format));

    if (tsIndex === -1) {
      if (format === "vtt" && !seenFirstCue) {
        headerSegments.push(segment);
      } else if (format === "vtt" && isVttNonCueBlock(segment)) {
        pendingPrefixSegments.push(segment);
      } else if (!seenFirstCue && format === "srt") {
        // Ignore stray preamble before first SRT cue if any
        headerSegments.push(segment);
      } else {
        pendingPrefixSegments.push(segment);
      }
      continue;
    }

    seenFirstCue = true;
    const indexLines = lines.slice(0, tsIndex);
    const timestamp = lines[tsIndex];
    const textLines = lines.slice(tsIndex + 1);

    const block: SubtitleBlock = {
      id: nextId++,
      index: indexLines.join("\n"),
      timestamp,
      text: textLines.join("\n"),
    };

    if (pendingPrefixSegments.length > 0) {
      block.prefix = pendingPrefixSegments.join("\n\n");
      pendingPrefixSegments = [];
    }

    blocks.push(block);
  }

  const header =
    format === "vtt" && headerSegments.length === 0
      ? "WEBVTT"
      : headerSegments.join("\n\n");

  const trailing = pendingPrefixSegments.join("\n\n");

  return {
    format,
    header,
    blocks,
    trailing,
    lineEnding,
    hasBom,
  };
}

/**
 * Reconstructs the subtitle file verbatim, replacing only the dialogue text of each block
 * with its translated version while keeping headers, indices, timestamps, and line endings intact.
 */
export function reconstructSubtitle(
  parsed: ParsedSubtitle,
  translations: Map<number, string> | Record<number, string>
): string {
  const getTranslatedText = (block: SubtitleBlock): string => {
    if (translations instanceof Map) {
      return translations.get(block.id) ?? block.text;
    }
    return translations[block.id] ?? block.text;
  };

  const segments: string[] = [];

  if (parsed.header) {
    segments.push(parsed.header);
  }

  for (const block of parsed.blocks) {
    if (block.prefix) {
      segments.push(block.prefix);
    }

    const lines: string[] = [];
    if (block.index !== "") {
      lines.push(block.index);
    }
    lines.push(block.timestamp);

    const translatedText = getTranslatedText(block).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    if (translatedText !== "") {
      lines.push(translatedText);
    }

    segments.push(lines.join("\n"));
  }

  if (parsed.trailing) {
    segments.push(parsed.trailing);
  }

  const output = segments.join("\n\n") + "\n";
  return parsed.lineEnding === "\r\n" ? output.replace(/\n/g, "\r\n") : output;
}

/**
 * Splits subtitle blocks into fixed-size chunks (default: 70 blocks per chunk).
 */
export function chunkSubtitleBlocks(
  blocks: SubtitleBlock[],
  chunkSize: number = CHUNK_SIZE
): SubtitleBlock[][] {
  if (chunkSize <= 0) {
    throw new Error("chunkSize must be greater than 0");
  }
  const chunks: SubtitleBlock[][] = [];
  for (let i = 0; i < blocks.length; i += chunkSize) {
    chunks.push(blocks.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Builds a compact read-only transcript of the entire original subtitle (without timestamps)
 * so concurrent translation workers share full narrative/character context.
 */
export function buildFullContextTranscript(
  blocks: SubtitleBlock[],
  maxChars: number = MAX_FULL_CONTEXT_CHARS
): string {
  const lines: string[] = [];
  let totalChars = 0;

  for (const block of blocks) {
    const compact = block.text.replace(/\s+/g, " ").trim();
    if (!compact) continue;
    const entry = `[${block.id}] ${compact}`;
    if (totalChars + entry.length + 1 > maxChars) {
      lines.push("... [restante truncado por limite de tamanho]");
      break;
    }
    lines.push(entry);
    totalChars += entry.length + 1;
  }

  return lines.join("\n");
}

/**
 * Hybrid context builder:
 * - For files up to 500 blocks (<= 80k chars), sends the entire original transcript.
 * - For long movies (> 500 blocks), sends the opening 15 blocks (character names/tone)
 *   plus a compact sliding window of 20 blocks before and 20 blocks after the current chunk,
 *   EXCLUDING the current chunk itself to avoid duplicating input tokens.
 */
export function buildChunkContext(
  blocks: SubtitleBlock[],
  chunkIndex: number,
  chunkSize: number = CHUNK_SIZE,
  cachedFullTranscript?: string
): string {
  if (blocks.length <= FULL_CONTEXT_BLOCK_THRESHOLD) {
    return cachedFullTranscript ?? buildFullContextTranscript(blocks);
  }

  const start = chunkIndex * chunkSize;
  const end = Math.min(blocks.length, start + chunkSize);
  const windowStart = Math.max(0, start - CONTEXT_WINDOW_BEFORE);
  const windowEnd = Math.min(blocks.length, end + CONTEXT_WINDOW_AFTER);

  const sections: string[] = [];

  if (windowStart > CONTEXT_INTRO_BLOCKS) {
    const intro = buildFullContextTranscript(
      blocks.slice(0, CONTEXT_INTRO_BLOCKS),
      6_000
    );
    if (intro) {
      sections.push(`[Abertura da obra]\n${intro}`);
    }
  }

  if (windowStart < start) {
    const beforeWindow = buildFullContextTranscript(
      blocks.slice(windowStart, start),
      12_000
    );
    if (beforeWindow) {
      sections.push(`[Contexto imediatamente anterior]\n${beforeWindow}`);
    }
  }

  if (end < windowEnd) {
    const afterWindow = buildFullContextTranscript(
      blocks.slice(end, windowEnd),
      12_000
    );
    if (afterWindow) {
      sections.push(`[Contexto imediatamente posterior]\n${afterWindow}`);
    }
  }

  return sections.join("\n\n");
}

/**
 * Generates the output filename with the `.pt-BR` suffix before the extension.
 * Example: `movie.srt` -> `movie.pt-BR.srt`, `episode.en.vtt` -> `episode.en.pt-BR.vtt`.
 */
export function getTranslatedFileName(originalName: string, format: SubtitleFormat): string {
  const lastDot = originalName.lastIndexOf(".");
  if (lastDot === -1) {
    return `${originalName}.pt-BR.${format}`;
  }
  const base = originalName.slice(0, lastDot);
  const ext = originalName.slice(lastDot + 1);
  if (base.toLowerCase().endsWith(".pt-br")) {
    return `${base}.${ext}`;
  }
  return `${base}.pt-BR.${ext}`;
}

/**
 * Creates a downloadable UTF-8 Blob with optional BOM for older players and Smart TVs.
 */
export function createSubtitleBlob(
  content: string,
  format: SubtitleFormat,
  includeBom: boolean
): Blob {
  const payload = includeBom ? `\uFEFF${content}` : content;
  const mimeType =
    format === "vtt" ? "text/vtt;charset=utf-8" : "application/x-subrip;charset=utf-8";
  return new Blob([payload], { type: mimeType });
}
