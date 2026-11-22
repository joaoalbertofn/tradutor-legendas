"use client";

import { Subtitles } from "lucide-react";
import type { QuotaInfo } from "@/lib/types";

interface HeaderProps {
  totalTranslated: number | null;
  quota: QuotaInfo | null;
}

export function Header({ totalTranslated, quota }: HeaderProps) {
  const formattedTotal =
    totalTranslated !== null
      ? new Intl.NumberFormat("pt-BR").format(totalTranslated)
      : "—";

  const label =
    totalTranslated === 1 ? "legenda traduzida" : "legendas traduzidas";

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
            <Subtitles className="h-4 w-4" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold tracking-tight text-zinc-100">
              LegendaBR
            </span>
            <span className="hidden text-xs text-zinc-500 sm:inline">
              SRT &amp; VTT → PT-BR
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {quota && (
            <div
              title={
                quota.unlimited
                  ? "Modo desenvolvimento local: traduções ilimitadas"
                  : "Limite diário gratuito por IP"
              }
              className="hidden items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900/70 px-2.5 py-1 text-[11px] font-medium text-zinc-400 sm:inline-flex"
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  quota.unlimited || quota.remaining > 0
                    ? "bg-emerald-400"
                    : "bg-amber-400"
                }`}
              />
              <span>
                {quota.unlimited
                  ? "Ilimitado (dev)"
                  : `${quota.remaining}/${quota.limit} hoje`}
              </span>
            </div>
          )}

          <div
            aria-label="Total de legendas traduzidas na plataforma"
            className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800/90 bg-zinc-900/80 px-3 py-1 text-xs text-zinc-400"
          >
            <span className="font-mono font-medium text-zinc-200">
              {formattedTotal}
            </span>
            <span>{label}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
