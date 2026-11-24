import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type MascotState = "idle" | "thinking" | "lit" | "bye";

/** The XOVA message-bot companion. The X mark remains the primary brand identity. */
export function Mascot({
  state = "idle",
  className,
  label = "XOVA mascot",
}: {
  state?: MascotState;
  className?: string;
  label?: string;
}) {
  return (
    <span
      className={cn("xv-mascot relative inline-block h-20 w-20", className)}
      data-state={state}
      role="img"
      aria-label={label}
    >
      <svg viewBox="0 0 100 100" aria-hidden="true" className="h-full w-full overflow-visible">
        <defs>
          <linearGradient id="xv-mascot-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#61B8FF" />
            <stop offset="100%" stopColor="#8B65F5" />
          </linearGradient>
        </defs>
        <g className="xv-mascot-bulb" transform="translate(50 9)">
          <circle r="8" className="xv-mascot-bulb-glass" />
          <rect x="-4" y="6" width="8" height="4" rx="1.5" className="xv-mascot-bulb-base" />
          <path d="M-3 -1 L3 -1 M0 -4 L0 3" className="xv-mascot-bulb-filament" />
        </g>
        <path d="M50 29 V22" className="xv-mascot-antenna" />
        <circle cx="50" cy="21" r="2.5" className="xv-mascot-antenna-tip" />
        <g className="xv-mascot-body">
          <path d="M29 76 L25 88 Q24 91 28 89 L43 79" className="xv-mascot-tail" />
          <rect x="13" y="29" width="74" height="54" rx="17" className="xv-mascot-shell" />
          <path d="M20 36 L50 56 L80 36" className="xv-mascot-fold" />
          <g className="xv-mascot-eyes">
            <ellipse cx="37" cy="54" rx="6.2" ry="7.2" className="xv-mascot-eye" />
            <ellipse cx="63" cy="54" rx="6.2" ry="7.2" className="xv-mascot-eye" />
            <circle cx="38.5" cy="55" r="2.5" className="xv-mascot-pupil" />
            <circle cx="64.5" cy="55" r="2.5" className="xv-mascot-pupil" />
          </g>
          <path d="M44 69 Q50 74 56 69" className="xv-mascot-mouth" />
          <g className="xv-mascot-thinking-dots">
            <circle cx="43" cy="70" r="2" />
            <circle cx="50" cy="70" r="2" />
            <circle cx="57" cy="70" r="2" />
          </g>
          <path d="M72 67 L77 72 L72 77" className="xv-mascot-cheek" />
        </g>
      </svg>
    </span>
  );
}

/** Thinking starts on submit; the bulb lights as soon as the answer streams in. */
export function useMascotState(status: string): MascotState {
  const waiting = status === "submitted" || status === "generating";
  const streaming = status === "streaming";
  const wasActive = useRef(false);
  const [hold, setHold] = useState(false);

  useEffect(() => {
    if (waiting || streaming) {
      wasActive.current = true;
      setHold(false);
      return;
    }
    if (wasActive.current) {
      wasActive.current = false;
      setHold(true);
      const timer = window.setTimeout(() => setHold(false), 1600);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [waiting, streaming]);

  if (waiting) return "thinking";
  return streaming || hold ? "lit" : "idle";
}
