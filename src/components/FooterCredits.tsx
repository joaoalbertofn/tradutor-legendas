import {
  SITE_AUTHOR,
  SITE_CONTACT_EMAIL,
  SITE_NAME,
} from "@/lib/siteConfig";

interface FooterCreditsProps {
  className?: string;
}

export function FooterCredits({ className = "" }: FooterCreditsProps) {
  return (
    <div
      className={`flex flex-col items-center justify-between gap-1.5 border-t border-zinc-900/60 pt-3 text-center text-[11px] text-zinc-600 sm:flex-row sm:text-left ${className}`.trim()}
    >
      <p>
        © 2026 {SITE_NAME}. Desenvolvido por{" "}
        <span className="text-zinc-400">{SITE_AUTHOR}</span>. Todos os direitos
        reservados.
      </p>
      <p>
        Contato:{" "}
        <a
          href={`mailto:${SITE_CONTACT_EMAIL}`}
          className="text-zinc-400 transition-colors hover:text-emerald-400"
        >
          {SITE_CONTACT_EMAIL}
        </a>
      </p>
    </div>
  );
}
