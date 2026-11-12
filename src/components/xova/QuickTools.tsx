import { Code2, FileSearch, Image as ImageIcon, Lightbulb, Sparkles, Zap } from "lucide-react";
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
    },
    {
      Icon: Lightbulb,
      title: lang === "ar" ? "اشرح أي شيء" : "Explain anything",
      description: lang === "ar" ? "شرح بسيط بأمثلة" : "Simple explanations with examples",
      prompt: lang === "ar" ? "اشرح لي الموضوع ده ببساطة وبأمثلة: " : "Explain this simply with examples: ",
    },
    {
      Icon: FileSearch,
      title: lang === "ar" ? "تحليل ملف" : "Analyze a file",
      description: lang === "ar" ? "ارفق ملفك وابدأ التحليل" : "Attach a file to get started",
      prompt: lang === "ar" ? "هرفق ملف، حلّله واستخرج أهم المعلومات والنقاط: " : "I'll attach a file. Analyze it and extract the key information: ",
    },
  ];

  return (
    <aside dir={dir} className="xv-tools-rail hidden h-full w-[248px] shrink-0 flex-col gap-4 border-s border-border/70 p-4 xl:flex">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{lang === "ar" ? "أدوات سريعة" : "Quick tools"}</h2>
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-brand/10 text-brand">
          <Zap className="h-4 w-4" />
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <Link
          to="/images"
          className="xv-focus xv-tool-card group flex min-h-[112px] flex-col items-center justify-center gap-2 rounded-2xl border border-brand/20 bg-brand/10 p-3 text-center transition-all hover:-translate-y-0.5 hover:border-brand/40 hover:bg-brand/15"
        >
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand/15 text-brand">
            <ImageIcon className="h-4.5 w-4.5" />
          </span>
          <span className="text-xs font-semibold">{lang === "ar" ? "استوديو الصور" : "Image studio"}</span>
          <span className="text-[10px] text-muted-foreground">{lang === "ar" ? "ابتكر صورة جديدة" : "Create an image"}</span>
        </Link>

        {tools.map(({ Icon, title, description, prompt }) => (
          <button
            key={title}
            type="button"
            onClick={() => onPick(prompt)}
            className="xv-focus xv-tool-card group flex min-h-[112px] flex-col items-center justify-center gap-2 rounded-2xl border border-border/80 bg-surface/65 p-3 text-center transition-all hover:-translate-y-0.5 hover:border-brand/35 hover:bg-brand/5"
          >
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand/10 text-brand transition-transform group-hover:scale-105">
              <Icon className="h-4.5 w-4.5" />
            </span>
            <span className="text-xs font-semibold">{title}</span>
            <span className="text-[10px] leading-relaxed text-muted-foreground">{description}</span>
          </button>
        ))}
      </div>

      <div className="mt-auto rounded-2xl border border-brand/15 bg-brand/5 p-3.5">
        <span className="mb-2 flex items-center gap-2 text-xs font-semibold text-brand">
          <Sparkles className="h-4 w-4" />
          {lang === "ar" ? "مساحة واحدة لكل أفكارك" : "One space for every idea"}
        </span>
        <p className="text-xs leading-6 text-muted-foreground">
          {lang === "ar"
            ? "اسأل، اكتب كود، حلّل ملفاتك أو افتح استوديو الصور من مكان واحد."
            : "Ask, code, analyze files, or open the image studio from one place."}
        </p>
      </div>
    </aside>
  );
}
