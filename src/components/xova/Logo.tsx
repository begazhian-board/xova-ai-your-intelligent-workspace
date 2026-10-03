import { useId } from "react";
import { cn } from "@/lib/utils";

function Grad({ id }: { id: string }) {
  return (
    <linearGradient id={id} x1="0" y1="64" x2="92" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0" stopColor="#1EA0FF" />
      <stop offset="1" stopColor="#7B3FF2" />
    </linearGradient>
  );
}

const X_PATHS = (
  <>
    <path d="M2 2h22l3 2 63 58H68l-3-2L2 2Z" />
    <path d="M90 2H68l-3 2L2 62h22l3-2L90 2Z" opacity="0.88" />
  </>
);

/** XOVA mark: the gradient ribbon X. */
export function XovaMark({ className }: { className?: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 92 64" aria-hidden="true" className={cn("h-7 w-7", className)}>
      <defs>
        <Grad id={id} />
      </defs>
      <g fill={`url(#${id})`}>{X_PATHS}</g>
    </svg>
  );
}

/** Full vector logo — the gradient X alone, real shapes, not an image. */
export function XovaLogoText({ className }: { className?: string }) {
  const id = useId();
  return (
    <svg
      viewBox="0 0 92 70"
      role="img"
      aria-label="XOVA"
      className={cn("h-7 w-auto", className)}
    >
      <defs>
        <Grad id={id} />
      </defs>
      <g fill={`url(#${id})`} transform="translate(0 3)">{X_PATHS}</g>
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
        <XovaMark className="h-5 w-7" />
      </span>
    );
  }
  return (
    <span className={cn("flex min-w-0 flex-col items-start leading-none", className)} dir="ltr">
      <XovaLogoText className="h-7 text-foreground" />
      <span className="mt-1 truncate text-xxs font-medium text-faint">by Begad</span>
    </span>
  );
}
