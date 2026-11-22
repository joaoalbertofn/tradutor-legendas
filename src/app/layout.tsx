import type { Metadata } from "next";
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
    <html lang="pt-BR" className="dark">
      <body className="min-h-screen bg-zinc-950 font-sans text-zinc-100 antialiased selection:bg-emerald-500/30 selection:text-emerald-200">
        {children}
      </body>
    </html>
  );
}
