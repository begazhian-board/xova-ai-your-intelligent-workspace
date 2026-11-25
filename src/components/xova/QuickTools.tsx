import {
  ArrowUpRight,
  Code2,
  FileSearch,
  Image as ImageIcon,
  Lightbulb,
  Zap,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";

interface QuickToolsProps {
  onPick: (text: string) => void;
}

export function QuickTools({ onPick }: QuickToolsProps) {
  const { lang, dir } = useI18n();
  const tools = [
    {
      Icon: Code2,
      title: lang === "ar" ? "مساعد برمجي" : "Coding assistant",
      description: lang === "ar" ? "اكتب وراجع الكود" : "Write and review code",
      prompt: lang === "ar" ? "ساعدني في كتابة أو مراجعة الكود التالي: " : "Help me write or review this code: ",
      tone: "blue",
    },
    {
      Icon: Lightbulb,
      title: lang === "ar" ? "اشرح أي شيء" : "Explain anything",
      description: lang === "ar" ? "شرح بسيط بأمثلة" : "Simple explanations with examples",
      prompt: lang === "ar" ? "اشرح لي الموضوع ده ببساطة وبأمثلة: " : "Explain this simply with examples: ",
      tone: "violet",
    },
    {
      Icon: FileSearch,
      title: lang === "ar" ? "تحليل ملف" : "Analyze a file",
      description: lang === "ar" ? "ارفق ملفك وابدأ التحليل" : "Attach a file to get started",
      prompt: lang === "ar" ? "هرفق ملف، حلّله واستخرج أهم المعلومات والنقاط: " : "I'll attach a file. Analyze it and extract the key information: ",
      tone: "indigo",
    },
  ];

  return (
    <aside dir={dir} className="xv-tools-rail xv-tools-rail-v2 relative z-10 hidden h-full w-[260px] shrink-0 flex-col gap-4 p-4 xl:flex">
      <div className="xv-tools-heading flex items-center justify-between">
        <div>
          <span className="xv-tools-kicker block text-[10px] font-bold uppercase tracking-[0.18em]">
            {lang === "ar" ? "مساحة عملك" : "YOUR WORKSPACE"}
          </span>
          <h2 className="mt-1 text-sm font-bold">
            {lang === "ar" ? "أدواتك الذكية" : "Quick tools"}
          </h2>
        </div>
        <span className="xv-tools-heading-icon grid h-10 w-10 place-items-center rounded-2xl">
          <Zap className="h-[18px] w-[18px]" />
        </span>
      </div>

      <div className="xv-tools-section-label flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em]">
        <span className="h-px flex-1" />
        <span>{lang === "ar" ? "ابدأ من هنا" : "GET STARTED"}</span>
        <span className="h-px flex-1" />
      </div>

      <div className="flex flex-col gap-2.5">
        <Link
          to="/images"
          className="xv-quicktool-card xv-quicktool-featured xv-focus group flex items-center gap-3 rounded-2xl p-3.5 text-start transition-all"
        >
          <span className="xv-quicktool-icon xv-quicktool-icon-image grid h-11 w-11 shrink-0 place-items-center rounded-xl">
            <ImageIcon className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-bold">
              {lang === "ar" ? "استوديو الصور" : "Image studio"}
            </span>
            <span className="mt-1 block text-[11px] leading-relaxed text-muted-foreground">
              {lang === "ar" ? "ابتكر صورة جديدة" : "Create something visual"}
            </span>
          </span>
          <ArrowUpRight className="xv-quicktool-arrow h-4 w-4 shrink-0" />
        </Link>

        {tools.map(({ Icon, title, description, prompt, tone }, index) => (
          <button
            key={title}
            type="button"
            onClick={() => onPick(prompt)}
            className={`xv-quicktool-card xv-focus group flex w-full items-center gap-3 rounded-2xl p-3 text-start transition-all xv-quicktool-${tone}`}
          >
            <span className="xv-quicktool-icon grid h-10 w-10 shrink-0 place-items-center rounded-xl">
              <Icon className="h-[18px] w-[18px]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold">{title}</span>
              <span className="mt-1 block text-[10px] leading-relaxed text-muted-foreground">
                {description}
              </span>
            </span>
            <span className="xv-quicktool-number text-[10px] font-semibold">
              0{index + 2}
            </span>
          </button>
        ))}
      </div>

      <div className="xv-tools-footer mt-auto rounded-2xl p-3.5">
        <span className="flex items-center gap-2 text-xs font-bold">
          <span className="xv-tools-footer-mark grid h-7 w-7 place-items-center rounded-lg">
            <Zap className="h-3.5 w-3.5" />
          </span>
          {lang === "ar" ? "كل أفكارك في مكان واحد" : "One space for every idea"}
        </span>
        <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
          {lang === "ar"
            ? "اسأل، اكتب كود، حلّل ملفاتك أو افتح استوديو الصور من مكان واحد."
            : "Ask, code, analyze files, or create images from one place."}
        </p>
      </div>
    </aside>
  );
}
