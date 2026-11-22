import { describe, expect, it } from "vitest";
import {
  GEMINI_2_5_FLASH_PRICING,
  calculateEstimatedCostUsd,
  convertUsdToBrl,
  formatBrl,
  formatDurationMs,
  formatUsd,
} from "./pricing";

describe("pricing", () => {
  it("calculates Gemini 2.5 Flash cost accurately ($0.15/1M input, $0.60/1M output)", () => {
    expect(GEMINI_2_5_FLASH_PRICING.inputUsdPer1M).toBe(0.15);
    expect(GEMINI_2_5_FLASH_PRICING.outputUsdPer1M).toBe(0.6);

    // 1M input + 1M output = $0.75
    expect(calculateEstimatedCostUsd(1_000_000, 1_000_000)).toBe(0.75);

    // 100k input ($0.015) + 50k output ($0.03) = $0.045
    expect(calculateEstimatedCostUsd(100_000, 50_000, "gemini-2.5-flash")).toBe(
      0.045
    );
  });

  it("handles zero or invalid token counts safely", () => {
    expect(calculateEstimatedCostUsd(0, 0)).toBe(0);
    expect(calculateEstimatedCostUsd(-500, Number.NaN)).toBe(0);
  });

  it("converts USD to BRL using provided rate", () => {
    expect(convertUsdToBrl(1, 5.8)).toBe(5.8);
    expect(convertUsdToBrl(0.05, 6)).toBe(0.3);
  });

  it("formats USD, BRL and duration cleanly", () => {
    expect(formatUsd(0.0025)).toBe("$0.0025");
    expect(formatUsd(1.25)).toBe("$1.25");
    expect(formatBrl(5.8)).toContain("5,80");
    expect(formatDurationMs(450)).toBe("450ms");
    expect(formatDurationMs(4200)).toBe("4.2s");
    expect(formatDurationMs(125_000)).toBe("2m 5s");
  });
});
