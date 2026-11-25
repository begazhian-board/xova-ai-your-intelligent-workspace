import { Menu, Plus, Settings } from "lucide-react";
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
  deviceLayout: "mobile" | "tablet" | "desktop";
  onOpenSettings: () => void;
}

export function Topbar({
  title,
  mode,
  onModeChange,
  onOpenDrawer,
  onNewChat,
  deviceLayout,
  onOpenSettings,
}: TopbarProps) {
  const { t, dir } = useI18n();

  return (
    <header dir={dir} className="xv-topbar xv-topbar-v2 relative z-10 flex items-center gap-2 px-3 py-3 sm:gap-3 sm:px-4">
      <button
        type="button"
        onClick={onOpenDrawer}
        aria-label={t("nav.menu")}
        title={t("nav.menu")}
        className={`xv-toolbar-icon xv-focus grid h-10 w-10 shrink-0 place-items-center rounded-xl ${deviceLayout === "mobile" ? "" : "md:hidden"}`}
      >
        <Menu className="h-[18px] w-[18px]" />
      </button>

      <span className="xv-toolbar-divider hidden h-8 w-px shrink-0 md:block" />

      <div className="xv-topbar-heading flex min-w-0 flex-1 flex-col justify-center">
        <span className="xv-topbar-eyebrow hidden text-[10px] font-semibold uppercase tracking-[0.16em] md:block">
          {t("app.name")}
        </span>
        {title ? (
          <span className="block truncate text-sm font-semibold sm:text-[15px]">{title}</span>
        ) : (
          <span className="flex items-center">
            <XovaWordmark className="md:hidden" />
            <span className="hidden text-[15px] font-semibold md:inline">{t("nav.conversation")}</span>
          </span>
        )}
      </div>

      <div className="xv-topbar-actions flex shrink-0 items-center gap-1.5 sm:gap-2">
        <div className="xv-toolbar-mode hidden items-center sm:flex">
          <ModeSelector mode={mode} onChange={onModeChange} />
        </div>

        <button
          type="button"
          onClick={onOpenSettings}
          aria-label={t("nav.settings")}
          title={t("nav.settings")}
          className="xv-toolbar-icon xv-focus grid h-10 w-10 shrink-0 place-items-center rounded-xl"
        >
          <Settings className="h-[17px] w-[17px]" />
        </button>

        <button
          type="button"
          onClick={onNewChat}
          className="xv-toolbar-primary xv-focus inline-flex h-10 shrink-0 items-center gap-2 rounded-xl px-3 text-xs font-semibold sm:px-4 sm:text-sm"
          aria-label={t("nav.newChat")}
          title={t("nav.newChat")}
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">{t("nav.newChat")}</span>
        </button>
      </div>
    </header>
  );
}
