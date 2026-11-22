const DEFAULT_SITE_URL = "https://legendas-br.vercel.app";

function normalizeSiteUrl(rawUrl?: string): string {
  const candidate = rawUrl?.trim();
  if (!candidate) return DEFAULT_SITE_URL;
  try {
    const parsed = new URL(candidate);
    return parsed.origin;
  } catch {
    return DEFAULT_SITE_URL;
  }
}

export const SITE_URL = normalizeSiteUrl(process.env.NEXT_PUBLIC_APP_URL);
export const SITE_NAME = "LegendasBR";
export const SITE_TAGLINE = "Tradutor de Legendas .SRT e .VTT para PT-BR";
export const SITE_DESCRIPTION =
  "Traduza legendas .srt e .vtt de qualquer idioma para Português do Brasil natural preservando 100% dos timestamps, índices e formatações originais.";

export function absoluteUrl(path = "/"): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return normalizedPath === "/" ? SITE_URL : `${SITE_URL}${normalizedPath}`;
}
