import { requireView } from "@/lib/admin/session";
import { PageHeader } from "@/components/admin/ui";
import { EMPTY_PAGE, PageForm } from "@/components/admin/PageForm";

export const metadata = { title: "New page" };
export const dynamic = "force-dynamic";

export default async function NewPagePage() {
  await requireView("content:write");
  return (
    <>
      <PageHeader breadcrumb={{ href: "/admin/content/pages", label: "Pages" }} title="New page" />
      <PageForm initial={EMPTY_PAGE} />
    </>
  );
}
