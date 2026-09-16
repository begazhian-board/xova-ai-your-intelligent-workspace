import { cn } from "@/lib/utils";

/** Original XOVA mark: two interlocking chevrons forming an aperture. */
export function XovaMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      role="img"
      aria-hidden="true"
      className={cn("h-7 w-7", className)}
      fill="none"
    >
      <path
        d="M5 4.5 14.5 16 5 27.5h6.2L20.7 16 11.2 4.5H5Z"
        fill="currentColor"
        opacity="0.55"
      />
      <path d="M17.3 4.5 26.8 16l-9.5 11.5H23.5L33 16 23.5 4.5h-6.2Z" fill="currentColor" />
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
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-brand-soft text-brand">
        <XovaMark className="h-[18px] w-[18px]" />
      </span>
      {!compact && (
        <span className="flex min-w-0 flex-col leading-none">
          <span className="truncate text-[15px] font-semibold tracking-[-0.01em]">XOVA AI</span>
          <span className="mt-0.5 truncate text-xxs font-medium text-faint">by Begad</span>
        </span>
      )}
    </span>
  );
}
