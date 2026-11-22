export interface ModelPricing {
  /** Cost in USD per 1,000,000 input (prompt) tokens */
  inputUsdPer1M: number;
  /** Cost in USD per 1,000,000 output (candidate) tokens */
  outputUsdPer1M: number;
}

/**
 * Default Gemini 2.5 Flash pricing (USD per 1M tokens).
 * Easily configurable here or via model-specific overrides below.
 */
export const GEMINI_2_5_FLASH_PRICING: ModelPricing = {
  inputUsdPer1M: 0.15,
  outputUsdPer1M: 0.6,
};

/**
 * Per-model pricing overrides (USD per 1M tokens).
 * Any model not listed here falls back to GEMINI_2_5_FLASH_PRICING.
 */
export const MODEL_PRICING_MAP: Record<string, ModelPricing> = {
  "gemini-2.5-flash": GEMINI_2_5_FLASH_PRICING,
  "gemini-2.5-flash-lite": {
    inputUsdPer1M: 0.1,
    outputUsdPer1M: 0.4,
  },
};

/** Default USD → BRL exchange rate used when no env override is configured */
export const DEFAULT_USD_TO_BRL_RATE = 5.8;

export function getUsdToBrlRate(): number {
  const raw =
    process.env.USD_TO_BRL_RATE ?? process.env.NEXT_PUBLIC_USD_TO_BRL_RATE;
  const parsed = raw ? Number(raw) : NaN;
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return DEFAULT_USD_TO_BRL_RATE;
}

export function getPricingForModel(model?: string): ModelPricing {
  if (model && model in MODEL_PRICING_MAP) {
    return MODEL_PRICING_MAP[model];
  }
  return GEMINI_2_5_FLASH_PRICING;
}

/**
 * Calculates estimated cost in USD for the given input and output token counts.
 */
export function calculateEstimatedCostUsd(
  promptTokens: number,
  outputTokens: number,
  model?: string
): number {
  const safePrompt = Math.max(0, Number.isFinite(promptTokens) ? promptTokens : 0);
  const safeOutput = Math.max(0, Number.isFinite(outputTokens) ? outputTokens : 0);
  const pricing = getPricingForModel(model);

  const inputCost = (safePrompt / 1_000_000) * pricing.inputUsdPer1M;
  const outputCost = (safeOutput / 1_000_000) * pricing.outputUsdPer1M;

  return Number((inputCost + outputCost).toFixed(8));
}

export function convertUsdToBrl(
  costUsd: number,
  rate: number = getUsdToBrlRate()
): number {
  const safeUsd = Math.max(0, Number.isFinite(costUsd) ? costUsd : 0);
  const safeRate = rate > 0 && Number.isFinite(rate) ? rate : DEFAULT_USD_TO_BRL_RATE;
  return Number((safeUsd * safeRate).toFixed(6));
}

export function formatUsd(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  if (safe > 0 && safe < 0.01) {
    return `$${safe.toFixed(4)}`;
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(safe);
}

export function formatBrl(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: safe > 0 && safe < 0.01 ? 4 : 2,
  }).format(safe);
}

export function formatDurationMs(ms: number): string {
  const safe = Math.max(0, Number.isFinite(ms) ? Math.round(ms) : 0);
  if (safe < 1000) return `${safe}ms`;
  const seconds = safe / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remSeconds = Math.round(seconds % 60);
  return `${minutes}m ${remSeconds}s`;
}
