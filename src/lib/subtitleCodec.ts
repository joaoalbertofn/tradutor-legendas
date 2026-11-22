export interface IndexedTranslationItem {
  id: number;
  text: string;
}

/**
 * Escapes backslashes and newlines so each subtitle cue occupies exactly one physical line.
 */
export function escapeInlineText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n");
}

/**
 * Reverses `escapeInlineText` in a single pass so literal `\\n` is preserved accurately.
 */
export function unescapeInlineText(raw: string): string {
  let out = "";
  let i = 0;
  while (i < raw.length) {
    if (raw[i] === "\\" && i + 1 < raw.length) {
      const next = raw[i + 1];
      if (next === "n") {
        out += "\n";
        i += 2;
        continue;
      }
      if (next === "\\") {
        out += "\\";
        i += 2;
        continue;
      }
    }
    out += raw[i];
    i += 1;
  }
  return out;
}

/**
 * Encodes a batch of subtitle items into the ultra-compact `ID|text` line format.
 * Reduces input/output token overhead by ~30% compared to JSON `{id, text}` arrays
 * while preserving explicit 1:1 IDs on every line.
 */
export function encodeIndexedBatch(items: IndexedTranslationItem[]): string {
  return items
    .map((item) => `${item.id}|${escapeInlineText(item.text)}`)
    .join("\n");
}

/**
 * Parses a model response in `ID|text` format and validates strict 1:1 coverage
 * of all expected IDs. Returns `null` if any expected ID is missing or unparseable
 * so the caller can fall back to structured JSON `{id, text}[]`.
 */
export function decodeIndexedBatch(
  rawOutput: string,
  expectedIds: Set<number>
): Map<number, string> | null {
  if (!rawOutput || !rawOutput.trim()) return null;

  // Strip optional markdown code fences if the model wrapped the plain text output
  let cleaned = rawOutput.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned
      .replace(/^```[a-zA-Z0-9_-]*\s*\r?\n?/, "")
      .replace(/\r?\n?```\s*$/, "")
      .trim();
  }

  const lines = cleaned.split(/\r?\n/);
  const result = new Map<number, string>();

  for (const line of lines) {
    if (!line.trim()) continue;
    const match = line.match(/^\s*(\d+)\|(.*)$/);
    if (!match) continue;

    const id = Number(match[1]);
    if (!Number.isSafeInteger(id) || !expectedIds.has(id) || result.has(id)) {
      continue;
    }

    result.set(id, unescapeInlineText(match[2]));
  }

  if (result.size !== expectedIds.size) {
    return null;
  }

  return result;
}
