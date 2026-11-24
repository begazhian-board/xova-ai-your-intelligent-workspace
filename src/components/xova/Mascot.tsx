import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type MascotState = "idle" | "thinking" | "lit" | "bye";

/** Friendly envelope-bubble robot. Separate from the XOVA X logo. Pure SVG + CSS. */
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
    <span className={cn("xv-mascot relative inline-block h-20 w-20", className)} data-state={state}>
      <svg viewBox="0 0 100 100" role="img" aria-label={label} className="h-full w-full overflow-visible">
        {/* lightbulb */}
        <g className="xv-mascot-bulb" transform="translate(50 8)">
          <circle r="7" className="xv-mascot-bulb-glass" />
          <rect x="-3.5" y="6" width="7" height="4" rx="1" className="xv-mascot-line-fill" />
        </g>
        {/* antenna */}
        <line x1="50" y1="30" x2="50" y2="22" className="xv-mascot-stroke" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="50" cy="21" r="3" className="xv-mascot-accent" />
        <g className="xv-mascot-body">
          {/* bubble tail */}
          <path d="M30 78 L26 90 L42 80 Z" className="xv-mascot-shell" />
          {/* envelope body */}
          <rect x="14" y="30" width="72" height="52" rx="14" className="xv-mascot-shell" />
          {/* envelope flap */}
          <path d="M20 36 L50 56 L80 36" fill="none" className="xv-mascot-stroke" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.35" />
          {/* eyes */}
          <g className="xv-mascot-eyes">
            <ellipse cx="38" cy="54" rx="6" ry="7" className="xv-mascot-eye" />
            <ellipse cx="62" cy="54" rx="6" ry="7" className="xv-mascot-eye" />
            <circle cx="39.5" cy="55" r="2.6" className="xv-mascot-pupil" />
            <circle cx="63.5" cy="55" r="2.6" className="xv-mascot-pupil" />
          </g>
          {/* small X mark */}
          <path d="M70 68 l6 6 M76 68 l-6 6" className="xv-mascot-accent-stroke" strokeWidth="2.4" strokeLinecap="round" />
          {/* smile */}
          <path d="M45 68 Q50 72 55 68" fill="none" className="xv-mascot-stroke" strokeWidth="2" strokeLinecap="round" />
        </g>
      </svg>
    </span>
  );
}

/** Derive mascot state from chat status: thinking while busy, brief bulb after completion. */
export function useMascotState(status: string): MascotState {
  const busy = status === "submitted" || status === "streaming" || status === "generating";
  const wasBusy = useRef(false);
  const [lit, setLit] = useState(false);
  useEffect(() => {
    if (busy) {
      wasBusy.current = true;
      setLit(false);
      return;
    }
    if (wasBusy.current) {
      wasBusy.current = false;
      setLit(true);
      const timer = window.setTimeout(() => setLit(false), 1600);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [busy]);
  return busy ? "thinking" : lit ? "lit" : "idle";
}
