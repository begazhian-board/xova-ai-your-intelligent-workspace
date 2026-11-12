import { Code2, FileSearch, Lightbulb, PenLine, Sparkles } from "lucide-react";
import { XovaLogoText } from "./Logo";
import { useI18n } from "@/lib/i18n";

const SUGGESTIONS = [
  { key: "explain", Icon: Lightbulb },
  { key: "code", Icon: Code2 },
  { key: "analyze", Icon: FileSearch },
  { key: "write", Icon: PenLine },
] as const;

export function Welcome({
  onPick,
  displayName,
}: {
  onPick: (text: string) => void;
  displayName?: string | null;
}) {
  const { t, lang } = useI18n();
  const preferredName = displayName?.trim();
  const greeting = preferredName
    ? lang === "ar"
      ? `أهلاً يا ${preferredName}، نبدأ بإيه النهارده؟`
      : `Welcome, ${preferredName}. What shall we work on?`
    : t("welcome.greeting");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 py-10 text-center sm:px-6">
      <div className="xv-rise flex items-center justify-center gap-2" dir="ltr">
        <XovaLogoText className="h-14 w-[218px] drop-shadow-[0_0_24px_rgba(88,100,255,0.22)] sm:h-16 sm:w-[250px]" />
        <span className="xv-gradient-text mb-2 text-sm font-semibold tracking-[0.18em] sm:text-base">AI</span>
      </div>
      <p className="mt-1 text-[11px] font-medium tracking-[0.12em] text-faint">{t("app.by")}</p>
      <span className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-brand/20 bg-brand/10 px-3 py-1.5 text-xs font-medium text-brand">
        <Sparkles className="h-3.5 w-3.5" />
        {lang === "ar" ? "مساحة عمل ذكية" : "Your AI workspace"}
      </span>

      <h1 className="xv-gradient-text mt-4 text-2xl font-semibold tracking-tight sm:text-4xl">
        {greeting}
      </h1>
      <p className="mt-3 max-w-lg text-sm leading-7 text-muted-foreground">{t("welcome.sub")}</p>

      <ul className="mt-8 grid w-full gap-3 sm:grid-cols-2">
        {SUGGESTIONS.map(({ key, Icon }) => (
          <li key={key}>
            <button
              type="button"
              onClick={() => onPick(t(`suggest.${key}.text`))}
              className="xv-focus xv-lift xv-tool-card group flex min-h-[98px] w-full items-center gap-3.5 rounded-2xl border border-border/80 bg-surface/75 px-4 py-4 text-start backdrop-blur-xl"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-brand/15 bg-brand/10 text-brand transition-transform group-hover:scale-105">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-foreground">{t(`suggest.${key}`)}</span>
                <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                  {t(`suggest.${key}.text`)}
                </span>
              </span>
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand/10 text-brand opacity-70 transition-all group-hover:translate-x-[-2px] group-hover:opacity-100">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
