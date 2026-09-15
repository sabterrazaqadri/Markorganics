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
  const all = await getPublishedPosts(60);
  // English and Urdu lists sit side by side; <html data-lang> shows one.
  const en = all.filter((p) => p.lang !== "ur");
  const ur = all.filter((p) => p.lang === "ur");

  return (
    <div className="container-x py-8 md:py-12">
      <h1 className="text-3xl sm:text-4xl">
        <span className="lang-en">Journal</span>
        <span className="lang-ur urdu" lang="ur">
          مضامین
        </span>
      </h1>
      <p className="mt-2 max-w-2xl text-ink-soft">
        <span className="lang-en">How the products are made, how to use them, and what we have learned selling them.</span>
        <span className="lang-ur urdu" lang="ur">
          پروڈکٹس کیسے بنتی ہیں، کیسے استعمال ہوتی ہیں، اور بیچتے ہوئے ہم نے کیا سیکھا۔
        </span>
      </p>

      {all.length === 0 ? (
        <p className="mt-8 text-ink-soft">Nothing published yet. Check back soon.</p>
      ) : (
        <>
          <PostGrid posts={en} className="lang-en" />
          <PostGrid posts={ur.length ? ur : en} className="lang-ur" />
        </>
      )}
    </div>
  );
}

function PostGrid({ posts, className }: { posts: Awaited<ReturnType<typeof getPublishedPosts>>; className: string }) {
  return (
    <ul className={`mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 ${className}`}>
          {posts.map((post) => (
            <li key={post.id} className={`card overflow-hidden ${post.lang === "ur" ? "urdu" : ""}`} lang={post.lang}>
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
  );
}
