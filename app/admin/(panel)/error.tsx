"use client";

import Link from "next/link";
import { useEffect } from "react";

/** Any uncaught error inside the panel. Never leaks a stack to the browser. */
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("admin error", error);
  }, [error]);

  return (
    <div className="a-card a-empty">
      <h2>Something went wrong on this screen</h2>
      <p className="text-[12.5px]">
        The action was not completed. Try again, and if it keeps happening send the reference below to whoever runs the
        site.
      </p>
      {error.digest ? <p className="a-mono mt-2 text-[var(--a-soft)]">Reference {error.digest}</p> : null}
      <div className="mt-3 flex justify-center gap-2">
        <button type="button" className="a-btn a-btn-primary a-btn-xs" onClick={reset}>
          Try again
        </button>
        <Link href="/admin" className="a-btn a-btn-xs">
          Back to the dashboard
        </Link>
      </div>
    </div>
  );
}
