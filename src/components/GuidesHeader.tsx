import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";
import { BrandMark, BrandWordmark } from "@/components/BrandLogo";

export function GuidesHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-zinc-800/80 bg-zinc-950/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link
          href="/"
          aria-label="LegendasBR — Página inicial"
          className="flex items-center gap-2.5 transition-opacity hover:opacity-90"
        >
          <BrandMark className="h-8 w-8 shrink-0" />
          <div className="flex items-baseline gap-2">
            <BrandWordmark className="text-sm font-semibold tracking-tight" />
            <span className="hidden text-xs text-zinc-500 sm:inline">
              SRT &amp; VTT → PT-BR
            </span>
          </div>
        </Link>

        <nav
          aria-label="Navegação dos guias"
          className="flex items-center gap-2 sm:gap-3"
        >
          <Link
            href="/guias"
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-900 hover:text-zinc-100"
          >
            <BookOpen className="h-3.5 w-3.5 text-emerald-400" />
            <span>Guias</span>
          </Link>

          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-zinc-950 shadow-sm shadow-emerald-500/15 transition-colors hover:bg-emerald-400"
          >
            <span>Traduzir grátis</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </nav>
      </div>
    </header>
  );
}
