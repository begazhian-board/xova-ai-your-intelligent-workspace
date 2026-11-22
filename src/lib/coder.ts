/** XOVA Coder shared, browser-safe helpers: file protocol parsing, review, preview, storage. */

export interface CoderFile {
  path: string;
  content: string;
}

export interface CoderTurn {
  role: "user" | "assistant";
  text: string;
}

export interface CoderProject {
  id: string;
  title: string;
  files: CoderFile[];
  history: CoderTurn[];
  updatedAt: string;
}

export const FILE_OPEN = /^<<<FILE\s+([^>\s]+)\s*>>>\s*$/;
export const FILE_CLOSE = /^<<<END>>>\s*$/;
export const SUMMARY_OPEN = /^<<<SUMMARY>>>\s*$/;
export const ERROR_MARK = /<<<XOVA_ERROR:([a-zA-Z.]+)>>>/;

const SAFE_PATH = /^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,80}$/;

/** Strips an accidental markdown fence the model may wrap around a file body. */
function unfence(body: string) {
  const trimmed = body.replace(/^\s*\n/, "").replace(/\s+$/, "");
  const m = trimmed.match(/^```[a-zA-Z]*\n([\s\S]*?)\n```$/);
  return (m ? m[1]! : trimmed) + "\n";
}

/** Parses the `<<<FILE path>>> … <<<END>>>` protocol. Tolerates a missing final END. */
export function parseCoderOutput(raw: string): { files: CoderFile[]; summary: string } {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const files: CoderFile[] = [];
  let current: { path: string; body: string[] } | null = null;
  let summary: string[] | null = null;
  for (const line of lines) {
    const open = line.match(FILE_OPEN);
    if (open) {
      if (current) files.push({ path: current.path, content: unfence(current.body.join("\n")) });
      current = { path: open[1]!.replace(/^\.?\//, ""), body: [] };
      summary = null;
      continue;
    }
    if (current && FILE_CLOSE.test(line)) {
      files.push({ path: current.path, content: unfence(current.body.join("\n")) });
      current = null;
      continue;
    }
    if (!current && SUMMARY_OPEN.test(line)) {
      summary = [];
      continue;
    }
    if (current) current.body.push(line);
    else if (summary) summary.push(line);
  }
  if (current && current.body.join("").trim()) {
    files.push({ path: current.path, content: unfence(current.body.join("\n")) });
  }
  const valid = files.filter((f) => SAFE_PATH.test(f.path) && !f.path.includes(".."));
  return { files: valid, summary: (summary ?? []).join("\n").trim() };
}

/** Applies updated files over the existing set (edits return only changed files). */
export function mergeFiles(base: CoderFile[], updates: CoderFile[]) {
  const map = new Map(base.map((f) => [f.path, f]));
  for (const f of updates) map.set(f.path, f);
  return [...map.values()].sort((a, b) =>
    a.path === "index.html" ? -1 : b.path === "index.html" ? 1 : a.path.localeCompare(b.path),
  );
}

export interface ReviewIssue {
  level: "error" | "warn";
  key: string;
  detail: string;
}

/** Real static review of the generated files: missing assets, broken links, mobile basics, handlers. */
export function reviewProject(files: CoderFile[]): ReviewIssue[] {
  const issues: ReviewIssue[] = [];
  const paths = new Set(files.map((f) => f.path));
  const html = files.filter((f) => f.path.endsWith(".html"));
  if (!paths.has("index.html")) issues.push({ level: "error", key: "noIndex", detail: "index.html" });
  for (const page of html) {
    const c = page.content;
    if (!/<meta[^>]+name=["']viewport["']/i.test(c))
      issues.push({ level: "warn", key: "noViewport", detail: page.path });
    if (!/<title>[^<]+<\/title>/i.test(c)) issues.push({ level: "warn", key: "noTitle", detail: page.path });
    const refs = [...c.matchAll(/(?:href|src)=["']([^"'#?]+)[^"']*["']/gi)].map((m) => m[1]!);
    for (const ref of refs) {
      if (/^(https?:|mailto:|tel:|data:|\/\/|javascript:)/i.test(ref)) continue;
      const clean = ref.replace(/^\.?\//, "");
      if (clean && !paths.has(clean)) issues.push({ level: "error", key: "missingFile", detail: `${page.path} → ${ref}` });
    }
    const anchors = [...c.matchAll(/href=["']#([^"']+)["']/gi)].map((m) => m[1]!);
    for (const id of anchors) {
      if (!new RegExp(`id=["']${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`).test(c))
        issues.push({ level: "warn", key: "brokenAnchor", detail: `${page.path} → #${id}` });
    }
    const imgsNoAlt = (c.match(/<img(?![^>]*\balt=)[^>]*>/gi) ?? []).length;
    if (imgsNoAlt) issues.push({ level: "warn", key: "imgAlt", detail: `${page.path} (${imgsNoAlt})` });
  }
  const js = files.filter((f) => f.path.endsWith(".js")).map((f) => f.content).join("\n");
  const allHtml = html.map((f) => f.content).join("\n");
  for (const m of js.matchAll(/getElementById\(\s*["']([^"']+)["']\s*\)/g)) {
    if (!new RegExp(`id=["']${m[1]}["']`).test(allHtml))
      issues.push({ level: "error", key: "jsMissingId", detail: `#${m[1]}` });
  }
  const css = files.filter((f) => f.path.endsWith(".css")).map((f) => f.content).join("\n");
  if (css && !/@media/i.test(css) && !/<style[\s\S]*@media/i.test(allHtml))
    issues.push({ level: "warn", key: "noMedia", detail: "CSS" });
  return issues;
}

/** Builds a self-contained srcdoc for the preview iframe by inlining local CSS/JS. */
export function buildPreviewDoc(files: CoderFile[], page = "index.html") {
  const byPath = new Map(files.map((f) => [f.path, f.content]));
  let doc = byPath.get(page) ?? byPath.get("index.html") ?? "";
  doc = doc.replace(/<link([^>]*?)href=["'](?!https?:|\/\/)\.?\/?([^"']+\.css)["']([^>]*)>/gi, (all, _a, href) => {
    const css = byPath.get(href);
    return css !== undefined ? `<style data-file="${href}">\n${css}\n</style>` : all;
  });
  doc = doc.replace(
    /<script([^>]*?)src=["'](?!https?:|\/\/)\.?\/?([^"']+\.js)["']([^>]*)><\/script>/gi,
    (all, _a, src) => {
      const js = byPath.get(src);
      return js !== undefined ? `<script data-file="${src}">\n${js.replace(/<\/script/gi, "<\\/script")}\n</script>` : all;
    },
  );
  return doc;
}

const STORAGE_KEY = "xova.coder.projects.v1";

export function loadProjects(): CoderProject[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CoderProject[]) : [];
  } catch {
    return [];
  }
}

export function saveProjects(projects: CoderProject[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects.slice(0, 20)));
    return true;
  } catch {
    return false;
  }
}
