import { Brain, Check, Code2, Eye, Globe, Sigma, Zap, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MODES, type ModeId } from "@/lib/xova";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const ICONS: Record<ModeId, typeof Zap> = {
  instant: Zap,
  reasoning: Brain,
  research: Globe,
  vision: Eye,
  coding: Code2,
  engineering: Sigma,
};

export function ModeIcon({ mode, className }: { mode: ModeId; className?: string }) {
  const Icon = ICONS[mode];
  return <Icon className={cn("h-4 w-4", className)} aria-hidden="true" />;
}

export function ModeSelector({
  mode,
  onChange,
  compact = false,
}: {
  mode: ModeId;
  onChange: (mode: ModeId) => void;
  compact?: boolean;
}) {
  const { t } = useI18n();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("composer.mode")}
        className="xv-focus inline-flex h-8 max-w-[9.5rem] items-center gap-1.5 rounded-lg border border-border bg-elevated px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-hover"
      >
        <ModeIcon mode={mode} className="h-3.5 w-3.5 shrink-0 text-brand" />
        {!compact && <span className="truncate">{t(`mode.${mode}`)}</span>}
        <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64 border-border bg-popover">
        {MODES.map((entry) => (
          <DropdownMenuItem
            key={entry.id}
            onSelect={() => onChange(entry.id)}
            className="flex items-start gap-2.5 py-2"
          >
            <ModeIcon mode={entry.id} className="mt-0.5 shrink-0 text-brand" />
            <span className="flex min-w-0 flex-col">
              <span className="text-sm font-medium">{t(`mode.${entry.id}`)}</span>
              <span className="text-xs text-muted-foreground">{t(`mode.${entry.id}.desc`)}</span>
            </span>
            {mode === entry.id && <Check className="ms-auto mt-0.5 h-4 w-4 text-brand" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
