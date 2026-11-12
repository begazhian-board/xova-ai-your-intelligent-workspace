import { useCallback, useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Check,
  ClipboardCopy,
  Download,
  ImageIcon,
  Loader2,
  Maximize2,
  RefreshCw,
  Sparkles,
  Trash2,
  WandSparkles,
  Zap,
} from "lucide-react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { downloadWatermarkedImage } from "@/lib/image-watermark";

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

const STYLE_PRESETS = [
  {
    id: "photo",
    label: { ar: "واقعي وسينمائي", en: "Photo realistic" },
    prompt: {
      ar: "تصوير فوتوغرافي واقعي، إضاءة سينمائية، تفاصيل دقيقة وخامات طبيعية",
      en: "photorealistic photography, cinematic lighting, fine details, natural textures",
    },
  },
  {
    id: "illustration",
    label: { ar: "رسوم ثلاثية الأبعاد", en: "3D illustration" },
    prompt: {
      ar: "رسوم ثلاثية الأبعاد جذابة، ألوان زاهية، إضاءة ناعمة وشخصيات بتفاصيل واضحة",
      en: "beautiful 3D illustration, vibrant colors, soft lighting, clearly detailed characters",
    },
  },
  {
    id: "product",
    label: { ar: "تصوير منتجات", en: "Product photography" },
    prompt: {
      ar: "تصوير منتجات احترافي، خلفية نظيفة، إضاءة استوديو وظلال ناعمة",
      en: "professional product photography, clean background, studio lighting, soft shadows",
    },
  },
] as const;

function ImageStudio() {
  const { t, lang, dir } = useI18n();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [prompt, setPrompt] = useState("");
  const [aspect, setAspect] = useState<Aspect>("1:1");
  const [quality, setQuality] = useState<Quality>("standard");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<ImageRow[]>([]);
  const [selectedImage, setSelectedImage] = useState<ImageRow | null>(null);
  const [lightboxImage, setLightboxImage] = useState<ImageRow | null>(null);
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
        const rows = (data as ImageRow[] | null) ?? [];
        setImages(rows);
        setSelectedImage((current) => current ?? rows[0] ?? null);
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
        const generated: ImageRow = {
          id: json.id,
          prompt: clean,
          aspect: useAspect,
          quality: useQuality,
          storage_path: "",
          image_url: json.image,
          created_at: json.createdAt ?? new Date().toISOString(),
        };
        setImages((current) => [generated, ...current]);
        setSelectedImage(generated);
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
      await downloadWatermarkedImage(row.image_url, `xova-${row.id}.png`);
    } catch (caught) {
      console.error("XOVA watermarked image download failed", caught);
      toast.error(t("err.generic"));
    }
  }, [t]);

  const copyPrompt = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t("studio.promptCopied"));
    } catch {
      toast.error(t("err.generic"));
    }
  }, [t]);

  const remove = useCallback(
    async (row: ImageRow) => {
      setImages((current) => current.filter((item) => item.id !== row.id));
      setSelectedImage((current) => (current?.id === row.id ? null : current));
      setLightboxImage((current) => (current?.id === row.id ? null : current));
      if (row.storage_path) {
        await supabase.storage.from("xova-images").remove([row.storage_path]);
      }
      const { error: dbError } = await supabase.from("generated_images").delete().eq("id", row.id);
      if (dbError) toast.error(t("err.generic"));
      else toast.success(t("studio.deleted"));
    },
    [t],
  );

  const addPreset = (value: string) => {
    setPrompt((current) => (current.trim() ? `${current.trim()}, ${value}` : `${value}: `));
  };

  if (authLoading || !user) {
    return (
      <main className="flex min-h-screen flex-col gap-4 bg-background p-6">
        <Skeleton className="h-9 w-48 rounded-lg" />
        <Skeleton className="h-28 w-full max-w-2xl rounded-2xl" />
      </main>
    );
  }

  return (
    <main dir={dir} className="xv-studio-shell relative min-h-screen overflow-hidden bg-background text-foreground">
      <div aria-hidden="true" className="xv-studio-glow pointer-events-none absolute inset-x-0 -top-40 h-96" />
      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 sm:py-8">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => void navigate({ to: "/" })}
            className="xv-focus xv-studio-control inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-all hover:-translate-y-0.5"
          >
            <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
            {t("studio.back")}
          </button>
          <span className="inline-flex items-center gap-2 rounded-full border border-brand/25 bg-brand/10 px-3 py-1.5 text-[11px] font-semibold text-brand">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            {t("app.name")}
          </span>
        </div>

        <header className="flex flex-col gap-2">
          <h1 className="xv-gradient-text text-3xl font-bold tracking-tight sm:text-4xl">
            {t("studio.title")}
          </h1>
          <p className="max-w-2xl text-sm leading-7 text-muted-foreground">{t("studio.subtitle")}</p>
        </header>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(340px,0.95fr)]">
          <section className="xv-studio-panel flex min-w-0 flex-col gap-5 rounded-3xl border p-4 shadow-panel sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand/10 text-brand">
                  <WandSparkles className="h-4.5 w-4.5" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-sm font-semibold">{t("studio.createTitle")}</h2>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{t("studio.createHint")}</p>
                </div>
              </div>
              <span className="rounded-full border border-border/80 bg-surface/70 px-2.5 py-1 text-[10px] font-medium text-muted-foreground">
                {prompt.length}/2000
              </span>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="xova-image-prompt" className="text-xs font-semibold">
                {t("studio.prompt")}
              </label>
              <textarea
                id="xova-image-prompt"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                rows={5}
                maxLength={2000}
                placeholder={t("composer.imagePlaceholder")}
                className="xv-focus xv-studio-input min-h-32 w-full resize-y rounded-2xl border bg-surface px-4 py-3.5 text-sm leading-7 outline-none transition-colors placeholder:text-muted-foreground/75 focus:border-brand/55"
              />
              <p className="text-[11px] leading-relaxed text-muted-foreground">{t("studio.promptTip")}</p>
            </div>

            <div className="flex flex-col gap-2.5">
              <h3 className="text-xs font-semibold">{t("studio.quickStyles")}</h3>
              <div className="flex flex-wrap gap-2">
                {STYLE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => addPreset(preset.prompt[lang])}
                    className="xv-focus xv-studio-chip inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-[11px] font-medium transition-all hover:-translate-y-0.5 hover:border-brand/45 hover:text-brand"
                  >
                    <Sparkles className="h-3 w-3" aria-hidden="true" />
                    {preset.label[lang]}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <fieldset className="flex min-w-0 flex-col gap-2.5">
                <legend className="text-xs font-semibold">{t("studio.aspect")}</legend>
                <div className="grid grid-cols-3 gap-2">
                  {ASPECTS.map((value) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={aspect === value}
                      onClick={() => setAspect(value)}
                      className={cn(
                        "xv-focus xv-studio-choice flex min-h-[82px] flex-col items-center justify-center gap-2 rounded-2xl border p-2 text-xs font-semibold transition-all",
                        aspect === value && "is-selected",
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "rounded-[4px] border-2 border-current opacity-80",
                          value === "1:1" && "h-5 w-5",
                          value === "3:2" && "h-4 w-6",
                          value === "2:3" && "h-6 w-4",
                        )}
                      />
                      <span>{t(`studio.aspect.${value}`)}</span>
                      <span className="text-[10px] font-normal opacity-65">{value}</span>
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset className="flex min-w-0 flex-col gap-2.5">
                <legend className="text-xs font-semibold">{t("studio.quality")}</legend>
                <div className="grid grid-cols-2 gap-2">
                  {QUALITIES.map((value) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={quality === value}
                      onClick={() => setQuality(value)}
                      className={cn(
                        "xv-focus xv-studio-choice flex min-h-[82px] flex-col items-start justify-center gap-1 rounded-2xl border px-3 py-2 text-start transition-all",
                        quality === value && "is-selected",
                      )}
                    >
                      <span className="flex items-center gap-1.5 text-xs font-semibold">
                        {value === "premium" ? (
                          <Sparkles className="h-3.5 w-3.5" />
                        ) : (
                          <Zap className="h-3.5 w-3.5" />
                        )}
                        {t(`studio.quality.${value}`)}
                      </span>
                      <span className="text-[10px] leading-relaxed opacity-70">
                        {t(`studio.quality.${value}.desc`)}
                      </span>
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>

            <button
              type="button"
              disabled={busy || prompt.trim().length === 0}
              onClick={() => void generate(prompt, aspect, quality)}
              className="xv-focus xv-studio-generate inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border px-5 py-3 text-sm font-bold text-white shadow-md transition-all hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Sparkles className="h-4 w-4" aria-hidden="true" />
              )}
              {busy ? t("studio.generating") : t("studio.generate")}
            </button>

            {error && (
              <p role="status" className="rounded-xl border border-destructive/35 bg-destructive/10 px-3 py-2.5 text-xs text-destructive">
                {t(error)}
              </p>
            )}
          </section>

          <section className="xv-studio-preview flex min-w-0 flex-col overflow-hidden rounded-3xl border shadow-panel">
            <div className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3.5 sm:px-5">
              <div>
                <h2 className="text-sm font-semibold">{t("studio.preview")}</h2>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{t("studio.previewHint")}</p>
              </div>
              {selectedImage && (
                <button
                  type="button"
                  onClick={() => void download(selectedImage)}
                  className="xv-focus xv-studio-control inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-semibold"
                >
                  <Download className="h-3.5 w-3.5" />
                  {t("msg.download")}
                </button>
              )}
            </div>

            {selectedImage ? (
              <>
                <button
                  type="button"
                  onClick={() => setLightboxImage(selectedImage)}
                  aria-label={t("studio.openPreview")}
                  className="xv-focus group/preview relative flex min-h-[300px] flex-1 items-center justify-center overflow-hidden bg-surface/80 p-3 sm:min-h-[390px]"
                >
                  <img
                    src={selectedImage.image_url}
                    alt={selectedImage.prompt}
                    className="max-h-[520px] w-full rounded-xl object-contain"
                  />
                  <span className="absolute bottom-5 end-5 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/65 px-3 py-2 text-[11px] font-semibold text-white opacity-0 shadow-lg backdrop-blur transition-opacity group-hover/preview:opacity-100 group-focus-visible/preview:opacity-100">
                    <Maximize2 className="h-3.5 w-3.5" />
                    {t("studio.openPreview")}
                  </span>
                </button>
                <div className="flex flex-col gap-3 p-4 sm:p-5">
                  <p className="text-xs leading-6 text-muted-foreground">{selectedImage.prompt}</p>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[10px] text-muted-foreground">
                      {selectedImage.aspect} · {t(`studio.quality.${selectedImage.quality === "premium" ? "premium" : "standard"}`)} · {new Date(selectedImage.created_at).toLocaleDateString()}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => void copyPrompt(selectedImage.prompt)}
                        className="xv-focus xv-studio-icon-button grid h-9 w-9 place-items-center rounded-xl border"
                        aria-label={t("studio.copyPrompt")}
                        title={t("studio.copyPrompt")}
                      >
                        <ClipboardCopy className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void generate(
                          selectedImage.prompt,
                          (ASPECT_CLASS[selectedImage.aspect] ? selectedImage.aspect : "1:1") as Aspect,
                          selectedImage.quality === "premium" ? "premium" : "standard",
                        )}
                        className="xv-focus xv-studio-icon-button grid h-9 w-9 place-items-center rounded-xl border disabled:opacity-45"
                        aria-label={t("msg.regenerate")}
                        title={t("msg.regenerate")}
                      >
                        <RefreshCw className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex min-h-[370px] flex-1 flex-col items-center justify-center gap-4 px-6 py-12 text-center">
                <span className="xv-studio-empty-mark grid h-20 w-20 place-items-center rounded-[1.8rem] border border-brand/20 bg-brand/10 text-brand">
                  {busy ? <Loader2 className="h-8 w-8 animate-spin" /> : <ImageIcon className="h-8 w-8" />}
                </span>
                <div>
                  <h3 className="text-sm font-semibold">{busy ? t("studio.generating") : t("studio.previewEmptyTitle")}</h3>
                  <p className="mt-1 max-w-xs text-xs leading-6 text-muted-foreground">{t("studio.previewEmptyBody")}</p>
                </div>
              </div>
            )}
          </section>
        </div>

        <section className="flex flex-col gap-4">
          <div className="flex items-end justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-brand/10 text-brand">
                <ImageIcon className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-sm font-semibold">{t("studio.history")}</h2>
                <p className="text-[11px] text-muted-foreground">{t("studio.historyCount").replace("{count}", String(images.length))}</p>
              </div>
            </div>
            <span className="rounded-full border border-border/80 bg-surface/70 px-2.5 py-1 text-[10px] font-medium text-muted-foreground">
              {images.length}
            </span>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <Skeleton className="aspect-square w-full rounded-2xl" />
              <Skeleton className="aspect-square w-full rounded-2xl" />
              <Skeleton className="aspect-square w-full rounded-2xl" />
              <Skeleton className="aspect-square w-full rounded-2xl" />
            </div>
          ) : images.length === 0 && !busy ? (
            <div className="xv-studio-empty flex flex-col items-center gap-3 rounded-3xl border border-dashed px-4 py-14 text-center">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand/10 text-brand">
                <ImageIcon className="h-5 w-5" aria-hidden="true" />
              </span>
              <p className="text-sm font-medium">{t("empty.noImages")}</p>
              <p className="text-xs text-muted-foreground">{t("studio.historyEmptyHint")}</p>
            </div>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {busy && (
                <li className="xv-studio-thumb flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border text-center text-xs text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin text-brand" aria-hidden="true" />
                  {t("studio.generating")}
                </li>
              )}
              {images.map((row) => (
                <li
                  key={row.id}
                  className={cn(
                    "xv-studio-thumb group/card flex min-w-0 flex-col overflow-hidden rounded-2xl border transition-all hover:-translate-y-0.5 hover:shadow-panel",
                    selectedImage?.id === row.id && "is-selected",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedImage(row)}
                    aria-pressed={selectedImage?.id === row.id}
                    className="xv-focus relative block w-full overflow-hidden bg-surface/60"
                  >
                    <img
                      src={row.image_url}
                      alt={row.prompt}
                      loading="lazy"
                      className={cn(
                        "w-full object-cover transition-transform duration-500 group-hover/card:scale-[1.035]",
                        ASPECT_CLASS[row.aspect] ?? "aspect-square",
                      )}
                    />
                    <span className="absolute bottom-2 end-2 rounded-md border border-white/15 bg-black/60 px-1.5 py-0.5 text-[9px] font-bold text-white">
                      XOVA
                    </span>
                    {selectedImage?.id === row.id && (
                      <span className="absolute start-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-brand text-white shadow-md">
                        <Check className="h-3.5 w-3.5" />
                      </span>
                    )}
                  </button>
                  <div className="flex min-w-0 items-center justify-between gap-1.5 p-2">
                    <span className="min-w-0 flex-1 truncate text-[10px] text-muted-foreground">{row.prompt}</span>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => void download(row)}
                        aria-label={t("msg.download")}
                        title={t("msg.download")}
                        className="xv-focus xv-studio-icon-button grid h-7 w-7 place-items-center rounded-lg border"
                      >
                        <Download className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDelete(row)}
                        aria-label={t("studio.confirmDelete")}
                        title={t("studio.confirmDelete")}
                        className="xv-focus xv-studio-icon-button grid h-7 w-7 place-items-center rounded-lg border hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <Dialog open={lightboxImage !== null} onOpenChange={(open) => !open && setLightboxImage(null)}>
        <DialogContent className="xv-studio-lightbox w-[calc(100vw-1.5rem)] max-w-5xl overflow-hidden border p-3 sm:p-5">
          {lightboxImage && (
            <>
              <DialogHeader className="text-start">
                <DialogTitle className="text-sm">{t("studio.preview")}</DialogTitle>
              </DialogHeader>
              <div className="flex max-h-[72vh] items-center justify-center overflow-auto rounded-2xl bg-black/5 p-2 dark:bg-black/30">
                <img src={lightboxImage.image_url} alt={lightboxImage.prompt} className="max-h-[68vh] max-w-full rounded-xl object-contain" />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="min-w-0 flex-1 text-xs leading-relaxed text-muted-foreground">{lightboxImage.prompt}</p>
                <button
                  type="button"
                  onClick={() => void download(lightboxImage)}
                  className="xv-focus xv-studio-control inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold"
                >
                  <Download className="h-3.5 w-3.5" />
                  {t("msg.download")}
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

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
