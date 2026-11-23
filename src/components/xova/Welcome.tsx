import {
  ArrowUpRight,
  Clock3,
  Code2,
  FileSearch,
  FileText,
  Image as ImageIcon,
  Lightbulb,
  MessageCircle,
  LayoutGrid,
  Palette,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { XovaMark } from "./Logo";
import { useI18n } from "@/lib/i18n";
import type { ConversationSummary } from "@/hooks/useConversation";

export function Welcome({
  onPick,
  displayName,
  conversations,
  onSelectConversation,
}: {
  onPick: (text: string) => void;
  displayName?: string | null;
  conversations: ConversationSummary[];
  onSelectConversation: (id: string) => void;
}) {
  const { t, lang, dir } = useI18n();
  const preferredName = displayName?.trim();
  const greeting = preferredName
    ? lang === "ar"
      ? "أهلاً يا " + preferredName + "، نبدأ بإيه النهارده؟"
      : "Welcome, " + preferredName + ". What shall we work on?"
    : t("welcome.greeting");

  const recentConversations = conversations.slice(0, 4);
  const formatDate = (value: string | number) =>
    new Date(value).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US", {
      month: "short",
      day: "numeric",
    });

  return (
    <div
      dir={dir}
      className="xv-welcome xv-home-dashboard mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8 xl:px-8"
    >
      <section className="xv-home-hero relative flex min-h-[220px] items-center justify-between gap-4 rounded-[1.75rem] px-5 py-7 sm:px-8 lg:min-h-[250px] lg:px-10">
        <div className="xv-home-hero-copy relative z-10 max-w-2xl">
          <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand/25 bg-brand/10 px-3 py-1.5 text-xs font-semibold text-brand">
            <MessageCircle className="h-3.5 w-3.5" />
            {lang === "ar" ? "مساحة عملك الذكية" : "Your intelligent workspace"}
          </span>
          <h1 className="xv-gradient-text text-2xl font-bold leading-tight tracking-tight sm:text-4xl">
            {greeting}
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">
            {lang === "ar"
              ? "اسأل، ابتكر، حلّل، وأنجز شغلك كله من مساحة واحدة."
              : "Ask, create, analyze, and get your work done in one focused space."}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() =>
                onPick(
                  lang === "ar"
                    ? "ساعدني أبدأ مهمة جديدة، واسألني عن التفاصيل اللي تحتاجها."
                    : "Help me start a new task and ask for any details you need.",
                )
              }
              className="xv-home-primary-action xv-focus inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold"
            >
              <MessageCircle className="h-4 w-4" />
              {lang === "ar" ? "ابدأ محادثة" : "Start a chat"}
              <ArrowUpRight className="h-4 w-4" />
            </button>
            <Link
              to="/images"
              className="xv-home-secondary-action xv-focus inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors"
            >
              <ImageIcon className="h-4 w-4" />
              {lang === "ar" ? "استوديو الصور" : "Image studio"}
            </Link>
          </div>
        </div>

        <div className="xv-home-art hidden shrink-0 lg:grid" aria-hidden="true">
          <span className="xv-home-orbit xv-home-orbit-one" />
          <span className="xv-home-orbit xv-home-orbit-two" />
          <span className="xv-home-art-glow" />
          <XovaMark className="xv-home-art-mark" />
          <span className="xv-home-float-icon xv-home-float-one"><ImageIcon className="h-5 w-5" /></span>
          <span className="xv-home-float-icon xv-home-float-three"><Lightbulb className="h-5 w-5" /></span>
        </div>
      </section>

      <section aria-labelledby="xv-home-tools-title">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 id="xv-home-tools-title" className="text-base font-bold sm:text-lg">
              {lang === "ar" ? "أدوات سريعة" : "Quick tools"}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {lang === "ar" ? "اختار نقطة البداية المناسبة ليك" : "Choose a place to get started"}
            </p>
          </div>
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand/10 text-brand">
            <LayoutGrid className="h-4.5 w-4.5" />
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <button
            type="button"
            onClick={() =>
              onPick(lang === "ar" ? "اشرح لي الموضوع ده ببساطة وبأمثلة واضحة: " : "Explain this topic simply with clear examples: ")
            }
            className="xv-home-tool-card xv-focus group flex min-h-[116px] items-center gap-3 rounded-2xl border p-4 text-start transition-all"
          >
            <span className="xv-home-tool-icon"><Lightbulb className="h-5 w-5" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold">{lang === "ar" ? "اشرح أي حاجة" : "Explain anything"}</span>
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">{lang === "ar" ? "شرح بسيط وأمثلة مفهومة" : "Clear answers and examples"}</span>
            </span>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </button>

          <button
            type="button"
            onClick={() =>
              onPick(lang === "ar" ? "ساعدني في كتابة أو مراجعة الكود التالي: " : "Help me write or review this code: ")
            }
            className="xv-home-tool-card xv-focus group flex min-h-[116px] items-center gap-3 rounded-2xl border p-4 text-start transition-all"
          >
            <span className="xv-home-tool-icon"><Code2 className="h-5 w-5" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold">{lang === "ar" ? "مساعد برمجي" : "Coding assistant"}</span>
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">{lang === "ar" ? "اكتب وراجع الكود" : "Write and review code"}</span>
            </span>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </button>

          <button
            type="button"
            onClick={() =>
              onPick(lang === "ar" ? "هرفق ملف، حلّله واستخرج أهم المعلومات والنقاط: " : "I'll attach a file. Analyze it and extract the key information: ")
            }
            className="xv-home-tool-card xv-focus group flex min-h-[116px] items-center gap-3 rounded-2xl border p-4 text-start transition-all"
          >
            <span className="xv-home-tool-icon"><FileSearch className="h-5 w-5" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold">{lang === "ar" ? "تحليل ملف" : "Analyze a file"}</span>
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">{lang === "ar" ? "ارفق ملفك وابدأ التحليل" : "Attach a file and analyze it"}</span>
            </span>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </button>

          <Link
            to="/images"
            className="xv-home-tool-card xv-focus group flex min-h-[116px] items-center gap-3 rounded-2xl border p-4 text-start transition-all"
          >
            <span className="xv-home-tool-icon"><ImageIcon className="h-5 w-5" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold">{lang === "ar" ? "استوديو الصور" : "Image studio"}</span>
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">{lang === "ar" ? "حوّل أفكارك لصور" : "Turn your ideas into images"}</span>
            </span>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="xv-home-panel rounded-2xl border p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold">
                {lang === "ar" ? "آخر محادثاتك" : "Recent conversations"}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {lang === "ar" ? "ارجع لأي محادثة وكمل من مكان ما وقفت" : "Pick up where you left off"}
              </p>
            </div>
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand/10 text-brand">
              <Clock3 className="h-4.5 w-4.5" />
            </span>
          </div>

          {recentConversations.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {recentConversations.map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => onSelectConversation(conversation.id)}
                  className="xv-home-recent-row xv-focus flex min-w-0 items-center gap-3 rounded-xl border px-3 py-3 text-start transition-colors"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
                    <MessageCircle className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold">
                      {conversation.title || (lang === "ar" ? "محادثة جديدة" : "New conversation")}
                    </span>
                    <span className="mt-1 block text-[11px] text-muted-foreground">
                      {formatDate(conversation.updatedAt)}
                    </span>
                  </span>
                  <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          ) : (
            <div className="flex min-h-[118px] flex-col items-center justify-center rounded-xl border border-dashed px-4 py-5 text-center">
              <MessageCircle className="h-6 w-6 text-brand/70" />
              <p className="mt-2 text-xs text-muted-foreground">
                {lang === "ar" ? "لسه مفيش محادثات. ابدأ أول واحدة دلوقتي." : "No conversations yet. Start your first one."}
              </p>
            </div>
          )}
        </div>

        <div className="xv-home-studio-panel relative flex min-h-[210px] flex-col justify-between overflow-hidden rounded-2xl border p-5 sm:p-6">
          <div className="xv-home-studio-glow" aria-hidden="true" />
          <div className="relative z-10 flex items-start justify-between gap-3">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand/10 px-2.5 py-1 text-[11px] font-semibold text-brand">
                <Palette className="h-3.5 w-3.5" />
                {lang === "ar" ? "مساحة الإبداع" : "Creative space"}
              </span>
              <h2 className="mt-3 text-lg font-bold">
                {lang === "ar" ? "استوديو الصور" : "Image studio"}
              </h2>
              <p className="mt-1 max-w-xs text-xs leading-6 text-muted-foreground">
                {lang === "ar" ? "حوّل وصفك إلى صورة، وراجع إبداعاتك من مكان واحد." : "Turn a prompt into an image and revisit your creations in one place."}
              </p>
            </div>
            <span className="xv-home-studio-mark grid h-14 w-14 shrink-0 place-items-center rounded-2xl">
              <ImageIcon className="h-7 w-7" />
            </span>
          </div>
          <div className="relative z-10 mt-5 flex flex-wrap items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <FileText className="h-3.5 w-3.5" />
              {lang === "ar" ? "معاينة الصور وإدارتها" : "Preview and manage images"}
            </span>
            <Link
              to="/images"
              className="xv-home-primary-action xv-focus inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold"
            >
              {lang === "ar" ? "افتح الاستوديو" : "Open studio"}
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
