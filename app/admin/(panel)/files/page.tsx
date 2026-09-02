import { requireView } from "@/lib/admin/session";
import { can } from "@/lib/admin/permissions";
import { listMedia } from "@/lib/admin/media";
import { CursorPager, PageHeader } from "@/components/admin/ui";
import { MediaLibrary } from "@/components/admin/MediaLibrary";

export const metadata = { title: "Files" };
export const dynamic = "force-dynamic";

export default async function FilesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cursor?: string }>;
}) {
  const ctx = await requireView("files:read");
  const sp = await searchParams;
  const { rows, nextCursor } = await listMedia({ q: sp.q, cursor: sp.cursor });

  return (
    <>
      <PageHeader title="Files" subtitle="Images shared across products, collections and blog posts." />

      <form method="get" className="a-card mb-3 flex flex-wrap items-end gap-2 p-2">
        <div className="min-w-[220px] flex-1">
          <label htmlFor="q" className="a-label">
            Search
          </label>
          <input id="q" name="q" className="a-input" defaultValue={sp.q ?? ""} placeholder="Filename, alt text or path" />
        </div>
        <button type="submit" className="a-btn a-btn-primary">
          Search
        </button>
      </form>

      <MediaLibrary files={rows} canWrite={can(ctx.user.role, "files:write")} />
      <CursorPager basePath="/admin/files" params={{ q: sp.q }} nextCursor={nextCursor} hasCursor={Boolean(sp.cursor)} />
    </>
  );
}
