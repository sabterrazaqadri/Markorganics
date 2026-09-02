import { notFound } from "next/navigation";
import { requireView } from "@/lib/admin/session";
import { getPageAdmin } from "@/lib/content";
import { PageHeader } from "@/components/admin/ui";
import { PageForm } from "@/components/admin/PageForm";

export const metadata = { title: "Edit page" };
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditPagePage({ params }: { params: Promise<{ id: string }> }) {
  await requireView("content:write");
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const page = await getPageAdmin(id);
  if (!page) notFound();

  return (
    <>
      <PageHeader
        breadcrumb={{ href: "/admin/content/pages", label: "Pages" }}
        title={page.title}
        subtitle={`/${page.slug}`}
      />
      <PageForm
        initial={{
          id: page.id,
          slug: page.slug,
          title: page.title,
          body: page.body,
          seoTitle: page.seoTitle,
          seoDescription: page.seoDescription,
          status: page.status,
          isSystem: page.isSystem,
        }}
      />
    </>
  );
}
