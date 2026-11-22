"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  Film,
  Image as ImageIcon,
  Loader2,
  ShieldCheck,
  Subtitles,
  UploadCloud,
  X,
} from "lucide-react";
import {
  FRIENDLY_MESSAGES,
  VideoExtractorError,
  extractSubtitleTrack,
  inspectVideoSubtitles,
  type ExtractionProgress,
  type VideoSubtitleTrack,
} from "@/lib/videoSubtitleExtractor";

export interface ExtractedSubtitlePayload {
  file: File;
  content: string;
  fileName: string;
  cueCount: number;
  trackLabel: string;
  extractionDurationMs: number;
}

interface VideoExtractorModalProps {
  isOpen: boolean;
  initialFile?: File | null;
  onClose: () => void;
  onExtracted: (payload: ExtractedSubtitlePayload) => void;
}

type ModalStage =
  | "idle"
  | "inspecting"
  | "selecting_track"
  | "extracting"
  | "error";

function formatLargeFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function VideoExtractorModal({
  isOpen,
  initialFile = null,
  onClose,
  onExtracted,
}: VideoExtractorModalProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inspectDurationMsRef = useRef<number>(0);

  const [stage, setStage] = useState<ModalStage>("idle");
  const [isDragging, setIsDragging] = useState(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [textTracks, setTextTracks] = useState<VideoSubtitleTrack[]>([]);
  const [imageTracks, setImageTracks] = useState<VideoSubtitleTrack[]>([]);
  const [selectedTrackId, setSelectedTrackId] = useState<number | null>(null);
  const [activeTrackLabel, setActiveTrackLabel] = useState<string>("");
  const [progress, setProgress] = useState<ExtractionProgress>({
    percent: 0,
    message: "Preparando leitura...",
    loadedBytes: 0,
    totalBytes: 0,
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isImageOnlyError, setIsImageOnlyError] = useState(false);

  const resetState = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    inspectDurationMsRef.current = 0;
    setStage("idle");
    setIsDragging(false);
    setVideoFile(null);
    setTextTracks([]);
    setImageTracks([]);
    setSelectedTrackId(null);
    setActiveTrackLabel("");
    setProgress({
      percent: 0,
      message: "Preparando leitura...",
      loadedBytes: 0,
      totalBytes: 0,
    });
    setErrorMessage(null);
    setIsImageOnlyError(false);
  }, []);

  const runExtraction = useCallback(
    async (file: File, track: VideoSubtitleTrack) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setStage("extracting");
      setActiveTrackLabel(track.displayLabel);
      setErrorMessage(null);
      setIsImageOnlyError(false);
      setProgress({
        percent: 0,
        message: "Lendo faixas do vídeo... 0%",
        loadedBytes: 0,
        totalBytes: file.size,
      });

      try {
        const extractStart = performance.now();
        const result = await extractSubtitleTrack(file, track, {
          signal: controller.signal,
          onProgress: (p) => setProgress(p),
        });

        if (controller.signal.aborted) return;

        const extractionDurationMs = Math.max(
          0,
          Math.round(
            inspectDurationMsRef.current + (performance.now() - extractStart)
          )
        );

        const srtFile = new File([result.srt], result.suggestedFileName, {
          type: "application/x-subrip;charset=utf-8",
        });

        onExtracted({
          file: srtFile,
          content: result.srt,
          fileName: result.suggestedFileName,
          cueCount: result.cueCount,
          trackLabel: result.track.displayLabel,
          extractionDurationMs,
        });
        resetState();
        onClose();
      } catch (err) {
        if (
          err instanceof VideoExtractorError &&
          err.code === "CANCELLED"
        ) {
          // If multiple tracks exist, go back to track selector; otherwise idle
          setStage((prev) =>
            prev === "extracting" && textTracks.length > 1
              ? "selecting_track"
              : "idle"
          );
          return;
        }
        setStage("error");
        setIsImageOnlyError(
          err instanceof VideoExtractorError &&
            err.code === "IMAGE_ONLY_SUBTITLES"
        );
        setErrorMessage(
          err instanceof Error
            ? err.message
            : "Não foi possível extrair a legenda deste vídeo."
        );
      }
    },
    [onClose, onExtracted, resetState, textTracks.length]
  );

  const handleVideoFile = useCallback(
    async (candidate: File | undefined) => {
      if (!candidate) return;

      const lower = candidate.name.toLowerCase();
      if (
        !lower.endsWith(".mkv") &&
        !lower.endsWith(".mp4") &&
        !lower.endsWith(".m4v")
      ) {
        setVideoFile(candidate);
        setStage("error");
        setIsImageOnlyError(false);
        setErrorMessage(FRIENDLY_MESSAGES.UNSUPPORTED_FORMAT);
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setVideoFile(candidate);
      setStage("inspecting");
      setErrorMessage(null);
      setIsImageOnlyError(false);
      setTextTracks([]);
      setImageTracks([]);
      setSelectedTrackId(null);

      try {
        const inspectStart = performance.now();
        const inspection = await inspectVideoSubtitles(
          candidate,
          controller.signal
        );
        if (controller.signal.aborted) return;
        inspectDurationMsRef.current = Math.max(
          0,
          performance.now() - inspectStart
        );

        setTextTracks(inspection.textTracks);
        setImageTracks(inspection.imageTracks);

        if (inspection.textTracks.length === 0) {
          setStage("error");
          if (inspection.imageTracks.length > 0) {
            setIsImageOnlyError(true);
            setErrorMessage(FRIENDLY_MESSAGES.IMAGE_ONLY_SUBTITLES);
          } else {
            setIsImageOnlyError(false);
            setErrorMessage(FRIENDLY_MESSAGES.NO_SUBTITLES);
          }
          return;
        }

        // Single text track: auto-select and extract immediately!
        if (inspection.textTracks.length === 1) {
          const onlyTrack = inspection.textTracks[0];
          setSelectedTrackId(onlyTrack.id);
          await runExtraction(candidate, onlyTrack);
          return;
        }

        // Multiple text tracks: pre-select default (or first) and let user pick
        const defaultTrack =
          inspection.textTracks.find((t) => t.isDefault && !t.isForced) ??
          inspection.textTracks[0];
        setSelectedTrackId(defaultTrack.id);
        setStage("selecting_track");
      } catch (err) {
        if (
          err instanceof VideoExtractorError &&
          err.code === "CANCELLED"
        ) {
          setStage("idle");
          setVideoFile(null);
          return;
        }
        setStage("error");
        setIsImageOnlyError(false);
        setErrorMessage(
          err instanceof Error
            ? err.message
            : "Não foi possível analisar este arquivo de vídeo."
        );
      }
    },
    [runExtraction]
  );

  // Process an initialFile if dropped directly onto the main page dropzone
  useEffect(() => {
    if (isOpen && initialFile) {
      handleVideoFile(initialFile);
    }
  }, [isOpen, initialFile, handleVideoFile]);

  // Escape key closes modal when not actively extracting
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        abortRef.current?.abort();
        resetState();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose, resetState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  if (!isOpen) return null;

  const isBusy = stage === "inspecting" || stage === "extracting";

  const handleClose = () => {
    abortRef.current?.abort();
    resetState();
    onClose();
  };

  const handleCancelOperation = () => {
    abortRef.current?.abort();
  };

  const handleConfirmTrack = () => {
    if (!videoFile || selectedTrackId === null) return;
    const chosen = textTracks.find((t) => t.id === selectedTrackId);
    if (chosen) {
      runExtraction(videoFile, chosen);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="video-extractor-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isBusy) {
          handleClose();
        }
      }}
    >
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/60">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800/80 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
              <Film className="h-4 w-4" />
            </div>
            <div>
              <h2
                id="video-extractor-title"
                className="text-sm font-semibold text-zinc-100"
              >
                Extrair legenda do vídeo
              </h2>
              <p className="text-[11px] text-zinc-500">
                Suporta arquivos .mkv, .mp4 e .m4v
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            aria-label="Fechar"
            className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 p-5">
          {/* Privacy Reassurance Banner */}
          <div className="flex items-start gap-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-3.5 py-2.5 text-xs leading-relaxed text-emerald-200/90">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
            <p>
              O vídeo não é enviado para a internet. A extração acontece direto
              no seu navegador de forma privada e instantânea.
            </p>
          </div>

          {/* Stage: IDLE (Dropzone) */}
          {stage === "idle" && (
            <div
              role="button"
              tabIndex={0}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  inputRef.current?.click();
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                handleVideoFile(e.dataTransfer.files?.[0]);
              }}
              className={`group flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-6 py-10 text-center transition-all ${
                isDragging
                  ? "border-emerald-400 bg-emerald-500/10"
                  : "border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-900/70"
              }`}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".mkv,.mp4,.m4v,video/x-matroska,video/mp4"
                onChange={(e) => {
                  handleVideoFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
                className="hidden"
              />

              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-300 transition-colors group-hover:border-emerald-500/30 group-hover:text-emerald-400">
                <UploadCloud className="h-5 w-5" />
              </div>

              <p className="text-sm font-medium text-zinc-200">
                Arraste o arquivo de vídeo aqui ou{" "}
                <span className="text-emerald-400 underline-offset-4 group-hover:underline">
                  clique para selecionar
                </span>
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Aceita <span className="font-mono text-zinc-400">.mkv</span> e{" "}
                <span className="font-mono text-zinc-400">.mp4</span> de
                qualquer tamanho (mesmo filmes de 10 GB+)
              </p>
            </div>
          )}

          {/* Stage: INSPECTING */}
          {stage === "inspecting" && videoFile && (
            <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-zinc-100">
                  Analisando faixas de legenda...
                </p>
                <p className="truncate text-xs text-zinc-400">
                  {videoFile.name} ({formatLargeFileSize(videoFile.size)})
                </p>
              </div>
              <button
                type="button"
                onClick={handleCancelOperation}
                className="inline-flex items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 px-3.5 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
              >
                Cancelar
              </button>
            </div>
          )}

          {/* Stage: SELECTING TRACK (Multiple Tracks) */}
          {stage === "selecting_track" && videoFile && (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between gap-2 rounded-xl border border-zinc-800/80 bg-zinc-900/40 px-3.5 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-zinc-200">
                    {videoFile.name}
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    {formatLargeFileSize(videoFile.size)} • {textTracks.length}{" "}
                    faixas de legenda encontradas
                  </p>
                </div>
                <button
                  type="button"
                  onClick={resetState}
                  className="shrink-0 text-xs text-zinc-400 underline-offset-4 hover:text-zinc-200 hover:underline"
                >
                  Trocar vídeo
                </button>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-medium text-zinc-300">
                  Escolha qual faixa de legenda extrair:
                </p>
                <div className="max-h-60 space-y-1.5 overflow-y-auto pr-1">
                  {textTracks.map((track) => {
                    const isSelected = selectedTrackId === track.id;
                    return (
                      <button
                        key={track.id}
                        type="button"
                        onClick={() => setSelectedTrackId(track.id)}
                        className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-all ${
                          isSelected
                            ? "border-emerald-500/60 bg-emerald-500/10 text-zinc-100"
                            : "border-zinc-800 bg-zinc-900/50 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900"
                        }`}
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <Subtitles
                            className={`h-4 w-4 shrink-0 ${
                              isSelected ? "text-emerald-400" : "text-zinc-500"
                            }`}
                          />
                          <div className="min-w-0">
                            <p className="truncate text-xs font-medium">
                              {track.languageLabel}
                              {track.name &&
                              track.name.toLowerCase() !==
                                track.languageLabel.toLowerCase()
                                ? ` — ${track.name}`
                                : ""}
                            </p>
                            <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-zinc-500">
                              <span className="font-mono uppercase">
                                {track.codec.replace(/^S_TEXT\//i, "")}
                              </span>
                              {track.isForced && (
                                <span className="rounded bg-zinc-800 px-1.5 py-0.2 text-[10px] text-zinc-400">
                                  Forçada
                                </span>
                              )}
                              {track.isDefault && (
                                <span className="rounded bg-zinc-800 px-1.5 py-0.2 text-[10px] text-zinc-400">
                                  Padrão
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                            isSelected
                              ? "border-emerald-400 bg-emerald-500 text-zinc-950"
                              : "border-zinc-700 bg-zinc-900"
                          }`}
                        >
                          {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {imageTracks.length > 0 && (
                <p className="text-[11px] text-zinc-500">
                  Nota: {imageTracks.length}{" "}
                  {imageTracks.length === 1
                    ? "faixa em formato de imagem (PGS/VobSub) foi ocultada"
                    : "faixas em formato de imagem (PGS/VobSub) foram ocultadas"}{" "}
                  por não serem texto extraível.
                </p>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmTrack}
                  disabled={selectedTrackId === null}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-zinc-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Subtitles className="h-3.5 w-3.5" />
                  Extrair legenda selecionada
                </button>
              </div>
            </div>
          )}

          {/* Stage: EXTRACTING (Progress Bar + Cancel) */}
          {stage === "extracting" && videoFile && (
            <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-100">
                    {progress.message}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-zinc-400">
                    {activeTrackLabel} • {videoFile.name}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-xs font-semibold text-emerald-400">
                  {progress.percent}%
                </span>
              </div>

              <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-150"
                  style={{ width: `${Math.max(2, progress.percent)}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-zinc-500">
                <span>Processamento 100% local na memória do navegador</span>
                <button
                  type="button"
                  onClick={handleCancelOperation}
                  className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Stage: ERROR (Friendly Messages) */}
          {stage === "error" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-4">
                <div className="flex items-start gap-3">
                  {isImageOnlyError ? (
                    <ImageIcon className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
                  ) : (
                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
                  )}
                  <div className="space-y-2 text-xs leading-relaxed text-amber-100/90">
                    <p className="font-medium text-amber-200">
                      {isImageOnlyError
                        ? "Legendas em formato de imagem (Blu-ray / DVD)"
                        : "Nenhuma legenda em texto encontrada"}
                    </p>
                    <p>{errorMessage}</p>

                    {isImageOnlyError && imageTracks.length > 0 && (
                      <div className="mt-2 rounded-lg border border-amber-500/20 bg-black/25 px-3 py-2 text-[11px] text-amber-200/80">
                        <p className="mb-1 font-medium">
                          Faixas detectadas neste vídeo:
                        </p>
                        <ul className="list-inside list-disc space-y-0.5">
                          {imageTracks.slice(0, 5).map((t) => (
                            <li key={t.id}>{t.displayLabel}</li>
                          ))}
                          {imageTracks.length > 5 && (
                            <li>e mais {imageTracks.length - 5} faixas...</li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={resetState}
                  className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-800"
                >
                  Escolher outro vídeo
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-xl bg-zinc-100 px-4 py-2 text-xs font-semibold text-zinc-950 transition-colors hover:bg-zinc-200"
                >
                  Voltar para envio de .srt
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
