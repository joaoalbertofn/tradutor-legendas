"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Clock,
  Coins,
  Database,
  FileText,
  Film,
  Flame,
  HardDrive,
  Loader2,
  Lock,
  LogOut,
  RefreshCw,
  RotateCw,
  ShieldAlert,
  Subtitles,
} from "lucide-react";
import {
  convertUsdToBrl,
  formatBrl,
  formatDurationMs,
  formatUsd,
} from "@/lib/pricing";
import type {
  TranslationLogRecord,
  TranslationLogsListResponse,
  TranslationLogStatus,
} from "@/lib/types";

interface AdminLogsDashboardProps {
  isConfigured: boolean;
  initialAuthenticated: boolean;
}

const numberFmt = new Intl.NumberFormat("pt-BR");

function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatCompactTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(2)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}k`;
  return String(tokens);
}

export function AdminLogsDashboard({
  isConfigured,
  initialAuthenticated,
}: AdminLogsDashboardProps) {
  const [authenticated, setAuthenticated] = useState(initialAuthenticated);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const [data, setData] = useState<TranslationLogsListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [statusFilter, setStatusFilter] = useState<"all" | TranslationLogStatus>(
    "all"
  );

  const loadLogs = useCallback(
    async (targetPage: number, targetPageSize: number, targetStatus: string) => {
      setLoading(true);
      setFetchError(null);
      try {
        const params = new URLSearchParams({
          page: String(targetPage),
          pageSize: String(targetPageSize),
          status: targetStatus,
        });
        const res = await fetch(`/api/logs?${params.toString()}`, {
          cache: "no-store",
        });

        if (res.status === 401) {
          setAuthenticated(false);
          setData(null);
          return;
        }

        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(json.error || `Erro HTTP ${res.status}`);
        }

        setData(json as TranslationLogsListResponse);
      } catch (err) {
        setFetchError(
          err instanceof Error ? err.message : "Erro ao carregar logs."
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (authenticated) {
      loadLogs(page, pageSize, statusFilter);
    }
  }, [authenticated, page, pageSize, statusFilter, loadLogs]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);

    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAuthError(json.error || "Senha inválida.");
        return;
      }
      setPassword("");
      setAuthenticated(true);
    } catch {
      setAuthError("Não foi possível validar a senha.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/admin/auth", { method: "DELETE" }).catch(() => {});
    setAuthenticated(false);
    setData(null);
  };

  if (!isConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-amber-500/25 bg-zinc-900/70 p-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h1 className="text-lg font-semibold text-zinc-100">
            ADMIN_SECRET não configurado
          </h1>
          <p className="mt-2 text-xs leading-relaxed text-zinc-400">
            Para proteger o painel de telemetria em{" "}
            <code className="font-mono text-zinc-200">/admin/logs</code>, defina
            a variável de ambiente{" "}
            <code className="font-mono text-amber-300">ADMIN_SECRET</code> no{" "}
            <code className="font-mono text-zinc-200">.env.local</code> (ou nas
            configurações da Vercel) e reinicie o servidor.
          </p>
          <Link
            href="/"
            className="mt-5 inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar ao tradutor
          </Link>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-2xl shadow-black/40">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-zinc-100">
                Painel de Telemetria
              </h1>
              <p className="text-xs text-zinc-500">
                Acesso restrito — LegendaBR
              </p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="admin-password"
                className="block text-xs font-medium text-zinc-300"
              >
                Senha de administrador
              </label>
              <input
                id="admin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite ADMIN_SECRET"
                autoFocus
                required
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            {authError && (
              <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                {authError}
              </div>
            )}

            <button
              type="submit"
              disabled={authLoading || !password.trim()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {authLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              Entrar
            </button>
          </form>

          <div className="mt-4 text-center">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs text-zinc-500 transition-colors hover:text-zinc-300"
            >
              <ArrowLeft className="h-3 w-3" />
              Voltar ao tradutor
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const summary = data?.summary;
  const logs = data?.logs ?? [];
  const pagination = data?.pagination;
  const usdToBrlRate = data?.usdToBrlRate ?? 5.8;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 border-b border-zinc-800/80 bg-zinc-950/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 transition-colors hover:bg-emerald-500/20"
              title="Voltar ao tradutor"
            >
              <Subtitles className="h-4 w-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-semibold tracking-tight text-zinc-100">
                  Telemetria &amp; Logs de Tradução
                </h1>
                {data && (
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                      data.source === "supabase"
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                        : "border-amber-500/30 bg-amber-500/10 text-amber-300"
                    }`}
                  >
                    {data.source === "supabase" ? (
                      <>
                        <Database className="h-2.5 w-2.5" />
                        Supabase
                      </>
                    ) : (
                      <>
                        <HardDrive className="h-2.5 w-2.5" />
                        Fallback Local JSON
                      </>
                    )}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-500">
                Monitoramento de tokens, custos (USD/BRL) e latência por arquivo
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => loadLogs(page, pageSize, statusFilter)}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
              />
              <span className="hidden sm:inline">Atualizar</span>
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
        {fetchError && (
          <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-xs text-red-300">
            {fetchError}
          </div>
        )}

        {/* Summary Cards */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Total Translated */}
          <div className="rounded-2xl border border-zinc-800/90 bg-zinc-900/50 p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-400">
                Legendas traduzidas
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                <Activity className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-3 font-mono text-2xl font-semibold text-zinc-50">
              {summary ? numberFmt.format(summary.totalTranslated) : "—"}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {summary
                ? `${numberFmt.format(summary.totalCuesTranslated)} blocos • ${summary.totalErrors} ${
                    summary.totalErrors === 1 ? "erro" : "erros"
                  }`
                : "Carregando..."}
            </p>
          </div>

          {/* Card 2: Total Cost USD & BRL */}
          <div className="rounded-2xl border border-zinc-800/90 bg-zinc-900/50 p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-400">
                Custo acumulado
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400">
                <Coins className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <p className="font-mono text-2xl font-semibold text-zinc-50">
                {summary ? formatUsd(summary.totalCostUsd) : "—"}
              </p>
              {summary && (
                <span className="font-mono text-sm font-medium text-emerald-400">
                  {formatBrl(summary.totalCostBrl)}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              {summary
                ? `${formatCompactTokens(
                    summary.totalPromptTokens + summary.totalOutputTokens
                  )} tokens • câmbio R$ ${usdToBrlRate.toFixed(2)}`
                : "Carregando..."}
            </p>
          </div>

          {/* Card 3: Average Duration */}
          <div className="rounded-2xl border border-zinc-800/90 bg-zinc-900/50 p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-400">
                Média de tempo / arquivo
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-3 font-mono text-2xl font-semibold text-zinc-50">
              {summary ? formatDurationMs(summary.avgDurationMs) : "—"}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {summary
                ? summary.avgExtractionDurationMs > 0
                  ? `Extração média: ${formatDurationMs(
                      summary.avgExtractionDurationMs
                    )}`
                  : `Gargalo lento: ≥ ${formatDurationMs(
                      summary.bottlenecks.slowDurationThresholdMs
                    )}`
                : "Carregando..."}
            </p>
          </div>

          {/* Card 4: Retry Rate */}
          <div className="rounded-2xl border border-zinc-800/90 bg-zinc-900/50 p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-400">
                Taxa de retries
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10 text-purple-400">
                <RotateCw className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-3 font-mono text-2xl font-semibold text-zinc-50">
              {summary ? `${(summary.retryRate * 100).toFixed(1)}%` : "—"}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {summary
                ? `${numberFmt.format(summary.totalRetries)} retries em ${numberFmt.format(
                    summary.totalChunks
                  )} lotes`
                : "Carregando..."}
            </p>
          </div>
        </section>

        {/* Filter & Bottleneck Legend */}
        <section className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900/60 p-1">
            {(
              [
                { value: "all", label: "Todos" },
                { value: "success", label: "Sucesso" },
                { value: "error", label: "Erros" },
                { value: "cancelled", label: "Cancelados" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => {
                  setStatusFilter(tab.value);
                  setPage(1);
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  statusFilter === tab.value
                    ? "bg-zinc-800 text-zinc-100"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-400">
            <span className="inline-flex items-center gap-1 rounded-md border border-red-500/25 bg-red-500/10 px-2 py-0.5 text-red-300">
              <AlertTriangle className="h-3 w-3" />
              Erro
            </span>
            <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-amber-300">
              <Clock className="h-3 w-3" />
              Lento
            </span>
            <span className="inline-flex items-center gap-1 rounded-md border border-purple-500/25 bg-purple-500/10 px-2 py-0.5 text-purple-300">
              <Flame className="h-3 w-3" />
              Alto uso de tokens
            </span>
          </div>
        </section>

        {/* Paginated Table */}
        <section className="overflow-hidden rounded-2xl border border-zinc-800/90 bg-zinc-900/40">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/80 text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Arquivo</th>
                  <th className="px-4 py-3">Status / Gargalos</th>
                  <th className="px-4 py-3 text-right">Blocos / Lotes</th>
                  <th className="px-4 py-3 text-right">Tempo</th>
                  <th className="px-4 py-3 text-right">Tokens (In / Out)</th>
                  <th className="px-4 py-3 text-right">Custo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/70">
                {loading && logs.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-12 text-center text-zinc-500"
                    >
                      <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-emerald-400" />
                      Carregando registros de telemetria...
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-12 text-center text-zinc-500"
                    >
                      Nenhum log de tradução registrado ainda.
                    </td>
                  </tr>
                ) : (
                  logs.map((log: TranslationLogRecord) => {
                    const totalTokens =
                      log.totalPromptTokens + log.totalOutputTokens;
                    const isError = log.status === "error";
                    const isSlow =
                      summary !== undefined &&
                      log.translationDurationMs >=
                        summary.bottlenecks.slowDurationThresholdMs;
                    const isHighTokens =
                      summary !== undefined &&
                      totalTokens >= summary.bottlenecks.highTokensThreshold;
                    const costBrl = convertUsdToBrl(
                      log.estimatedCostUsd,
                      usdToBrlRate
                    );

                    return (
                      <tr
                        key={log.id}
                        className={`transition-colors hover:bg-zinc-900/70 ${
                          isError
                            ? "bg-red-500/[0.04]"
                            : isSlow || isHighTokens
                            ? "bg-amber-500/[0.02]"
                            : ""
                        }`}
                      >
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-[11px] text-zinc-400">
                          {formatDateTime(log.createdAt)}
                        </td>

                        <td className="max-w-[260px] px-4 py-3">
                          <div className="flex items-center gap-2">
                            {log.sourceType === "video_extraction" ? (
                              <span
                                title="Extraída de vídeo"
                                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-emerald-500/25 bg-emerald-500/10 text-emerald-400"
                              >
                                <Film className="h-3.5 w-3.5" />
                              </span>
                            ) : (
                              <span
                                title="Upload direto de legenda"
                                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900 text-zinc-400"
                              >
                                <FileText className="h-3.5 w-3.5" />
                              </span>
                            )}
                            <div className="min-w-0">
                              <p
                                title={log.fileName}
                                className="truncate font-medium text-zinc-200"
                              >
                                {log.fileName}
                              </p>
                              <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-zinc-500">
                                <span className="rounded bg-zinc-800 px-1 py-0.2 font-mono uppercase text-zinc-300">
                                  {log.extension}
                                </span>
                                <span>
                                  {log.sourceType === "video_extraction"
                                    ? "Vídeo"
                                    : "Upload"}
                                </span>
                                {log.model && (
                                  <>
                                    <span>•</span>
                                    <span className="truncate font-mono">
                                      {log.model}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-1">
                            {log.status === "success" && (
                              <span className="rounded-md border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300">
                                Sucesso
                              </span>
                            )}
                            {log.status === "error" && (
                              <span className="inline-flex items-center gap-1 rounded-md border border-red-500/30 bg-red-500/15 px-1.5 py-0.5 text-[10px] font-medium text-red-300">
                                <AlertTriangle className="h-2.5 w-2.5" />
                                Erro
                              </span>
                            )}
                            {log.status === "cancelled" && (
                              <span className="rounded-md border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-300">
                                Cancelado
                              </span>
                            )}
                            {isSlow && (
                              <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
                                <Clock className="h-2.5 w-2.5" />
                                Lento
                              </span>
                            )}
                            {isHighTokens && (
                              <span className="inline-flex items-center gap-1 rounded-md border border-purple-500/30 bg-purple-500/10 px-1.5 py-0.5 text-[10px] font-medium text-purple-300">
                                <Flame className="h-2.5 w-2.5" />
                                Alto consumo
                              </span>
                            )}
                            {log.retriesCount > 0 && (
                              <span className="rounded-md border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 font-mono text-[10px] text-amber-200">
                                {log.retriesCount}{" "}
                                {log.retriesCount === 1 ? "retry" : "retries"}
                              </span>
                            )}
                          </div>
                          {log.errorMessage && (
                            <p
                              title={log.errorMessage}
                              className="mt-1 max-w-[240px] truncate text-[11px] text-red-300/80"
                            >
                              {log.errorMessage}
                            </p>
                          )}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-zinc-300">
                          <div>{numberFmt.format(log.totalCues)} cues</div>
                          <div className="text-[10px] text-zinc-500">
                            {log.totalChunks}{" "}
                            {log.totalChunks === 1 ? "lote" : "lotes"}
                          </div>
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-right font-mono">
                          <div
                            className={
                              isSlow
                                ? "font-semibold text-amber-300"
                                : "text-zinc-200"
                            }
                          >
                            {formatDurationMs(log.translationDurationMs)}
                          </div>
                          {log.extractionDurationMs > 0 && (
                            <div className="text-[10px] text-zinc-500">
                              + {formatDurationMs(log.extractionDurationMs)} ext.
                            </div>
                          )}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-right font-mono">
                          <div
                            className={
                              isHighTokens
                                ? "font-semibold text-purple-300"
                                : "text-zinc-200"
                            }
                          >
                            {formatCompactTokens(totalTokens)}
                          </div>
                          <div className="text-[10px] text-zinc-500">
                            {formatCompactTokens(log.totalPromptTokens)} /{" "}
                            {formatCompactTokens(log.totalOutputTokens)}
                          </div>
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-right font-mono">
                          <div className="text-zinc-100">
                            {formatUsd(log.estimatedCostUsd)}
                          </div>
                          <div className="text-[10px] text-emerald-400/90">
                            {formatBrl(costBrl)}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {pagination && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800/80 bg-zinc-900/60 px-4 py-3 text-xs text-zinc-400">
              <div className="flex items-center gap-3">
                <span>
                  Total:{" "}
                  <strong className="font-mono text-zinc-200">
                    {numberFmt.format(pagination.totalItems)}
                  </strong>{" "}
                  {pagination.totalItems === 1 ? "registro" : "registros"}
                </span>
                <select
                  aria-label="Itens por página"
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-zinc-300 focus:border-emerald-500/50 focus:outline-none"
                >
                  <option value={10}>10 / pág</option>
                  <option value={15}>15 / pág</option>
                  <option value={25}>25 / pág</option>
                  <option value={50}>50 / pág</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={pagination.page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Anterior
                </button>
                <span className="font-mono text-xs text-zinc-300">
                  {pagination.page} / {pagination.totalPages}
                </span>
                <button
                  type="button"
                  disabled={pagination.page >= pagination.totalPages || loading}
                  onClick={() =>
                    setPage((p) => Math.min(pagination.totalPages, p + 1))
                  }
                  className="inline-flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Próxima
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
