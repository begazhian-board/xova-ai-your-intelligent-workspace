import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Check,
  Code2,
  Download,
  Eye,
  FileCode2,
  FileText,
  FolderOpen,
  Loader2,
  Laptop,
  Monitor,
  Plus,
  RefreshCw,
  Send,
  Smartphone,
  Tablet,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { newId } from "@/lib/xova";
import { createProjectZip } from "@/lib/coder-zip";

export const Route = createFileRoute("/coder")({
  head: () => ({
    meta: [
      { title: "XOVA Coder — Build your website with AI" },
      {
        name: "description",
        content: "Describe a website, build it with XOVA AI, preview it live and export the complete project.",
      },
    ],
  }),
  component: XovaCoder,
});

type ProjectFile = { path: string; content: string };
type ChatLine = { id: string; role: "user" | "assistant"; content: string };
type PreviewSize = "desktop" | "tablet" | "mobile";
interface CoderProject {
  id: string;
  name: string;
  description: string;
  files: ProjectFile[];
  messages: ChatLine[];
  updatedAt: string;
}
interface CoderResponse {
  error?: string;
  name?: string;
  description?: string;
  files?: ProjectFile[];
}

const STORAGE_PREFIX = "xova-coder-projects-v1:";
const STARTERS = [
  {
    ar: "موقع شخصي احترافي لعرض أعمالي",
    en: "A professional personal portfolio website",
    prompt: "Create a polished personal portfolio website with a hero section, about section, skills, selected projects, and a contact section.",
  },
  {
    ar: "متجر إلكتروني للملابس",
    en: "A modern online clothing store",
    prompt: "Create a modern clothing store website with a product grid, category filters, product cards, a shopping cart demo, and a clean checkout preview.",
  },
  {
    ar: "موقع مطعم مع قائمة طعام",
    en: "A restaurant website with a menu",
    prompt: "Create a premium restaurant website with an attractive hero, menu categories, popular dishes, opening hours, location, and a reservation form demo.",
  },
];

function createEmptyProject(): CoderProject {
  return {
    id: newId(),
    name: "موقع جديد",
    description: "",
    files: [],
    messages: [],
    updatedAt: new Date().toISOString(),
  };
}

function cleanAssetPath(value: string) {
  return value.split(/[?#]/, 1)[0]?.replace(/^\.?\//, "").replace(/^\/+/, "") ?? "";
}

function buildPreviewHtml(files: ProjectFile[]) {
  const index = files.find((file) => file.path.toLowerCase() === "index.html");
  if (!index) return "";

  const findFile = (path: string) => {
    const clean = cleanAssetPath(path);
    return files.find((file) => file.path === clean);
  };

  let html = index.content;
  const inlinedCss = new Set<string>();
  const inlinedScripts = new Set<string>();

  html = html.replace(/<link\b[^>]*>/gi, (tag) => {
    if (!/\brel\s*=\s*["']?stylesheet/i.test(tag)) return tag;
    const href = tag.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1];
    if (!href || /^(https?:|data:|\/\/)/i.test(href)) return tag;
    const file = findFile(href);
    if (!file || !file.path.toLowerCase().endsWith(".css")) return tag;
    inlinedCss.add(file.path);
    return "<style>\n" + file.content.replace(/<\/style/gi, "<\\/style") + "\n</style>";
  });

  html = html.replace(/<script\b([^>]*)\bsrc\s*=\s*["']([^"']+)["']([^>]*)>\s*<\/script>/gi, (tag, before: string, src: string, after: string) => {
    if (/^(https?:|data:|\/\/)/i.test(src)) return tag;
    const file = findFile(src);
    if (!file || !/\.(js|mjs)$/i.test(file.path)) return tag;
    inlinedScripts.add(file.path);
    const attributes = (before + after).replace(/\s*type\s*=\s*["']module["']/i, "");
    return "<script" + attributes + ">\n" + file.content.replace(/<\/script/gi, "<\\/script") + "\n</script>";
  });

  const extraCss = files
    .filter((file) => file.path.toLowerCase().endsWith(".css") && !inlinedCss.has(file.path))
    .map((file) => "<style>\n" + file.content.replace(/<\/style/gi, "<\\/style") + "\n</style>")
    .join("\n");
  if (extraCss) {
    html = /<\/head>/i.test(html) ? html.replace(/<\/head>/i, extraCss + "\n</head>") : extraCss + html;
  }

  const extraScripts = files
    .filter((file) => /\.(js|mjs)$/i.test(file.path) && !inlinedScripts.has(file.path))
    .map((file) => "<script>\n" + file.content.replace(/<\/script/gi, "<\\/script") + "\n</script>")
    .join("\n");
  if (extraScripts) {
    html = /<\/body>/i.test(html) ? html.replace(/<\/body>/i, extraScripts + "\n</body>") : html + extraScripts;
  }

  if (!/<meta\b[^>]*name=["']viewport["']/i.test(html)) {
    const viewport = '<meta name="viewport" content="width=device-width, initial-scale=1">';
    html = /<head\b[^>]*>/i.test(html) ? html.replace(/<head\b[^>]*>/i, (tag) => tag + viewport) : viewport + html;
  }
  return html;
}

function friendlyError(code: string | undefined, lang: string) {
  const arabic: Record<string, string> = {
    "err.auth": "انتهت جلسة تسجيل الدخول. سجّل دخولك تاني.",
    "err.aiConfig": "بيانات Cloudflare الخاصة بالذكاء الاصطناعي مش متظبطة. راجع CLOUDFLARE_ACCOUNT_ID وCLOUDFLARE_API_TOKEN.",
    "err.coderRate": "وصلت للحد المؤقت لإنشاء المواقع. جرّب بعد شوية.",
    "err.coderPrompt": "اكتب وصف للموقع، وخليه أقل من 6000 حرف.",
    "err.coderRequest": "الطلب مش واضح. جرّب تاني.",
    "err.coderFiles": "ملفات المشروع كبيرة أو فيها صيغة غير مدعومة.",
    "err.coderTooLarge": "الموقع كبير على طلب واحد. قسم التعديل لخطوات أصغر.",
    "err.coderFormat": "الذكاء الاصطناعي رجّع ملفات بصيغة غير متوقعة. جرّب تاني.",
    "err.coderGeneration": "حصلت مشكلة أثناء بناء الموقع. جرّب تاني بعد شوية.",
    "err.aiCredits": "حساب مزود الذكاء الاصطناعي مفيهوش رصيد أو حصة كفاية.",
    "err.aiModel": "موديل إنشاء المواقع مش موجود في إعدادات مزود الذكاء الاصطناعي.",
    "err.aiRequest": "مزود الذكاء الاصطناعي رفض طلب إنشاء الموقع. راجع الوصف أو إعدادات التوليد.",
    "err.aiBusy": "خدمة الذكاء الاصطناعي مشغولة أو غير متاحة مؤقتًا. جرّب بعد شوية.",
    "err.aiNetwork": "XOVA معرفش يتصل بمزود الذكاء الاصطناعي. راجع اتصال السيرفر وجرب تاني.",
    "err.rate": "فيه طلبات كتير على الخدمة. استنى شوية وجرب تاني.",
  };
  const english: Record<string, string> = {
    "err.auth": "Your sign-in session expired. Please sign in again.",
    "err.aiConfig": "Cloudflare AI is not configured. Check CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN on the server.",
    "err.coderRate": "You reached the temporary website-generation limit. Try again later.",
    "err.coderPrompt": "Describe the website in fewer than 6,000 characters.",
    "err.coderRequest": "The request was not clear. Please try again.",
    "err.coderFiles": "The project files are too large or contain an unsupported file type.",
    "err.coderTooLarge": "This project is too large for one request. Split the change into smaller steps.",
    "err.coderFormat": "The AI returned an unexpected file format. Please try again.",
    "err.coderGeneration": "Something went wrong while building the website. Please try again shortly.",
    "err.aiCredits": "The AI provider account has no remaining credits or quota.",
    "err.aiModel": "The website-generation model was not found. Check the configured model name.",
    "err.aiRequest": "The AI provider rejected the website-generation request. Check the prompt or settings.",
    "err.aiBusy": "The AI provider is temporarily busy or unavailable. Please try again shortly.",
    "err.aiNetwork": "XOVA could not connect to the AI provider. Check the server connection and retry.",
    "err.rate": "The service is receiving too many requests. Please wait and try again.",
  };
  return (lang === "ar" ? arabic : english)[code ?? ""] ?? (lang === "ar" ? "حصل خطأ. جرّب تاني." : "Something went wrong. Please try again.");
}

function XovaCoder() {
  const { lang, dir } = useI18n();
  const isArabic = lang === "ar";
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [projects, setProjects] = useState<CoderProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [previewSize, setPreviewSize] = useState<PreviewSize>("desktop");
  const [previewRefresh, setPreviewRefresh] = useState(0);
  const [mobileTab, setMobileTab] = useState<"chat" | "preview">("chat");

  const activeProject = projects.find((project) => project.id === activeProjectId) ?? null;
  const previewHtml = useMemo(
    () => buildPreviewHtml(activeProject?.files ?? []),
    [activeProject?.files],
  );

  useEffect(() => {
    if (!authLoading && !user) void navigate({ to: "/auth", replace: true });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user?.id) return;
    try {
      const raw = window.localStorage.getItem(STORAGE_PREFIX + user.id);
      if (raw) {
        const saved = JSON.parse(raw) as { projects?: CoderProject[]; activeProjectId?: string | null };
        const safeProjects = Array.isArray(saved.projects)
          ? saved.projects.filter((item) =>
              item &&
              typeof item.id === "string" &&
              Array.isArray(item.files) &&
              Array.isArray(item.messages),
            )
          : [];
        setProjects(safeProjects.slice(0, 12));
        setActiveProjectId(
          typeof saved.activeProjectId === "string" && safeProjects.some((project) => project.id === saved.activeProjectId)
            ? saved.activeProjectId
            : safeProjects[0]?.id ?? null,
        );
      } else {
        setProjects([]);
        setActiveProjectId(null);
      }
    } catch {
      setProjects([]);
      setActiveProjectId(null);
    }
    setLoadedUserId(user.id);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || loadedUserId !== user.id) return;
    try {
      window.localStorage.setItem(
        STORAGE_PREFIX + user.id,
        JSON.stringify({ projects, activeProjectId }),
      );
    } catch {
      // The project remains available in the current tab if browser storage is full.
    }
  }, [projects, activeProjectId, loadedUserId, user?.id]);

  const updateProject = (id: string, updater: (project: CoderProject) => CoderProject) => {
    setProjects((current) => current.map((project) => project.id === id ? updater(project) : project));
  };

  const startNewProject = () => {
    const project = createEmptyProject();
    project.name = isArabic ? "موقع جديد" : "New website";
    setProjects((current) => [project, ...current].slice(0, 12));
    setActiveProjectId(project.id);
    setPrompt("");
    setMobileTab("chat");
  };

  const deleteProject = (id: string) => {
    if (busy) return;
    const target = projects.find((project) => project.id === id);
    if (!target) return;

    const confirmed = window.confirm(
      isArabic
        ? `متأكد إنك عايز تحذف مشروع "${target.name}"؟ مش هتقدر ترجع المحادثة والملفات بعد الحذف.`
        : `Delete "${target.name}"? Its chat and files cannot be recovered.`,
    );
    if (!confirmed) return;

    const deletedIndex = projects.findIndex((project) => project.id === id);
    const remaining = projects.filter((project) => project.id !== id);
    setProjects(remaining);

    if (activeProjectId === id) {
      const nextProject = remaining[Math.min(deletedIndex, remaining.length - 1)] ?? null;
      setActiveProjectId(nextProject?.id ?? null);
      setPrompt("");
      setMobileTab("chat");
      setPreviewRefresh((value) => value + 1);
    }
  };

  const submitPrompt = async (event?: FormEvent<HTMLFormElement>, starter?: string) => {
    event?.preventDefault();
    const text = (starter ?? prompt).trim();
    if (!text || busy) return;

    let project = activeProject;
    if (!project) {
      project = createEmptyProject();
      project.name = isArabic ? "موقع جديد" : "New website";
      setProjects((current) => [project!, ...current].slice(0, 12));
      setActiveProjectId(project.id);
    }

    const projectId = project.id;
    const userLine: ChatLine = { id: newId(), role: "user", content: text };
    const requestMessages = [...project.messages, userLine];
    setProjects((current) => {
      const exists = current.some((item) => item.id === projectId);
      if (!exists) return [{ ...project!, messages: requestMessages, updatedAt: new Date().toISOString() }, ...current].slice(0, 12);
      return current.map((item) =>
        item.id === projectId
          ? { ...item, messages: requestMessages, updatedAt: new Date().toISOString() }
          : item,
      );
    });
    setPrompt("");
    setBusy(true);
    setMobileTab("preview");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("err.auth");

      const response = await fetch("/api/coder", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({
          prompt: text,
          projectName: project.name,
          files: project.files,
        }),
      });
      const payload = (await response.json()) as CoderResponse;
      if (!response.ok || !Array.isArray(payload.files)) {
        throw new Error(payload.error ?? "err.coderGeneration");
      }

      const assistantLine: ChatLine = {
        id: newId(),
        role: "assistant",
        content: payload.description || (isArabic ? "تم تحديث الموقع. راجع المعاينة، وتقدر تطلب أي تعديل." : "The website has been updated. Check the preview and ask for any changes."),
      };
      updateProject(projectId, (current) => ({
        ...current,
        name: payload.name || current.name,
        description: payload.description || current.description,
        files: payload.files ?? current.files,
        messages: [...current.messages, assistantLine],
        updatedAt: new Date().toISOString(),
      }));
      setPreviewRefresh((value) => value + 1);
    } catch (error) {
      const code = error instanceof Error ? error.message : "err.coderGeneration";
      const assistantLine: ChatLine = {
        id: newId(),
        role: "assistant",
        content: friendlyError(code, lang),
      };
      updateProject(projectId, (current) => ({
        ...current,
        messages: [...current.messages, assistantLine],
        updatedAt: new Date().toISOString(),
      }));
      setMobileTab("chat");
    } finally {
      setBusy(false);
    }
  };

  const downloadProject = () => {
    if (!activeProject || activeProject.files.length === 0) return;
    const zipBytes = createProjectZip(activeProject.files);
    const buffer = zipBytes.buffer.slice(
      zipBytes.byteOffset,
      zipBytes.byteOffset + zipBytes.byteLength,
    ) as ArrayBuffer;
    const blob = new Blob([buffer], { type: "application/zip" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = (activeProject.name || "xova-website").replace(/[^a-zA-Z0-9-_]+/g, "-") + ".zip";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (authLoading || !user || loadedUserId !== user.id) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </main>
    );
  }

  const fileCount = activeProject?.files.length ?? 0;
  const previewOptions: { id: PreviewSize; label: string; Icon: typeof Monitor }[] = [
    { id: "desktop", label: isArabic ? "كمبيوتر" : "Desktop", Icon: Monitor },
    { id: "tablet", label: isArabic ? "تابلت" : "Tablet", Icon: Tablet },
    { id: "mobile", label: isArabic ? "موبايل" : "Mobile", Icon: Smartphone },
  ];

  return (
    <main dir={dir} className="xv-coder-page flex h-[100dvh] min-h-[560px] flex-col overflow-hidden bg-background text-foreground">
      <header className="xv-coder-header flex shrink-0 items-center gap-3 border-b border-border/70 px-3 py-3 sm:px-5">
        <Link
          to="/"
          aria-label={isArabic ? "العودة إلى XOVA" : "Back to XOVA"}
          className="xv-focus grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-border bg-surface/70 text-muted-foreground transition-colors hover:bg-hover hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand/12 text-brand">
          <Code2 className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold">XOVA Coder</span>
          <span className="block truncate text-[11px] text-muted-foreground">
            {isArabic ? "ابني موقعك بالذكاء الاصطناعي" : "Build a website with AI"}
          </span>
        </span>

        <select
          aria-label={isArabic ? "مشاريعك" : "Your projects"}
          value={activeProjectId ?? ""}
          onChange={(event) => setActiveProjectId(event.target.value || null)}
          className="xv-coder-select hidden max-w-[190px] rounded-lg border border-border bg-surface px-2.5 py-2 text-xs sm:block"
        >
          <option value="">{isArabic ? "مشروع جديد" : "New project"}</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>{project.name}</option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => activeProjectId && deleteProject(activeProjectId)}
          disabled={!activeProjectId || busy}
          aria-label={isArabic ? "حذف المشروع الحالي" : "Delete current project"}
          title={isArabic ? "حذف المشروع الحالي" : "Delete current project"}
          className="xv-focus hidden h-9 w-9 shrink-0 place-items-center rounded-xl border border-border bg-surface/70 text-muted-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-35 sm:inline-grid"
        >
          <Trash2 className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={startNewProject}
          className="xv-focus inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-border bg-surface/70 px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-hover hover:text-foreground"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">{isArabic ? "مشروع جديد" : "New project"}</span>
        </button>
        <button
          type="button"
          onClick={downloadProject}
          disabled={fileCount === 0}
          className="xv-focus inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-brand px-3 text-xs font-semibold text-brand-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Download className="h-4 w-4" />
          <span className="hidden sm:inline">{isArabic ? "تحميل ZIP" : "Export ZIP"}</span>
        </button>
      </header>

      {projects.length > 0 && (
        <div className="xv-coder-mobile-projects flex shrink-0 items-center gap-2 overflow-x-auto px-3 py-2 sm:hidden">
          {projects.map((project) => (
            <div
              key={project.id}
              className={"inline-flex shrink-0 items-center rounded-full border " + (project.id === activeProjectId ? "border-brand/40 bg-brand/10 text-brand" : "border-border text-muted-foreground")}
            >
              <button
                type="button"
                onClick={() => setActiveProjectId(project.id)}
                aria-current={project.id === activeProjectId ? "page" : undefined}
                className="xv-focus rounded-s-full px-3 py-1.5 text-[11px]"
              >
                {project.name}
              </button>
              <button
                type="button"
                onClick={() => deleteProject(project.id)}
                disabled={busy}
                aria-label={isArabic ? `حذف مشروع ${project.name}` : `Delete project ${project.name}`}
                title={isArabic ? "حذف المشروع" : "Delete project"}
                className="xv-focus grid h-7 w-7 place-items-center rounded-e-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-35"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="xv-coder-mobile-tabs grid shrink-0 grid-cols-2 gap-2 px-3 py-2 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileTab("chat")}
          className={"xv-focus rounded-xl border px-3 py-2 text-xs font-semibold " + (mobileTab === "chat" ? "border-brand/35 bg-brand/10 text-brand" : "border-border text-muted-foreground")}
        >
          <Code2 className="me-2 inline h-4 w-4" />{isArabic ? "البناء والمحادثة" : "Build & chat"}
        </button>
        <button
          type="button"
          onClick={() => setMobileTab("preview")}
          className={"xv-focus rounded-xl border px-3 py-2 text-xs font-semibold " + (mobileTab === "preview" ? "border-brand/35 bg-brand/10 text-brand" : "border-border text-muted-foreground")}
        >
          <Eye className="me-2 inline h-4 w-4" />{isArabic ? "معاينة الموقع" : "Live preview"}
        </button>
      </div>

      <div className="xv-coder-workspace grid min-h-0 flex-1 grid-cols-1 gap-3 p-3 lg:grid-cols-[minmax(320px,0.82fr)_minmax(0,1.18fr)] lg:gap-4 lg:p-4">
        <section className={"xv-coder-chat flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border/80 bg-surface/70 " + (mobileTab === "chat" ? "flex" : "hidden lg:flex")}>
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
            <div className="min-w-0">
              <h1 className="truncate text-sm font-bold">{activeProject?.name ?? (isArabic ? "ابدأ موقع جديد" : "Start a new website")}</h1>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {fileCount > 0
                  ? isArabic ? fileCount + " ملفات في المشروع" : fileCount + " project files"
                  : isArabic ? "اكتب فكرتك، وXOVA هيبني الموقع" : "Describe your idea and XOVA will build it"}
              </p>
            </div>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
              <Code2 className="h-4 w-4" />
            </span>
          </div>

          <div className="xv-coder-messages min-h-0 flex-1 overflow-y-auto p-4">
            {!activeProject || activeProject.messages.length === 0 ? (
              <div className="mx-auto flex min-h-full max-w-xl flex-col justify-center">
                <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-brand/20 bg-brand/10 text-brand">
                  <Code2 className="h-7 w-7" />
                </div>
                <h2 className="text-center text-lg font-bold">
                  {isArabic ? "خلّي فكرتك تبقى موقع حقيقي" : "Turn your idea into a real website"}
                </h2>
                <p className="mx-auto mt-2 max-w-md text-center text-xs leading-6 text-muted-foreground">
                  {isArabic
                    ? "احكي لـ XOVA عايز موقع إيه، وهيجهز الملفات ويعرضهولك هنا. بعد كده اطلب أي تعديل."
                    : "Tell XOVA what kind of website you need. It will create the files and show a live preview here. Then ask for any changes."}
                </p>
                <div className="mt-5 grid gap-2">
                  {STARTERS.map((starter) => (
                    <button
                      key={starter.en}
                      type="button"
                      disabled={busy}
                      onClick={() => void submitPrompt(undefined, isArabic ? starter.ar : starter.prompt)}
                      className="xv-coder-starter xv-focus flex items-center gap-3 rounded-xl border border-border/80 bg-background/65 px-3 py-3 text-start text-xs transition-colors hover:border-brand/35 hover:bg-brand/5 disabled:opacity-50"
                    >
                      <FileCode2 className="h-4 w-4 shrink-0 text-brand" />
                      <span className="min-w-0 flex-1">{isArabic ? starter.ar : starter.en}</span>
                      <ArrowLeft className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {activeProject.messages.map((line) => (
                  <article key={line.id} className={"flex gap-2.5 " + (line.role === "user" ? "flex-row-reverse" : "flex-row")}>
                    <span className={"grid h-8 w-8 shrink-0 place-items-center rounded-xl " + (line.role === "assistant" ? "bg-brand/12 text-brand" : "bg-subtle text-muted-foreground")}>
                      {line.role === "assistant" ? <Code2 className="h-4 w-4" /> : <span className="text-[10px] font-bold">{isArabic ? "أنت" : "You"}</span>}
                    </span>
                    <div className={"max-w-[88%] rounded-2xl px-3.5 py-3 text-xs leading-6 " + (line.role === "user" ? "bg-brand text-brand-foreground" : "border border-border/70 bg-background/75 text-foreground")}>
                      {line.content}
                    </div>
                  </article>
                ))}
                {busy && (
                  <div className="flex items-center gap-2 rounded-xl border border-brand/20 bg-brand/5 px-3 py-3 text-xs text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin text-brand" />
                    {isArabic ? "XOVA بيبني الموقع وبيجهز الملفات..." : "XOVA is building your website and preparing its files..."}
                  </div>
                )}
              </div>
            )}
          </div>

          <form onSubmit={(event) => void submitPrompt(event)} className="shrink-0 border-t border-border/70 p-3">
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              rows={3}
              maxLength={6000}
              placeholder={isArabic ? "اوصف الموقع أو التعديل اللي عايزه بالتفصيل..." : "Describe the website or the change you want..."}
              className="xv-focus w-full resize-y rounded-xl border border-border bg-background/80 px-3.5 py-3 text-xs leading-6 outline-none placeholder:text-muted-foreground focus:border-brand/50"
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-[10px] text-muted-foreground">
                {isArabic ? "كل طلب بيعدّل نفس المشروع" : "Each request updates the same project"}
              </span>
              <button
                type="submit"
                disabled={busy || !prompt.trim()}
                className="xv-focus inline-flex h-9 items-center gap-2 rounded-xl bg-brand px-3.5 text-xs font-semibold text-brand-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {isArabic ? "نفّذ" : "Build"}
              </button>
            </div>
          </form>
        </section>

        <section className={"xv-coder-preview flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border/80 bg-surface/55 " + (mobileTab === "preview" ? "flex" : "hidden lg:flex")}>
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border/70 px-3 py-3 sm:px-4">
            <div className="me-auto flex min-w-0 items-center gap-2">
              <Eye className="h-4 w-4 shrink-0 text-brand" />
              <span className="truncate text-xs font-bold">{isArabic ? "معاينة الموقع" : "Website preview"}</span>
              {fileCount > 0 && <span className="rounded-full bg-brand/10 px-2 py-1 text-[10px] text-brand">{fileCount} {isArabic ? "ملفات" : "files"}</span>}
            </div>
            <div className="flex items-center gap-1 rounded-xl border border-border bg-background/75 p-1">
              {previewOptions.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPreviewSize(id)}
                  aria-pressed={previewSize === id}
                  title={label}
                  className={"xv-focus grid h-8 grid-cols-[auto_auto] place-items-center gap-1 rounded-lg px-2 text-[10px] " + (previewSize === id ? "bg-brand/12 text-brand" : "text-muted-foreground hover:bg-hover")}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden xl:inline">{label}</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setPreviewRefresh((value) => value + 1)}
              disabled={!previewHtml}
              aria-label={isArabic ? "تحديث المعاينة" : "Refresh preview"}
              title={isArabic ? "تحديث المعاينة" : "Refresh preview"}
              className="xv-focus grid h-8 w-8 place-items-center rounded-lg border border-border bg-background/75 text-muted-foreground hover:bg-hover disabled:opacity-40"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="xv-coder-preview-stage flex min-h-0 flex-1 items-stretch justify-center overflow-auto p-2.5 sm:p-4">
            {previewHtml ? (
              <div
                className={"xv-coder-device flex min-h-0 flex-1 flex-col overflow-hidden border border-border/80 bg-white shadow-xl " + (previewSize === "mobile" ? "is-mobile" : previewSize === "tablet" ? "is-tablet" : "is-desktop")}
                style={{
                  width: previewSize === "mobile" ? "390px" : previewSize === "tablet" ? "820px" : "100%",
                  maxWidth: "100%",
                }}
              >
                <iframe
                  key={previewRefresh + "-" + activeProjectId + "-" + previewSize}
                  title={isArabic ? "معاينة الموقع الذي أنشأته" : "Generated website preview"}
                  srcDoc={previewHtml}
                  sandbox="allow-scripts allow-forms allow-modals"
                  referrerPolicy="no-referrer"
                  className="h-full min-h-[320px] w-full flex-1 border-0 bg-white"
                />
              </div>
            ) : (
              <div className="flex min-h-[320px] w-full flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-background/45 px-6 text-center">
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-brand/10 text-brand">
                  <Laptop className="h-7 w-7" />
                </div>
                <h2 className="mt-4 text-sm font-bold">{isArabic ? "المعاينة هتظهر هنا" : "Your preview will appear here"}</h2>
                <p className="mt-2 max-w-sm text-xs leading-6 text-muted-foreground">
                  {isArabic ? "اكتب وصف الموقع في الناحية التانية واضغط نفّذ. هتشوف النتيجة هنا." : "Describe your website in the other panel and press Build. The result will show here."}
                </p>
                <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-surface/75 px-3 py-1.5 text-[10px] text-muted-foreground">
                  <FolderOpen className="h-3.5 w-3.5" />
                  {isArabic ? "ملفات المشروع هتتجمع تلقائيًا" : "Project files are collected automatically"}
                </div>
              </div>
            )}
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border/70 px-3 py-2.5 sm:px-4">
            <div className="flex min-w-0 items-center gap-2 text-[10px] text-muted-foreground">
              {fileCount > 0 ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <FileCode2 className="h-3.5 w-3.5" />}
              <span>{fileCount > 0 ? (isArabic ? "المشروع جاهز للمعاينة والتصدير" : "Ready to preview and export") : (isArabic ? "لسه مفيش ملفات" : "No project files yet")}</span>
            </div>
            {fileCount > 0 && (
              <details className="xv-coder-file-list relative">
                <summary className="xv-focus cursor-pointer list-none rounded-lg border border-border bg-background/75 px-3 py-1.5 text-[10px] text-muted-foreground hover:text-foreground">
                  <FileText className="me-1.5 inline h-3.5 w-3.5" />{isArabic ? "ملفات المشروع" : "Project files"}
                </summary>
                <div className="absolute bottom-full end-0 z-20 mb-2 max-h-52 w-64 overflow-y-auto rounded-xl border border-border bg-surface p-2 shadow-xl">
                  {activeProject?.files.map((file) => (
                    <div key={file.path} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[10px] text-muted-foreground">
                      <FileCode2 className="h-3.5 w-3.5 shrink-0 text-brand" />
                      <span className="truncate">{file.path}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
