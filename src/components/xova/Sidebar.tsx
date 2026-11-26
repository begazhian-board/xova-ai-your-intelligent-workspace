import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Code2,
  Image as ImageIcon,
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
import { XovaMark } from "./Logo";
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
import type { ConversationSummary } from "@/hooks/useConversation";

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  messages: ChatMessage[];
  loading: boolean;
  conversations: ConversationSummary[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onRename: (id: string) => void;
  onDelete: (id: string) => void;
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
  conversations,
  activeId,
  onSelect,
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
  const { t, dir, lang } = useI18n();
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return messages
      .filter((message) => message.content.toLowerCase().includes(needle))
      .slice(-25)
      .reverse();
  }, [messages, query]);

  if (collapsed) {
    return (
      <nav
        aria-label={t("nav.conversation")}
        dir={dir}
        className="xv-sidebar xv-sidebar-v3 xv-sidebar-collapsed hidden w-[68px] shrink-0 flex-col items-center gap-2 py-3 md:flex"
      >
        <span className="xv-sidebar-mini-brand" aria-label="XOVA">
          <XovaMark className="h-7 w-7" />
        </span>
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label={t("nav.expand")}
          title={t("nav.expand")}
          className="xv-sidebar-mini-button xv-focus"
        >
          <PanelLeftOpen className="h-[17px] w-[17px]" />
        </button>
        <span className="xv-sidebar-mini-separator" />
        <button
          type="button"
          onClick={onNewChat}
          aria-label={t("nav.newChat")}
          title={t("nav.newChat")}
          className="xv-sidebar-mini-button xv-sidebar-mini-primary xv-focus"
        >
          <Plus className="h-[18px] w-[18px]" />
        </button>
        <Link
          to="/images"
          aria-label={t("nav.imageStudio")}
          title={t("nav.imageStudio")}
          className="xv-sidebar-mini-button xv-focus"
        >
          <ImageIcon className="h-[17px] w-[17px]" />
        </Link>
        <Link
          to="/coder"
          aria-label={t("nav.coder")}
          title={t("nav.coder")}
          className="xv-sidebar-mini-button xv-focus"
        >
          <Code2 className="h-[17px] w-[17px]" />
        </Link>
        <button
          type="button"
          onClick={onOpenSettings}
          aria-label={t("nav.settings")}
          title={t("nav.settings")}
          className="xv-sidebar-mini-button xv-focus mt-auto"
        >
          <Settings className="h-[17px] w-[17px]" />
        </button>
      </nav>
    );
  }

  return (
    <nav
      aria-label={t("nav.conversation")}
      dir={dir}
      className="xv-sidebar xv-sidebar-panel xv-sidebar-v3 flex h-full w-full shrink-0 flex-col md:w-[280px]"
    >
      <div className="xv-sidebar-v3-header">
        <div className="xv-sidebar-brand-lockup">
          <span className="xv-sidebar-brand-copy">
            <span className="xv-sidebar-brand-name"><span>X</span>OVA</span>
            <span className="xv-sidebar-brand-caption">AI WORKSPACE</span>
          </span>
        </div>
        {onCloseDrawer ? (
          <button
            type="button"
            onClick={onCloseDrawer}
            aria-label={t("nav.close")}
            className="xv-sidebar-collapse-button xv-focus"
          >
            <X className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={t("nav.collapse")}
            title={t("nav.collapse")}
            className="xv-sidebar-collapse-button xv-focus hidden md:grid"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="xv-sidebar-v3-primary">
        <button
          type="button"
          onClick={onNewChat}
          className="xv-sidebar-v3-new-chat xv-focus"
        >
          <span className="xv-sidebar-v3-new-icon"><Plus className="h-[18px] w-[18px]" /></span>
          <span className="flex-1 text-start">{t("nav.newChat")}</span>
        </button>

        <div className="xv-sidebar-v3-section-label">
          {lang === "ar" ? "مساحتك" : "YOUR SPACE"}
        </div>
        <div className="xv-sidebar-v3-nav">
          <Link
            to="/images"
            onClick={() => onCloseDrawer?.()}
            className="xv-sidebar-v3-nav-link xv-focus"
          >
            <ImageIcon className="h-[17px] w-[17px]" />
            <span>{t("nav.imageStudio")}</span>
          </Link>
          <Link
            to="/coder"
            onClick={() => onCloseDrawer?.()}
            className="xv-sidebar-v3-nav-link xv-focus"
          >
            <Code2 className="h-[17px] w-[17px]" />
            <span>{t("nav.coder")}</span>
          </Link>
        </div>
      </div>

      <div className="xv-sidebar-v3-search-wrap">
        <Search
          className="xv-sidebar-search-icon pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2"
          aria-hidden="true"
        />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("search.placeholder")}
          aria-label={t("nav.search")}
          className="xv-sidebar-v3-search xv-focus w-full"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label={t("search.clear")}
            className="xv-sidebar-search-clear xv-focus"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="xv-sidebar-v3-list-head">
        <span>{query ? t("search.results") : lang === "ar" ? "محادثاتك" : "RECENTS"}</span>
        {!query && <span className="xv-sidebar-v3-count">{conversations.length}</span>}
      </div>

      <div className="xv-sidebar-list xv-sidebar-v3-list min-h-0 flex-1 overflow-y-auto">
        {query ? (
          results.length === 0 ? (
            <p className="xv-sidebar-v3-empty">{t("search.empty")}</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {results.map((message) => (
                <li key={message.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onJumpTo(message.id);
                      onCloseDrawer?.();
                    }}
                    className="xv-sidebar-v3-result xv-focus"
                  >
                    <span className="block text-xs font-semibold">
                      {message.role === "user" ? t("msg.you") : t("app.name")}
                    </span>
                    <span className="mt-1 line-clamp-2 block text-xs text-muted-foreground">
                      {message.content}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : loading ? (
          <div className="flex flex-col gap-2 px-1 pt-2">
            <Skeleton className="h-11 w-full rounded-xl" />
            <Skeleton className="h-11 w-4/5 rounded-xl" />
            <Skeleton className="h-11 w-full rounded-xl" />
          </div>
        ) : conversations.length > 0 ? (
          <ul className="flex flex-col gap-1">
            {conversations.map((conversation) => (
              <li key={conversation.id}>
                <div
                  className={cn(
                    "xv-sidebar-v3-conversation group/item",
                    conversation.id === activeId && "is-active",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onSelect(conversation.id)}
                    aria-current={conversation.id === activeId ? "page" : undefined}
                    className="xv-sidebar-v3-conversation-main xv-focus"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium">
                        {conversation.title ?? t("nav.newChat")}
                      </span>
                    </span>
                  </button>
                  <span className="xv-sidebar-v3-row-actions">
                    <button
                      type="button"
                      onClick={() => onRename(conversation.id)}
                      aria-label={t("dialog.rename.title")}
                      title={t("dialog.rename.title")}
                      className="xv-sidebar-v3-row-action xv-focus"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(conversation.id)}
                      aria-label={t("dialog.delete.title")}
                      title={t("dialog.delete.title")}
                      className="xv-sidebar-v3-row-action xv-focus"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="xv-sidebar-v3-empty-state">
            <span className="xv-sidebar-v3-empty-icon"><MessageSquare className="h-5 w-5" /></span>
            <p>{t("empty.noMessages")}</p>
            <span>{lang === "ar" ? "ابدأ محادثة جديدة وهتظهر هنا" : "Start a chat and it will show up here"}</span>
          </div>
        )}
      </div>

      <div className="xv-sidebar-v3-footer">
        <button
          type="button"
          onClick={onOpenSettings}
          className="xv-sidebar-v3-settings xv-focus"
        >
          <Settings className="h-[17px] w-[17px]" />
          <span>{t("nav.settings")}</span>
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger className="xv-sidebar-v3-profile xv-focus">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="h-9 w-9 shrink-0 rounded-xl object-cover" />
            ) : (
              <span className="xv-sidebar-v3-avatar">
                <User className="h-4 w-4" />
              </span>
            )}
            <span className="min-w-0 flex-1 text-start">
              <span className="block truncate text-xs font-bold">{displayName}</span>
              <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">{email}</span>
            </span>
            <span className="xv-sidebar-profile-status" aria-hidden="true" />
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
