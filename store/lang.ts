"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { LANG_STORAGE_KEY, type Lang } from "@/lib/i18n/lang";

export type { Lang };

interface LangState {
  lang: Lang;
  setLang: (lang: Lang) => void;
}

/**
 * The visitor's language, kept in the browser only.
 *
 * Pages stay static: the server renders English and Urdu blocks side by side
 * and `data-lang` on <html> decides which one is visible (see globals.css).
 * The inline script in LangScript.tsx applies the stored choice before the
 * first paint so there is no flash of the wrong language.
 */
export const useLang = create<LangState>()(
  persist(
    (set) => ({
      lang: "en",
      setLang: (lang) => {
        if (typeof document !== "undefined") document.documentElement.dataset.lang = lang;
        set({ lang });
      },
    }),
    {
      name: LANG_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ lang: s.lang }),
      onRehydrateStorage: () => (state) => {
        if (state && typeof document !== "undefined") document.documentElement.dataset.lang = state.lang;
      },
    },
  ),
);

export function isUrdu(lang: Lang): boolean {
  return lang === "ur";
}
