"use client";

import {
  CheckCircle2,
  Download,
  Loader2,
  StopCircle,
  AlertTriangle,
  Clock,
  Layers,
} from "lucide-react";
import type { TranslationStatus } from "@/lib/types";

interface TranslationProgressProps {
  status: TranslationStatus;
  completedChunks: number;
  totalChunks: number;
  translatedBlocks: number;
  totalBlocks: number;
  etaSeconds: number | null;
  errorMessage: string | null;
  outputFileName: string;
  onCancel: () => void;
  onDownload: () => void;
}

function formatEta(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds <= 0) {
    return "Calculando...";
  }
  if (seconds < 60) {
    return `~${Math.ceil(seconds)}s restantes`;
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.ceil(seconds % 60);
  return `~${mins}m ${secs}s restantes`;
}

export function TranslationProgress({
  status,
  completedChunks,
  totalChunks,
  translatedBlocks,
  totalBlocks,
  etaSeconds,
  errorMessage,
  outputFileName,
  onCancel,
  onDownload,
}: TranslationProgressProps) {
  if (status === "idle") return null;

  const percentage =
    totalChunks > 0 ? Math.min(100, Math.round((completedChunks / totalChunks) * 100)) : 0;

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {status === "translating" && (
            <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
          )}
          {status === "completed" && (
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          )}
          {(status === "error" || status === "cancelled") && (
            <AlertTriangle className="h-5 w-5 text-amber-400" />
          )}

          <div>
            <p className="text-sm font-medium text-zinc-100">
              {status === "translating" &&
                `Traduzindo — ${completedChunks} de ${totalChunks} ${
                  totalChunks === 1 ? "lote concluído" : "lotes concluídos"
                }`}
              {status === "completed" && "Tradução concluída com sucesso!"}
              {status === "error" && "Falha durante a tradução"}
              {status === "cancelled" && "Tradução cancelada"}
            </p>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400">
              <span className="inline-flex items-center gap-1">
                <Layers className="h-3.5 w-3.5 text-zinc-500" />
                {new Intl.NumberFormat("pt-BR").format(translatedBlocks)} /{" "}
                {new Intl.NumberFormat("pt-BR").format(totalBlocks)} blocos
              </span>
              {status === "translating" && (
                <>
                  <span className="text-zinc-700">•</span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-zinc-500" />
                    {formatEta(etaSeconds)}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <span className="font-mono text-sm font-semibold text-zinc-200">
            {percentage}%
          </span>

          {status === "translating" && (
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-800/80 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
            >
              <StopCircle className="h-3.5 w-3.5" />
              Cancelar
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-zinc-800">
        <div
          className={`h-full rounded-full transition-all duration-300 ease-out ${
            status === "error" || status === "cancelled"
              ? "bg-amber-500"
              : "bg-emerald-500"
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {errorMessage && (
        <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-300">
          {errorMessage}
        </div>
      )}

      {status === "completed" && (
        <div className="mt-5 flex flex-col items-stretch justify-between gap-3 border-t border-zinc-800/80 pt-4 sm:flex-row sm:items-center">
          <div className="min-w-0 text-xs text-zinc-400">
            Arquivo pronto:{" "}
            <span className="font-mono font-medium text-zinc-200">
              {outputFileName}
            </span>
          </div>
          <button
            type="button"
            onClick={onDownload}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-zinc-950 shadow-lg shadow-emerald-500/15 transition-all hover:bg-emerald-400 active:scale-[0.99]"
          >
            <Download className="h-4 w-4" />
            Baixar {outputFileName}
          </button>
        </div>
      )}
    </div>
  );
}
