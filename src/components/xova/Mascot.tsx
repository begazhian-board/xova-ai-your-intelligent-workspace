import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type MascotState = "idle" | "thinking" | "lit" | "bye";

/** XOVA's glowing companion robot. The X remains the primary brand mark. */
export function Mascot({
  state = "idle",
  className,
  label = "XOVA robot",
}: {
  state?: MascotState;
  className?: string;
  label?: string;
}) {
  const id = useId().replace(/:/g, "");
  const shellGradient = `xv-bot-shell-${id}`;
  const visorGradient = `xv-bot-visor-${id}`;

  return (
    <span
      className={cn("xv-mascot relative inline-block h-20 w-20 shrink-0", className)}
      data-state={state}
      role="img"
      aria-label={label}
    >
      <svg viewBox="0 0 120 120" aria-hidden="true" className="h-full w-full overflow-visible">
        <defs>
          <linearGradient id={shellGradient} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#F9FCFF" />
            <stop offset="55%" stopColor="#DCEBFA" />
            <stop offset="100%" stopColor="#A9C7E8" />
          </linearGradient>
          <linearGradient id={visorGradient} x1="0" y1="0" x2="0.9" y2="1">
            <stop offset="0%" stopColor="#172B4A" />
            <stop offset="100%" stopColor="#091629" />
          </linearGradient>
        </defs>

        <ellipse cx="60" cy="108" rx="34" ry="6" className="xv-bot-shadow" />
        <g className="xv-bot-aura">
          <circle cx="60" cy="58" r="48" className="xv-bot-aura-ring" />
          <circle cx="60" cy="58" r="39" className="xv-bot-aura-core" />
        </g>

        <g className="xv-bot-body">
          <path d="M43 91 L39 103 Q38 107 43 106 L54 98" className="xv-bot-neck" />
          <path d="M77 91 L81 103 Q82 107 77 106 L66 98" className="xv-bot-neck" />
          <rect x="39" y="91" width="42" height="16" rx="8" className="xv-bot-chest" />
          <path d="M51 98 H69" className="xv-bot-chest-line" />

          <rect x="12" y="43" width="13" height="29" rx="6.5" className="xv-bot-ear" />
          <rect x="95" y="43" width="13" height="29" rx="6.5" className="xv-bot-ear" />
          <path d="M18 51 V64 M102 51 V64" className="xv-bot-ear-light" />

          <rect x="23" y="20" width="74" height="76" rx="25" className="xv-bot-shell" />
          <path d="M36 28 Q60 15 84 28" className="xv-bot-top-highlight" />
          <rect x="31" y="39" width="58" height="39" rx="15" className="xv-bot-visor" />
          <path d="M38 45 Q60 37 82 45" className="xv-bot-visor-glint" />

          <g className="xv-bot-eyes">
            <ellipse cx="47" cy="57" rx="5.3" ry="7.2" className="xv-bot-eye" />
            <ellipse cx="73" cy="57" rx="5.3" ry="7.2" className="xv-bot-eye" />
            <circle cx="48.5" cy="55" r="1.7" className="xv-bot-eye-glint" />
            <circle cx="74.5" cy="55" r="1.7" className="xv-bot-eye-glint" />
          </g>
          <path d="M53 69 Q60 73 67 69" className="xv-bot-mouth" />
          <g className="xv-bot-thinking">
            <circle cx="51" cy="69" r="2" />
            <circle cx="60" cy="69" r="2" />
            <circle cx="69" cy="69" r="2" />
          </g>
          <path d="M34 84 H86" className="xv-bot-lower-seam" />
          <circle cx="60" cy="86" r="2.2" className="xv-bot-status" />
        </g>

        <g className="xv-bot-bulb" transform="translate(60 10)">
          <path d="M0 8 V15" className="xv-bot-bulb-stem" />
          <circle r="7.5" className="xv-bot-bulb-glass" />
          <path d="M-2.5 0 L0 -3 L2.5 0 M-2.5 3 L0 5 L2.5 3" className="xv-bot-bulb-mark" />
        </g>
      </svg>
    </span>
  );
}

/** Thinking begins on submit; the idea light switches on when the answer arrives. */
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
