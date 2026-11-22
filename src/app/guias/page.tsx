import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, Clock, Sparkles } from "lucide-react";
import { GuidesHeader } from "@/components/GuidesHeader";
import { GUIDES } from "@/lib/guides";
import { SITE_NAME, absoluteUrl } from "@/lib/siteConfig";

export const metadata: Metadata = {
  title: "Guias sobre Legendas .SRT, .VTT, MKV e Tradução para PT-BR",
  description:
    "Tutoriais práticos e gratuitos sobre como traduzir legendas de filmes para PT-BR, extrair legendas de MKV/MP4, traduzir arquivos .vtt e corrigir acentos na Smart TV e VLC.",
  alternates: {
    canonical: "/guias",
  },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: absoluteUrl("/guias"),
    siteName: SITE_NAME,
    title: `Guias sobre Legendas e Tradução para PT-BR | ${SITE_NAME}`,
    description:
      "Aprenda a traduzir legendas .srt e .vtt grátis, extrair faixas de vídeos MKV/MP4 e corrigir acentos com UTF-8 BOM.",
  },
};

export default function GuidesIndexPage() {
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Início",
        item: absoluteUrl("/"),
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Guias",
        item: absoluteUrl("/guias"),
      },
    ],
  };

  return (
    <div className="flex min-h-screen flex-col">
      <GuidesHeader />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-10 px-4 py-10 sm:px-6 sm:py-14">
        <nav aria-label="Breadcrumb" className="text-xs text-zinc-500">
          <ol className="flex items-center gap-2">
            <li>
              <Link href="/" className="transition-colors hover:text-zinc-300">
                Início
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="text-zinc-300">Guias</li>
          </ol>
        </nav>

        <header className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
            <BookOpen className="h-3.5 w-3.5" />
            <span>Central de Guias LegendasBR</span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
            Guias práticos para traduzir e corrigir legendas em PT-BR
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-zinc-400 sm:text-base">
            Respostas diretas para as dúvidas mais comuns sobre arquivos{" "}
            <span className="font-mono text-zinc-300">.srt</span>,{" "}
            <span className="font-mono text-zinc-300">.vtt</span>, extração de
            vídeos <span className="font-mono text-zinc-300">.mkv/.mp4</span> e
            codificação de acentos na Smart TV e no VLC.
          </p>
        </header>

        <section aria-label="Lista de guias" className="grid gap-4">
          {GUIDES.map((guide) => (
            <article
              key={guide.slug}
              className="group rounded-2xl border border-zinc-800/90 bg-zinc-900/40 p-6 transition-all hover:border-emerald-500/40 hover:bg-zinc-900/70"
            >
              <div className="flex flex-wrap items-center gap-2.5 text-xs text-zinc-400">
                <span className="rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 font-medium text-emerald-300">
                  {guide.category}
                </span>
                <span className="inline-flex items-center gap-1 text-zinc-500">
                  <Clock className="h-3.5 w-3.5" />
                  {guide.readingTimeMinutes} min de leitura
                </span>
              </div>

              <h2 className="mt-3 text-lg font-semibold tracking-tight text-zinc-100 transition-colors group-hover:text-emerald-300 sm:text-xl">
                <Link href={`/guias/${guide.slug}`}>{guide.title}</Link>
              </h2>

              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                {guide.excerpt}
              </p>

              <div className="mt-4">
                <Link
                  href={`/guias/${guide.slug}`}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 transition-colors hover:text-emerald-300"
                >
                  <span>Ler guia completo</span>
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
            </article>
          ))}
        </section>

        <section className="rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/10 via-zinc-900/80 to-zinc-900 p-6 sm:p-8">
          <div className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
            <div className="space-y-1.5">
              <h2 className="text-lg font-semibold text-zinc-100 sm:text-xl">
                Quer traduzir uma legenda agora mesmo?
              </h2>
              <p className="max-w-xl text-sm text-zinc-400">
                Envie seu arquivo .srt, .vtt ou vídeo .mkv/.mp4 na página
                inicial do LegendasBR e traduza para Português do Brasil grátis
                com 100% de sincronia preservada.
              </p>
            </div>
            <Link
              href="/"
              className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-zinc-950 shadow-lg shadow-emerald-500/15 transition-colors hover:bg-emerald-400"
            >
              <Sparkles className="h-4 w-4" />
              <span>Abrir tradutor grátis</span>
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-900 py-6 text-center text-xs text-zinc-500">
        <div className="mx-auto flex max-w-4xl flex-col items-center justify-between gap-2 px-4 sm:flex-row sm:px-6">
          <span>{SITE_NAME} — Tradutor de Legendas .SRT e .VTT para PT-BR</span>
          <Link
            href="/"
            className="font-medium text-emerald-400 transition-colors hover:text-emerald-300"
          >
            Voltar para o tradutor →
          </Link>
        </div>
      </footer>
    </div>
  );
}
