import { requireView } from "@/lib/admin/session";
import { PageHeader } from "@/components/admin/ui";
import { BlogPostForm, EMPTY_POST } from "@/components/admin/BlogPostForm";

export const metadata = { title: "New post" };
export const dynamic = "force-dynamic";

export default async function NewPostPage() {
  const ctx = await requireView("content:write");
  return (
    <>
      <PageHeader breadcrumb={{ href: "/admin/content/blog", label: "Blog" }} title="New post" />
      <BlogPostForm initial={{ ...EMPTY_POST, authorName: ctx.user.name }} />
    </>
  );
}
