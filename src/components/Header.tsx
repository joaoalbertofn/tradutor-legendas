"use client";

import { Show, SignInButton, UserButton } from "@clerk/nextjs";
import { Plus, Subtitles } from "lucide-react";
import type { UserCreditsInfo } from "@/lib/types";

interface HeaderProps {
  totalTranslated: number | null;
  credits: UserCreditsInfo | null;
  creditsLoading?: boolean;
  onOpenBuyCredits: () => void;
}

function formatExpiryShort(isoDate: string | null): string | null {
  if (!isoDate) return null;
  const diffMs = Date.parse(isoDate) - Date.now();
  if (!Number.isFinite(diffMs) || diffMs <= 0) return null;
  const hours = Math.ceil(diffMs / (60 * 60 * 1000));
  if (hours >= 1) return `${hours}h`;
  const mins = Math.max(1, Math.ceil(diffMs / (60 * 1000)));
  return `${mins}m`;
}

export function Header({
  totalTranslated,
  credits,
  creditsLoading = false,
  onOpenBuyCredits,
}: HeaderProps) {
  const formattedTotal =
    totalTranslated !== null
      ? new Intl.NumberFormat("pt-BR").format(totalTranslated)
      : "—";

  const label =
    totalTranslated === 1 ? "legenda traduzida" : "legendas traduzidas";

  const hasPaidCredits = (credits?.paidCredits ?? 0) > 0;
  const expiryShort = hasPaidCredits
    ? formatExpiryShort(credits?.paidExpiresAt ?? null)
    : null;

  const badgeText = (() => {
    if (creditsLoading && !credits) return "Carregando saldo...";
    if (!credits) return "3/3 grátis hoje";
    if (credits.paidCredits > 0) {
      const unit = credits.paidCredits === 1 ? "crédito" : "créditos";
      return expiryShort
        ? `${credits.paidCredits} ${unit} • expira em ${expiryShort}`
        : `${credits.paidCredits} ${unit}`;
    }
    return `${credits.freeRemaining}/${credits.freeLimit} grátis hoje`;
  })();

  const badgeTitle = credits
    ? `Grátis hoje: ${credits.freeRemaining}/${credits.freeLimit} • Créditos avulsos: ${credits.paidCredits}`
    : "Saldo de traduções";

  const isExhausted = credits !== null && credits.totalAvailable === 0;

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-2 px-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
            <Subtitles className="h-4 w-4" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold tracking-tight text-zinc-100">
              LegendaBR
            </span>
            <span className="hidden text-xs text-zinc-500 md:inline">
              SRT &amp; VTT → PT-BR
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Global translated counter */}
          <div
            aria-label="Total de legendas traduzidas na plataforma"
            className="hidden items-center gap-1.5 rounded-full border border-zinc-800/90 bg-zinc-900/80 px-3 py-1 text-xs text-zinc-400 sm:inline-flex"
          >
            <span className="font-mono font-medium text-zinc-200">
              {formattedTotal}
            </span>
            <span>{label}</span>
          </div>

          {/* Auth & Credits controls */}
          <Show when="signed-out">
            <span className="hidden rounded-full border border-zinc-800/80 bg-zinc-900/60 px-2.5 py-1 text-[11px] font-medium text-zinc-400 lg:inline-flex">
              3 traduções grátis/dia
            </span>
            <SignInButton mode="modal">
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition-colors hover:border-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-200"
              >
                Entrar
              </button>
            </SignInButton>
          </Show>

          <Show when="signed-in">
            <div className="inline-flex items-center gap-1 rounded-full border border-zinc-800 bg-zinc-900/80 py-0.5 pl-2.5 pr-1 text-[11px] font-medium text-zinc-300">
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                  isExhausted ? "bg-amber-400" : "bg-emerald-400"
                }`}
              />
              <span title={badgeTitle} className="whitespace-nowrap">
                {badgeText}
              </span>
              <button
                type="button"
                onClick={onOpenBuyCredits}
                title="Comprar mais créditos"
                aria-label="Comprar mais créditos"
                className="ml-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full border border-emerald-500/35 bg-emerald-500/15 text-emerald-300 transition-colors hover:bg-emerald-500 hover:text-zinc-950"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>

            <UserButton
              appearance={{
                elements: {
                  avatarBox: "h-7 w-7 ring-1 ring-zinc-700",
                },
              }}
            />
          </Show>
        </div>
      </div>
    </header>
  );
}
