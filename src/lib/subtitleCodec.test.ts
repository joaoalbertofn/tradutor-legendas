import { describe, expect, it } from "vitest";
import {
  decodeIndexedBatch,
  encodeIndexedBatch,
  escapeInlineText,
  unescapeInlineText,
} from "./subtitleCodec";

describe("subtitleCodec", () => {
  it("escapes and unescapes newlines and backslashes losslessly", () => {
    const samples = [
      "Hello\nworld",
      "<i>Line 1</i>\n<i>Line 2</i>",
      "Path C:\\new\\test",
      "Pipe | inside | subtitle",
      "Already literal \\n sequence",
      "",
    ];

    for (const sample of samples) {
      const encoded = escapeInlineText(sample);
      expect(encoded).not.toContain("\n");
      expect(unescapeInlineText(encoded)).toBe(sample);
    }
  });

  it("encodes and decodes indexed batches with 1:1 ID fidelity", () => {
    const items = [
      { id: 10, text: "<i>Listen up!</i>" },
      { id: 11, text: "Line one\nLine two | with pipe" },
      { id: 12, text: "[Ali G] Switch off ya phones!" },
    ];

    const encoded = encodeIndexedBatch(items);
    expect(encoded).toBe(
      "10|<i>Listen up!</i>\n11|Line one\\nLine two | with pipe\n12|[Ali G] Switch off ya phones!"
    );

    const modelReply = [
      "10|<i>Ouçam aqui!</i>",
      "11|Linha um\\nLinha dois | com barra",
      "12|[Ali G] Desliguem os celulares!",
    ].join("\n");

    const decoded = decodeIndexedBatch(modelReply, new Set([10, 11, 12]));
    expect(decoded).not.toBeNull();
    expect(decoded?.get(10)).toBe("<i>Ouçam aqui!</i>");
    expect(decoded?.get(11)).toBe("Linha um\nLinha dois | com barra");
    expect(decoded?.get(12)).toBe("[Ali G] Desliguem os celulares!");
  });

  it("handles markdown code fences around plain-text output", () => {
    const fenced = "```text\n1|Olá\n2|Mundo\n```";
    const decoded = decodeIndexedBatch(fenced, new Set([1, 2]));
    expect(decoded?.get(1)).toBe("Olá");
    expect(decoded?.get(2)).toBe("Mundo");
  });

  it("returns null when any expected ID is missing (triggering JSON fallback)", () => {
    const partial = "1|Olá\n2|Mundo";
    expect(decodeIndexedBatch(partial, new Set([1, 2, 3]))).toBeNull();
  });
});
