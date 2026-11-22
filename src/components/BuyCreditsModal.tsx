"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Clock,
  CreditCard,
  Loader2,
  QrCode,
  RefreshCw,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import { CREDIT_PLANS } from "@/lib/mercadopago";
import type { CreditPlanId, UserCreditsInfo } from "@/lib/types";

export type BuyCreditsModalReason =
  | "limit_reached"
  | "manual"
  | "payment_success"
  | "payment_pending"
  | "payment_failure";

interface BuyCreditsModalProps {
  isOpen: boolean;
  credits: UserCreditsInfo | null;
  reason?: BuyCreditsModalReason;
  onClose: () => void;
  onCreditsUpdated: (credits: UserCreditsInfo) => void;
}

type ModalPhase = "select" | "awaiting_payment" | "confirmed";

const POLL_INTERVAL_MS = 3500;
const MAX_POLL_DURATION_MS = 5 * 60 * 1000; // 5 minutes

export function BuyCreditsModal({
  isOpen,
  credits,
  reason = "manual",
  onClose,
  onCreditsUpdated,
}: BuyCreditsModalProps) {
  const isReturningFromPayment =
    reason === "payment_success" || reason === "payment_pending";

  const [phase, setPhase] = useState<ModalPhase>(
    isReturningFromPayment ? "awaiting_payment" : "select"
  );
  const [loadingPlan, setLoadingPlan] = useState<CreditPlanId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCheckingNow, setIsCheckingNow] = useState(false);

  const baselineRef = useRef<{
    paidCredits: number;
    updatedAt: string | null;
  }>({
    paidCredits: credits?.paidCredits ?? 0,
    updatedAt: credits?.updatedAt ?? null,
  });

  // Reset modal state whenever opened
  useEffect(() => {
    if (!isOpen) return;
    setLoadingPlan(null);
    baselineRef.current = {
      paidCredits: credits?.paidCredits ?? 0,
      updatedAt: credits?.updatedAt ?? null,
    };

    if (reason === "payment_success" || reason === "payment_pending") {
      setError(null);
      setPhase("awaiting_payment");
    } else if (reason === "payment_failure") {
      setPhase("select");
      setError(
        "O pagamento não foi concluído no Mercado Pago. Você pode tentar novamente escolhendo um pacote abaixo."
      );
    } else {
      setError(null);
      setPhase("select");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, reason]);

  const checkCreditsBalance = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch("/api/credits", { cache: "no-store" });
      if (!res.ok) return false;
      const data = (await res.json()) as { credits?: UserCreditsInfo };
      if (!data.credits) return false;

      onCreditsUpdated(data.credits);

      const base = baselineRef.current;
      const paidIncreased = data.credits.paidCredits > base.paidCredits;
      const renewedPaid =
        data.credits.paidCredits > 0 &&
        base.updatedAt !== null &&
        data.credits.updatedAt !== base.updatedAt;

      if (
        paidIncreased ||
        (isReturningFromPayment && data.credits.paidCredits > 0) ||
        renewedPaid
      ) {
        setPhase("confirmed");
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [onCreditsUpdated, isReturningFromPayment]);

  // Light polling while awaiting Mercado Pago webhook confirmation
  useEffect(() => {
    if (!isOpen || phase !== "awaiting_payment") return;

    let cancelled = false;
    const startedAt = Date.now();

    const tick = async () => {
      if (cancelled) return;
      const confirmed = await checkCreditsBalance();
      if (confirmed || cancelled) return;
      if (Date.now() - startedAt >= MAX_POLL_DURATION_MS) return;
    };

    void tick();

    const timer = window.setInterval(() => {
      if (Date.now() - startedAt >= MAX_POLL_DURATION_MS) {
        window.clearInterval(timer);
        return;
      }
      void tick();
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [isOpen, phase, checkCreditsBalance]);

  const handleSelectPlan = async (planId: CreditPlanId) => {
    setError(null);
    setLoadingPlan(planId);

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : "Não foi possível gerar o link de pagamento."
        );
      }

      const url = typeof data.checkoutUrl === "string" ? data.checkoutUrl : "";
      if (!url) {
        throw new Error("URL de pagamento não retornada pelo servidor.");
      }

      // Redirect to Mercado Pago Checkout Pro
      window.location.href = url;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erro inesperado ao iniciar o checkout."
      );
      setLoadingPlan(null);
    }
  };

  const handleManualCheck = async () => {
    setIsCheckingNow(true);
    setError(null);
    const confirmed = await checkCreditsBalance();
    setIsCheckingNow(false);
    if (!confirmed) {
      setError(
        "Pagamento ainda não confirmado. Assim que o Pix ou cartão for aprovado pelo Mercado Pago, seu saldo será atualizado automaticamente."
      );
    }
  };

  if (!isOpen) return null;

  const plans = [CREDIT_PLANS["10_credits"], CREDIT_PLANS["50_credits"]];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="buy-credits-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loadingPlan) {
          onClose();
        }
      }}
    >
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-zinc-800/80 px-6 py-5">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-300">
              <Sparkles className="h-3 w-3" />
              Pacotes Avulsos • Sem assinatura
            </div>
            <h2
              id="buy-credits-title"
              className="text-lg font-semibold tracking-tight text-zinc-50"
            >
              {reason === "limit_reached"
                ? "Limite grátis de hoje atingido"
                : "Comprar créditos de tradução"}
            </h2>
            <p className="text-xs text-zinc-400">
              {reason === "limit_reached"
                ? "Você já usou suas 3 traduções grátis de hoje. Adquira um passe avulso para continuar agora."
                : "Pague apenas quando precisar. 1 crédito = 1 arquivo de legenda completo."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar modal"
            className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-900 hover:text-zinc-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-6 py-5">
          {phase === "select" && (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {plans.map((plan) => {
                  const isBusy = loadingPlan === plan.id;
                  return (
                    <button
                      key={plan.id}
                      type="button"
                      disabled={loadingPlan !== null}
                      onClick={() => handleSelectPlan(plan.id)}
                      className={`group relative flex flex-col justify-between rounded-xl border p-4 text-left transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
                        plan.highlighted
                          ? "border-emerald-500/50 bg-emerald-500/[0.06] hover:border-emerald-400 hover:bg-emerald-500/[0.1]"
                          : "border-zinc-800 bg-zinc-900/70 hover:border-zinc-700 hover:bg-zinc-900"
                      }`}
                    >
                      {plan.highlighted && (
                        <span className="absolute -top-2.5 right-3 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-950">
                          Melhor custo
                        </span>
                      )}

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-zinc-100">
                            {plan.name}
                          </span>
                          <Zap
                            className={`h-4 w-4 ${
                              plan.highlighted
                                ? "text-emerald-400"
                                : "text-zinc-500 group-hover:text-zinc-300"
                            }`}
                          />
                        </div>

                        <div className="flex items-baseline gap-1.5">
                          <span className="text-2xl font-bold tracking-tight text-zinc-50">
                            {plan.priceLabel}
                          </span>
                          <span className="text-xs font-medium text-emerald-400">
                            +{plan.credits} traduções
                          </span>
                        </div>

                        <p className="text-xs leading-relaxed text-zinc-400">
                          {plan.tagline}
                        </p>
                      </div>

                      <div className="mt-4 space-y-2.5 border-t border-zinc-800/80 pt-3">
                        <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                          <Clock className="h-3.5 w-3.5 text-zinc-500" />
                          Validade de {plan.validityHours}h após a compra
                        </div>

                        <div
                          className={`inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                            plan.highlighted
                              ? "bg-emerald-500 text-zinc-950 group-hover:bg-emerald-400"
                              : "bg-zinc-800 text-zinc-100 group-hover:bg-zinc-700"
                          }`}
                        >
                          {isBusy ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              Redirecionando...
                            </>
                          ) : (
                            <>Escolher {plan.name}</>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-800/80 bg-zinc-900/50 px-3.5 py-2.5 text-[11px] text-zinc-400">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1 text-zinc-300">
                    <QrCode className="h-3.5 w-3.5 text-emerald-400" />
                    Pix instantâneo
                  </span>
                  <span className="inline-flex items-center gap-1 text-zinc-300">
                    <CreditCard className="h-3.5 w-3.5 text-emerald-400" />
                    Cartão de crédito
                  </span>
                </div>
                <span className="text-zinc-500">via Mercado Pago</span>
              </div>
            </>
          )}

          {phase === "awaiting_payment" && (
            <div className="space-y-4 py-2 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>

              <div className="space-y-1">
                <h3 className="text-base font-semibold text-zinc-100">
                  {reason === "payment_pending"
                    ? "Pagamento em processamento..."
                    : "Confirmando seu pagamento..."}
                </h3>
                <p className="mx-auto max-w-sm text-xs leading-relaxed text-zinc-400">
                  Estamos aguardando a confirmação do Mercado Pago. Assim que
                  aprovado, seus créditos serão liberados automaticamente.
                </p>
              </div>

              <div className="flex flex-col items-center justify-center gap-2 sm:flex-row">
                <button
                  type="button"
                  disabled={isCheckingNow}
                  onClick={handleManualCheck}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-800 disabled:opacity-60 sm:w-auto"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${isCheckingNow ? "animate-spin" : ""}`}
                  />
                  Verificar saldo agora
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setPhase("select");
                  setError(null);
                }}
                className="text-xs text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline"
              >
                Voltar e escolher outro pacote
              </button>
            </div>
          )}

          {phase === "confirmed" && (
            <div className="space-y-4 py-3 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/15 text-emerald-400">
                <CheckCircle2 className="h-6 w-6" />
              </div>

              <div className="space-y-1">
                <h3 className="text-base font-semibold text-zinc-100">
                  Créditos adicionados com sucesso!
                </h3>
                <p className="text-xs text-zinc-400">
                  Saldo atual:{" "}
                  <span className="font-semibold text-emerald-400">
                    {credits?.paidCredits ?? 0}{" "}
                    {credits?.paidCredits === 1
                      ? "crédito avulso"
                      : "créditos avulsos"}
                  </span>
                  {credits && credits.freeRemaining > 0
                    ? ` (+ ${credits.freeRemaining} grátis hoje)`
                    : ""}
                  .
                </p>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 px-5 py-2.5 text-xs font-semibold text-zinc-950 transition-colors hover:bg-emerald-400"
              >
                Continuar traduzindo
              </button>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-200">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
