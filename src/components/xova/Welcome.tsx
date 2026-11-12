import { Code2, FileSearch, Lightbulb, PenLine, Sparkles } from "lucide-react";
import { XovaMark } from "./Logo";
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
      <div className="xv-hero-mark xv-rise relative grid h-24 w-24 place-items-center rounded-[2rem] border border-brand/25 bg-brand/10 shadow-float">
        <span className="absolute inset-2 rounded-[1.5rem] border border-brand/15" />
        <XovaMark className="relative h-11 w-16 drop-shadow-[0_0_18px_rgba(88,100,255,0.55)]" />
        <span className="absolute -end-1 -top-1 grid h-7 w-7 place-items-center rounded-full border border-brand/20 bg-surface text-brand shadow-panel">
          <Sparkles className="h-3.5 w-3.5" />
        </span>
      </div>

      <div className="mt-5 flex items-baseline gap-0.5" dir="ltr">
        <span className="text-4xl font-semibold tracking-[-0.07em] text-foreground sm:text-5xl">XOVA</span>
        <span className="xv-gradient-text self-end pb-1 text-sm font-bold tracking-tight sm:text-base">AI</span>
      </div>
      <p className="mt-1 text-[11px] font-medium tracking-wide text-faint">{t("app.by")}</p>
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
