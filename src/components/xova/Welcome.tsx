import { Code2, FileSearch, Lightbulb, PenLine } from "lucide-react";
import { XovaLogoText, XovaMark } from "./Logo";
import { useI18n } from "@/lib/i18n";

const SUGGESTIONS = [
  { key: "explain", Icon: Lightbulb },
  { key: "code", Icon: Code2 },
  { key: "analyze", Icon: FileSearch },
  { key: "write", Icon: PenLine },
] as const;

export function Welcome({ onPick }: { onPick: (text: string) => void }) {
  const { t } = useI18n();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-4 py-10 text-center">
      <span className="xv-rise relative grid h-16 w-16 place-items-center rounded-2xl border border-brand/25 bg-brand-soft text-brand shadow-panel">
        <XovaMark className="h-8 w-8" />
      </span>
      <div className="mt-5 flex items-baseline gap-2" dir="ltr">
        <XovaLogoText className="h-9" />
        <span className="text-4xl font-semibold tracking-[-0.03em] text-foreground">OVA</span>
        <span className="xv-gradient-text text-sm font-bold tracking-wide">AI</span>
      </div>
      <p className="mt-1 text-xxs font-medium text-faint">by Begad</p>
      <h1 className="xv-gradient-text mt-2 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
        {t("welcome.greeting")}
      </h1>
      <p className="mt-3 max-w-md text-sm text-muted-foreground">{t("welcome.sub")}</p>

      <ul className="mt-9 grid w-full gap-2.5 sm:grid-cols-2">
        {SUGGESTIONS.map(({ key, Icon }) => (
          <li key={key}>
            <button
              type="button"
              onClick={() => onPick(t(`suggest.${key}.text`))}
              className="xv-focus xv-lift group flex w-full items-start gap-3 rounded-2xl border border-border bg-surface/70 px-4 py-3.5 text-start backdrop-blur hover:bg-surface"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{t(`suggest.${key}`)}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                  {t(`suggest.${key}.text`)}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
