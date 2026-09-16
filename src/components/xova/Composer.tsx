import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  FileText,
  Image as ImageIcon,
  Loader2,
  Mic,
  Paperclip,
  Sparkles,
  Square,
  Table2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { ModeSelector } from "./ModeSelector";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  classifyFile,
  formatBytes,
  MAX_ATTACHMENT_BYTES,
  newId,
  type Attachment,
  type ModeId,
} from "@/lib/xova";

type Status = "idle" | "submitted" | "streaming" | "generating";

interface ComposerProps {
  mode: ModeId;
  onModeChange: (mode: ModeId) => void;
  status: Status;
  enterToSend: boolean;
  imageMode: boolean;
  onToggleImageMode: () => void;
  onSend: (text: string, attachments: Attachment[]) => void;
  onGenerateImage: (prompt: string) => void;
  onStop: () => void;
}

function AttachmentIcon({ kind }: { kind: Attachment["kind"] }) {
  if (kind === "image") return <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />;
  if (kind === "data") return <Table2 className="h-3.5 w-3.5" aria-hidden="true" />;
  return <FileText className="h-3.5 w-3.5" aria-hidden="true" />;
}

export function Composer({
  mode,
  onModeChange,
  status,
  enterToSend,
  imageMode,
  onToggleImageMode,
  onSend,
  onGenerateImage,
  onStop,
}: ComposerProps) {
  const { t } = useI18n();
  const [value, setValue] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [dragging, setDragging] = useState(false);
  const [listening, setListening] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);

  const busy = status !== "idle";

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    if (status === "idle") textareaRef.current?.focus();
  }, [status]);

  useEffect(() => {
    const node = textareaRef.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, 240)}px`;
  }, [value]);

  const addFiles = async (files: FileList | File[]) => {
    const next: Attachment[] = [];
    for (const file of Array.from(files)) {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        toast.error(t("err.tooLarge"), { description: file.name });
        continue;
      }
      const kind = classifyFile(file);
      if (kind === "unsupported") {
        toast.error(t("err.unsupported"), { description: file.name });
        continue;
      }
      try {
        const attachment: Attachment = {
          id: newId(),
          name: file.name,
          mime: file.type || "application/octet-stream",
          size: file.size,
          kind,
        };
        if (kind === "image") {
          attachment.dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
          });
        } else {
          attachment.text = await file.text();
        }
        next.push(attachment);
      } catch {
        toast.error(t("err.upload"), { description: file.name });
      }
    }
    if (next.length > 0) {
      setAttachments((current) => [...current, ...next]);
      toast.success(t("toast.attached"));
    }
  };

  const submit = () => {
    const text = value.trim();
    if (busy) return;
    if (imageMode) {
      if (!text) return;
      onGenerateImage(text);
      setValue("");
      return;
    }
    if (!text && attachments.length === 0) return;
    onSend(text, attachments);
    setValue("");
    setAttachments([]);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const send = enterToSend
      ? event.key === "Enter" && !event.shiftKey
      : event.key === "Enter" && (event.metaKey || event.ctrlKey);
    if (send) {
      event.preventDefault();
      submit();
    }
  };

  const onPaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(event.clipboardData.files ?? []);
    if (files.length > 0) {
      event.preventDefault();
      void addFiles(files);
    }
  };

  const toggleVoice = () => {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const Ctor =
      (window as unknown as { SpeechRecognition?: new () => never }).SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: new () => never }).webkitSpeechRecognition;
    if (!Ctor) {
      toast.error(t("err.voiceUnsupported"));
      return;
    }
    const recognition = new Ctor() as unknown as {
      lang: string;
      interimResults: boolean;
      continuous: boolean;
      start: () => void;
      stop: () => void;
      onresult: (event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
      onerror: () => void;
      onend: () => void;
    };
    recognition.lang = document.documentElement.lang === "ar" ? "ar-SA" : "en-US";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i += 1) {
        transcript += event.results[i]?.[0]?.transcript ?? "";
      }
      setValue((current) => (current ? `${current} ${transcript}` : transcript));
    };
    recognition.onerror = () => {
      setListening(false);
      toast.error(t("err.generic"));
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  };

  return (
    <div className="px-3 pb-3 sm:px-6 sm:pb-5">
      <div className="mx-auto w-full max-w-3xl">
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            if (event.dataTransfer.files.length > 0) void addFiles(event.dataTransfer.files);
          }}
          className={cn(
            "rounded-2xl border bg-composer shadow-panel transition-colors",
            dragging ? "border-brand" : "border-border",
          )}
        >
          {dragging && (
            <p className="px-4 pt-3 text-xs font-medium text-brand">{t("composer.dropHere")}</p>
          )}

          {attachments.length > 0 && (
            <ul className="flex flex-wrap gap-2 px-3 pt-3">
              {attachments.map((attachment) => (
                <li
                  key={attachment.id}
                  className="group flex min-w-0 max-w-[15rem] items-center gap-2 rounded-lg border border-border bg-subtle px-2 py-1.5"
                >
                  {attachment.kind === "image" && attachment.dataUrl ? (
                    <img
                      src={attachment.dataUrl}
                      alt={attachment.name}
                      className="h-7 w-7 shrink-0 rounded object-cover"
                    />
                  ) : (
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded bg-elevated text-brand">
                      <AttachmentIcon kind={attachment.kind} />
                    </span>
                  )}
                  <span className="flex min-w-0 flex-col leading-tight">
                    <span className="truncate text-xs font-medium">{attachment.name}</span>
                    <span className="text-xxs text-muted-foreground">
                      {formatBytes(attachment.size)}
                    </span>
                  </span>
                  <button
                    type="button"
                    aria-label={`${t("nav.close")} ${attachment.name}`}
                    onClick={() =>
                      setAttachments((current) => current.filter((a) => a.id !== attachment.id))
                    }
                    className="xv-focus ms-1 rounded p-0.5 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <label className="sr-only" htmlFor="xova-composer">
            {imageMode ? t("composer.imagePlaceholder") : t("composer.placeholder")}
          </label>
          <textarea
            id="xova-composer"
            ref={textareaRef}
            value={value}
            rows={1}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            placeholder={imageMode ? t("composer.imagePlaceholder") : t("composer.placeholder")}
            className="max-h-60 w-full resize-none bg-transparent px-4 pb-1 pt-3.5 text-[0.95rem] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground"
          />

          <div className="flex items-center gap-1.5 px-2.5 pb-2.5 pt-1">
            <input
              ref={fileRef}
              type="file"
              multiple
              className="hidden"
              onChange={(event) => {
                if (event.target.files) void addFiles(event.target.files);
                event.target.value = "";
              }}
            />
            <button
              type="button"
              aria-label={t("composer.attach")}
              title={t("composer.attach")}
              onClick={() => fileRef.current?.click()}
              className="xv-focus grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-hover hover:text-foreground"
            >
              <Paperclip className="h-4 w-4" />
            </button>

            {!imageMode && <ModeSelector mode={mode} onChange={onModeChange} />}

            <button
              type="button"
              aria-pressed={imageMode}
              aria-label={t("composer.generate")}
              title={t("composer.generate")}
              onClick={onToggleImageMode}
              className={cn(
                "xv-focus inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors",
                imageMode
                  ? "bg-brand text-brand-foreground"
                  : "text-muted-foreground hover:bg-hover hover:text-foreground",
              )}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t("composer.generate")}</span>
            </button>

            <span className="ms-auto flex items-center gap-1.5">
              <button
                type="button"
                aria-label={t("composer.voice")}
                title={t("composer.voice")}
                aria-pressed={listening}
                onClick={toggleVoice}
                className={cn(
                  "xv-focus grid h-8 w-8 place-items-center rounded-lg transition-colors",
                  listening
                    ? "bg-destructive/15 text-destructive"
                    : "text-muted-foreground hover:bg-hover hover:text-foreground",
                )}
              >
                <Mic className="h-4 w-4" />
              </button>

              {busy ? (
                <button
                  type="button"
                  onClick={onStop}
                  aria-label={t("composer.stop")}
                  title={t("composer.stop")}
                  className="xv-focus grid h-9 w-9 place-items-center rounded-xl bg-elevated text-foreground transition-colors hover:bg-hover"
                >
                  {status === "generating" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Square className="h-3.5 w-3.5" />
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={submit}
                  disabled={!value.trim() && attachments.length === 0}
                  aria-label={t("composer.send")}
                  title={t("composer.send")}
                  className="xv-focus grid h-9 w-9 place-items-center rounded-xl bg-brand text-brand-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
              )}
            </span>
          </div>
        </div>

        <p className="mt-2 text-center text-xxs text-faint" aria-live="polite">
          {listening
            ? t("state.listening")
            : enterToSend
              ? t("composer.hint")
              : t("composer.hintCtrl")}
        </p>
      </div>
    </div>
  );
}
