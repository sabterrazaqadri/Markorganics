import { LANG_STORAGE_KEY } from "@/lib/i18n/lang";

/**
 * Applies the stored language to <html data-lang> before the page paints.
 * Runs once, reads one localStorage key, and swallows every error: a private
 * window or a blocked store just leaves the page in English.
 */
export function LangScript() {
  const code = `try{var v=JSON.parse(localStorage.getItem(${JSON.stringify(LANG_STORAGE_KEY)})||"{}");var l=v&&v.state&&v.state.lang;if(l==="ur")document.documentElement.dataset.lang="ur";}catch(e){}`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
