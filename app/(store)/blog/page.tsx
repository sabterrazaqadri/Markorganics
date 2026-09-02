import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { excerptOf, getPublishedPosts } from "@/lib/content";
import { BRAND_NAME } from "@/config/commerce";

export const metadata: Metadata = {
  title: "Journal",
  description: `Notes from ${BRAND_NAME} on oils, balms and keeping a Pakistani home running.`,
  alternates: { canonical: "/blog" },
};

export const revalidate = 900;

const DAY = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Asia/Karachi",
});

export default async function BlogIndexPage() {
  const posts = await getPublishedPosts(30);

  return (
    <div className="container-x py-8 md:py-12">
      <h1 className="text-3xl sm:text-4xl">Journal</h1>
      <p className="mt-2 max-w-2xl text-ink-soft">
        How the products are made, how to use them, and what we have learned selling them.
      </p>

      {posts.length === 0 ? (
        <p className="mt-8 text-ink-soft">Nothing published yet. Check back soon.</p>
      ) : (
        <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <li key={post.id} className="card overflow-hidden">
              <Link href={`/blog/${post.slug}`} className="block">
                {post.coverImage ? (
                  <Image
                    src={post.coverImage}
                    alt=""
                    width={480}
                    height={270}
                    sizes="(min-width: 1024px) 380px, (min-width: 640px) 45vw, 92vw"
                    className="aspect-video w-full bg-white object-cover"
                  />
                ) : null}
                <div className="p-5">
                  <h2 className="text-xl leading-tight">{post.title}</h2>
                  {post.publishedAt ? (
                    <p className="mt-1 text-xs text-ink-soft">
                      <time dateTime={post.publishedAt.toISOString()}>{DAY.format(post.publishedAt)}</time>
                      {post.authorName ? ` · ${post.authorName}` : ""}
                    </p>
                  ) : null}
                  <p className="mt-2 text-sm text-ink-soft">{excerptOf(post)}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
