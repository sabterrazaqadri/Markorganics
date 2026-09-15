"use client";

import { useEffect, useState } from "react";
import { useLang } from "@/store/lang";

/**
 * English / Urdu switch. Renders the same markup on the server and on the
 * first client pass (English), then reflects the stored choice once the
 * store has rehydrated, so hydration never mismatches.
 */
export function LangToggle({ className = "" }: { className?: string }) {
  const lang = useLang((s) => s.lang);
  const setLang = useLang((s) => s.setLang);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const current = ready ? lang : "en";

  return (
    <div className={className}>
      <div role="group" aria-label="Language" className="inline-flex overflow-hidden rounded border border-rule text-xs font-medium">
      <button
        type="button"
        onClick={() => setLang("en")}
        aria-pressed={current === "en"}
        className={`px-2.5 py-1.5 ${current === "en" ? "bg-ink text-white" : "bg-white text-ink-soft hover:text-ink"}`}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLang("ur")}
        aria-pressed={current === "ur"}
        lang="ur"
        className={`urdu px-2.5 py-1 text-sm leading-none ${current === "ur" ? "bg-ink text-white" : "bg-white text-ink-soft hover:text-ink"}`}
      >
        اردو
      </button>
      </div>
    </div>
  );
}
