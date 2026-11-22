import { describe, expect, it } from "vitest";
import {
  FRIENDLY_MESSAGES,
  VideoExtractorError,
  buildExtractedFileName,
  cleanAssSubtitleText,
  cleanVttSubtitleText,
  detectVideoFormat,
  extractSubtitleTrack,
  formatSrtTimestamp,
  getLanguageLabel,
  inspectVideoSubtitles,
} from "./videoSubtitleExtractor";

// ============================================================================
// Minimal Binary MKV (EBML) Builder for Unit Tests
// ============================================================================

function concatBytes(...chunks: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const total = chunks.reduce((acc, c) => acc + c.length, 0);
  const out = new Uint8Array(new ArrayBuffer(total));
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

function encodeVintSize(size: number): Uint8Array {
  if (size < 0x7f) {
    return new Uint8Array([0x80 | size]);
  }
  if (size < 0x3fff) {
    return new Uint8Array([0x40 | (size >> 8), size & 0xff]);
  }
  return new Uint8Array([
    0x20 | ((size >> 16) & 0x1f),
    (size >> 8) & 0xff,
    size & 0xff,
  ]);
}

function encodeId(id: number): Uint8Array {
  if (id <= 0xff) return new Uint8Array([id]);
  if (id <= 0xffff) return new Uint8Array([(id >> 8) & 0xff, id & 0xff]);
  if (id <= 0xffffff)
    return new Uint8Array([(id >> 16) & 0xff, (id >> 8) & 0xff, id & 0xff]);
  return new Uint8Array([
    (id >>> 24) & 0xff,
    (id >>> 16) & 0xff,
    (id >>> 8) & 0xff,
    id & 0xff,
  ]);
}

function ebmlElem(id: number, payload: Uint8Array): Uint8Array {
  return concatBytes(encodeId(id), encodeVintSize(payload.length), payload);
}

function ebmlUint(id: number, value: number): Uint8Array {
  const bytes: number[] = [];
  let v = value;
  do {
    bytes.unshift(v & 0xff);
    v = Math.floor(v / 256);
  } while (v > 0);
  return ebmlElem(id, new Uint8Array(bytes));
}

function ebmlStr(id: number, str: string): Uint8Array {
  return ebmlElem(id, new TextEncoder().encode(str));
}

function buildBlock(trackNumber: number, relTime: number, text: string): Uint8Array {
  const trackVint = encodeVintSize(trackNumber);
  const rel = new Uint8Array([
    (relTime >> 8) & 0xff,
    relTime & 0xff,
    0x00, // flags (no lacing)
  ]);
  const payload = new TextEncoder().encode(text);
  return concatBytes(trackVint, rel, payload);
}

function buildSyntheticMkv(options: {
  tracks: Array<{
    number: number;
    type: number;
    codec: string;
    language?: string;
    name?: string;
    forced?: boolean;
  }>;
  clusters?: Array<{
    timestamp: number;
    blocks: Array<{
      trackNumber: number;
      relTime: number;
      duration?: number;
      text: string;
      simple?: boolean;
    }>;
  }>;
}): Blob & { name: string } {
  const ebmlHeader = ebmlElem(0x1a45dfa3, ebmlStr(0x4282, "matroska"));
  const info = ebmlElem(0x1549a966, ebmlUint(0x2ad7b1, 1_000_000));

  const trackEntries = options.tracks.map((t) => {
    const parts: Uint8Array[] = [
      ebmlUint(0xd7, t.number),
      ebmlUint(0x83, t.type),
      ebmlStr(0x86, t.codec),
    ];
    if (t.language) parts.push(ebmlStr(0x22b59c, t.language));
    if (t.name) parts.push(ebmlStr(0x536e, t.name));
    if (t.forced) parts.push(ebmlUint(0x55aa, 1));
    return ebmlElem(0xae, concatBytes(...parts));
  });
  const tracks = ebmlElem(0x1654ae6b, concatBytes(...trackEntries));

  const clusterElements = (options.clusters ?? []).map((c) => {
    const children: Uint8Array[] = [ebmlUint(0xe7, c.timestamp)];
    for (const b of c.blocks) {
      const rawBlock = buildBlock(b.trackNumber, b.relTime, b.text);
      if (b.simple || b.duration === undefined) {
        children.push(ebmlElem(0xa3, rawBlock));
      } else {
        const bg = concatBytes(
          ebmlElem(0xa1, rawBlock),
          ebmlUint(0x9b, b.duration)
        );
        children.push(ebmlElem(0xa0, bg));
      }
    }
    return ebmlElem(0x1f43b675, concatBytes(...children));
  });

  const segment = ebmlElem(
    0x18538067,
    concatBytes(info, tracks, ...clusterElements)
  );

  const blob = new Blob([concatBytes(ebmlHeader, segment)]) as Blob & {
    name: string;
  };
  blob.name = "movie.mkv";
  return blob;
}

describe("videoSubtitleExtractor helpers", () => {
  it("formats SRT timestamps accurately", () => {
    expect(formatSrtTimestamp(0)).toBe("00:00:00,000");
    expect(formatSrtTimestamp(1500)).toBe("00:00:01,500");
    expect(formatSrtTimestamp(3_661_042)).toBe("01:01:01,042");
    expect(formatSrtTimestamp(-50)).toBe("00:00:00,000");
  });

  it("cleans ASS/SSA Matroska block payloads to clean SRT text", () => {
    const raw =
      "12,0,Default,Speaker,0,0,0,,{\\an8\\i1}Hello, world!{\\i0}\\NSecond line\\hhere.";
    expect(cleanAssSubtitleText(raw)).toBe("Hello, world!\nSecond line here.");
  });

  it("strips ASS vector drawing commands", () => {
    const drawing = "1,0,Sign,,0,0,0,,{\\p1}m 0 0 l 100 0 100 100 0 100{\\p0}";
    expect(cleanAssSubtitleText(drawing)).toBe("");
  });

  it("cleans WebVTT cue tags while keeping basic formatting", () => {
    const raw = "<v Speaker><i>Hello</i> <00:00:01.000><c.yellow>there</c></v>";
    expect(cleanVttSubtitleText(raw)).toBe("<i>Hello</i> there");
  });

  it("maps ISO 639-2 / BCP-47 language codes to Portuguese labels", () => {
    expect(getLanguageLabel("eng")).toBe("Inglês");
    expect(getLanguageLabel("pt-BR")).toBe("Português (Brasil)");
    expect(getLanguageLabel("spa")).toBe("Espanhol");
    expect(getLanguageLabel("und")).toBe("Idioma não especificado");
  });

  it("builds clean extracted .srt filenames", () => {
    expect(
      buildExtractedFileName("Inception.2010.1080p.mkv", {
        id: 3,
        container: "mkv",
        codec: "S_TEXT/UTF8",
        language: "eng",
        languageLabel: "Inglês",
        name: "English",
        displayLabel: "Inglês (UTF8)",
        isTextBased: true,
        isImageBased: false,
      })
    ).toBe("Inception.2010.1080p.eng.srt");
  });
});

describe("MKV streaming inspection and extraction", () => {
  it("detects MKV format by EBML magic bytes", async () => {
    const mkv = buildSyntheticMkv({ tracks: [] });
    expect(await detectVideoFormat(mkv)).toBe("mkv");
  });

  it("lists multiple subtitle tracks and extracts S_TEXT/UTF8 & S_TEXT/ASS cleanly", async () => {
    const mkv = buildSyntheticMkv({
      tracks: [
        { number: 1, type: 1, codec: "V_MPEG4/ISO/AVC" }, // Video track
        { number: 2, type: 2, codec: "A_AAC" }, // Audio track
        {
          number: 3,
          type: 0x11,
          codec: "S_TEXT/UTF8",
          language: "eng",
          name: "English (SDH)",
        },
        {
          number: 4,
          type: 0x11,
          codec: "S_TEXT/ASS",
          language: "spa",
          name: "Español",
        },
        {
          number: 5,
          type: 0x11,
          codec: "S_HDMV/PGS",
          language: "eng",
          name: "Blu-ray PGS",
        },
      ],
      clusters: [
        {
          timestamp: 1000,
          blocks: [
            { trackNumber: 1, relTime: 0, text: "FAKE_VIDEO_FRAME", simple: true },
            {
              trackNumber: 3,
              relTime: 500,
              duration: 2500,
              text: "Hello from MKV!",
            },
            {
              trackNumber: 4,
              relTime: 1000,
              duration: 3000,
              text: "0,0,Default,,0,0,0,,{\\an8}¡Hola,\\Nmundo!",
            },
          ],
        },
        {
          timestamp: 10_000,
          blocks: [
            {
              trackNumber: 3,
              relTime: 0,
              duration: 2000,
              text: "Second cue line 1\nSecond cue line 2",
            },
          ],
        },
      ],
    });

    const inspection = await inspectVideoSubtitles(mkv);
    expect(inspection.format).toBe("mkv");
    expect(inspection.textTracks).toHaveLength(2);
    expect(inspection.imageTracks).toHaveLength(1);
    expect(inspection.imageTracks[0].codec).toBe("S_HDMV/PGS");

    // Extract UTF-8 track
    const utf8Result = await extractSubtitleTrack(mkv, inspection.textTracks[0]);
    expect(utf8Result.cueCount).toBe(2);
    expect(utf8Result.srt).toBe(
      [
        "1",
        "00:00:01,500 --> 00:00:04,000",
        "Hello from MKV!",
        "",
        "2",
        "00:00:10,000 --> 00:00:12,000",
        "Second cue line 1",
        "Second cue line 2",
        "",
      ].join("\n")
    );

    // Extract ASS track (tags stripped, \N converted to newline)
    const assResult = await extractSubtitleTrack(mkv, inspection.textTracks[1]);
    expect(assResult.cueCount).toBe(1);
    expect(assResult.srt).toBe(
      ["1", "00:00:02,000 --> 00:00:05,000", "¡Hola,", "mundo!", ""].join("\n")
    );
  });

  it("identifies image-only Blu-ray/DVD subtitle tracks", async () => {
    const mkv = buildSyntheticMkv({
      tracks: [
        { number: 1, type: 1, codec: "V_MPEG4/ISO/AVC" },
        { number: 2, type: 0x11, codec: "S_HDMV/PGS", language: "eng" },
      ],
    });

    const inspection = await inspectVideoSubtitles(mkv);
    expect(inspection.textTracks).toHaveLength(0);
    expect(inspection.imageTracks).toHaveLength(1);

    await expect(
      extractSubtitleTrack(mkv, inspection.imageTracks[0])
    ).rejects.toThrowError(
      new VideoExtractorError(
        "IMAGE_ONLY_SUBTITLES",
        FRIENDLY_MESSAGES.IMAGE_ONLY_SUBTITLES
      )
    );
  });

  it("supports cancellation via AbortSignal", async () => {
    const mkv = buildSyntheticMkv({
      tracks: [{ number: 3, type: 0x11, codec: "S_TEXT/UTF8", language: "eng" }],
    });
    const controller = new AbortController();
    controller.abort();

    await expect(
      inspectVideoSubtitles(mkv, controller.signal)
    ).rejects.toThrowError(VideoExtractorError);
  });
});
