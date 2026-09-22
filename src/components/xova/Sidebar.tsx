import { useMemo, useState } from "react";
import {
  LogOut,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  Search,
  Settings,
  Trash2,
  User,
  X,
} from "lucide-react";
import { XovaWordmark } from "./Logo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/xova";
import { conversationTitle } from "@/lib/xova";

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  messages: ChatMessage[];
  loading: boolean;
  title: string | null;
  onRename: () => void;
  onDelete: () => void;
  onNewChat: () => void;
  onOpenSettings: () => void;
  onSignOut: () => void;
  onJumpTo: (messageId: string) => void;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  onCloseDrawer?: () => void;
}

export function Sidebar({
  collapsed,
  onToggleCollapsed,
  messages,
  loading,
  title,
  onRename,
  onDelete,
  onNewChat,
  onOpenSettings,
  onSignOut,
  onJumpTo,
  displayName,
  email,
  avatarUrl,
  onCloseDrawer,
}: SidebarProps) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return messages
      .filter((message) => message.content.toLowerCase().includes(needle))
      .slice(-25)
      .reverse();
  }, [messages, query]);

  const label = title ?? conversationTitle(messages);
  const lastAt = messages.length > 0 ? messages[messages.length - 1]!.createdAt : null;

  if (collapsed) {
    return (
      <nav
        aria-label={t("nav.conversation")}
        className="hidden w-[60px] shrink-0 flex-col items-center gap-2 border-e border-border bg-rail py-3 md:flex"
      >
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label={t("nav.expand")}
          title={t("nav.expand")}
          className="xv-focus grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-hover hover:text-foreground"
        >
          <PanelLeftOpen className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onNewChat}
          aria-label={t("nav.newChat")}
          title={t("nav.newChat")}
          className="xv-focus grid h-9 w-9 place-items-center rounded-lg bg-brand-soft text-brand hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
        </button>
        <Link
          to="/images"
          aria-label={t("nav.imageStudio")}
          title={t("nav.imageStudio")}
          className="xv-focus grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-hover hover:text-foreground"
        >
          <ImageIcon className="h-4 w-4" />
        </Link>
        <button
          type="button"
          onClick={onOpenSettings}
          aria-label={t("nav.settings")}
          title={t("nav.settings")}
          className="xv-focus mt-auto grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-hover hover:text-foreground"
        >
          <Settings className="h-4 w-4" />
        </button>
      </nav>
    );
  }

  return (
    <nav
      aria-label={t("nav.conversation")}
      className="flex h-full w-full shrink-0 flex-col border-e border-border bg-rail md:w-[264px]"
    >
      <div className="flex items-center gap-2 px-3 py-3">
        <XovaWordmark className="min-w-0 flex-1" />
        {onCloseDrawer ? (
          <button
            type="button"
            onClick={onCloseDrawer}
            aria-label={t("nav.close")}
            className="xv-focus grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-hover hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={t("nav.collapse")}
            title={t("nav.collapse")}
            className="xv-focus hidden h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-hover hover:text-foreground md:grid"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex flex-col gap-2 px-3">
        <button
          type="button"
          onClick={onNewChat}
          className="xv-focus inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm font-medium transition-colors hover:bg-hover"
        >
          <Plus className="h-4 w-4 text-brand" />
          {t("nav.newChat")}
        </button>

        <div className="relative">
          <Search
            className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("search.placeholder")}
            aria-label={t("nav.search")}
            className="xv-focus w-full rounded-xl border border-border bg-surface py-2 pe-8 ps-8 text-xs outline-none placeholder:text-muted-foreground"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label={t("search.clear")}
              className="xv-focus absolute end-1.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {query ? (
          <>
            <h2 className="mb-1.5 px-1 text-xxs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("search.results")}
            </h2>
            {results.length === 0 ? (
              <p className="px-1 py-4 text-xs text-muted-foreground">{t("search.empty")}</p>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {results.map((message) => (
                  <li key={message.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onJumpTo(message.id);
                        onCloseDrawer?.();
                      }}
                      className="xv-focus w-full rounded-lg px-2 py-2 text-start transition-colors hover:bg-hover"
                    >
                      <span className="block text-xs font-medium">
                        {message.role === "user" ? t("msg.you") : t("app.name")}
                      </span>
                      <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">
                        {message.content}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : loading ? (
          <div className="flex flex-col gap-2 pt-1">
            <Skeleton className="h-9 w-full rounded-lg" />
            <Skeleton className="h-9 w-4/5 rounded-lg" />
          </div>
        ) : label ? (
          <div className="group/item flex items-center gap-1 rounded-lg bg-active px-2 py-2">
            <MessageSquare className="h-3.5 w-3.5 shrink-0 text-brand" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium">{label}</span>
              {lastAt && (
                <span className="block text-xxs text-faint">
                  {new Date(lastAt).toLocaleDateString()}
                </span>
              )}
            </span>
            <button
              type="button"
              onClick={onRename}
              aria-label={t("dialog.rename.title")}
              className="xv-focus grid h-6 w-6 place-items-center rounded text-muted-foreground hover:text-foreground"
            >
              <Pencil className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              aria-label={t("dialog.delete.title")}
              className="xv-focus grid h-6 w-6 place-items-center rounded text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <p className="px-1 py-4 text-xs text-muted-foreground">{t("empty.noMessages")}</p>
        )}
      </div>

      <div className="border-t border-border p-2">
        <button
          type="button"
          onClick={onOpenSettings}
          className="xv-focus mb-1 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-hover hover:text-foreground"
        >
          <Settings className="h-4 w-4" />
          {t("nav.settings")}
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger className="xv-focus flex w-full items-center gap-2 rounded-lg px-2 py-2 text-start transition-colors hover:bg-hover">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" />
            ) : (
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-elevated text-muted-foreground">
                <User className="h-3.5 w-3.5" />
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium">{displayName}</span>
              <span className="block truncate text-xxs text-faint">{email}</span>
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            <DropdownMenuItem onClick={onOpenSettings}>
              <User className="me-2 h-4 w-4" />
              {t("nav.account")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onSignOut}>
              <LogOut className="me-2 h-4 w-4" />
              {t("nav.signOut")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
}

export const sidebarClasses = cn();
