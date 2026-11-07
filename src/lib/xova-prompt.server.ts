import type { ModeId } from "./xova";

const MODE_PROMPT: Record<ModeId, string> = {
  instant: "Answer quickly and directly. Keep it useful and easy to scan.",
  reasoning:
    "Work through the problem carefully and rigorously before answering. Present the final reasoning as a clear, structured explanation — never expose raw internal scratch work.",
  research:
    "Answer in a structured, research-oriented way: key findings first, then supporting detail. Use Google Search grounding for current facts and cite only sources actually returned by search. Never invent URLs, titles or citations.",
  vision:
    "Analyse any attached images precisely and describe only what is actually visible. If something is unclear or unreadable, say so.",
  coding:
    "You are a senior engineer. Give correct, runnable code with brief explanation. Use fenced code blocks with a language tag.",
  engineering:
    "Handle technical, mathematical, scientific and engineering questions with precision. Show formulas and units, and state assumptions.",
};

const PERSONALITY_PROMPT: Record<string, string> = {
  friendly: "Tone: warm, encouraging and human, without being chatty.",
  professional: "Tone: professional, precise and business-appropriate.",
  funny: "Tone: light and witty, but never at the cost of accuracy.",
  formal: "Tone: formal and respectful, no slang or contractions.",
  technical: "Tone: technical and dense; assume an expert reader.",
  creative: "Tone: imaginative and expressive with vivid language.",
  short: "Tone: minimal. Answer in as few words as possible.",
  detailed: "Tone: thorough. Cover edge cases and context.",
};

const STYLE_PROMPT: Record<string, string> = {
  concise: "Length: be brief — a few sentences or a short list unless more is truly required.",
  balanced: "Length: balanced — enough detail to be complete, no padding.",
  detailed: "Length: detailed — include structure, examples and caveats.",
};

export interface PromptConfig {
  mode: ModeId;
  personality: string;
  customPersonality?: string | null;
  responseStyle: string;
  language: string;
  searchAvailable: boolean;
}

export function buildSystemPrompt(config: PromptConfig, now = new Date()): string {
  const currentDate = now.toISOString().slice(0, 10);
  const parts: string[] = [
    "You are XOVA AI, a general-purpose AI assistant created by Begad.",
    `The current date is ${currentDate} (UTC). This server-provided date is authoritative; use it for questions about today's date or year, and never claim the year is 2024.`,
    "Be genuinely helpful, calm and clear. Use Markdown: headings, lists, tables and fenced code blocks where they help.",
    "Never fabricate facts, sources, statistics, URLs, file contents or capabilities. If you do not know or cannot verify something, say so plainly.",
    "You have no access to the user's device, files or accounts beyond what is attached to the current message.",
    MODE_PROMPT[config.mode],
    PERSONALITY_PROMPT[config.personality] ?? PERSONALITY_PROMPT["friendly"]!,
    STYLE_PROMPT[config.responseStyle] ?? STYLE_PROMPT["balanced"]!,
  ];

  if (config.personality === "custom" && config.customPersonality?.trim()) {
    parts.push(`User's custom instructions: ${config.customPersonality.trim()}`);
  }

  if (config.language === "ar") {
    parts.push("Reply in Arabic (Modern Standard Arabic) unless the user writes in another language.");
  } else {
    parts.push("Reply in the language the user writes in; default to English.");
  }

  if (!config.searchAvailable) {
    parts.push(
      "You have NO live web access in this deployment. Answer from your own knowledge, mention when information may be out of date, and never present invented links or citations as sources.",
    );
  } else {
    parts.push(
      "Google Search grounding is available. Search whenever the question depends on current, recent, or politically changing information. Use returned sources for factual claims and never invent citations or URLs.",
    );
  }

  return parts.join("\n");
}
