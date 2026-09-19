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
  const { t } = useI18n();

  return (
    <header className="flex items-center gap-2 border-b border-border bg-background/85 px-2 py-2 backdrop-blur md:px-4">
      <button
        type="button"
        onClick={onOpenDrawer}
        aria-label={t("nav.menu")}
        className="xv-focus grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-hover hover:text-foreground md:hidden"
      >
        <Menu className="h-4.5 w-4.5" />
      </button>

      <span className="min-w-0 flex-1">
        {title ? (
          <span className="block truncate text-sm font-medium">{title}</span>
        ) : (
          <XovaWordmark className="md:hidden" />
        )}
      </span>

      <span className="hidden sm:block">
        <ModeSelector mode={mode} onChange={onModeChange} />
      </span>

      <button
        type="button"
        onClick={onNewChat}
        aria-label={t("nav.newChat")}
        title={t("nav.newChat")}
        className="xv-focus grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-hover hover:text-foreground md:hidden"
      >
        <Plus className="h-4.5 w-4.5" />
      </button>
    </header>
  );
}
