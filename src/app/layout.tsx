import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { ptBR } from "@clerk/localizations";
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TAGLINE,
  SITE_URL,
} from "@/lib/siteConfig";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — ${SITE_TAGLINE}`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "traduzir legendas para pt-br",
    "tradutor de legendas srt gratis",
    "traduzir legenda vtt online",
    "extrair legenda mkv",
    "traduzir legenda de filme com ia",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      localization={ptBR}
      appearance={{
        variables: {
          colorPrimary: "#10b981",
          colorBackground: "#18181b",
          colorInput: "#09090b",
          colorForeground: "#f4f4f5",
          colorMutedForeground: "#a1a1aa",
          colorInputForeground: "#f4f4f5",
          borderRadius: "0.75rem",
        },
        elements: {
          card: "bg-zinc-900 border border-zinc-800 shadow-2xl",
          modalContent: "bg-zinc-900 border border-zinc-800",
          formButtonPrimary:
            "bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold",
        },
      }}
    >
      <html lang="pt-BR" className="dark">
        <body className="min-h-screen bg-zinc-950 font-sans text-zinc-100 antialiased selection:bg-emerald-500/30 selection:text-emerald-200">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
