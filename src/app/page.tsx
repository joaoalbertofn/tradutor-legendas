"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useAuth, useClerk } from "@clerk/nextjs";
import { Sparkles, RotateCcw, Download, Zap, BookOpen } from "lucide-react";
import { GUIDES } from "@/lib/guides";
import { BrandMark, BrandWordmark } from "@/components/BrandLogo";
import { Header } from "@/components/Header";
import {
  BuyCreditsModal,
  type BuyCreditsModalReason,
} from "@/components/BuyCreditsModal";
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
import { calculateEstimatedCostUsd } from "@/lib/pricing";
import type {
  ParsedSubtitle,
  QuotaInfo,
  SessionResponse,
  StatsResponse,
  SubtitleBlock,
  SubtitleExtension,
  TranslationChunkMetrics,
  TranslationItem,
  TranslationLogPayload,
  TranslationLogStatus,
  TranslationSourceType,
  TranslationStatus,
  TranslationStyle,
  UserCreditsInfo,
} from "@/lib/types";

const INITIAL_CONCURRENCY = 6;
const MIN_CONCURRENCY = 2;
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

function createTelemetrySessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function sendTranslationLogFireAndForget(payload: TranslationLogPayload): void {
  try {
    void fetch("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Never disrupt UX for telemetry failures
  }
}

export default function HomePage() {
  const { isLoaded: isAuthLoaded, isSignedIn, userId } = useAuth();
  const { openSignIn } = useClerk();

  const [totalTranslated, setTotalTranslated] = useState<number | null>(null);
  const [statsSource, setStatsSource] = useState<"redis" | "fallback">("fallback");
  const [credits, setCredits] = useState<UserCreditsInfo | null>(null);
  const [anonymousQuota, setAnonymousQuota] = useState<QuotaInfo | null>(null);
  const [creditsLoading, setCreditsLoading] = useState(false);

  const [isBuyCreditsOpen, setIsBuyCreditsOpen] = useState(false);
  const [buyCreditsReason, setBuyCreditsReason] =
    useState<BuyCreditsModalReason>("manual");

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
  const [sourceType, setSourceType] =
    useState<TranslationSourceType>("file_upload");
  const [extractionDurationMs, setExtractionDurationMs] = useState<number>(0);

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
  const pendingTranslateAfterSignInRef = useRef(false);

  const fetchUserCredits = useCallback(async () => {
    setCreditsLoading(true);
    try {
      const res = await fetch("/api/credits", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as {
        signedIn?: boolean;
        credits?: UserCreditsInfo | null;
        quota?: QuotaInfo | null;
      };
      if (data.quota) {
        setAnonymousQuota(data.quota);
      }
      if (data.signedIn && data.credits) {
        setCredits(data.credits);
      } else {
        setCredits(null);
      }
    } catch {
      // Ignore transient errors
    } finally {
      setCreditsLoading(false);
    }
  }, []);

  // Load initial global counter
  useEffect(() => {
    let active = true;
    async function loadStats() {
      try {
        const res = await fetch("/api/stats", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load stats");
        const data: StatsResponse = await res.json();
        if (!active) return;

        setStatsSource(data.source);

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

  // Load quota/credits on mount and whenever Clerk session changes
  useEffect(() => {
    if (!isAuthLoaded) return;
    void fetchUserCredits();
  }, [isAuthLoaded, isSignedIn, userId, fetchUserCredits]);

  // Detect return from Mercado Pago Checkout Pro (?payment=success|pending|failure)
  useEffect(() => {
    if (!isAuthLoaded || !isSignedIn) return;
    const params = new URLSearchParams(window.location.search);
    const paymentState = params.get("payment");
    if (
      paymentState === "success" ||
      paymentState === "pending" ||
      paymentState === "failure"
    ) {
      setBuyCreditsReason(
        paymentState === "success"
          ? "payment_success"
          : paymentState === "pending"
          ? "payment_pending"
          : "payment_failure"
      );
      setIsBuyCreditsOpen(true);

      // Clean Mercado Pago return query params from URL
      [
        "payment",
        "collection_id",
        "collection_status",
        "payment_id",
        "status",
        "external_reference",
        "payment_type",
        "merchant_order_id",
        "preference_id",
        "site_id",
        "processing_mode",
        "merchant_account_id",
      ].forEach((key) => params.delete(key));

      const nextSearch = params.toString();
      const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}`;
      window.history.replaceState({}, "", nextUrl);
    }
  }, [isAuthLoaded, isSignedIn]);

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
    setSourceType("file_upload");
    setExtractionDurationMs(0);

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
      setSourceType("video_extraction");
      setExtractionDurationMs(payload.extractionDurationMs);
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
    setSourceType("file_upload");
    setExtractionDurationMs(0);
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
      signal: AbortSignal,
      options?: {
        preferredModel?: string;
        onRetry?: () => void;
        onRateLimit?: () => void;
      }
    ): Promise<{
      items: TranslationItem[];
      metrics: TranslationChunkMetrics;
      model?: string;
    }> => {
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

        if (attempt > 0) {
          options?.onRetry?.();
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
              preferredModel: options?.preferredModel || undefined,
              previousContext: previousContext.length > 0 ? previousContext : undefined,
            }),
          });

          const data = await response.json().catch(() => ({}));

          if (!response.ok) {
            if (response.status === 429) {
              options?.onRateLimit?.();
            }
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
                const rawMetrics = data.metrics as Partial<TranslationChunkMetrics> | undefined;
                const metrics: TranslationChunkMetrics = {
                  promptTokens: Number(rawMetrics?.promptTokens) || 0,
                  outputTokens: Number(rawMetrics?.outputTokens) || 0,
                  totalTokens: Number(rawMetrics?.totalTokens) || undefined,
                  durationMs: Number(rawMetrics?.durationMs) || 0,
                };
                return {
                  items: translatedItems,
                  metrics,
                  model: typeof data.model === "string" ? data.model : undefined,
                };
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

    // Anonymous user: allow up to 3 free translations/day without login;
    // only prompt Clerk sign-in once the free daily limit is exhausted (unless running unlimited locally).
    if (
      !isSignedIn &&
      anonymousQuota !== null &&
      !anonymousQuota.unlimited &&
      anonymousQuota.remaining === 0
    ) {
      pendingTranslateAfterSignInRef.current = true;
      openSignIn();
      return;
    }

    // Signed-in user: if we already know they have 0 available credits (and not unlimited locally), open purchase modal
    if (
      isSignedIn &&
      credits !== null &&
      !credits.unlimited &&
      credits.totalAvailable === 0
    ) {
      setBuyCreditsReason("limit_reached");
      setIsBuyCreditsOpen(true);
      return;
    }

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

    // Per-file telemetry accumulator
    const telemetry = {
      sessionId: createTelemetrySessionId(),
      fileName: file.name,
      extension: (parsed.format === "vtt" ? ".vtt" : ".srt") as SubtitleExtension,
      sourceType,
      extractionDurationMs:
        sourceType === "video_extraction" ? extractionDurationMs : 0,
      totalCues: parsed.blocks.length,
      totalChunks: chunks.length,
      retriesCount: 0,
      totalPromptTokens: 0,
      totalOutputTokens: 0,
      model: null as string | null,
    };

    let translationStartMs: number | null = null;
    let logDispatched = false;

    const dispatchTelemetryLog = (
      finalStatus: TranslationLogStatus,
      finalError?: string | null
    ) => {
      if (logDispatched) return;
      logDispatched = true;

      const translationDurationMs =
        translationStartMs !== null
          ? Math.max(0, Math.round(performance.now() - translationStartMs))
          : 0;

      const estimatedCostUsd = calculateEstimatedCostUsd(
        telemetry.totalPromptTokens,
        telemetry.totalOutputTokens,
        telemetry.model ?? undefined
      );

      sendTranslationLogFireAndForget({
        sessionId: telemetry.sessionId,
        fileName: telemetry.fileName,
        extension: telemetry.extension,
        sourceType: telemetry.sourceType,
        status: finalStatus,
        errorMessage: finalError ?? null,
        model: telemetry.model,
        extractionDurationMs: telemetry.extractionDurationMs,
        translationDurationMs,
        totalCues: telemetry.totalCues,
        totalChunks: telemetry.totalChunks,
        retriesCount: telemetry.retriesCount,
        totalPromptTokens: telemetry.totalPromptTokens,
        totalOutputTokens: telemetry.totalOutputTokens,
        estimatedCostUsd,
      });
    };

    try {
      // 1. Acquire translation session & consume 1 credit (free daily quota first, then paid credits)
      const sessionRes = await fetch("/api/translate/session", {
        method: "POST",
        signal: controller.signal,
      });
      const sessionData = await sessionRes.json().catch(() => ({}));

      if (!sessionRes.ok) {
        if (sessionData.credits) {
          setCredits(sessionData.credits as UserCreditsInfo);
        }
        if (sessionData.quota) {
          setAnonymousQuota(sessionData.quota as QuotaInfo);
        }

        if (sessionRes.status === 401) {
          setStatus("idle");
          pendingTranslateAfterSignInRef.current = true;
          openSignIn();
          return;
        }

        if (sessionRes.status === 402) {
          setStatus("idle");
          setBuyCreditsReason("limit_reached");
          setIsBuyCreditsOpen(true);
          return;
        }

        throw new Error(
          sessionData.error || "Não foi possível iniciar a sessão de tradução."
        );
      }

      const {
        sessionId,
        credits: updatedCredits,
        quota: updatedQuota,
      } = sessionData as SessionResponse;
      activeSessionId = sessionId;
      if (updatedCredits) {
        setCredits(updatedCredits);
      }
      if (updatedQuota) {
        setAnonymousQuota(updatedQuota);
      }

      // 2. Adaptive concurrent queue (starts at 6 workers, backs off on 429)
      const startTime = Date.now();
      translationStartMs = performance.now();
      let nextChunkIndex = 0;
      const workerCount = Math.min(INITIAL_CONCURRENCY, chunks.length);
      let activeWorkerLimit = workerCount;

      const worker = async (workerIndex: number) => {
        while (true) {
          if (controller.signal.aborted) return;
          if (workerIndex >= activeWorkerLimit) return;

          const currentIndex = nextChunkIndex++;
          if (currentIndex >= chunks.length) return;

          const chunk = chunks[currentIndex];
          const chunkContext = buildChunkContext(
            parsed.blocks,
            currentIndex,
            CHUNK_SIZE,
            cachedFullTranscript
          );
          const chunkResult = await translateChunkWithRetry(
            chunk,
            currentIndex,
            parsed.blocks,
            chunkContext,
            sessionId,
            controller.signal,
            {
              preferredModel: telemetry.model ?? undefined,
              onRetry: () => {
                telemetry.retriesCount += 1;
              },
              onRateLimit: () => {
                activeWorkerLimit = Math.max(
                  MIN_CONCURRENCY,
                  activeWorkerLimit - 1
                );
              },
            }
          );

          if (controller.signal.aborted) return;

          telemetry.totalPromptTokens += chunkResult.metrics.promptTokens;
          telemetry.totalOutputTokens += chunkResult.metrics.outputTokens;
          if (chunkResult.model) {
            telemetry.model = chunkResult.model;
          }

          const batchMap: Record<number, string> = {};
          for (const item of chunkResult.items) {
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

      await Promise.all(
        Array.from({ length: workerCount }, (_, workerIndex) =>
          worker(workerIndex)
        )
      );

      if (controller.signal.aborted) {
        dispatchTelemetryLog("cancelled");
        return;
      }

      setStatus("completed");
      setEtaSeconds(0);
      dispatchTelemetryLog("success");

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

      // Only request credit refund if 0 chunks succeeded (server also enforces this strictly)
      if (activeSessionId && finishedCount === 0 && !isCancelled) {
        fetch("/api/translate/session", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: activeSessionId }),
        })
          .then((r) => r.json())
          .then((d) => {
            if (d?.credits) setCredits(d.credits as UserCreditsInfo);
            if (d?.quota) setAnonymousQuota(d.quota as QuotaInfo);
          })
          .catch(() => {});
      }

      if (isCancelled) {
        dispatchTelemetryLog("cancelled");
        setStatus("cancelled");
        return;
      }
      controller.abort();
      const message =
        err instanceof Error
          ? err.message
          : "Ocorreu um erro inesperado durante a tradução.";
      dispatchTelemetryLog("error", message);
      setStatus("error");
      setErrorMessage(message);
    }
  }, [
    parsed,
    file,
    isSignedIn,
    openSignIn,
    credits,
    anonymousQuota,
    sourceType,
    extractionDurationMs,
    translateChunkWithRetry,
    statsSource,
  ]);

  // Auto-resume translation if the user clicked "Traduzir" while signed out and just signed in
  useEffect(() => {
    if (
      isAuthLoaded &&
      isSignedIn &&
      pendingTranslateAfterSignInRef.current &&
      parsed &&
      file &&
      status !== "translating"
    ) {
      pendingTranslateAfterSignInRef.current = false;
      void handleStartTranslation();
    }
  }, [isAuthLoaded, isSignedIn, parsed, file, status, handleStartTranslation]);

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
      <Header
        totalTranslated={totalTranslated}
        credits={credits}
        quota={anonymousQuota}
        creditsLoading={creditsLoading}
        onOpenBuyCredits={() => {
          setBuyCreditsReason("manual");
          setIsBuyCreditsOpen(true);
        }}
      />

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-10 sm:px-6 sm:py-14">
        {/* Hero */}
        <div className="flex flex-col items-center space-y-3 text-center">
          <div className="inline-flex items-center gap-2.5 rounded-full border border-zinc-800/90 bg-zinc-900/70 py-1.5 pl-2 pr-3.5 shadow-sm">
            <BrandMark className="h-6 w-6" />
            <BrandWordmark className="text-sm font-semibold tracking-tight" />
          </div>
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
            {!isSignedIn &&
              anonymousQuota !== null &&
              !anonymousQuota.unlimited &&
              anonymousQuota.remaining === 0 && (
                <div className="flex flex-col items-start justify-between gap-2.5 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-xs text-amber-200 sm:flex-row sm:items-center">
                  <span>
                    Você já usou suas {anonymousQuota.limit} traduções grátis de
                    hoje. Faça login para verificar seus créditos ou adquirir um
                    pacote avulso.
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      pendingTranslateAfterSignInRef.current = true;
                      openSignIn();
                    }}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-zinc-950 transition-colors hover:bg-emerald-400"
                  >
                    Entrar para continuar
                  </button>
                </div>
              )}
            {isSignedIn &&
              credits !== null &&
              !credits.unlimited &&
              credits.totalAvailable === 0 && (
                <div className="flex flex-col items-start justify-between gap-2.5 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-xs text-amber-200 sm:flex-row sm:items-center">
                  <span>
                    Você já usou suas {credits.freeLimit} traduções grátis de hoje.
                    Compre um pacote avulso a partir de R$ 3,00 para continuar.
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setBuyCreditsReason("limit_reached");
                      setIsBuyCreditsOpen(true);
                    }}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-zinc-950 transition-colors hover:bg-emerald-400"
                  >
                    <Zap className="h-3.5 w-3.5" />
                    Comprar créditos
                  </button>
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
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-zinc-950 shadow-lg shadow-emerald-500/15 transition-all hover:bg-emerald-400 active:scale-[0.99] sm:w-auto"
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

      <footer className="border-t border-zinc-900 py-8 text-xs text-zinc-500">
        <div className="mx-auto flex max-w-4xl flex-col gap-5 px-4 sm:px-6">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 font-medium text-zinc-400">
                <BookOpen className="h-3.5 w-3.5 text-emerald-400/80" />
                Guias e tutoriais sobre legendas
              </span>
              <Link
                href="/guias"
                className="text-emerald-400/90 transition-colors hover:text-emerald-300"
              >
                Ver todos os guias →
              </Link>
            </div>
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {GUIDES.map((guide) => (
                <li key={guide.slug}>
                  <Link
                    href={`/guias/${guide.slug}`}
                    className="text-zinc-500 transition-colors hover:text-zinc-300"
                  >
                    {guide.metaTitle}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col items-center justify-between gap-2 border-t border-zinc-900/90 pt-4 text-center text-zinc-600 sm:flex-row sm:text-left">
            <div className="inline-flex items-center gap-2">
              <BrandMark className="h-5 w-5" />
              <BrandWordmark className="text-xs font-semibold tracking-tight" />
            </div>
            <p>
              Processamento em lotes paralelos com contexto completo • 3 traduções
              grátis por dia • Pacotes avulsos via Pix e Cartão
            </p>
          </div>
        </div>
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

      <BuyCreditsModal
        isOpen={isBuyCreditsOpen}
        credits={credits}
        reason={buyCreditsReason}
        onClose={() => setIsBuyCreditsOpen(false)}
        onCreditsUpdated={(updated) => setCredits(updated)}
      />
    </div>
  );
}
