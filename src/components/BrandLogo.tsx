import { useId } from "react";

interface BrandMarkProps {
  className?: string;
}

export function BrandMark({ className = "h-8 w-8" }: BrandMarkProps) {
  const uid = useId().replace(/:/g, "");
  const bgId = `lbr-bg-${uid}`;
  const glowId = `lbr-glow-${uid}`;
  const borderId = `lbr-border-${uid}`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <defs>
        <linearGradient
          id={bgId}
          x1="6"
          y1="4"
          x2="58"
          y2="60"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#141c1a" />
          <stop offset="100%" stopColor="#09090b" />
        </linearGradient>
        <radialGradient
          id={glowId}
          cx="0"
          cy="0"
          r="1"
          gradientUnits="userSpaceOnUse"
          gradientTransform="translate(14 12) rotate(45) scale(48)"
        >
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.24" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
        </radialGradient>
        <linearGradient
          id={borderId}
          x1="4"
          y1="4"
          x2="60"
          y2="60"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#34d399" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0.2" />
        </linearGradient>
      </defs>

      <rect x="2" y="2" width="60" height="60" rx="16" fill={`url(#${bgId})`} />
      <rect
        x="2"
        y="2"
        width="60"
        height="60"
        rx="16"
        fill={`url(#${glowId})`}
      />
      <rect
        x="2.75"
        y="2.75"
        width="58.5"
        height="58.5"
        rx="15.25"
        stroke={`url(#${borderId})`}
        strokeWidth="1.5"
      />

      <rect x="12" y="25" width="24" height="6.5" rx="3.25" fill="#f4f4f5" />
      <rect x="40" y="25" width="12" height="6.5" rx="3.25" fill="#10b981" />

      <rect x="12" y="36.5" width="13" height="6.5" rx="3.25" fill="#facc15" />
      <rect x="29" y="36.5" width="23" height="6.5" rx="3.25" fill="#f4f4f5" />
    </svg>
  );
}

interface BrandWordmarkProps {
  className?: string;
}

export function BrandWordmark({
  className = "text-sm font-semibold tracking-tight",
}: BrandWordmarkProps) {
  return (
    <span className={className}>
      <span className="text-zinc-100">Legendas</span>
      <span className="text-emerald-400">BR</span>
    </span>
  );
}
