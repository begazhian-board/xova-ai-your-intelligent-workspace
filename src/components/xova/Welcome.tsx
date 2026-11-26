import {
  ArrowUpRight,
  BrainCircuit,
  Code2,
  Image as ImageIcon,
  Lightbulb,
  MessageCircle,
  PanelsTopLeft,
  Search,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { XovaMark } from "./Logo";
import { useI18n } from "@/lib/i18n";

export function Welcome({
  onPick,
  displayName,
}: {
  onPick: (text: string) => void;
  displayName?: string | null;
}) {
  const { lang, dir } = useI18n();
  const preferredName = displayName?.trim();
  const greeting =
    lang === "ar"
      ? preferredName
        ? "أهلاً يا " + preferredName
        : "أهلاً بيك"
      : preferredName
        ? "Welcome, " + preferredName
        : "Welcome to";

  const tools = [
    {
      Icon: ImageIcon,
      title: lang === "ar" ? "استوديو الصور" : "Image studio",
      description: lang === "ar" ? "حوّل أفكارك لصور مميزة" : "Turn ideas into images",
      action: "link-images",
      tone: "image",
    },
    {
      Icon: Lightbulb,
      title: lang === "ar" ? "تخيّل ما تحب" : "Imagine anything",
      description: lang === "ar" ? "أفكار جديدة من غير حدود" : "Fresh ideas without limits",
      action: "ideas",
      tone: "ideas",
    },
    {
      Icon: Code2,
      title: lang === "ar" ? "مساعد برمجي" : "Coding assistant",
      description: lang === "ar" ? "اكتب وراجع الكود" : "Write and review code",
      action: "code",
      tone: "code",
    },
    {
      Icon: BrainCircuit,
      title: lang === "ar" ? "اشرح أي حاجة" : "Explain anything",
      description: lang === "ar" ? "شرح بسيط وأمثلة مفهومة" : "Clear answers and examples",
      action: "explain",
      tone: "explain",
    },
    {
      Icon: Search,
      title: lang === "ar" ? "ابحث عن معلومات" : "Search the web",
      description: lang === "ar" ? "معلومات مفيدة على الإنترنت" : "Find useful information online",
      action: "search",
      tone: "search",
    },
    {
      Icon: PanelsTopLeft,
      title: lang === "ar" ? "صمّم موقع ويب" : "Build a website",
      description: lang === "ar" ? "ابدأ مشروعك مع XOVA Coder" : "Start a project with XOVA Coder",
      action: "link-coder",
      tone: "coder",
    },
  ] as const;

  const prompts: Record<string, string> = {
    ideas:
      lang === "ar"
        ? "ساعدني أبتكر أفكارًا جديدة ومميزة عن: "
        : "Help me brainstorm fresh and original ideas about: ",
    code:
      lang === "ar"
        ? "ساعدني في كتابة أو مراجعة الكود التالي: "
        : "Help me write or review this code: ",
    explain:
      lang === "ar"
        ? "اشرح لي الموضوع ده ببساطة وبأمثلة واضحة: "
        : "Explain this topic simply with clear examples: ",
    search:
      lang === "ar"
        ? "ابحث على الإنترنت عن معلومات حديثة وموثوقة حول: "
        : "Search the web for recent, reliable information about: ",
  };

  return (
    <div
      dir={dir}
      className="xv-welcome xv-home-dashboard mx-auto flex w-full max-w-6xl flex-1 flex-col gap-7 px-4 py-6 sm:px-6 sm:py-8 xl:px-8"
    >
      <section className="xv-home-hero relative flex min-h-[330px] items-center justify-between gap-5 overflow-hidden rounded-[2rem] px-6 py-8 sm:px-9 lg:px-11">
        <div className="xv-home-hero-copy relative z-10 max-w-2xl">
          <span className="xv-home-badge mb-5 inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-semibold">
            <MessageCircle className="h-3.5 w-3.5" />
            {lang === "ar" ? "مساحة عملك الذكية" : "YOUR INTELLIGENT WORKSPACE"}
          </span>
          <h1 className="xv-home-title text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl xl:text-5xl">
            <span className="block">{greeting}</span>
            <span className="xv-gradient-text block">XOVA</span>
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">
            {lang === "ar"
              ? "ابدأ رحلتك مع الذكاء الاصطناعي بطريقة أسهل وأذكى."
              : "Your ideas, tools, and AI workspace — all in one place."}
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() =>
                onPick(
                  lang === "ar"
                    ? "خلينا نبدأ محادثة جديدة. أريد مساعدتك في: "
                    : "Let's start a new conversation. I need help with: ",
                )
              }
              className="xv-home-primary-action xv-focus inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold"
            >
              <MessageCircle className="h-4 w-4" />
              {lang === "ar" ? "ابدأ محادثة" : "Start chatting"}
              <ArrowUpRight className="h-4 w-4" />
            </button>
            <Link
              to="/images"
              className="xv-home-secondary-action xv-focus inline-flex items-center gap-2 rounded-xl border px-5 py-3 text-sm font-semibold transition-colors"
            >
              <ImageIcon className="h-4 w-4" />
              {lang === "ar" ? "استوديو الصور" : "Image studio"}
            </Link>
          </div>
        </div>

        <div className="xv-home-art relative z-10 shrink-0" aria-hidden="true">
          <span className="xv-home-orbit xv-home-orbit-one" />
          <span className="xv-home-orbit xv-home-orbit-two" />
          <span className="xv-home-art-glow" />
          <XovaMark className="xv-home-art-mark" />
          <span className="xv-home-float-icon xv-home-float-one">
            <ImageIcon className="h-5 w-5" />
          </span>
          <span className="xv-home-float-icon xv-home-float-three">
            <BrainCircuit className="h-5 w-5" />
          </span>
        </div>
      </section>

      <section aria-labelledby="xv-home-tools-title" className="xv-home-tools-section">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <span className="xv-home-section-kicker block text-[10px] font-bold uppercase tracking-[0.18em]">
              {lang === "ar" ? "ابدأ من هنا" : "GET STARTED"}
            </span>
            <h2 id="xv-home-tools-title" className="mt-1 text-lg font-bold sm:text-xl">
              {lang === "ar" ? "اكتشف إمكانيات XOVA" : "Explore what XOVA can do"}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {lang === "ar" ? "اختار الأداة المناسبة وابدأ على طول" : "Choose a tool and jump right in"}
            </p>
          </div>
          <span className="xv-home-tools-mark hidden h-10 w-10 place-items-center rounded-xl sm:grid">
            <PanelsTopLeft className="h-5 w-5" />
          </span>
        </div>

        <div className="xv-home-tools-grid grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {tools.map(({ Icon, title, description, action, tone }) => {
            const content = (
              <>
                <span className={`xv-home-tool-icon xv-home-tool-icon-${tone}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold">{title}</span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                    {description}
                  </span>
                </span>
                <span className="xv-home-tool-arrow grid h-8 w-8 shrink-0 place-items-center rounded-full">
                  <ArrowUpRight className="h-4 w-4" />
                </span>
              </>
            );

            if (action === "link-images") {
              return (
                <Link
                  key={action}
                  to="/images"
                  className={`xv-home-tool-card xv-home-tool-${tone} xv-focus group flex min-h-[126px] items-center gap-3 rounded-2xl border p-4 text-start transition-all`}
                >
                  {content}
                </Link>
              );
            }

            if (action === "link-coder") {
              return (
                <Link
                  key={action}
                  to="/coder"
                  className={`xv-home-tool-card xv-home-tool-${tone} xv-focus group flex min-h-[126px] items-center gap-3 rounded-2xl border p-4 text-start transition-all`}
                >
                  {content}
                </Link>
              );
            }

            return (
              <button
                key={action}
                type="button"
                onClick={() => onPick(prompts[action])}
                className={`xv-home-tool-card xv-home-tool-${tone} xv-focus group flex min-h-[126px] w-full items-center gap-3 rounded-2xl border p-4 text-start transition-all`}
              >
                {content}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
