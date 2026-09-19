import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { I18nProvider } from "./i18n";
import { cacheAppearance, readCachedAppearance, useApplyAppearance } from "./theme";
import type { LanguageId, ThemeChoice } from "./xova";

interface AppearanceValue {
  theme: ThemeChoice;
  lang: LanguageId;
  setAppearance: (next: { theme?: ThemeChoice; lang?: LanguageId }) => void;
}

const AppearanceContext = createContext<AppearanceValue>({
  theme: "dark",
  lang: "en",
  setAppearance: () => {},
});

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ theme: ThemeChoice; lang: LanguageId }>({
    theme: "dark",
    lang: "en",
  });

  // Read the cached choice after hydration so SSR markup stays stable.
  useEffect(() => {
    setState(readCachedAppearance());
  }, []);

  useApplyAppearance(state.theme, state.lang);

  const setAppearance = useCallback((next: { theme?: ThemeChoice; lang?: LanguageId }) => {
    setState((current) => {
      const merged = { theme: next.theme ?? current.theme, lang: next.lang ?? current.lang };
      cacheAppearance(merged.theme, merged.lang);
      return merged;
    });
  }, []);

  return (
    <AppearanceContext.Provider value={{ ...state, setAppearance }}>
      <I18nProvider lang={state.lang}>{children}</I18nProvider>
    </AppearanceContext.Provider>
  );
}

export function useAppearance() {
  return useContext(AppearanceContext);
}
