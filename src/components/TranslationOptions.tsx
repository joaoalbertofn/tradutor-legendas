"use client";

import { useState } from "react";
import { SlidersHorizontal, ChevronDown } from "lucide-react";
import type { TranslationStyle } from "@/lib/types";

interface TranslationOptionsProps {
  style: TranslationStyle;
  glossary: string;
  includeBom: boolean;
  disabled?: boolean;
  onStyleChange: (style: TranslationStyle) => void;
  onGlossaryChange: (glossary: string) => void;
  onIncludeBomChange: (includeBom: boolean) => void;
}

const STYLE_OPTIONS: {
  value: TranslationStyle;
  label: string;
  description: string;
}[] = [
  {
    value: "natural",
    label: "Natural / Coloquial",
    description: "Ideal para filmes e séries — diálogos fluidos em PT-BR real.",
  },
  {
    value: "faithful",
    label: "Fiel ao original",
    description: "Prioriza precisão técnica e fidelidade máxima ao texto base.",
  },
  {
    value: "slang",
    label: "Adaptação leve de gírias",
    description: "Adapta expressões idiomáticas e humor para equivalentes no Brasil.",
  },
];

export function TranslationOptions({
  style,
  glossary,
  includeBom,
  disabled = false,
  onStyleChange,
  onGlossaryChange,
  onIncludeBomChange,
}: TranslationOptionsProps) {
  const [open, setOpen] = useState(false);

  const selectedLabel =
    STYLE_OPTIONS.find((opt) => opt.value === style)?.label ?? "Natural";

  return (
    <div className="rounded-2xl border border-zinc-800/90 bg-zinc-900/40">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between px-5 py-3.5 text-left transition-colors hover:bg-zinc-900/60"
      >
        <div className="flex items-center gap-2.5">
          <SlidersHorizontal className="h-4 w-4 text-zinc-400" />
          <span className="text-sm font-medium text-zinc-200">
            Configurações de tradução
          </span>
          <span className="hidden rounded-md bg-zinc-800/80 px-2 py-0.5 text-[11px] text-zinc-400 sm:inline">
            {selectedLabel}
          </span>
          {glossary.trim() && (
            <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-400">
              Com glossário
            </span>
          )}
        </div>
        <ChevronDown
          className={`h-4 w-4 text-zinc-500 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="space-y-5 border-t border-zinc-800/80 px-5 py-5">
          <div className="space-y-2.5">
            <label className="block text-xs font-medium uppercase tracking-wider text-zinc-400">
              Estilo da tradução
            </label>
            <div className="grid gap-2.5 sm:grid-cols-3">
              {STYLE_OPTIONS.map((option) => {
                const active = style === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    disabled={disabled}
                    onClick={() => onStyleChange(option.value)}
                    className={`rounded-xl border p-3 text-left transition-all ${
                      active
                        ? "border-emerald-500/60 bg-emerald-500/10 text-zinc-100"
                        : "border-zinc-800 bg-zinc-950/60 text-zinc-300 hover:border-zinc-700"
                    } disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    <div className="text-xs font-semibold">{option.label}</div>
                    <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">
                      {option.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="glossary-input"
              className="block text-xs font-medium uppercase tracking-wider text-zinc-400"
            >
              Contexto / Glossário{" "}
              <span className="font-normal normal-case text-zinc-500">
                (opcional)
              </span>
            </label>
            <textarea
              id="glossary-input"
              rows={3}
              maxLength={2000}
              disabled={disabled}
              value={glossary}
              onChange={(e) => onGlossaryChange(e.target.value)}
              placeholder='Ex: "Série de ficção científica com tom sombrio. Não traduzir nomes como Starfleet e Warp Drive. O personagem Alex é mulher."'
              className="w-full resize-none rounded-xl border border-zinc-800 bg-zinc-950/80 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500/60 focus:outline-none disabled:opacity-50"
            />
          </div>

          <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-zinc-800/80 bg-zinc-950/50 px-3.5 py-3">
            <div>
              <span className="block text-xs font-medium text-zinc-200">
                Incluir UTF-8 BOM no arquivo final
              </span>
              <span className="block text-[11px] text-zinc-500">
                Melhora a exibição de acentos em Smart TVs e players mais antigos.
              </span>
            </div>
            <input
              type="checkbox"
              checked={includeBom}
              disabled={disabled}
              onChange={(e) => onIncludeBomChange(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 accent-emerald-500"
            />
          </label>
        </div>
      )}
    </div>
  );
}
