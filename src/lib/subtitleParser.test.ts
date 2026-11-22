import { describe, it, expect } from "vitest";
import {
  parseSubtitle,
  reconstructSubtitle,
  chunkSubtitleBlocks,
  getTranslatedFileName,
  buildFullContextTranscript,
  buildChunkContext,
  decodeSubtitleBuffer,
} from "./subtitleParser";

describe("subtitleParser", () => {
  it("parses and reconstructs a standard SRT file with 100% fidelity", () => {
    const srt = [
      "1",
      "00:00:01,000 --> 00:00:04,500",
      "<i>Previously on the show...</i>",
      "We need to talk.",
      "",
      "2",
      "00:00:05,200 --> 00:00:08,000",
      "Are you sure about this?",
      "",
    ].join("\n");

    const parsed = parseSubtitle(srt, "episode.srt");
    expect(parsed.format).toBe("srt");
    expect(parsed.blocks).toHaveLength(2);
    expect(parsed.blocks[0]).toEqual({
      id: 1,
      index: "1",
      timestamp: "00:00:01,000 --> 00:00:04,500",
      text: "<i>Previously on the show...</i>\nWe need to talk.",
    });

    const translations = new Map<number, string>([
      [1, "<i>Anteriormente na série...</i>\nPrecisamos conversar."],
      [2, "Você tem certeza disso?"],
    ]);

    const rebuilt = reconstructSubtitle(parsed, translations);
    expect(rebuilt).toBe(
      [
        "1",
        "00:00:01,000 --> 00:00:04,500",
        "<i>Anteriormente na série...</i>",
        "Precisamos conversar.",
        "",
        "2",
        "00:00:05,200 --> 00:00:08,000",
        "Você tem certeza disso?",
        "",
      ].join("\n")
    );
  });

  it("preserves CRLF line endings and handles UTF-8 BOM on input", () => {
    const srt = "\uFEFF1\r\n00:00:01,000 --> 00:00:02,000\r\nHello\r\n\r\n";
    const parsed = parseSubtitle(srt, "movie.srt");
    expect(parsed.hasBom).toBe(true);
    expect(parsed.lineEnding).toBe("\r\n");

    const rebuilt = reconstructSubtitle(parsed, { 1: "Olá" });
    expect(rebuilt).toBe("1\r\n00:00:01,000 --> 00:00:02,000\r\nOlá\r\n");
  });

  it("parses and reconstructs a VTT file preserving WEBVTT header, metadata, NOTE, cue IDs, and cue settings", () => {
    const vtt = [
      "WEBVTT - Sample Episode",
      "Kind: captions",
      "Language: en",
      "",
      "STYLE",
      "::cue { color: white; }",
      "",
      "cue-1",
      "00:01.000 --> 00:04.500 align:start position:10%",
      "<b>Watch out!</b>",
      "",
      "NOTE Mid-file comment",
      "",
      "00:05.000 --> 00:08.250",
      "That was close.",
      "",
    ].join("\n");

    const parsed = parseSubtitle(vtt, "sample.vtt");
    expect(parsed.format).toBe("vtt");
    expect(parsed.header).toContain("WEBVTT - Sample Episode");
    expect(parsed.header).toContain("STYLE");
    expect(parsed.blocks).toHaveLength(2);
    expect(parsed.blocks[0].index).toBe("cue-1");
    expect(parsed.blocks[0].timestamp).toBe("00:01.000 --> 00:04.500 align:start position:10%");
    expect(parsed.blocks[1].index).toBe("");
    expect(parsed.blocks[1].prefix).toBe("NOTE Mid-file comment");

    const rebuilt = reconstructSubtitle(parsed, {
      1: "<b>Cuidado!</b>",
      2: "Essa foi por pouco.",
    });

    expect(rebuilt).toBe(
      [
        "WEBVTT - Sample Episode",
        "Kind: captions",
        "Language: en",
        "",
        "STYLE",
        "::cue { color: white; }",
        "",
        "cue-1",
        "00:01.000 --> 00:04.500 align:start position:10%",
        "<b>Cuidado!</b>",
        "",
        "NOTE Mid-file comment",
        "",
        "00:05.000 --> 00:08.250",
        "Essa foi por pouco.",
        "",
      ].join("\n")
    );
  });

  it("chunks blocks into groups of 40", () => {
    const blocks = Array.from({ length: 85 }, (_, i) => ({
      id: i + 1,
      index: String(i + 1),
      timestamp: "00:00:01,000 --> 00:00:02,000",
      text: `Line ${i + 1}`,
    }));

    const chunks = chunkSubtitleBlocks(blocks, 40);
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toHaveLength(40);
    expect(chunks[1]).toHaveLength(40);
    expect(chunks[2]).toHaveLength(5);
  });

  it("formats translated output filenames properly", () => {
    expect(getTranslatedFileName("filme.srt", "srt")).toBe("filme.pt-BR.srt");
    expect(getTranslatedFileName("serie.S01E01.en.vtt", "vtt")).toBe(
      "serie.S01E01.en.pt-BR.vtt"
    );
    expect(getTranslatedFileName("filme.pt-BR.srt", "srt")).toBe("filme.pt-BR.srt");
  });

  it("builds a compact full-context transcript without timestamps", () => {
    const transcript = buildFullContextTranscript([
      { id: 1, index: "1", timestamp: "00:00:01,000 --> 00:00:02,000", text: "Hello\nworld" },
      { id: 2, index: "2", timestamp: "00:00:03,000 --> 00:00:04,000", text: "How are you?" },
    ]);
    expect(transcript).toBe("[1] Hello world\n[2] How are you?");
    expect(transcript).not.toContain("-->");
  });

  it("splits SRT blocks cleanly even when blank lines contain spaces or tabs", () => {
    const srt = [
      "1",
      "00:00:01,000 --> 00:00:02,000",
      "First line",
      "   \t  ",
      "2",
      "00:00:03,000 --> 00:00:04,000",
      "Second line",
      "",
    ].join("\n");

    const parsed = parseSubtitle(srt, "spaces.srt");
    expect(parsed.blocks).toHaveLength(2);
    expect(parsed.blocks[0].text).toBe("First line");
    expect(parsed.blocks[1].text).toBe("Second line");
    expect(parsed.blocks[0].text).not.toContain("-->");
  });

  it("decodes UTF-8, UTF-16LE, and Windows-1252 subtitle buffers without corrupting accents", () => {
    // Windows-1252 bytes for "Ação, coração!" (0xE7 = ç, 0xE3 = ã)
    const win1252 = new Uint8Array([
      0x41, 0xe7, 0xe3, 0x6f, 0x2c, 0x20, 0x63, 0x6f, 0x72, 0x61, 0xe7, 0xe3, 0x6f, 0x21,
    ]);
    expect(decodeSubtitleBuffer(win1252.buffer)).toBe("Ação, coração!");

    // UTF-16LE BOM + "Hi"
    const utf16le = new Uint8Array([0xff, 0xfe, 0x48, 0x00, 0x69, 0x00]);
    expect(decodeSubtitleBuffer(utf16le.buffer)).toBe("Hi");
  });

  it("uses hybrid sliding-window context for long subtitles (> 500 blocks)", () => {
    const manyBlocks = Array.from({ length: 600 }, (_, i) => ({
      id: i + 1,
      index: String(i + 1),
      timestamp: "00:00:01,000 --> 00:00:02,000",
      text: `Dialogue line ${i + 1}`,
    }));

    const ctx = buildChunkContext(manyBlocks, 5, 40); // chunk 5 = blocks 201..240
    expect(ctx).toContain("[Abertura da obra]");
    expect(ctx).toContain("[1] Dialogue line 1");
    expect(ctx).toContain("[201] Dialogue line 201");
    expect(ctx).not.toContain("[599] Dialogue line 599");
  });
});
