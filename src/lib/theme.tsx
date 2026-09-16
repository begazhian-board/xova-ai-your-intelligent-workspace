import { useEffect } from "react";
import type { LanguageId, ThemeChoice } from "./xova";

/** Applies theme + direction to the document. Safe on the client only. */
export function useApplyAppearance(theme: ThemeChoice, lang: LanguageId) {
  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && media.matches);
      root.classList.toggle("dark", dark);
      root.style.colorScheme = dark ? "dark" : "light";
    };

    apply();
    if (theme === "system") {
      media.addEventListener("change", apply);
      return () => media.removeEventListener("change", apply);
    }
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    root.lang = lang;
    root.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);
}

const THEME_KEY = "xova.theme";
const LANG_KEY = "xova.lang";

/** Local cache so the shell renders in the right theme before the profile loads. */
export function readCachedAppearance(): { theme: ThemeChoice; lang: LanguageId } {
  if (typeof window === "undefined") return { theme: "dark", lang: "en" };
  const theme = window.localStorage.getItem(THEME_KEY) as ThemeChoice | null;
  const lang = window.localStorage.getItem(LANG_KEY) as LanguageId | null;
  return {
    theme: theme === "light" || theme === "system" ? theme : "dark",
    lang: lang === "ar" ? "ar" : "en",
  };
}

export function cacheAppearance(theme: ThemeChoice, lang: LanguageId) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(THEME_KEY, theme);
  window.localStorage.setItem(LANG_KEY, lang);
}
