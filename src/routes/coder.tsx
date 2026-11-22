import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Code2,
  Download,
  FilePlus2,
  Loader2,
  Monitor,
  Smartphone,
  Square,
  Tablet,
  Trash2,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  buildPreviewDoc,
  ERROR_MARK,
  loadProjects,
  mergeFiles,
  parseCoderOutput,
  reviewProject,
  saveProjects,
  type CoderFile,
  type CoderProject,
} from "@/lib/coder";

export const Route = createFileRoute("/coder")({
  head: () => ({
    meta: [
      { title: "XOVA Coder — build a website from a description" },
      {
        name: "description",
        content:
          "Describe the website you want and XOVA Coder writes working HTML, CSS and JavaScript with a live responsive preview, follow-up edits and ZIP download.",
      },
      { property: "og:title", content: "XOVA Coder — build a website from a description" },
      {
        property: "og:description",
        content: "Describe a website; get working code, a live preview, edits and a ZIP download.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CoderPage,
});

const SUBTITLE = "اكتب وصف الموقع اللي انت عايزه وxova هيعمله فثواني";

const TX = {
  en: {
    back: "Back to chat",
    placeholder: "e.g. A landing page for a coffee shop with a menu, gallery and contact form",
    editPlaceholder: "Describe a change, e.g. make the header dark blue and add a pricing section",
    build: "Build website",
    edit: "Apply edit",
    stop: "Stop",
    building: "Building your website…",
    newProject: "New project",
    projects: "Your projects",
    noProjects: "No projects yet.",
    preview: "Live preview",
    code: "Code",
    download: "Download ZIP",
    review: "Code review",
    reviewOk: "No problems found in links, files or interactions.",
    history: "Edits",
    empty: "Your website preview appears here.",
    saved: "Saved in this browser",
    saveFailed: "Couldn't save in this browser (storage full).",
    zipReady: "ZIP downloaded",
    mobile: "Mobile",
    tablet: "Tablet",
    desktop: "Desktop",
    delete: "Delete",
    organized: "Organized files",
    "coder.err.auth": "Your session expired. Sign in again and retry.",
    "coder.err.input": "Write a description (up to 4000 characters).",
    "coder.err.tooLarge": "This project is too large to edit at once. Start a new project.",
    "coder.err.config": "The building service isn't configured on the server.",
    "coder.err.busy": "The AI service is busy right now (rate limit). Wait a minute and press Build again.",
    "coder.err.credits": "The AI service has no remaining credit. Try again later.",
    "coder.err.provider": "The AI service didn't respond. Press Build again in a moment.",
    "coder.err.interrupted": "The response was cut off. Your partial files were kept — press Build again to finish.",
    "coder.err.noFiles": "The AI replied without website files. Press Build again; your description is kept.",
    "coder.err.network": "Connection lost. Check your internet and press Build again.",
    noIndex: "index.html is missing",
    noViewport: "Missing mobile viewport tag",
    noTitle: "Missing page title",
    missingFile: "Link to a file that doesn't exist",
    brokenAnchor: "Link to a section that doesn't exist",
    imgAlt: "Images without alt text",
    jsMissingId: "Script uses an element that doesn't exist",
    noMedia: "No responsive @media rules",
  },
  ar: {
    back: "رجوع للمحادثة",
    placeholder: "مثال: صفحة لكافيه فيها منيو ومعرض صور وفورم تواصل",
    editPlaceholder: "اكتب التعديل، مثال: خلّي الهيدر أزرق غامق وضيف قسم أسعار",
    build: "ابني الموقع",
    edit: "طبّق التعديل",
    stop: "إيقاف",
    building: "بنبني موقعك…",
    newProject: "مشروع جديد",
    projects: "مشاريعك",
    noProjects: "مفيش مشاريع لسه.",
    preview: "معاينة مباشرة",
    code: "الكود",
    download: "تحميل ZIP",
    review: "مراجعة الكود",
    reviewOk: "مفيش مشاكل في الروابط أو الملفات أو التفاعلات.",
    history: "التعديلات",
    empty: "معاينة موقعك هتظهر هنا.",
    saved: "اتحفظ في المتصفح",
    saveFailed: "معرفناش نحفظ في المتصفح (المساحة مليانة).",
    zipReady: "اتحمّل الـ ZIP",
    mobile: "موبايل",
    tablet: "تابلت",
    desktop: "كمبيوتر",
    delete: "حذف",
    organized: "ملفات منظمة",
    "coder.err.auth": "الجلسة انتهت. سجّل دخول تاني وجرّب.",
    "coder.err.input": "اكتب وصف للموقع (لحد 4000 حرف).",
    "coder.err.tooLarge": "المشروع كبير على تعديل واحد. ابدأ مشروع جديد.",
    "coder.err.config": "خدمة البناء مش متظبطة على السيرفر.",
    "coder.err.busy": "خدمة الذكاء الاصطناعي مشغولة دلوقتي (حد الطلبات). استنى دقيقة ودوس ابني تاني.",
    "coder.err.credits": "رصيد خدمة الذكاء الاصطناعي خلص. جرّب بعدين.",
    "coder.err.provider": "خدمة الذكاء الاصطناعي مردتش. دوس ابني تاني كمان شوية.",
    "coder.err.interrupted": "الرد اتقطع. احتفظنا بالملفات اللي اتعملت — دوس ابني تاني للإكمال.",
    "coder.err.noFiles": "الذكاء الاصطناعي رد من غير ملفات موقع. دوس ابني تاني؛ الوصف محفوظ.",
    "coder.err.network": "الاتصال اتقطع. اتأكد من النت ودوس ابني تاني.",
    noIndex: "ملف index.html ناقص",
    noViewport: "ناقص وسم التوافق مع الموبايل",
    noTitle: "ناقص عنوان الصفحة",
    missingFile: "رابط لملف مش موجود",
    brokenAnchor: "رابط لقسم مش موجود",
    imgAlt: "صور من غير وصف alt",
    jsMissingId: "السكريبت بيستخدم عنصر مش موجود",
    noMedia: "مفيش قواعد @media للتجاوب",
  },
} as const;
type TxKey = keyof (typeof TX)["en"];

function NewBadge() {
  return (
    <span className="ms-1.5 inline-flex items-center rounded-full bg-brand px-1.5 py-px text-[9px] font-bold uppercase leading-4 tracking-wide text-brand-foreground">
      NEW
    </span>
  );
}

function newProject(): CoderProject {
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `p-${Date.now()}`,
    title: "",
    files: [],
    history: [],
    updatedAt: new Date().toISOString(),
  };
}

const WIDTHS = { mobile: 390, tablet: 768, desktop: 0 } as const;
type Device = keyof typeof WIDTHS;

function CoderPage() {
  const { lang } = useI18n();
  const tx = (k: TxKey | string) => (TX[lang] as Record<string, string>)[k] ?? (TX.en as Record<string, string>)[k] ?? k;
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [projects, setProjects] = useState<CoderProject[]>([]);
  const [project, setProject] = useState<CoderProject>(newProject);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"preview" | "code">("preview");
  const [device, setDevice] = useState<Device>("desktop");
  const [openFile, setOpenFile] = useState("index.html");
  const [liveText, setLiveText] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!authLoading && !user) void navigate({ to: "/auth", replace: true });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    const list = loadProjects();
    setProjects(list);
    if (list[0]) setProject(list[0]);
  }, []);

  const persist = useCallback((next: CoderProject) => {
    setProject(next);
    setProjects((prev) => {
      const list = [next, ...prev.filter((p) => p.id !== next.id)];
      if (!saveProjects(list)) toast.error(tx("saveFailed"));
      return list;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  const issues = useMemo(() => reviewProject(project.files), [project.files]);
  const previewDoc = useMemo(() => buildPreviewDoc(project.files), [project.files]);
  const isEdit = project.files.length > 0;

  const run = useCallback(async () => {
    const text = prompt.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    setLiveText("");
    const controller = new AbortController();
    abortRef.current = controller;
    let raw = "";
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("coder.err.auth");
      const res = await fetch("/api/coder", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ prompt: text, files: project.files, history: project.history }),
      });
      if (!res.ok || !res.body) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(json.error ?? "coder.err.provider");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        raw += decoder.decode(value, { stream: true });
        setLiveText(raw.slice(-1200));
      }
      raw += decoder.decode();
    } catch (err) {
      if (controller.signal.aborted) {
        setBusy(false);
        return;
      }
      const msg = err instanceof Error ? err.message : "";
      if (!raw) {
        setError(msg.startsWith("coder.err.") ? msg : "coder.err.network");
        setBusy(false);
        return;
      }
    }
    const marker = raw.match(ERROR_MARK);
    const { files, summary } = parseCoderOutput(raw.replace(ERROR_MARK, ""));
    if (files.length) {
      const merged = mergeFiles(project.files, files);
      persist({
        ...project,
        title: project.title || text.slice(0, 60),
        files: merged,
        history: [
          ...project.history,
          { role: "user", text },
          { role: "assistant", text: summary || files.map((f) => f.path).join(", ") },
        ],
        updatedAt: new Date().toISOString(),
      });
      setPrompt("");
      setTab("preview");
      if (!merged.some((f) => f.path === openFile)) setOpenFile(merged[0]?.path ?? "index.html");
      if (marker) setError(marker[1]!);
      else toast.success(tx("saved"));
    } else {
      setError(marker?.[1] ?? "coder.err.noFiles");
    }
    setBusy(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt, busy, project, persist, openFile, lang]);

  const downloadZip = useCallback(async () => {
    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();
    for (const f of project.files) zip.file(f.path, f.content);
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(project.title || "xova-site").replace(/[^\p{L}\p{N}]+/gu, "-").slice(0, 40) || "xova-site"}.zip`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast.success(tx("zipReady"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, lang]);

  const removeProject = (id: string) => {
    const list = projects.filter((p) => p.id !== id);
    setProjects(list);
    saveProjects(list);
    if (project.id === id) setProject(list[0] ?? newProject());
  };

  const current = project.files.find((f) => f.path === openFile) ?? project.files[0];

  return (
    <div className="xv-ambient flex min-h-screen flex-col bg-background text-foreground">
      <header className="flex items-center gap-3 border-b border-border bg-background/85 px-3 py-3 backdrop-blur md:px-6">
        <Link
          to="/"
          aria-label={tx("back")}
          className="xv-focus grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-hover hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center text-lg font-semibold tracking-tight">
            <Code2 className="me-2 h-5 w-5 text-brand" />
            XOVA Coder
            <NewBadge />
          </h1>
          <p dir="rtl" lang="ar" className="text-sm text-muted-foreground">
            {SUBTITLE}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setProject(newProject());
            setPrompt("");
            setError(null);
          }}
          className="xv-focus inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-hover"
        >
          <FilePlus2 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{tx("newProject")}</span>
        </button>
      </header>

      <div className="grid flex-1 gap-4 p-3 md:p-6 lg:grid-cols-[360px_1fr]">
        <aside className="flex flex-col gap-4">
          <div className="rounded-2xl border border-border bg-surface p-3">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void run();
              }}
              rows={5}
              maxLength={4000}
              placeholder={isEdit ? tx("editPlaceholder") : tx("placeholder")}
              aria-label={isEdit ? tx("edit") : tx("build")}
              className="xv-focus w-full resize-none rounded-xl bg-transparent p-2 text-sm outline-none"
            />
            <div className="flex gap-2">
              {busy ? (
                <button
                  type="button"
                  onClick={() => abortRef.current?.abort()}
                  className="xv-focus inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-medium"
                >
                  <Square className="h-3.5 w-3.5" /> {tx("stop")}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void run()}
                  disabled={!prompt.trim()}
                  className="xv-focus inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand px-3 py-2 text-sm font-semibold text-brand-foreground disabled:opacity-50"
                >
                  <Wand2 className="h-4 w-4" /> {isEdit ? tx("edit") : tx("build")}
                </button>
              )}
            </div>
            {busy && (
              <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> {tx("building")}
              </p>
            )}
          </div>

          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/35 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{tx(error)}</span>
            </div>
          )}

          {project.files.length > 0 && (
            <section className="rounded-2xl border border-border bg-surface p-3">
              <h2 className="mb-2 flex items-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {tx("review")}
                <NewBadge />
              </h2>
              {issues.length === 0 ? (
                <p className="flex items-center gap-2 text-xs text-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5 text-brand" /> {tx("reviewOk")}
                </p>
              ) : (
                <ul className="flex flex-col gap-1.5 text-xs">
                  {issues.map((i, n) => (
                    <li key={n} className="flex items-start gap-2">
                      <AlertTriangle className={cn("mt-0.5 h-3 w-3 shrink-0", i.level === "error" ? "text-destructive" : "text-muted-foreground")} />
                      <span>
                        {tx(i.key)} <code className="text-muted-foreground" dir="ltr">{i.detail}</code>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {project.history.length > 0 && (
            <section className="rounded-2xl border border-border bg-surface p-3">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{tx("history")}</h2>
              <ol className="flex max-h-56 flex-col gap-2 overflow-y-auto text-xs">
                {project.history.map((h, n) => (
                  <li key={n} className={cn("rounded-lg px-2 py-1.5", h.role === "user" ? "bg-brand-soft" : "bg-subtle text-muted-foreground")}>
                    {h.text}
                  </li>
                ))}
              </ol>
            </section>
          )}

          <section className="rounded-2xl border border-border bg-surface p-3">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{tx("projects")}</h2>
            {projects.length === 0 ? (
              <p className="text-xs text-muted-foreground">{tx("noProjects")}</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {projects.map((p) => (
                  <li key={p.id} className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setProject(p);
                        setError(null);
                      }}
                      className={cn("xv-focus min-w-0 flex-1 truncate rounded-lg px-2 py-1.5 text-start text-xs hover:bg-hover", p.id === project.id && "bg-hover font-medium")}
                    >
                      {p.title || "—"}
                    </button>
                    <button type="button" aria-label={tx("delete")} onClick={() => removeProject(p.id)} className="xv-focus rounded p-1 text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>

        <section className="flex min-h-[70vh] flex-col overflow-hidden rounded-2xl border border-border bg-surface">
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
            <div className="flex rounded-lg bg-subtle p-0.5 text-xs">
              {(["preview", "code"] as const).map((v) => (
                <button key={v} type="button" onClick={() => setTab(v)} className={cn("xv-focus rounded-md px-3 py-1", tab === v ? "bg-background font-medium shadow-sm" : "text-muted-foreground")}>
                  {tx(v)}
                </button>
              ))}
            </div>
            {tab === "preview" && (
              <div className="flex gap-0.5">
                {([["mobile", Smartphone], ["tablet", Tablet], ["desktop", Monitor]] as const).map(([d, Icon]) => (
                  <button key={d} type="button" aria-label={tx(d)} title={tx(d)} onClick={() => setDevice(d)} className={cn("xv-focus grid h-7 w-7 place-items-center rounded-md", device === d ? "bg-hover text-foreground" : "text-muted-foreground")}>
                    <Icon className="h-3.5 w-3.5" />
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => void downloadZip()}
              disabled={!project.files.length}
              className="xv-focus ms-auto inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground disabled:opacity-40"
            >
              <Download className="h-3.5 w-3.5" /> {tx("download")}
            </button>
          </div>

          {!project.files.length ? (
            <div className="grid flex-1 place-items-center p-6 text-center text-sm text-muted-foreground">
              {busy ? (
                <pre dir="ltr" className="max-h-[60vh] w-full overflow-hidden whitespace-pre-wrap text-start font-mono text-[11px] opacity-70">{liveText}</pre>
              ) : (
                tx("empty")
              )}
            </div>
          ) : tab === "preview" ? (
            <div className="flex flex-1 justify-center overflow-auto bg-subtle p-2">
              <iframe
                title={tx("preview")}
                sandbox="allow-scripts allow-forms allow-modals"
                srcDoc={previewDoc}
                style={WIDTHS[device] ? { width: WIDTHS[device] } : undefined}
                className="h-full min-h-[65vh] w-full rounded-lg border border-border bg-background"
              />
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex items-center gap-1 overflow-x-auto border-b border-border px-2 py-1.5 text-xs">
                <span className="me-1 flex items-center text-muted-foreground">{tx("organized")}<NewBadge /></span>
                {project.files.map((f) => (
                  <button key={f.path} type="button" onClick={() => setOpenFile(f.path)} className={cn("xv-focus rounded-md px-2 py-1 font-mono", current?.path === f.path ? "bg-hover" : "text-muted-foreground")}>
                    {f.path}
                  </button>
                ))}
              </div>
              <pre dir="ltr" className="flex-1 overflow-auto p-3 font-mono text-[12px] leading-relaxed">{current?.content}</pre>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
