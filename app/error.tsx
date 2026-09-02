"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main id="main" className="container-x py-16 md:py-24">
      <p className="text-sm font-medium text-ink-soft">Something broke</p>
      <h1 className="mt-1 text-3xl sm:text-4xl">We could not load this page.</h1>
      <p className="mt-3 max-w-xl text-ink-soft">
        Nothing has been charged and no order has been changed. Try again, or go back to the products page.
      </p>
      {error.digest ? <p className="mt-2 text-xs text-ink-soft">Reference: {error.digest}</p> : null}
      <div className="mt-6 flex flex-wrap gap-3">
        <button type="button" onClick={reset} className="btn btn-primary">
          Try again
        </button>
        <Link href="/products" className="btn btn-secondary">
          See all products
        </Link>
      </div>
    </main>
  );
}
