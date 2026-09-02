import { getPublishedPage, renderRichText } from "@/lib/content";

/**
 * Renders a database-backed page.
 *
 * The four content pages that used to be hard-coded now read from the `pages`
 * table. If the row is missing — a fresh database, or the backfill has not run
 * — the original copy is rendered as a fallback, so the storefront can never
 * show an empty page.
 */
export async function PageBody({
  slug,
  fallbackTitle,
  children,
}: {
  slug: string;
  fallbackTitle: string;
  children: React.ReactNode;
}) {
  const page = await getPublishedPage(slug);

  return (
    <div className="container-x py-8 md:py-12">
      <h1 className="text-3xl sm:text-4xl">{page?.title ?? fallbackTitle}</h1>
      {page ? (
        <div className="prose-plain mt-6 max-w-2xl" dangerouslySetInnerHTML={{ __html: renderRichText(page.body) }} />
      ) : (
        <div className="prose-plain mt-6 max-w-2xl">{children}</div>
      )}
    </div>
  );
}

/** Metadata for a database-backed page, falling back to the static copy. */
export async function pageMetadata(
  slug: string,
  fallback: { title: string; description: string },
) {
  const page = await getPublishedPage(slug);
  return {
    title: page?.seoTitle || page?.title || fallback.title,
    description: page?.seoDescription || fallback.description,
    alternates: { canonical: `/${slug}` },
  };
}
