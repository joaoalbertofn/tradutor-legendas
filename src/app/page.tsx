"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Sparkles, RotateCcw, Download } from "lucide-react";
import { Header } from "@/components/Header";
import { SubtitleUploader } from "@/components/SubtitleUploader";
import { TranslationOptions } from "@/components/TranslationOptions";
import { TranslationProgress } from "@/components/TranslationProgress";
import { PreviewTable } from "@/components/PreviewTable";
import type { ExtractedSubtitlePayload } from "@/components/VideoExtractorModal";

const VideoExtractorModal = dynamic(
  () =>
    import("@/components/VideoExtractorModal").then(
      (mod) => mod.VideoExtractorModal
    ),
  { ssr: false }
);
import {
  CHUNK_SIZE,
  FULL_CONTEXT_BLOCK_THRESHOLD,
  buildChunkContext,
  buildFullContextTranscript,
  chunkSubtitleBlocks,
  createSubtitleBlob,
  getTranslatedFileName,
  parseSubtitle,
  reconstructSubtitle,
} from "@/lib/subtitleParser";
import type {
  ParsedSubtitle,
  QuotaInfo,
  SessionResponse,
  StatsResponse,
  SubtitleBlock,
  TranslationItem,
  TranslationStatus,
  TranslationStyle,
} from "@/lib/types";

const CONCURRENCY = 3;
const MAX_RETRIES = 2;
const FETCH_TIMEOUT_MS = 55_000;
const LOCAL_STORAGE_COUNTER_KEY = "traduz-legendas:total_translated";

function createAttemptSignal(parentSignal: AbortSignal, timeoutMs: number): {
  signal: AbortSignal;
  cleanup: () => void;
  wasTimedOut: () => boolean;
} {
  const controller = new AbortController();
  let timedOut = false;

  const onParentAbort = () => controller.abort();
  if (parentSignal.aborted) {
    controller.abort();
  } else {
    parentSignal.addEventListener("abort", onParentAbort, { once: true });
  }

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  return {
    signal: controller.signal,
    wasTimedOut: () => timedOut,
    cleanup: () => {
      clearTimeout(timer);
      parentSignal.removeEventListener("abort", onParentAbort);
    },
  };
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true }
    );
  });
}

function readLocalCounter(): number {
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_COUNTER_KEY);
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

function writeLocalCounter(value: number): void {
  try {
    window.localStorage.setItem(LOCAL_STORAGE_COUNTER_KEY, String(value));
  } catch {
    // Ignore storage quota / privacy mode errors
  }
}

export default function HomePage() {
  const [totalTranslated, setTotalTranslated] = useState<number | null>(null);
  const [statsSource, setStatsSource] = useState<"redis" | "fallback">("fallback");
  const [quota, setQuota] = useState<QuotaInfo | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedSubtitle | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const [isVideoExtractorOpen, setIsVideoExtractorOpen] = useState(false);
  const [pendingVideoFile, setPendingVideoFile] = useState<File | null>(null);
  const [extractedOriginal, setExtractedOriginal] = useState<{
    fileName: string;
    content: string;
    trackLabel: string;
  } | null>(null);

  const [style, setStyle] = useState<TranslationStyle>("natural");
  const [glossary, setGlossary] = useState("");
  const [includeBom, setIncludeBom] = useState(true);

  const [status, setStatus] = useState<TranslationStatus>("idle");
  const [completedChunks, setCompletedChunks] = useState(0);
  const [totalChunks, setTotalChunks] = useState(0);
  const [etaSeconds, setEtaSeconds] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [translations, setTranslations] = useState<Record<number, string>>({});

  const abortControllerRef = useRef<AbortController | null>(null);
  const translationsRef = useRef<Record<number, string>>({});

  // Load initial global counter and daily IP quota
  useEffect(() => {
    let active = true;
    async function loadStats() {
      try {
        const res = await fetch("/api/stats", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load stats");
        const data: StatsResponse = await res.json();
        if (!active) return;

        setStatsSource(data.source);
        setQuota(data.quota);

        if (data.source === "redis") {
          setTotalTranslated(data.totalTranslated);
        } else {
          setTotalTranslated(readLocalCounter());
        }
      } catch {
        if (!active) return;
        setStatsSource("fallback");
        setTotalTranslated(readLocalCounter());
      }
    }

    loadStats();
    return () => {
      active = false;
      abortControllerRef.current?.abort();
    };
  }, []);

  const outputFileName = useMemo(() => {
    if (!file || !parsed) return "legenda.pt-BR.srt";
    return getTranslatedFileName(file.name, parsed.format);
  }, [file, parsed]);

  const handleFileSelected = useCallback((selectedFile: File, content: string) => {
    setParseError(null);
    setErrorMessage(null);
    setStatus("idle");
    setTranslations({});
    translationsRef.current = {};
    setCompletedChunks(0);
    setTotalChunks(0);
    setEtaSeconds(null);
    setExtractedOriginal(null);

    const result = parseSubtitle(content, selectedFile.name);
    if (result.blocks.length === 0) {
      setFile(null);
      setParsed(null);
      setParseError(
        "Nenhum bloco de legenda válido foi encontrado neste arquivo. Verifique se os timestamps estão no formato .srt ou .vtt."
      );
      return;
    }

    setFile(selectedFile);
    setParsed(result);
    if (result.hasBom) {
      setIncludeBom(true);
    }
  }, []);

  const handleVideoSubtitleExtracted = useCallback(
    (payload: ExtractedSubtitlePayload) => {
      handleFileSelected(payload.file, payload.content);
      setExtractedOriginal({
        fileName: payload.fileName,
        content: payload.content,
        trackLabel: payload.trackLabel,
      });
      setPendingVideoFile(null);
    },
    [handleFileSelected]
  );

  const handleDownloadOriginalExtracted = useCallback(() => {
    if (!extractedOriginal) return;
    const blob = createSubtitleBlob(extractedOriginal.content, "srt", includeBom);
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = extractedOriginal.fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [extractedOriginal, includeBom]);

  const handleClear = useCallback(() => {
    abortControllerRef.current?.abort();
    setFile(null);
    setParsed(null);
    setParseError(null);
    setExtractedOriginal(null);
    setStatus("idle");
    setTranslations({});
    translationsRef.current = {};
    setCompletedChunks(0);
    setTotalChunks(0);
    setEtaSeconds(null);
    setErrorMessage(null);
  }, []);

  const handleCancel = useCallback(() => {
    abortControllerRef.current?.abort();
    setStatus("cancelled");
    setEtaSeconds(null);
  }, []);

  const translateChunkWithRetry = useCallback(
    async (
      chunk: SubtitleBlock[],
      chunkIndex: number,
      allBlocks: SubtitleBlock[],
      fullContext: string,
      sessionId: string,
      signal: AbortSignal
    ): Promise<TranslationItem[]> => {
      const items: TranslationItem[] = chunk.map((b) => ({
        id: b.id,
        text: b.text,
      }));

      // Include up to 2 immediately preceding lines for local dialogue continuity
      const startIndex = chunkIndex * CHUNK_SIZE;
      const prevSlice = allBlocks.slice(Math.max(0, startIndex - 2), startIndex);
      const previousContext = prevSlice.map((b) => ({
        id: b.id,
        text: translationsRef.current[b.id] ?? b.text,
      }));

      let lastError: Error = new Error("Erro desconhecido ao traduzir lote.");

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        if (signal.aborted) {
          throw new DOMException("Aborted", "AbortError");
        }

        const attemptControl = createAttemptSignal(signal, FETCH_TIMEOUT_MS);

        try {
          const response = await fetch("/api/translate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: attemptControl.signal,
            body: JSON.stringify({
              sessionId,
              items,
              style,
              glossary: glossary.trim() || undefined,
              fullContext,
              previousContext: previousContext.length > 0 ? previousContext : undefined,
            }),
          });

          const data = await response.json().catch(() => ({}));

          if (!response.ok) {
            const msg =
              typeof data.error === "string"
                ? data.error
                : `Erro HTTP ${response.status}`;
            const retryable =
              response.status === 429 ||
              response.status === 502 ||
              response.status === 503 ||
              response.status === 504 ||
              response.status >= 500;

            lastError = new Error(msg);
            if (!retryable || attempt === MAX_RETRIES) {
              throw lastError;
            }
          } else {
            const translatedItems = data.translations as TranslationItem[] | undefined;
            if (!Array.isArray(translatedItems) || translatedItems.length !== items.length) {
              lastError = new Error("Resposta incompleta recebida da API.");
              if (attempt === MAX_RETRIES) throw lastError;
            } else {
              const expectedIds = new Set(items.map((i) => i.id));
              const validAll = translatedItems.every((t) => expectedIds.has(t.id));
              if (!validAll) {
                lastError = new Error("IDs retornados não correspondem ao lote enviado.");
                if (attempt === MAX_RETRIES) throw lastError;
              } else {
                return translatedItems;
              }
            }
          }
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") {
            if (attemptControl.wasTimedOut() && !signal.aborted) {
              lastError = new Error("Tempo limite excedido ao aguardar resposta do servidor.");
              if (attempt === MAX_RETRIES) throw lastError;
            } else {
              throw err;
            }
          } else {
            lastError = err instanceof Error ? err : new Error("Falha de rede.");
            if (attempt === MAX_RETRIES) {
              throw lastError;
            }
          }
        } finally {
          attemptControl.cleanup();
        }

        // Exponential backoff: 1.5s -> 3.5s
        const backoffMs = 1500 * Math.pow(2, attempt) + Math.floor(Math.random() * 400);
        await sleep(backoffMs, signal);
      }

      throw lastError;
    },
    [style, glossary]
  );

  const handleStartTranslation = useCallback(async () => {
    if (!parsed || !file) return;

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const chunks = chunkSubtitleBlocks(parsed.blocks, CHUNK_SIZE);
    const cachedFullTranscript =
      parsed.blocks.length <= FULL_CONTEXT_BLOCK_THRESHOLD
        ? buildFullContextTranscript(parsed.blocks)
        : undefined;

    setStatus("translating");
    setErrorMessage(null);
    setTranslations({});
    translationsRef.current = {};
    setCompletedChunks(0);
    setTotalChunks(chunks.length);
    setEtaSeconds(null);

    let activeSessionId: string | null = null;
    let finishedCount = 0;

    try {
      // 1. Acquire translation session & verify daily IP quota (3 subtitles/day/IP)
      const sessionRes = await fetch("/api/translate/session", {
        method: "POST",
        signal: controller.signal,
      });
      const sessionData = await sessionRes.json().catch(() => ({}));

      if (!sessionRes.ok) {
        if (sessionData.quota) {
          setQuota(sessionData.quota);
        }
        throw new Error(
          sessionData.error || "Não foi possível iniciar a sessão de tradução."
        );
      }

      const { sessionId, quota: updatedQuota } = sessionData as SessionResponse;
      activeSessionId = sessionId;
      setQuota(updatedQuota);

      // 2. Concurrent queue with 3 parallel workers using hybrid context
      const startTime = Date.now();
      let nextChunkIndex = 0;

      const worker = async () => {
        while (true) {
          if (controller.signal.aborted) return;

          const currentIndex = nextChunkIndex++;
          if (currentIndex >= chunks.length) return;

          const chunk = chunks[currentIndex];
          const chunkContext = buildChunkContext(
            parsed.blocks,
            currentIndex,
            CHUNK_SIZE,
            cachedFullTranscript
          );
          const translatedItems = await translateChunkWithRetry(
            chunk,
            currentIndex,
            parsed.blocks,
            chunkContext,
            sessionId,
            controller.signal
          );

          if (controller.signal.aborted) return;

          const batchMap: Record<number, string> = {};
          for (const item of translatedItems) {
            batchMap[item.id] = item.text;
            translationsRef.current[item.id] = item.text;
          }

          finishedCount += 1;
          const elapsedSeconds = (Date.now() - startTime) / 1000;
          const avgPerChunk = elapsedSeconds / finishedCount;
          const remainingChunks = chunks.length - finishedCount;

          setTranslations((prev) => ({ ...prev, ...batchMap }));
          setCompletedChunks(finishedCount);
          setEtaSeconds(remainingChunks > 0 ? avgPerChunk * remainingChunks : 0);
        }
      };

      const workerCount = Math.min(CONCURRENCY, chunks.length);
      await Promise.all(Array.from({ length: workerCount }, () => worker()));

      if (controller.signal.aborted) return;

      setStatus("completed");
      setEtaSeconds(0);

      // 3. Increment global counter on completion (authenticated & idempotent via sessionId)
      try {
        const statsRes = await fetch("/api/stats", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        if (statsRes.ok) {
          const statsData: StatsResponse = await statsRes.json();
          setStatsSource(statsData.source);
          if (statsData.source === "redis") {
            setTotalTranslated(statsData.totalTranslated);
          } else {
            const nextLocal = readLocalCounter() + 1;
            writeLocalCounter(nextLocal);
            setTotalTranslated(nextLocal);
          }
        }
      } catch {
        if (statsSource === "fallback") {
          const nextLocal = readLocalCounter() + 1;
          writeLocalCounter(nextLocal);
          setTotalTranslated(nextLocal);
        }
      }
    } catch (err) {
      const isCancelled = err instanceof DOMException && err.name === "AbortError";

      // Only request quota refund if 0 chunks succeeded (server also enforces this strictly)
      if (activeSessionId && finishedCount === 0 && !isCancelled) {
        fetch("/api/translate/session", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: activeSessionId }),
        })
          .then((r) => r.json())
          .then((d) => {
            if (d?.quota) setQuota(d.quota);
          })
          .catch(() => {});
      }

      if (isCancelled) {
        setStatus("cancelled");
        return;
      }
      controller.abort();
      setStatus("error");
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Ocorreu um erro inesperado durante a tradução."
      );
    }
  }, [parsed, file, translateChunkWithRetry, statsSource]);

  const handleDownload = useCallback(() => {
    if (!parsed) return;
    const content = reconstructSubtitle(parsed, translationsRef.current);
    const blob = createSubtitleBlob(content, parsed.format, includeBom);
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = outputFileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [parsed, includeBom, outputFileName]);

  const isTranslating = status === "translating";
  const translatedCount = Object.keys(translations).length;

  return (
    <div className="flex min-h-screen flex-col">
      <Header totalTranslated={totalTranslated} quota={quota} />

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-10 sm:px-6 sm:py-14">
        {/* Hero */}
        <div className="space-y-2.5 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
            Traduza legendas para{" "}
            <span className="text-emerald-400">Português do Brasil</span>
          </h1>
          <p className="mx-auto max-w-xl text-sm leading-relaxed text-zinc-400 sm:text-base">
            Envie um arquivo <span className="font-mono text-zinc-300">.srt</span>{" "}
            ou <span className="font-mono text-zinc-300">.vtt</span> em qualquer
            idioma. Preservamos 100% dos índices, timestamps e formatações
            originais.
          </p>
        </div>

        {/* Uploader */}
        <SubtitleUploader
          file={file}
          parsed={parsed}
          disabled={isTranslating}
          extractedSourceLabel={extractedOriginal?.trackLabel ?? null}
          onFileSelected={handleFileSelected}
          onClear={handleClear}
          onOpenVideoExtractor={() => {
            setPendingVideoFile(null);
            setIsVideoExtractorOpen(true);
          }}
          onVideoFileDropped={(videoFile) => {
            setPendingVideoFile(videoFile);
            setIsVideoExtractorOpen(true);
          }}
        />

        {parseError && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs text-red-300">
            {parseError}
          </div>
        )}

        {/* Collapsible Options */}
        <TranslationOptions
          style={style}
          glossary={glossary}
          includeBom={includeBom}
          disabled={isTranslating}
          onStyleChange={setStyle}
          onGlossaryChange={setGlossary}
          onIncludeBomChange={setIncludeBom}
        />

        {/* Primary Action Button */}
        {parsed && status !== "translating" && (
          <div className="space-y-2.5">
            {quota !== null && !quota.unlimited && quota.remaining === 0 && (
              <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-200">
                Você atingiu o limite diário gratuito de {quota.limit} legendas
                por IP. A cota é renovada automaticamente às 00:00 UTC.
              </div>
            )}
            <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-end">
              {extractedOriginal && (
                <button
                  type="button"
                  onClick={handleDownloadOriginalExtracted}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100 sm:w-auto"
                >
                  <Download className="h-4 w-4" />
                  Baixar legenda original extraída (.srt)
                </button>
              )}

              {status === "completed" && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100 sm:w-auto"
                >
                  <RotateCcw className="h-4 w-4" />
                  Traduzir outro arquivo
                </button>
              )}

              <button
                type="button"
                onClick={handleStartTranslation}
                disabled={quota !== null && !quota.unlimited && quota.remaining === 0}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-zinc-950 shadow-lg shadow-emerald-500/15 transition-all hover:bg-emerald-400 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500 disabled:shadow-none sm:w-auto"
              >
                <Sparkles className="h-4 w-4" />
                {status === "error" || status === "cancelled"
                  ? "Tentar traduzir novamente"
                  : status === "completed"
                  ? "Retraduzir com novas opções"
                  : "Traduzir para PT-BR"}
              </button>
            </div>
          </div>
        )}

        {/* Progress & Download */}
        <TranslationProgress
          status={status}
          completedChunks={completedChunks}
          totalChunks={totalChunks}
          translatedBlocks={translatedCount}
          totalBlocks={parsed?.blocks.length ?? 0}
          etaSeconds={etaSeconds}
          errorMessage={errorMessage}
          outputFileName={outputFileName}
          onCancel={handleCancel}
          onDownload={handleDownload}
        />

        {/* Side-by-side Live Preview */}
        {parsed && (
          <PreviewTable blocks={parsed.blocks} translations={translations} />
        )}
      </main>

      <footer className="border-t border-zinc-900 py-6 text-center text-xs text-zinc-600">
        Processamento em lotes paralelos com contexto completo • Limite de 3
        legendas/dia por IP
      </footer>

      {isVideoExtractorOpen && (
        <VideoExtractorModal
          isOpen={isVideoExtractorOpen}
          initialFile={pendingVideoFile}
          onClose={() => {
            setIsVideoExtractorOpen(false);
            setPendingVideoFile(null);
          }}
          onExtracted={handleVideoSubtitleExtracted}
        />
      )}
    </div>
  );
}
