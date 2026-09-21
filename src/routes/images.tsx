import { useCallback, useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Download, ImageIcon, Loader2, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/images")({
  head: () => ({
    meta: [
      { title: "Image studio — XOVA AI by Begad" },
      {
        name: "description",
        content:
          "Generate real AI images from a text prompt inside XOVA AI: pick an aspect ratio and quality, then download or regenerate from your private image history.",
      },
      { property: "og:title", content: "Image studio — XOVA AI by Begad" },
      {
        property: "og:description",
        content: "Generate real AI images from a prompt, with a private history you own.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ImageStudio,
});

type Aspect = "1:1" | "3:2" | "2:3";
type Quality = "standard" | "premium";

interface ImageRow {
  id: string;
  prompt: string;
  aspect: string;
  quality: string;
  storage_path: string;
  image_url: string;
  created_at: string;
}

const ASPECTS: Aspect[] = ["1:1", "3:2", "2:3"];
const QUALITIES: Quality[] = ["standard", "premium"];

const ASPECT_CLASS: Record<string, string> = {
  "1:1": "aspect-square",
  "3:2": "aspect-[3/2]",
  "2:3": "aspect-[2/3]",
};

function ImageStudio() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [prompt, setPrompt] = useState("");
  const [aspect, setAspect] = useState<Aspect>("1:1");
  const [quality, setQuality] = useState<Quality>("standard");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<ImageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingDelete, setPendingDelete] = useState<ImageRow | null>(null);

  useEffect(() => {
    if (!authLoading && !user) void navigate({ to: "/auth", replace: true });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    setLoading(true);
    supabase
      .from("generated_images")
      .select("id, prompt, aspect, quality, storage_path, image_url, created_at")
      .order("created_at", { ascending: false })
      .then(({ data, error: dbError }) => {
        if (!active) return;
        if (dbError) setError("err.generic");
        setImages((data as ImageRow[] | null) ?? []);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user]);

  const generate = useCallback(
    async (text: string, useAspect: Aspect, useQuality: Quality) => {
      const clean = text.trim();
      if (!clean || busy) return;
      setBusy(true);
      setError(null);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) throw new Error("err.auth");
        const response = await fetch("/api/image", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ prompt: clean, aspect: useAspect, quality: useQuality }),
        });
        const json = (await response.json()) as {
          image?: string;
          id?: string;
          createdAt?: string;
          error?: string;
        };
        if (!response.ok || !json.image || !json.id) {
          throw new Error(json.error ?? "err.imageFailed");
        }
        setImages((current) => [
          {
            id: json.id!,
            prompt: clean,
            aspect: useAspect,
            quality: useQuality,
            storage_path: "",
            image_url: json.image!,
            created_at: json.createdAt ?? new Date().toISOString(),
          },
          ...current,
        ]);
        toast.success(t("toast.imageReady"));
      } catch (caught) {
        const code = caught instanceof Error ? caught.message : "err.imageFailed";
        setError(code.startsWith("err.") ? code : "err.imageFailed");
      } finally {
        setBusy(false);
      }
    },
    [busy, t],
  );

  const download = useCallback(async (row: ImageRow) => {
    try {
      const response = await fetch(row.image_url);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `xova-${row.id}.png`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      window.open(row.image_url, "_blank", "noopener");
    }
  }, []);

  const remove = useCallback(
    async (row: ImageRow) => {
      setImages((current) => current.filter((item) => item.id !== row.id));
      if (row.storage_path) {
        await supabase.storage.from("xova-images").remove([row.storage_path]);
      }
      const { error: dbError } = await supabase.from("generated_images").delete().eq("id", row.id);
      if (dbError) toast.error(t("err.generic"));
      else toast.success(t("studio.deleted"));
    },
    [t],
  );

  if (authLoading || !user) {
    return (
      <main className="flex min-h-screen flex-col gap-4 bg-background p-6">
        <Skeleton className="h-9 w-48 rounded-lg" />
        <Skeleton className="h-28 w-full max-w-2xl rounded-2xl" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void navigate({ to: "/" })}
            className="xv-focus inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-hover"
          >
            <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
            {t("studio.back")}
          </button>
        </div>

        <header className="flex flex-col gap-1">
          <h1 className="text-lg font-semibold tracking-tight">{t("studio.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("studio.subtitle")}</p>
        </header>

        <section className="flex flex-col gap-3 rounded-2xl border border-border bg-composer p-3 sm:p-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">{t("studio.prompt")}</span>
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              rows={3}
              maxLength={2000}
              placeholder={t("composer.imagePlaceholder")}
              className="xv-focus w-full resize-none rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
            />
          </label>

          <div className="flex flex-wrap items-end gap-4">
            <fieldset className="flex flex-col gap-1.5">
              <legend className="text-xs font-medium text-muted-foreground">
                {t("studio.aspect")}
              </legend>
              <div className="flex gap-1.5">
                {ASPECTS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={aspect === value}
                    onClick={() => setAspect(value)}
                    className={cn(
                      "xv-focus rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
                      aspect === value
                        ? "border-brand bg-brand-soft text-brand"
                        : "border-border bg-surface text-muted-foreground hover:bg-hover",
                    )}
                  >
                    {t(`studio.aspect.${value}`)}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="flex flex-col gap-1.5">
              <legend className="text-xs font-medium text-muted-foreground">
                {t("studio.quality")}
              </legend>
              <div className="flex gap-1.5">
                {QUALITIES.map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={quality === value}
                    onClick={() => setQuality(value)}
                    className={cn(
                      "xv-focus rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
                      quality === value
                        ? "border-brand bg-brand-soft text-brand"
                        : "border-border bg-surface text-muted-foreground hover:bg-hover",
                    )}
                  >
                    {t(`studio.quality.${value}`)}
                  </button>
                ))}
              </div>
            </fieldset>

            <button
              type="button"
              disabled={busy || prompt.trim().length === 0}
              onClick={() => void generate(prompt, aspect, quality)}
              className="xv-focus ms-auto inline-flex items-center gap-2 rounded-xl bg-brand px-3.5 py-2 text-sm font-medium text-brand-foreground transition-opacity hover:opacity-90 disabled:opacity-45"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Sparkles className="h-4 w-4" aria-hidden="true" />
              )}
              {t("studio.generate")}
            </button>
          </div>

          {error && (
            <p
              role="status"
              className="rounded-xl border border-destructive/35 bg-destructive/10 px-3 py-2 text-xs text-destructive"
            >
              {t(error)}
            </p>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("studio.history")}
          </h2>

          {busy && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              {t("studio.generating")}
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Skeleton className="aspect-square w-full rounded-xl" />
              <Skeleton className="aspect-square w-full rounded-xl" />
            </div>
          ) : images.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-surface px-4 py-10 text-center">
              <ImageIcon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">{t("empty.noImages")}</p>
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {images.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-col overflow-hidden rounded-2xl border border-border bg-surface"
                >
                  <img
                    src={row.image_url}
                    alt={row.prompt}
                    loading="lazy"
                    className={cn("w-full object-cover", ASPECT_CLASS[row.aspect] ?? "aspect-square")}
                  />
                  <div className="flex flex-col gap-2 p-3">
                    <p className="line-clamp-2 text-xs text-muted-foreground">{row.prompt}</p>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => void download(row)}
                        aria-label={t("msg.download")}
                        title={t("msg.download")}
                        className="xv-focus grid h-7 w-7 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-hover hover:text-foreground"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void generate(
                            row.prompt,
                            (ASPECT_CLASS[row.aspect] ? row.aspect : "1:1") as Aspect,
                            row.quality === "premium" ? "premium" : "standard",
                          )
                        }
                        aria-label={t("msg.regenerate")}
                        title={t("msg.regenerate")}
                        className="xv-focus grid h-7 w-7 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-hover hover:text-foreground disabled:opacity-45"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDelete(row)}
                        aria-label={t("dialog.confirm")}
                        title={t("studio.confirmDelete")}
                        className="xv-focus ms-auto grid h-7 w-7 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-hover hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <AlertDialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader className="text-start">
            <AlertDialogTitle>{t("studio.confirmDelete")}</AlertDialogTitle>
            <AlertDialogDescription>{t("studio.confirmDeleteBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("dialog.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDelete) void remove(pendingDelete);
                setPendingDelete(null);
              }}
            >
              {t("dialog.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
