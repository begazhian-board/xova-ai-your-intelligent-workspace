import { Code2, FileSearch, Lightbulb, PenLine } from "lucide-react";
import { XovaMark } from "./Logo";
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
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-soft text-brand">
        <XovaMark className="h-6 w-6" />
      </span>
      <h1 className="mt-5 text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">
        {t("app.name")}
      </h1>
      <p className="mt-2 text-lg font-medium text-foreground sm:text-xl">{t("welcome.greeting")}</p>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">{t("welcome.sub")}</p>

      <ul className="mt-8 grid w-full gap-2 sm:grid-cols-2">
        {SUGGESTIONS.map(({ key, Icon }) => (
          <li key={key}>
            <button
              type="button"
              onClick={() => onPick(t(`suggest.${key}.text`))}
              className="xv-focus flex w-full items-start gap-2.5 rounded-xl border border-border bg-surface px-3.5 py-3 text-start transition-colors hover:bg-hover"
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
              <span className="min-w-0">
                <span className="block text-sm font-medium">{t(`suggest.${key}`)}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
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
