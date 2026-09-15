export type Lang = "en" | "ur";

/** localStorage key the language store persists under (zustand persist envelope). */
export const LANG_STORAGE_KEY = "mrk-lang";

export const LANGS: Lang[] = ["en", "ur"];

export function isLang(v: unknown): v is Lang {
  return v === "en" || v === "ur";
}
