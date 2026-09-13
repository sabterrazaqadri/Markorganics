import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { excerptOf, getPublishedPost, renderRichText } from "@/lib/content";
import { SITE_URL, absoluteImageUrl } from "@/config/commerce";

export const revalidate = 900;

const DAY = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Asia/Karachi",
});

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedPost(slug);
  if (!post) return { title: "Not found", robots: { index: false, follow: false } };

  return {
    title: post.seoTitle || post.title,
    description: post.seoDescription || excerptOf(post, 155),
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: "article",
      title: post.seoTitle || post.title,
      description: post.seoDescription || excerptOf(post, 155),
      url: `${SITE_URL}/blog/${post.slug}`,
      publishedTime: post.publishedAt?.toISOString(),
      images: post.coverImage ? [{ url: post.coverImage }] : undefined,
    },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPublishedPost(slug);
  if (!post) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: excerptOf(post, 200),
    datePublished: post.publishedAt?.toISOString(),
    dateModified: post.updatedAt.toISOString(),
    author: post.authorName ? { "@type": "Person", name: post.authorName } : undefined,
    image: post.coverImage ? absoluteImageUrl(post.coverImage) : undefined,
    mainEntityOfPage: `${SITE_URL}/blog/${post.slug}`,
  };

  return (
    <article className="container-x py-8 md:py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav aria-label="Breadcrumb" className="text-sm text-ink-soft">
        <Link href="/blog" className="underline underline-offset-4">
          Journal
        </Link>
      </nav>

      <h1 className="mt-2 max-w-3xl text-3xl sm:text-4xl">{post.title}</h1>
      <p className="mt-2 text-sm text-ink-soft">
        {post.publishedAt ? <time dateTime={post.publishedAt.toISOString()}>{DAY.format(post.publishedAt)}</time> : null}
        {post.authorName ? ` · ${post.authorName}` : ""}
      </p>

      {post.coverImage ? (
        <Image
          src={post.coverImage}
          alt=""
          width={1200}
          height={630}
          priority
          sizes="(min-width: 1024px) 800px, 92vw"
          className="mt-6 aspect-video w-full max-w-3xl rounded border border-rule bg-white object-cover"
        />
      ) : null}

      <div
        className="prose-plain mt-6 max-w-2xl"
        dangerouslySetInnerHTML={{ __html: renderRichText(post.body) }}
      />

      {post.tags.length ? (
        <p className="mt-8 flex flex-wrap gap-2 text-xs text-ink-soft">
          {post.tags.map((tag) => (
            <span key={tag} className="rounded border border-rule px-2 py-0.5">
              {tag}
            </span>
          ))}
        </p>
      ) : null}
    </article>
  );
}
