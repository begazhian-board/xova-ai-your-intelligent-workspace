import { Menu, Plus } from "lucide-react";
import { XovaWordmark } from "./Logo";
import { ModeSelector } from "./ModeSelector";
import { useI18n } from "@/lib/i18n";
import type { ModeId } from "@/lib/xova";

interface TopbarProps {
  title: string | null;
  mode: ModeId;
  onModeChange: (mode: ModeId) => void;
  onOpenDrawer: () => void;
  onNewChat: () => void;
}

export function Topbar({ title, mode, onModeChange, onOpenDrawer, onNewChat }: TopbarProps) {
  const { t, dir } = useI18n();

  return (
    <header dir={dir} className="xv-topbar z-10 flex items-center gap-3 border-b border-border/70 px-3 py-3 backdrop-blur-xl sm:px-5">
      <button
        type="button"
        onClick={onOpenDrawer}
        aria-label={t("nav.menu")}
        className="xv-focus grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-border/70 bg-surface/70 text-muted-foreground hover:bg-hover hover:text-foreground md:hidden"
      >
        <Menu className="h-4.5 w-4.5" />
      </button>

      <span className="min-w-0 flex-1">
        {title ? (
          <span className="block truncate text-sm font-semibold">{title}</span>
        ) : (
          <span className="flex items-center gap-2">
            <XovaWordmark className="md:hidden" />
            <span className="hidden text-sm font-semibold md:inline">{t("app.name")}</span>
          </span>
        )}
      </span>

      <span className="hidden sm:block">
        <ModeSelector mode={mode} onChange={onModeChange} />
      </span>

      <button
        type="button"
        onClick={onNewChat}
        className="xv-focus inline-flex h-9 shrink-0 items-center gap-2 rounded-xl border border-brand/25 bg-brand/10 px-3 text-xs font-semibold text-brand transition-all hover:border-brand/40 hover:bg-brand/15"
        aria-label={t("nav.newChat")}
        title={t("nav.newChat")}
      >
        <Plus className="h-4 w-4" />
        <span className="hidden sm:inline">{t("nav.newChat")}</span>
      </button>
    </header>
  );
}
