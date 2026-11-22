import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { ptBR } from "@clerk/localizations";
import "./globals.css";

export const metadata: Metadata = {
  title: "LegendaBR — Tradutor de Legendas .SRT e .VTT para PT-BR",
  description:
    "Traduza legendas .srt e .vtt de qualquer idioma para Português do Brasil natural preservando 100% dos timestamps, índices e formatações originais.",
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
