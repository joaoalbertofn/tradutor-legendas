import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  HelpCircle,
  Lightbulb,
  Sparkles,
} from "lucide-react";
import { FooterCredits } from "@/components/FooterCredits";
import { GuidesHeader } from "@/components/GuidesHeader";
import { GUIDES, getGuideBySlug, getRelatedGuides } from "@/lib/guides";
import { SITE_NAME, absoluteUrl } from "@/lib/siteConfig";

interface GuidePageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return GUIDES.map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({
  params,
}: GuidePageProps): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuideBySlug(slug);

  if (!guide) {
    return {
      title: "Guia não encontrado",
    };
  }

  const canonicalPath = `/guias/${guide.slug}`;

  return {
    title: guide.metaTitle,
    description: guide.metaDescription,
    keywords: guide.keywords,
    alternates: {
      canonical: canonicalPath,
    },
    openGraph: {
      type: "article",
      locale: "pt_BR",
      url: absoluteUrl(canonicalPath),
      siteName: SITE_NAME,
      title: guide.metaTitle,
      description: guide.metaDescription,
      publishedTime: guide.publishedAt,
      modifiedTime: guide.updatedAt,
    },
    twitter: {
      card: "summary_large_image",
      title: guide.metaTitle,
      description: guide.metaDescription,
    },
  };
}

function formatDatePtBr(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  if (!year || !month || !day) return isoDate;
  return `${day}/${month}/${year}`;
}

export default async function GuideArticlePage({ params }: GuidePageProps) {
  const { slug } = await params;
  const guide = getGuideBySlug(slug);

  if (!guide) {
    notFound();
  }

  const relatedGuides = getRelatedGuides(guide.slug, 3);
  const articleUrl = absoluteUrl(`/guias/${guide.slug}`);

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guide.title,
    description: guide.metaDescription,
    inLanguage: "pt-BR",
    datePublished: guide.publishedAt,
    dateModified: guide.updatedAt,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": articleUrl,
    },
    author: {
      "@type": "Organization",
      name: SITE_NAME,
      url: absoluteUrl("/"),
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: absoluteUrl("/"),
    },
  };

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
      {
        "@type": "ListItem",
        position: 3,
        name: guide.metaTitle,
        item: articleUrl,
      },
    ],
  };

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: guide.faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  const inlineCtaAfterIndex = Math.min(1, guide.sections.length - 1);

  return (
    <div className="flex min-h-screen flex-col">
      <GuidesHeader />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([articleJsonLd, breadcrumbJsonLd, faqJsonLd]),
        }}
      />

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6 sm:py-14">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="text-xs text-zinc-500">
          <ol className="flex flex-wrap items-center gap-2">
            <li>
              <Link href="/" className="transition-colors hover:text-zinc-300">
                Início
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link
                href="/guias"
                className="transition-colors hover:text-zinc-300"
              >
                Guias
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="text-zinc-300">{guide.category}</li>
          </ol>
        </nav>

        <article className="space-y-8">
          {/* Article Header */}
          <header className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400">
              <span className="rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 font-medium text-emerald-300">
                {guide.category}
              </span>
              <span className="inline-flex items-center gap-1 text-zinc-500">
                <Clock className="h-3.5 w-3.5" />
                {guide.readingTimeMinutes} min de leitura
              </span>
              <span className="text-zinc-700">•</span>
              <time dateTime={guide.updatedAt} className="text-zinc-500">
                Atualizado em {formatDatePtBr(guide.updatedAt)}
              </time>
            </div>

            <h1 className="text-2xl font-semibold leading-tight tracking-tight text-zinc-50 sm:text-4xl">
              {guide.title}
            </h1>

            {/* Direct Answer Box (Featured Snippet & Quick Answer) */}
            <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                Resposta rápida
              </p>
              <p className="mt-2 text-sm leading-relaxed text-zinc-200 sm:text-[15px]">
                {guide.directAnswer}
              </p>
              <div className="mt-4">
                <Link
                  href="/"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 transition-colors hover:text-emerald-300"
                >
                  <span>Abrir o tradutor gratuito do LegendasBR</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </header>

          {/* Table of Contents */}
          <nav
            aria-label="Índice do artigo"
            className="rounded-2xl border border-zinc-800/90 bg-zinc-900/40 p-5"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Neste guia
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              {guide.sections.map((section) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className="text-zinc-300 transition-colors hover:text-emerald-400"
                  >
                    {section.heading}
                  </a>
                </li>
              ))}
              <li>
                <a
                  href="#perguntas-frequentes"
                  className="text-zinc-300 transition-colors hover:text-emerald-400"
                >
                  Perguntas frequentes
                </a>
              </li>
            </ul>
          </nav>

          {/* Article Sections */}
          <div className="space-y-10">
            {guide.sections.map((section, sectionIndex) => (
              <div key={section.id} className="space-y-8">
                <section id={section.id} className="scroll-mt-24 space-y-4">
                  <h2 className="text-xl font-semibold tracking-tight text-zinc-100 sm:text-2xl">
                    {section.heading}
                  </h2>

                  {section.paragraphs.map((paragraph, idx) => (
                    <p
                      key={idx}
                      className="text-sm leading-relaxed text-zinc-300 sm:text-base sm:leading-7"
                    >
                      {paragraph}
                    </p>
                  ))}

                  {section.steps && section.steps.length > 0 && (
                    <ol className="space-y-3 pt-1">
                      {section.steps.map((step, stepIdx) => (
                        <li
                          key={step.title}
                          className="flex gap-3.5 rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-4"
                        >
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-emerald-500/35 bg-emerald-500/15 font-mono text-xs font-semibold text-emerald-300">
                            {stepIdx + 1}
                          </span>
                          <div className="space-y-1">
                            <h3 className="text-sm font-semibold text-zinc-100">
                              {step.title}
                            </h3>
                            <p className="text-sm leading-relaxed text-zinc-400">
                              {step.detail}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}

                  {section.bullets && section.bullets.length > 0 && (
                    <ul className="space-y-2.5 pt-1">
                      {section.bullets.map((bullet, bulletIdx) => (
                        <li
                          key={bulletIdx}
                          className="flex items-start gap-2.5 text-sm leading-relaxed text-zinc-300 sm:text-[15px]"
                        >
                          <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-400" />
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {section.table && (
                    <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/40">
                      <table className="w-full border-collapse text-left text-xs sm:text-sm">
                        <thead>
                          <tr className="border-b border-zinc-800 bg-zinc-900/90 text-zinc-200">
                            {section.table.headers.map((header) => (
                              <th
                                key={header}
                                className="px-4 py-3 font-semibold"
                              >
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/70">
                          {section.table.rows.map((row, rowIdx) => (
                            <tr key={rowIdx} className="hover:bg-zinc-900/50">
                              {row.map((cell, cellIdx) => (
                                <td
                                  key={cellIdx}
                                  className={`px-4 py-3 ${
                                    cellIdx === 0
                                      ? "font-medium text-zinc-200"
                                      : cellIdx === 1
                                      ? "text-emerald-300"
                                      : "text-zinc-400"
                                  }`}
                                >
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {section.callout && (
                    <div
                      className={`flex items-start gap-3 rounded-xl border p-4 text-sm ${
                        section.callout.tone === "warning"
                          ? "border-amber-500/25 bg-amber-500/10 text-amber-200"
                          : "border-emerald-500/25 bg-emerald-500/10 text-emerald-100"
                      }`}
                    >
                      {section.callout.tone === "warning" ? (
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                      ) : (
                        <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                      )}
                      <div className="space-y-1">
                        <p className="font-semibold">{section.callout.title}</p>
                        <p className="text-xs leading-relaxed text-zinc-300 sm:text-sm">
                          {section.callout.body}
                        </p>
                      </div>
                    </div>
                  )}
                </section>

                {/* Inline Mid-Article CTA */}
                {sectionIndex === inlineCtaAfterIndex && (
                  <aside className="rounded-2xl border border-emerald-500/30 bg-zinc-900/80 p-5 sm:p-6">
                    <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-zinc-100 sm:text-base">
                          {guide.inlineCta.title}
                        </p>
                        <p className="text-xs leading-relaxed text-zinc-400 sm:text-sm">
                          {guide.inlineCta.description}
                        </p>
                      </div>
                      <Link
                        href="/"
                        className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-semibold text-zinc-950 shadow-md shadow-emerald-500/15 transition-colors hover:bg-emerald-400 sm:text-sm"
                      >
                        <Sparkles className="h-4 w-4" />
                        <span>{guide.inlineCta.buttonLabel}</span>
                      </Link>
                    </div>
                  </aside>
                )}
              </div>
            ))}
          </div>

          {/* FAQ Section */}
          <section
            id="perguntas-frequentes"
            className="scroll-mt-24 space-y-4 border-t border-zinc-800/80 pt-8"
          >
            <div className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-emerald-400" />
              <h2 className="text-xl font-semibold tracking-tight text-zinc-100">
                Perguntas frequentes
              </h2>
            </div>

            <div className="space-y-3">
              {guide.faqs.map((faq) => (
                <div
                  key={faq.question}
                  className="rounded-xl border border-zinc-800/90 bg-zinc-900/40 p-4 sm:p-5"
                >
                  <h3 className="text-sm font-semibold text-zinc-100 sm:text-base">
                    {faq.question}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                    {faq.answer}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Bottom Conversion CTA */}
          <section className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/15 via-zinc-900 to-zinc-900 p-6 sm:p-8">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <h2 className="text-xl font-semibold text-zinc-50">
                  {guide.bottomCta.title}
                </h2>
                <p className="text-sm leading-relaxed text-zinc-300">
                  {guide.bottomCta.description}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-zinc-950 shadow-lg shadow-emerald-500/20 transition-colors hover:bg-emerald-400"
                >
                  <Sparkles className="h-4 w-4" />
                  <span>{guide.bottomCta.buttonLabel}</span>
                </Link>
                <span className="text-xs text-zinc-400">
                  3 traduções grátis por dia • Sem instalar nada
                </span>
              </div>
            </div>
          </section>
        </article>

        {/* Related Guides Cross-Linking */}
        <section
          aria-label="Outros guias relacionados"
          className="space-y-4 border-t border-zinc-800/80 pt-8"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-zinc-200">
              Outros guias úteis sobre legendas
            </h2>
            <Link
              href="/guias"
              className="text-xs font-medium text-emerald-400 transition-colors hover:text-emerald-300"
            >
              Ver todos →
            </Link>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {relatedGuides.map((related) => (
              <Link
                key={related.slug}
                href={`/guias/${related.slug}`}
                className="group flex flex-col justify-between rounded-xl border border-zinc-800/90 bg-zinc-900/40 p-4 transition-all hover:border-emerald-500/40 hover:bg-zinc-900/80"
              >
                <div className="space-y-2">
                  <span className="text-[11px] font-medium text-emerald-400">
                    {related.category}
                  </span>
                  <h3 className="text-sm font-semibold leading-snug text-zinc-200 transition-colors group-hover:text-emerald-300">
                    {related.metaTitle}
                  </h3>
                </div>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-zinc-400 group-hover:text-emerald-300">
                  Ler guia
                  <ArrowRight className="h-3 w-3" />
                </span>
              </Link>
            ))}
          </div>
        </section>

        <div>
          <Link
            href="/guias"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 transition-colors hover:text-zinc-200"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Voltar para todos os guias</span>
          </Link>
        </div>
      </main>

      <footer className="border-t border-zinc-900 py-6 text-center text-xs text-zinc-500">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 px-4 sm:px-6">
          <div className="flex flex-col items-center justify-between gap-2 sm:flex-row">
            <span>{SITE_NAME} — Tradutor de Legendas .SRT e .VTT para PT-BR</span>
            <Link
              href="/"
              className="font-medium text-emerald-400 transition-colors hover:text-emerald-300"
            >
              Traduzir legenda grátis →
            </Link>
          </div>
          <FooterCredits />
        </div>
      </footer>
    </div>
  );
}
