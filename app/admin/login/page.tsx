import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/LoginForm";
import { countUsers } from "@/lib/admin/users";
import { getAdminContext } from "@/lib/admin/session";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  // Checked against the database, not just the cookie signature, so a revoked
  // session lands here and stays here instead of bouncing.
  if (await getAdminContext()) redirect("/admin");

  const { next } = await searchParams;
  const noUsers = (await countUsers()) === 0;

  return (
    <main id="main" className="flex min-h-dvh items-center justify-center p-4">
      <div className="a-card w-full max-w-sm p-5">
        <p className="text-[13px] font-bold tracking-tight">
          MARK <span className="font-normal text-[var(--a-soft)]">admin</span>
        </p>
        <h1 className="mt-3">Sign in</h1>
        <p className="mt-0.5 text-[12px] text-[var(--a-soft)]">Staff accounts only. Sessions last seven days.</p>
        {noUsers ? (
          <p className="mt-3 rounded border border-[var(--a-border)] bg-[var(--a-warn-bg)] px-2.5 py-2 text-[11.5px] text-[var(--a-warn)]">
            No staff accounts exist yet. Signing in with the <code className="a-mono">ADMIN_EMAIL</code> and{" "}
            <code className="a-mono">ADMIN_PASSWORD</code> from your environment creates the first Owner.
          </p>
        ) : null}
        <LoginForm next={next} />
      </div>
    </main>
  );
}
