import { notFound } from "next/navigation";
import { requireView } from "@/lib/admin/session";
import { getPostAdmin } from "@/lib/content";
import { PageHeader } from "@/components/admin/ui";
import { BlogPostForm } from "@/components/admin/BlogPostForm";

export const metadata = { title: "Edit post" };
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** datetime-local shows Asia/Karachi wall-clock time. */
function toLocalInput(d: Date | null): string {
  if (!d) return "";
  return new Date(d.getTime() + 5 * 3600_000).toISOString().slice(0, 16);
}

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  await requireView("content:write");
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const post = await getPostAdmin(id);
  if (!post) notFound();

  return (
    <>
      <PageHeader
        breadcrumb={{ href: "/admin/content/blog", label: "Blog" }}
        title={post.title}
        subtitle={`/blog/${post.slug}`}
      />
      <BlogPostForm
        initial={{
          id: post.id,
          slug: post.slug,
          title: post.title,
          excerpt: post.excerpt,
          body: post.body,
          coverImage: post.coverImage,
          authorName: post.authorName,
          tags: post.tags,
          status: post.status,
          seoTitle: post.seoTitle,
          seoDescription: post.seoDescription,
          publishedAt: toLocalInput(post.publishedAt),
        }}
      />
    </>
  );
}
