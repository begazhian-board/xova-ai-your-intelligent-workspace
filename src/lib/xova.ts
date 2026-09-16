/**
 * XOVA AI shared domain model: modes, personalities, response styles and types.
 * Model routing lives on the server (src/routes/api/chat.ts); the UI only ever
 * exposes the MODE, never provider names or credentials.
 */

export type ModeId = "instant" | "reasoning" | "research" | "vision" | "coding" | "engineering";

export interface ModeDef {
  id: ModeId;
  /** i18n key suffix */
  key: string;
  icon: string;
}

export const MODES: ModeDef[] = [
  { id: "instant", key: "instant", icon: "zap" },
  { id: "reasoning", key: "reasoning", icon: "brain" },
  { id: "research", key: "research", icon: "globe" },
  { id: "vision", key: "vision", icon: "eye" },
  { id: "coding", key: "coding", icon: "code" },
  { id: "engineering", key: "engineering", icon: "sigma" },
];

export type PersonalityId =
  | "friendly"
  | "professional"
  | "funny"
  | "formal"
  | "technical"
  | "creative"
  | "short"
  | "detailed"
  | "custom";

export const PERSONALITIES: PersonalityId[] = [
  "friendly",
  "professional",
  "funny",
  "formal",
  "technical",
  "creative",
  "short",
  "detailed",
  "custom",
];

export type ResponseStyleId = "concise" | "balanced" | "detailed";
export const RESPONSE_STYLES: ResponseStyleId[] = ["concise", "balanced", "detailed"];

export type ThemeChoice = "dark" | "light" | "system";
export type LanguageId = "en" | "ar";

export interface Attachment {
  id: string;
  name: string;
  mime: string;
  size: number;
  kind: "image" | "text" | "data" | "unsupported";
  /** data URL for images, extracted text for text/data files */
  dataUrl?: string;
  text?: string;
}

export interface SourceRef {
  title: string;
  url: string;
  snippet?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachments: Attachment[];
  sources: SourceRef[];
  imageUrl?: string | null;
  mode?: ModeId | null;
  createdAt: string;
  /** local-only flags */
  streaming?: boolean;
  failed?: boolean;
}

export const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;

export const IMAGE_MIME = /^image\/(png|jpe?g|webp|gif|avif)$/i;

export const TEXT_LIKE =
  /(^text\/)|(json|csv|xml|yaml|markdown|javascript|typescript|x-python|x-sh|x-c|x-java)/i;

export function classifyFile(file: File): Attachment["kind"] {
  if (IMAGE_MIME.test(file.type)) return "image";
  if (TEXT_LIKE.test(file.type)) return "text";
  if (/\.(txt|md|csv|json|ts|tsx|js|jsx|py|css|html|sql|yml|yaml|log)$/i.test(file.name))
    return "text";
  if (/\.csv$/i.test(file.name)) return "data";
  return "unsupported";
}

export function newId() {
  return globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random()}`;
}

export function conversationTitle(messages: ChatMessage[]) {
  const first = messages.find((m) => m.role === "user" && m.content.trim().length > 0);
  if (!first) return null;
  const line = first.content.trim().split("\n")[0];
  return line.length > 48 ? `${line.slice(0, 48).trimEnd()}…` : line;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
