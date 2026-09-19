import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, Info, X } from "lucide-react";
import { toast } from "sonner";
import { Composer } from "@/components/xova/Composer";
import { Message } from "@/components/xova/Message";
import { Sidebar } from "@/components/xova/Sidebar";
import { SettingsDialog } from "@/components/xova/SettingsDialog";
import { Topbar } from "@/components/xova/Topbar";
import { Welcome } from "@/components/xova/Welcome";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useConversation } from "@/hooks/useConversation";
import { useProfile } from "@/hooks/useProfile";
import { useAppearance } from "@/lib/appearance";
import { useI18n } from "@/lib/i18n";
import { conversationTitle, type Attachment, type ModeId } from "@/lib/xova";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "XOVA AI — your calm AI assistant, by Begad" },
      {
        name: "description",
        content:
          "XOVA AI is a fast, focused AI assistant by Begad: real answers, six thinking modes, file and image understanding, in English and Arabic.",
      },
      { property: "og:title", content: "XOVA AI — your calm AI assistant, by Begad" },
      {
        property: "og:description",
        content:
          "A fast, focused AI assistant with six thinking modes, file and image understanding, in English and Arabic.",
      },
    ],
  }),
  component: Workspace,
});

function Banner({
  tone,
  children,
  onDismiss,
}: {
  tone: "error" | "info";
  children: React.ReactNode;
  onDismiss: () => void;
}) {
  const { t } = useI18n();
  const Icon = tone === "error" ? AlertTriangle : Info;
  return (
    <div
      role="status"
      className={
        tone === "error"
          ? "mx-auto flex w-full max-w-3xl items-start gap-2 rounded-xl border border-destructive/35 bg-destructive/10 px-3 py-2 text-xs text-destructive"
          : "mx-auto flex w-full max-w-3xl items-start gap-2 rounded-xl border border-border bg-subtle px-3 py-2 text-xs text-muted-foreground"
      }
    >
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1">{children}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t("nav.close")}
        className="xv-focus rounded p-0.5 hover:opacity-80"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function Workspace() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut } = useAuth();
  const { setAppearance } = useAppearance();
  const { profile, loading: profileLoading, update } = useProfile(user?.id);

  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [mode, setMode] = useState<ModeId>("instant");
  const [imageMode, setImageMode] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);

  useEffect(() => {
    if (!authLoading && !user) void navigate({ to: "/auth", replace: true });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (profile) {
      setMode(profile.default_mode);
      setAppearance({ theme: profile.theme, lang: profile.language });
    }
  }, [profile, setAppearance]);

  const aiConfig = useMemo(
    () => ({
      personality: profile?.personality ?? "friendly",
      customPersonality: profile?.custom_personality ?? null,
      responseStyle: profile?.response_style ?? "balanced",
      language: profile?.language ?? "en",
    }),
    [profile],
  );

  const {
    messages,
    loading: messagesLoading,
    status,
    error,
    notice,
    setError,
    setNotice,
    send,
    stop,
    clear,
    regenerate,
    generateImage,
  } = useConversation(user?.id, aiConfig);

  // Intelligent scrolling: follow the stream only while the user is at the bottom.
  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const onScroll = () => {
      pinnedRef.current = node.scrollHeight - node.scrollTop - node.clientHeight < 96;
    };
    node.addEventListener("scroll", onScroll, { passive: true });
    return () => node.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node || !pinnedRef.current) return;
    node.scrollTop = node.scrollHeight;
  }, [messages, status]);

  const title = profile?.conversation_title ?? conversationTitle(messages);

  const handleSend = useCallback(
    (text: string, attachments: Attachment[]) => {
      pinnedRef.current = true;
      void send({ text, attachments, mode });
    },
    [mode, send],
  );

  const handleGenerateImage = useCallback(
    async (prompt: string) => {
      pinnedRef.current = true;
      const result = await generateImage(prompt, "1:1");
      if (result) toast.success(t("toast.imageReady"));
    },
    [generateImage, t],
  );

  const handleNewChat = useCallback(() => {
    setDrawer(false);
    if (messages.length === 0) return;
    setConfirmDelete(true);
  }, [messages.length]);

  const jumpTo = useCallback((messageId: string) => {
    setDrawer(false);
    const node = document.getElementById(`msg-${messageId}`);
    node?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  const handleSignOut = useCallback(async () => {
    await signOut();
    void navigate({ to: "/auth", replace: true });
  }, [navigate, signOut]);

  if (authLoading || !user || profileLoading || !profile) {
    return (
      <main className="flex min-h-screen flex-col gap-4 bg-background p-6">
        <Skeleton className="h-9 w-48 rounded-lg" />
        <Skeleton className="h-4 w-72 rounded" />
        <Skeleton className="mt-auto h-28 w-full max-w-3xl self-center rounded-2xl" />
      </main>
    );
  }

  const email = user.email ?? "";
  const displayName = profile.display_name ?? profile.username ?? email.split("@")[0] ?? "";

  const sidebar = (onCloseDrawer?: () => void) => (
    <Sidebar
      collapsed={collapsed && !onCloseDrawer}
      onToggleCollapsed={() => setCollapsed((value) => !value)}
      messages={messages}
      loading={messagesLoading}
      title={title}
      onRename={() => {
        setRenameValue(title ?? "");
        setRenameOpen(true);
      }}
      onDelete={() => setConfirmDelete(true)}
      onNewChat={handleNewChat}
      onOpenSettings={() => {
        setDrawer(false);
        setSettingsOpen(true);
      }}
      onSignOut={() => void handleSignOut()}
      onJumpTo={jumpTo}
      displayName={displayName}
      email={email}
      avatarUrl={profile.avatar_url}
      {...(onCloseDrawer ? { onCloseDrawer } : {})}
    />
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <div className="hidden md:flex">{sidebar()}</div>

      <Dialog open={drawer} onOpenChange={setDrawer}>
        <DialogContent className="left-0 top-0 h-screen w-[86vw] max-w-xs translate-x-0 translate-y-0 gap-0 rounded-none border-0 p-0 md:hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>{t("nav.conversation")}</DialogTitle>
          </DialogHeader>
          {sidebar(() => setDrawer(false))}
        </DialogContent>
      </Dialog>

      <main className="flex min-w-0 flex-1 flex-col">
        <Topbar
          title={title}
          mode={mode}
          onModeChange={setMode}
          onOpenDrawer={() => setDrawer(true)}
          onNewChat={handleNewChat}
        />

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
          {messagesLoading ? (
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-8">
              <Skeleton className="h-10 w-2/3 self-end rounded-2xl" />
              <Skeleton className="h-24 w-full rounded-xl" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex min-h-full flex-col">
              <Welcome onPick={(text) => setDraft(text)} />
            </div>
          ) : (
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6">
              {messages.map((message) => (
                <div key={message.id} id={`msg-${message.id}`}>
                  <Message
                    message={message}
                    onRegenerate={() => {
                      pinnedRef.current = true;
                      void regenerate(message.id, message.mode ?? mode);
                    }}
                    onEdit={(content) => setDraft(content)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {(error || notice) && (
          <div className="flex flex-col gap-2 px-3 pb-2 sm:px-6">
            {error && (
              <Banner tone="error" onDismiss={() => setError(null)}>
                {t(error)}
              </Banner>
            )}
            {notice && (
              <Banner tone="info" onDismiss={() => setNotice(null)}>
                {t(notice)}
              </Banner>
            )}
          </div>
        )}

        <Composer
          mode={mode}
          onModeChange={setMode}
          status={status}
          enterToSend={profile.enter_to_send}
          imageMode={imageMode}
          onToggleImageMode={() => setImageMode((value) => !value)}
          onSend={handleSend}
          onGenerateImage={(prompt) => void handleGenerateImage(prompt)}
          onStop={stop}
          seedText={draft}
          onSeedConsumed={() => setDraft(null)}
        />
      </main>

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        profile={profile}
        email={email}
        onUpdate={async (patch) => {
          const result = await update(patch);
          if (!result.error && (patch.theme || patch.language)) {
            setAppearance({
              ...(patch.theme ? { theme: patch.theme } : {}),
              ...(patch.language ? { lang: patch.language } : {}),
            });
          }
          return result;
        }}
        onDeleteConversation={() => {
          setSettingsOpen(false);
          setConfirmDelete(true);
        }}
      />

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader className="text-start">
            <DialogTitle className="text-base">{t("dialog.rename.title")}</DialogTitle>
          </DialogHeader>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              {t("dialog.rename.label")}
            </span>
            <input
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              className="xv-focus w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none"
            />
          </label>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setRenameOpen(false)}
              className="xv-focus rounded-lg border border-border px-3 py-1.5 text-xs font-medium"
            >
              {t("dialog.cancel")}
            </button>
            <button
              type="button"
              onClick={() => {
                void update({ conversation_title: renameValue.trim() || null }).then(({ error: e }) =>
                  e ? toast.error(t("err.generic")) : toast.success(t("toast.saved")),
                );
                setRenameOpen(false);
              }}
              className="xv-focus rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-brand-foreground"
            >
              {t("dialog.save")}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader className="text-start">
            <AlertDialogTitle>{t("dialog.delete.title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("dialog.delete.body")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("dialog.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                void clear();
                void update({ conversation_title: null });
                toast.success(t("toast.deleted"));
              }}
            >
              {t("dialog.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
