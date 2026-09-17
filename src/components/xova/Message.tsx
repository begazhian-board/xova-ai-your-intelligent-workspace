import { useState } from "react";
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  Flag,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Share2,
  ThumbsDown,
  ThumbsUp,
  Volume2,
  VolumeX,
} from "lucide-react";
import { toast } from "sonner";
import { Markdown } from "./Markdown";
import { XovaMark } from "./Logo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/xova";

interface MessageProps {
  message: ChatMessage;
  onRegenerate: () => void;
  onEdit: (content: string) => void;
}

function IconButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "xv-focus grid h-7 w-7 place-items-center rounded-md transition-colors",
        active
          ? "bg-brand-soft text-brand"
          : "text-muted-foreground hover:bg-hover hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

export function Message({ message, onRegenerate, onEdit }: MessageProps) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const [vote, setVote] = useState<"up" | "down" | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);

  const copy = async (text: string, toastText?: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
      if (toastText) toast.success(toastText);
    } catch {
      toast.error(t("err.generic"));
    }
  };

  const readAloud = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      toast.error(t("err.speechUnsupported"));
      return;
    }
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(message.content);
    utterance.lang = document.documentElement.lang === "ar" ? "ar-SA" : "en-US";
    utterance.onend = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  };

  if (message.role === "user") {
    return (
      <article className="flex flex-col items-end gap-2">
        {message.attachments.length > 0 && (
          <ul className="flex max-w-[85%] flex-wrap justify-end gap-2">
            {message.attachments.map((attachment) => (
              <li
                key={attachment.id}
                className="overflow-hidden rounded-lg border border-border bg-subtle"
              >
                {attachment.kind === "image" && attachment.dataUrl ? (
                  <img
                    src={attachment.dataUrl}
                    alt={attachment.name}
                    className="max-h-40 w-auto object-cover"
                  />
                ) : (
                  <span className="block max-w-[12rem] truncate px-2.5 py-1.5 text-xs">
                    {attachment.name}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        {message.content && (
          <div className="max-w-[85%] rounded-2xl rounded-ee-md bg-elevated px-3.5 py-2.5 text-[0.95rem] leading-relaxed text-foreground">
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          </div>
        )}
      </article>
    );
  }

  return (
    <article className="group/msg flex gap-3">
      <span
        className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand"
        aria-hidden="true"
      >
        <XovaMark className="h-4 w-4" />
      </span>

      <div className="min-w-0 flex-1">
        {message.imageUrl && (
          <figure className="mb-3 max-w-md overflow-hidden rounded-xl border border-border">
            <img src={message.imageUrl} alt={message.content || t("nav.imageStudio")} />
            <figcaption className="flex gap-1.5 border-t border-border bg-subtle px-2 py-1.5">
              <a
                href={message.imageUrl}
                download="xova-image.png"
                className="xv-focus inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-hover hover:text-foreground"
              >
                <Download className="h-3.5 w-3.5" />
                {t("msg.download")}
              </a>
              <button
                type="button"
                onClick={onRegenerate}
                className="xv-focus inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-hover hover:text-foreground"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {t("msg.regenerate")}
              </button>
            </figcaption>
          </figure>
        )}

        {editing ? (
          <div className="flex flex-col gap-2">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={6}
              className="w-full resize-y rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none xv-focus"
            />
            <span className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  onEdit(draft);
                  setEditing(false);
                }}
                className="xv-focus rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-brand-foreground"
              >
                {t("dialog.save")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraft(message.content);
                  setEditing(false);
                }}
                className="xv-focus rounded-lg border border-border px-3 py-1.5 text-xs font-medium"
              >
                {t("dialog.cancel")}
              </button>
            </span>
          </div>
        ) : (
          message.content && <Markdown content={message.content} />
        )}

        {message.streaming && !message.content && (
          <p className="text-sm text-muted-foreground" aria-live="polite">
            <span className="xv-caret">{t("state.preparing")}</span>
          </p>
        )}

        {message.sources.length > 0 && (
          <section className="mt-4 rounded-xl border border-border bg-subtle p-3">
            <h3 className="mb-2 text-xxs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("msg.sources")}
            </h3>
            <ol className="flex flex-col gap-1.5">
              {message.sources.map((source, index) => (
                <li key={source.url} className="flex min-w-0 items-start gap-2 text-xs">
                  <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded bg-elevated text-xxs text-muted-foreground">
                    {index + 1}
                  </span>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="xv-focus min-w-0 rounded"
                  >
                    <span className="line-clamp-1 font-medium text-foreground">{source.title}</span>
                    <span className="flex items-center gap-1 text-muted-foreground">
                      {new URL(source.url).hostname.replace(/^www\./, "")}
                      <ExternalLink className="h-3 w-3" />
                    </span>
                  </a>
                </li>
              ))}
            </ol>
          </section>
        )}

        {!message.streaming && !editing && (
          <div className="mt-2 flex flex-wrap items-center gap-0.5 opacity-100 transition-opacity md:opacity-0 md:group-hover/msg:opacity-100 md:focus-within:opacity-100">
            <IconButton label={copied ? t("msg.copied") : t("msg.copy")} onClick={() => void copy(message.content)}>
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </IconButton>
            <IconButton label={t("msg.regenerate")} onClick={onRegenerate}>
              <RefreshCw className="h-3.5 w-3.5" />
            </IconButton>
            <IconButton
              label={t("msg.like")}
              active={vote === "up"}
              onClick={() => {
                setVote("up");
                toast.success(t("toast.feedback"));
              }}
            >
              <ThumbsUp className="h-3.5 w-3.5" />
            </IconButton>
            <IconButton
              label={t("msg.dislike")}
              active={vote === "down"}
              onClick={() => {
                setVote("down");
                toast.success(t("toast.feedback"));
              }}
            >
              <ThumbsDown className="h-3.5 w-3.5" />
            </IconButton>
            <IconButton
              label={t("msg.share")}
              onClick={() => void copy(message.content, t("toast.shareCopied"))}
            >
              <Share2 className="h-3.5 w-3.5" />
            </IconButton>
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label={t("msg.more")}
                className="xv-focus grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-hover hover:text-foreground"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuItem onClick={readAloud}>
                  {speaking ? (
                    <VolumeX className="me-2 h-4 w-4" />
                  ) : (
                    <Volume2 className="me-2 h-4 w-4" />
                  )}
                  {speaking ? t("msg.stopReading") : t("msg.readAloud")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setEditing(true)}>
                  <Pencil className="me-2 h-4 w-4" />
                  {t("msg.edit")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => toast.success(t("toast.reported"))}>
                  <Flag className="me-2 h-4 w-4" />
                  {t("msg.report")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
    </article>
  );
}
