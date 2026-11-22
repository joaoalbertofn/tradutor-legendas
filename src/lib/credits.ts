import crypto from "crypto";
import type { UserCreditsInfo } from "./types";

export const FREE_DAILY_LIMIT = 3;
export const CREDIT_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

interface UserCreditsRow {
  user_id: string;
  free_used_today: number;
  free_reset_at: string;
  paid_credits: number;
  paid_expires_at: string | null;
  updated_at: string;
}

export interface PaymentTransactionRecord {
  id: string;
  provider: string;
  external_payment_id: string;
  user_id: string;
  credits_added: number;
  amount_cents: number;
  status: string;
  created_at: string;
}

interface SupabaseConfig {
  url: string;
  key: string;
}

function getSupabaseConfig(): SupabaseConfig | null {
  if (process.env.CREDITS_FORCE_MEMORY === "true") {
    return null;
  }

  const url = (
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  )?.trim();
  const key = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )?.trim();

  if (!url || !key) return null;
  return { url: url.replace(/\/+$/, ""), key };
}

function buildSupabaseHeaders(
  key: string,
  extra?: Record<string, string>
): Record<string, string> {
  const headers: Record<string, string> = {
    apikey: key,
    ...(extra ?? {}),
  };
  // Legacy JWT keys (eyJ...) require Authorization: Bearer; new sb_secret_... keys must NOT send it
  if (key.startsWith("eyJ")) {
    headers.Authorization = `Bearer ${key}`;
  }
  return headers;
}

const globalForCredits = globalThis as unknown as {
  __memoryUserCredits?: Map<string, UserCreditsRow>;
  __memoryPaymentTx?: Map<string, PaymentTransactionRecord>;
};

const memoryUserCredits = (globalForCredits.__memoryUserCredits ??= new Map<
  string,
  UserCreditsRow
>());
const memoryPaymentTx = (globalForCredits.__memoryPaymentTx ??= new Map<
  string,
  PaymentTransactionRecord
>());

/** Test helper to reset in-memory stores */
export function __resetMemoryCreditsStore(): void {
  memoryUserCredits.clear();
  memoryPaymentTx.clear();
}

function createDefaultRow(userId: string, now: Date): UserCreditsRow {
  const nowIso = now.toISOString();
  const resetIso = new Date(now.getTime() + CREDIT_WINDOW_MS).toISOString();
  return {
    user_id: userId,
    free_used_today: 0,
    free_reset_at: resetIso,
    paid_credits: 0,
    paid_expires_at: null,
    updated_at: nowIso,
  };
}

/**
 * Pure lazy-reset evaluation (no cron job required):
 * 1. If now >= free_reset_at, reset free_used_today = 0 and free_reset_at = now + 24h.
 * 2. If paid_expires_at exists and now >= paid_expires_at, reset paid_credits = 0 and paid_expires_at = null.
 */
export function applyLazyResets(
  row: UserCreditsRow,
  now: Date = new Date()
): { row: UserCreditsRow; changed: boolean } {
  const nowMs = now.getTime();
  let changed = false;

  let freeUsedToday = Math.max(0, Number(row.free_used_today) || 0);
  let freeResetAt = row.free_reset_at;
  let paidCredits = Math.max(0, Number(row.paid_credits) || 0);
  let paidExpiresAt = row.paid_expires_at;

  const freeResetMs = Date.parse(freeResetAt);
  if (!Number.isFinite(freeResetMs) || nowMs >= freeResetMs) {
    freeUsedToday = 0;
    freeResetAt = new Date(nowMs + CREDIT_WINDOW_MS).toISOString();
    changed = true;
  }

  if (paidExpiresAt) {
    const paidExpiresMs = Date.parse(paidExpiresAt);
    if (!Number.isFinite(paidExpiresMs) || nowMs >= paidExpiresMs) {
      paidCredits = 0;
      paidExpiresAt = null;
      changed = true;
    }
  }

  return {
    changed,
    row: {
      user_id: row.user_id,
      free_used_today: freeUsedToday,
      free_reset_at: freeResetAt,
      paid_credits: paidCredits,
      paid_expires_at: paidExpiresAt,
      updated_at: changed ? now.toISOString() : row.updated_at,
    },
  };
}

function toUserCreditsInfo(
  row: UserCreditsRow,
  source: "supabase" | "memory",
  ipFreeUsed = 0
): UserCreditsInfo {
  const freeUsedToday = Math.max(
    0,
    Number(row.free_used_today) || 0,
    Number(ipFreeUsed) || 0
  );
  const freeRemaining = Math.max(0, FREE_DAILY_LIMIT - freeUsedToday);
  const paidCredits = Math.max(0, Number(row.paid_credits) || 0);

  return {
    userId: row.user_id,
    freeUsedToday,
    freeLimit: FREE_DAILY_LIMIT,
    freeRemaining,
    freeResetAt: row.free_reset_at,
    paidCredits,
    paidExpiresAt: row.paid_expires_at,
    totalAvailable: freeRemaining + paidCredits,
    updatedAt: row.updated_at,
    source,
  };
}

async function fetchSupabaseRow(
  supabase: SupabaseConfig,
  userId: string
): Promise<UserCreditsRow | null> {
  const res = await fetch(
    `${supabase.url}/rest/v1/user_credits?user_id=eq.${encodeURIComponent(userId)}&select=*&limit=1`,
    {
      headers: buildSupabaseHeaders(supabase.key),
      cache: "no-store",
    }
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Supabase user_credits fetch failed (${res.status}): ${errText}`);
  }

  const rows = (await res.json()) as UserCreditsRow[];
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

async function upsertSupabaseRow(
  supabase: SupabaseConfig,
  row: UserCreditsRow
): Promise<UserCreditsRow> {
  const res = await fetch(
    `${supabase.url}/rest/v1/user_credits?on_conflict=user_id`,
    {
      method: "POST",
      headers: buildSupabaseHeaders(supabase.key, {
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=representation",
      }),
      body: JSON.stringify(row),
      cache: "no-store",
    }
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Supabase user_credits upsert failed (${res.status}): ${errText}`);
  }

  const rows = (await res.json()) as UserCreditsRow[];
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : row;
}

async function getOrCreateRow(
  userId: string,
  now: Date
): Promise<{ row: UserCreditsRow; source: "supabase" | "memory"; isNew: boolean }> {
  const supabase = getSupabaseConfig();

  if (supabase) {
    const existing = await fetchSupabaseRow(supabase, userId);
    if (existing) {
      return { row: existing, source: "supabase", isNew: false };
    }
    const created = await upsertSupabaseRow(supabase, createDefaultRow(userId, now));
    return { row: created, source: "supabase", isNew: true };
  }

  const existing = memoryUserCredits.get(userId);
  if (existing) {
    return { row: existing, source: "memory", isNew: false };
  }
  const fresh = createDefaultRow(userId, now);
  memoryUserCredits.set(userId, fresh);
  return { row: fresh, source: "memory", isNew: true };
}

async function saveRow(
  row: UserCreditsRow,
  source: "supabase" | "memory"
): Promise<UserCreditsRow> {
  if (source === "supabase") {
    const supabase = getSupabaseConfig();
    if (supabase) {
      return upsertSupabaseRow(supabase, row);
    }
  }
  memoryUserCredits.set(row.user_id, row);
  return row;
}

/**
 * Reads a user's credit balance, applying lazy resets if the 24h free window
 * or paid credits window has expired.
 */
export async function getUserCredits(
  userId: string,
  now: Date = new Date(),
  options?: { ipFreeUsed?: number }
): Promise<UserCreditsInfo> {
  const { row, source } = await getOrCreateRow(userId, now);
  const { row: normalized, changed } = applyLazyResets(row, now);
  const ipFreeUsed = options?.ipFreeUsed ?? 0;

  if (changed) {
    const saved = await saveRow(normalized, source);
    return toUserCreditsInfo(saved, source, ipFreeUsed);
  }

  return toUserCreditsInfo(normalized, source, ipFreeUsed);
}

export type ConsumeCreditResult =
  | {
      allowed: true;
      consumedFrom: "free" | "paid";
      credits: UserCreditsInfo;
    }
  | {
      allowed: false;
      status: 402;
      credits: UserCreditsInfo;
      error: string;
    };

/**
 * Validates and consumes 1 translation credit for the given user (lazy reset, no cron job):
 * 1. Resets free_used_today = 0 and free_reset_at = now + 24h when now >= free_reset_at.
 * 2. Resets paid_credits = 0 and paid_expires_at = null when paid_expires_at <= now.
 * 3. Priority: consumes free daily quota first (< 3), then paid_credits (> 0).
 * 4. If both are exhausted, returns allowed: false with status 402 (Payment Required).
 */
export async function checkAndConsumeCredit(
  userId: string,
  now: Date = new Date(),
  options?: { ipFreeUsed?: number }
): Promise<ConsumeCreditResult> {
  const { row, source } = await getOrCreateRow(userId, now);
  const { row: normalized, changed } = applyLazyResets(row, now);
  const ipFreeUsed = Math.max(0, Number(options?.ipFreeUsed) || 0);
  const effectiveFreeUsed = Math.max(normalized.free_used_today, ipFreeUsed);

  if (effectiveFreeUsed < FREE_DAILY_LIMIT) {
    const updated: UserCreditsRow = {
      ...normalized,
      free_used_today: effectiveFreeUsed + 1,
      updated_at: now.toISOString(),
    };
    const saved = await saveRow(updated, source);
    return {
      allowed: true,
      consumedFrom: "free",
      credits: toUserCreditsInfo(saved, source),
    };
  }

  if (normalized.paid_credits > 0) {
    const updated: UserCreditsRow = {
      ...normalized,
      paid_credits: normalized.paid_credits - 1,
      updated_at: now.toISOString(),
    };
    const saved = await saveRow(updated, source);
    return {
      allowed: true,
      consumedFrom: "paid",
      credits: toUserCreditsInfo(saved, source, ipFreeUsed),
    };
  }

  if (changed) {
    await saveRow(normalized, source);
  }

  return {
    allowed: false,
    status: 402,
    credits: toUserCreditsInfo(normalized, source, ipFreeUsed),
    error:
      "Você atingiu o limite de 3 traduções grátis hoje e não possui créditos avulsos disponíveis. Adquira um pacote para continuar traduzindo.",
  };
}

/**
 * Refunds 1 credit back to the user when a translation session fails with 0 chunks translated.
 */
export async function refundUserCredit(
  userId: string,
  consumedFrom: "free" | "paid",
  now: Date = new Date()
): Promise<UserCreditsInfo> {
  const { row, source } = await getOrCreateRow(userId, now);
  const { row: normalized } = applyLazyResets(row, now);

  const updated: UserCreditsRow = {
    ...normalized,
    free_used_today:
      consumedFrom === "free"
        ? Math.max(0, normalized.free_used_today - 1)
        : normalized.free_used_today,
    paid_credits:
      consumedFrom === "paid"
        ? normalized.paid_credits + 1
        : normalized.paid_credits,
    paid_expires_at:
      consumedFrom === "paid" && !normalized.paid_expires_at
        ? new Date(now.getTime() + CREDIT_WINDOW_MS).toISOString()
        : normalized.paid_expires_at,
    updated_at: now.toISOString(),
  };

  const saved = await saveRow(updated, source);
  return toUserCreditsInfo(saved, source);
}

export interface GrantPaidCreditsParams {
  externalPaymentId: string;
  userId: string;
  creditsToAdd: number;
  amountCents: number;
  status: string;
  provider?: string;
  now?: Date;
}

export interface GrantPaidCreditsResult {
  credited: boolean;
  alreadyProcessed: boolean;
  credits?: UserCreditsInfo;
}

/**
 * Idempotently records a confirmed payment in `payment_transactions` (checking
 * `external_payment_id` uniqueness) and adds `creditsToAdd` to `user_credits`
 * with `paid_expires_at = now() + 24 hours`.
 */
export async function grantPaidCreditsFromPayment(
  params: GrantPaidCreditsParams
): Promise<GrantPaidCreditsResult> {
  const now = params.now ?? new Date();
  const provider = params.provider ?? "mercadopago";
  const supabase = getSupabaseConfig();

  if (supabase) {
    // 1. Check idempotency before inserting
    const checkRes = await fetch(
      `${supabase.url}/rest/v1/payment_transactions?external_payment_id=eq.${encodeURIComponent(
        params.externalPaymentId
      )}&select=id&limit=1`,
      {
        headers: buildSupabaseHeaders(supabase.key),
        cache: "no-store",
      }
    );

    if (!checkRes.ok) {
      const errText = await checkRes.text().catch(() => "");
      throw new Error(
        `Supabase payment_transactions lookup failed (${checkRes.status}): ${errText}`
      );
    }

    const existingTx = (await checkRes.json()) as { id: string }[];
    if (Array.isArray(existingTx) && existingTx.length > 0) {
      return { credited: false, alreadyProcessed: true };
    }

    // 2. Insert transaction first — UNIQUE constraint on external_payment_id guarantees
    //    race-condition-safe idempotency across concurrent webhook retries
    const insertRes = await fetch(
      `${supabase.url}/rest/v1/payment_transactions`,
      {
        method: "POST",
        headers: buildSupabaseHeaders(supabase.key, {
          "Content-Type": "application/json",
          Prefer: "return=representation",
        }),
        body: JSON.stringify({
          provider,
          external_payment_id: params.externalPaymentId,
          user_id: params.userId,
          credits_added: params.creditsToAdd,
          amount_cents: params.amountCents,
          status: params.status,
          created_at: now.toISOString(),
        }),
        cache: "no-store",
      }
    );

    if (insertRes.status === 409) {
      // Duplicate external_payment_id hit unique constraint concurrently
      return { credited: false, alreadyProcessed: true };
    }

    if (!insertRes.ok) {
      const errText = await insertRes.text().catch(() => "");
      if (errText.includes("23505") || errText.toLowerCase().includes("duplicate")) {
        return { credited: false, alreadyProcessed: true };
      }
      throw new Error(
        `Supabase payment_transactions insert failed (${insertRes.status}): ${errText}`
      );
    }

    // 3. Apply lazy resets to existing credits, then add paid credits and renew 24h expiry
    const { row } = await getOrCreateRow(params.userId, now);
    const { row: normalized } = applyLazyResets(row, now);
    const updatedRow: UserCreditsRow = {
      ...normalized,
      paid_credits: normalized.paid_credits + params.creditsToAdd,
      paid_expires_at: new Date(now.getTime() + CREDIT_WINDOW_MS).toISOString(),
      updated_at: now.toISOString(),
    };

    const saved = await upsertSupabaseRow(supabase, updatedRow);
    return {
      credited: true,
      alreadyProcessed: false,
      credits: toUserCreditsInfo(saved, "supabase"),
    };
  }

  // In-memory fallback (for local development without Supabase & automated tests)
  if (memoryPaymentTx.has(params.externalPaymentId)) {
    return { credited: false, alreadyProcessed: true };
  }

  memoryPaymentTx.set(params.externalPaymentId, {
    id: crypto.randomUUID(),
    provider,
    external_payment_id: params.externalPaymentId,
    user_id: params.userId,
    credits_added: params.creditsToAdd,
    amount_cents: params.amountCents,
    status: params.status,
    created_at: now.toISOString(),
  });

  const { row } = await getOrCreateRow(params.userId, now);
  const { row: normalized } = applyLazyResets(row, now);
  const updatedRow: UserCreditsRow = {
    ...normalized,
    paid_credits: normalized.paid_credits + params.creditsToAdd,
    paid_expires_at: new Date(now.getTime() + CREDIT_WINDOW_MS).toISOString(),
    updated_at: now.toISOString(),
  };

  memoryUserCredits.set(params.userId, updatedRow);

  return {
    credited: true,
    alreadyProcessed: false,
    credits: toUserCreditsInfo(updatedRow, "memory"),
  };
}
