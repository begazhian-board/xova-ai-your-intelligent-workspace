import { useId } from "react";
import { cn } from "@/lib/utils";

function Grad({ id }: { id: string }) {
  return (
    <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stopColor="#168FFF" />
      <stop offset="52%" stopColor="#5267FF" />
      <stop offset="100%" stopColor="#8A45E8" />
    </linearGradient>
  );
}

/** Typographic X monogram used only where a compact brand mark is needed. */
export function XovaMark({ className }: { className?: string }) {
  const id = useId();
  return (
    <svg
      viewBox="0 0 48 54"
      role="img"
      aria-label="X"
      className={cn("h-7 w-7", className)}
    >
      <defs>
        <Grad id={id} />
      </defs>
      <text
        x="24"
        y="43"
        textAnchor="middle"
        fill={`url(#${id})`}
        fontFamily="Inter, ui-sans-serif, Arial, sans-serif"
        fontSize="48"
        fontWeight="600"
        letterSpacing="-4"
      >
        X
      </text>
    </svg>
  );
}

/** The primary XOVA identity: a clean, spaced typographic wordmark. */
export function XovaLogoText({ className }: { className?: string }) {
  const id = useId();
  return (
    <svg
      viewBox="0 0 300 76"
      role="img"
      aria-label="XOVA"
      className={cn("h-7 w-auto", className)}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <Grad id={id} />
      </defs>
      <text
        x="150"
        y="58"
        textAnchor="middle"
        fill={`url(#${id})`}
        fontFamily="Inter, ui-sans-serif, Arial, sans-serif"
        fontSize="58"
        fontWeight="500"
        letterSpacing="10"
      >
        XOVA
      </text>
    </svg>
  );
}

export function XovaWordmark({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  if (compact) {
    return (
      <span className={cn("grid h-8 w-8 shrink-0 place-items-center", className)}>
        <XovaMark className="h-6 w-6" />
      </span>
    );
  }
  return (
    <span className={cn("flex min-w-0 flex-col items-start leading-none", className)} dir="ltr">
      <XovaLogoText className="h-7 w-[112px]" />
      <span className="mt-1 truncate text-xxs font-medium tracking-wide text-faint">by Begad</span>
    </span>
  );
}
