"use client";

import { useRef, useState } from "react";
import { UploadCloud, FileText, X, AlertCircle, Film } from "lucide-react";
import { CHUNK_SIZE, decodeSubtitleBuffer } from "@/lib/subtitleParser";
import type { ParsedSubtitle } from "@/lib/types";

interface SubtitleUploaderProps {
  file: File | null;
  parsed: ParsedSubtitle | null;
  disabled?: boolean;
  extractedSourceLabel?: string | null;
  onFileSelected: (file: File, content: string) => void;
  onClear: () => void;
  onOpenVideoExtractor?: () => void;
  onVideoFileDropped?: (videoFile: File) => void;
}

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function SubtitleUploader({
  file,
  parsed,
  disabled = false,
  extractedSourceLabel = null,
  onFileSelected,
  onClear,
  onOpenVideoExtractor,
  onVideoFileDropped,
}: SubtitleUploaderProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleFile = async (candidate: File | undefined) => {
    setLocalError(null);
    if (!candidate) return;

    const lower = candidate.name.toLowerCase();
    if (
      (lower.endsWith(".mkv") || lower.endsWith(".mp4") || lower.endsWith(".m4v")) &&
      onVideoFileDropped
    ) {
      onVideoFileDropped(candidate);
      return;
    }

    if (!lower.endsWith(".srt") && !lower.endsWith(".vtt")) {
      setLocalError("Formato não suportado. Selecione um arquivo .srt ou .vtt.");
      return;
    }

    if (candidate.size > MAX_FILE_SIZE_BYTES) {
      setLocalError("Arquivo muito grande. O tamanho máximo permitido é 5 MB.");
      return;
    }

    try {
      const buffer = await candidate.arrayBuffer();
      const content = decodeSubtitleBuffer(buffer);
      onFileSelected(candidate, content);
    } catch {
      setLocalError("Não foi possível ler o arquivo selecionado.");
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    handleFile(event.dataTransfer.files?.[0]);
  };

  if (file && parsed) {
    const totalChunks = Math.ceil(parsed.blocks.length / CHUNK_SIZE);

    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
              <FileText className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-medium text-zinc-100">
                  {file.name}
                </p>
                <span className="shrink-0 rounded-md border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase text-zinc-300">
                  {parsed.format}
                </span>
                {extractedSourceLabel && (
                  <span className="hidden shrink-0 items-center gap-1 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300 sm:inline-flex">
                    <Film className="h-2.5 w-2.5" />
                    Extraída do vídeo
                  </span>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400">
                <span>{formatFileSize(file.size)}</span>
                <span className="text-zinc-700">•</span>
                <span>
                  <strong className="font-medium text-zinc-200">
                    {new Intl.NumberFormat("pt-BR").format(parsed.blocks.length)}
                  </strong>{" "}
                  blocos detectados
                </span>
                <span className="text-zinc-700">•</span>
                <span>
                  {totalChunks} {totalChunks === 1 ? "lote" : "lotes"} de até{" "}
                  {CHUNK_SIZE} blocos
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClear}
            disabled={disabled}
            title="Remover arquivo"
            className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (!disabled && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`group relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-12 text-center transition-all ${
          isDragging
            ? "border-emerald-400 bg-emerald-500/10"
            : "border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-900/70"
        } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".srt,.vtt"
          disabled={disabled}
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
          className="hidden"
        />

        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-300 transition-colors group-hover:border-emerald-500/30 group-hover:text-emerald-400">
          <UploadCloud className="h-6 w-6" />
        </div>

        <p className="text-sm font-medium text-zinc-200">
          Arraste e solte sua legenda aqui ou{" "}
          <span className="text-emerald-400 underline-offset-4 group-hover:underline">
            clique para selecionar
          </span>
        </p>
        <p className="mt-1.5 text-xs text-zinc-500">
          Suporta arquivos <span className="font-mono text-zinc-400">.srt</span>{" "}
          e <span className="font-mono text-zinc-400">.vtt</span> em qualquer
          idioma (até 5 MB)
        </p>
      </div>

      {onOpenVideoExtractor && (
        <div className="flex justify-center pt-1">
          <button
            type="button"
            disabled={disabled}
            onClick={onOpenVideoExtractor}
            className="group inline-flex items-center gap-2 rounded-xl border border-zinc-800/80 bg-zinc-900/40 px-4 py-2 text-xs text-zinc-400 transition-all hover:border-emerald-500/30 hover:bg-zinc-900 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Film className="h-3.5 w-3.5 shrink-0 text-zinc-500 transition-colors group-hover:text-emerald-400" />
            <span>
              Seu filme não veio com arquivo de legenda?{" "}
              <span className="font-medium text-emerald-400 underline-offset-4 group-hover:underline">
                Clique aqui para extrair do vídeo (.mkv / .mp4)
              </span>
            </span>
          </button>
        </div>
      )}

      {localError && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{localError}</span>
        </div>
      )}
    </div>
  );
}
