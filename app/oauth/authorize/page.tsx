import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BRAND_NAME } from "@/config/commerce";
import { clientLabel, readAuthorizeParams, validateAuthorize } from "@/lib/oauth/core";
import { AuthorizeForm } from "./AuthorizeForm";

export const metadata: Metadata = {
  title: "Sign in with WhatsApp",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function AuthorizePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = readAuthorizeParams(await searchParams);
  const valid = await validateAuthorize(params);

  if (!valid.ok) {
    // Errors that the assistant should handle go back to it; others stay here.
    if (valid.redirect) redirect(valid.redirect);
    return (
      <Shell>
        <h1 className="font-display text-xl font-semibold">Sign-in link not valid</h1>
        <p className="mt-3 text-sm text-ink-soft">{valid.message}</p>
      </Shell>
    );
  }

  return (
    <Shell>
      <AuthorizeForm params={valid.params} assistant={clientLabel(valid.client)} brand={BRAND_NAME} />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh bg-paper px-4 py-12 text-ink">
      <div className="mx-auto max-w-sm rounded-2xl border border-rule bg-surface p-6 shadow-sm">
        <p className="mb-5 text-xs font-semibold tracking-[0.2em] text-band-oil-ink">{BRAND_NAME}</p>
        {children}
      </div>
    </main>
  );
}
