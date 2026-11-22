"use client";

import { useMemo, useState } from "react";
import { Eye, ChevronDown, ChevronUp } from "lucide-react";
import type { SubtitleBlock } from "@/lib/types";

interface PreviewTableProps {
  blocks: SubtitleBlock[];
  translations: Record<number, string>;
}

const DEFAULT_VISIBLE = 12;

export function PreviewTable({ blocks, translations }: PreviewTableProps) {
  const [expanded, setExpanded] = useState(false);

  const translatedBlocks = useMemo(
    () => blocks.filter((b) => translations[b.id] !== undefined),
    [blocks, translations]
  );

  const visibleBlocks = useMemo(
    () =>
      expanded
        ? translatedBlocks.slice(0, 100)
        : translatedBlocks.slice(0, DEFAULT_VISIBLE),
    [expanded, translatedBlocks]
  );

  if (translatedBlocks.length === 0) return null;

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40">
      <div className="flex items-center justify-between border-b border-zinc-800/80 px-5 py-3.5">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-emerald-400" />
          <h2 className="text-sm font-medium text-zinc-200">
            Prévia em tempo real
          </h2>
          <span className="rounded-md bg-zinc-800 px-2 py-0.5 font-mono text-[11px] text-zinc-400">
            {translatedBlocks.length} de {blocks.length}
          </span>
        </div>

        {translatedBlocks.length > DEFAULT_VISIBLE && (
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="inline-flex items-center gap-1 text-xs font-medium text-zinc-400 transition-colors hover:text-zinc-200"
          >
            {expanded ? (
              <>
                Mostrar menos <ChevronUp className="h-3.5 w-3.5" />
              </>
            ) : (
              <>
                Ver mais ({Math.min(translatedBlocks.length, 100)}){" "}
                <ChevronDown className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-zinc-800/80 bg-zinc-950/60 text-[11px] uppercase tracking-wider text-zinc-500">
              <th className="w-14 px-4 py-2.5 font-medium">#</th>
              <th className="w-44 px-4 py-2.5 font-medium">Timestamp</th>
              <th className="px-4 py-2.5 font-medium">Original</th>
              <th className="px-4 py-2.5 font-medium text-emerald-400/90">
                Português (PT-BR)
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {visibleBlocks.map((block) => (
              <tr
                key={block.id}
                className="transition-colors hover:bg-zinc-900/70"
              >
                <td className="px-4 py-3 align-top font-mono text-zinc-500">
                  {block.index || block.id}
                </td>
                <td className="px-4 py-3 align-top font-mono text-[11px] text-zinc-500 whitespace-nowrap">
                  {block.timestamp.split("-->")[0]?.trim()}
                </td>
                <td className="px-4 py-3 align-top whitespace-pre-wrap text-zinc-400">
                  {block.text}
                </td>
                <td className="px-4 py-3 align-top whitespace-pre-wrap font-medium text-zinc-100">
                  {translations[block.id]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
