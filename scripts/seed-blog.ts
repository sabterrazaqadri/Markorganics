import "./env";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { blogPosts } from "@/lib/db/schema";
import { SEED_POSTS_EN } from "@/lib/db/seed-blog-en";
import { SEED_POSTS_UR } from "@/lib/db/seed-blog-ur";

/**
 * Publishes the journal: ten English posts and their Urdu versions, linked
 * both ways. Idempotent by slug. A post edited in the admin is left alone
 * unless --reset is passed.
 *
 *   npx tsx scripts/seed-blog.ts
 *   npx tsx scripts/seed-blog.ts --reset
 */
async function main() {
  const reset = process.argv.includes("--reset");
  let created = 0;
  let updated = 0;
  let kept = 0;

  for (const post of [...SEED_POSTS_EN, ...SEED_POSTS_UR]) {
    const existing = await db.query.blogPosts.findFirst({ where: eq(blogPosts.slug, post.slug) });
    const publishedAt = new Date(Date.now() - post.daysAgo * 24 * 3600_000);
    const values = {
      title: post.title,
      excerpt: post.excerpt,
      body: post.body,
      tags: post.tags,
      seoTitle: post.seoTitle,
      seoDescription: post.seoDescription,
      lang: post.lang,
      translationSlug: post.translationSlug,
      authorName: "MARKORGANIC",
      status: "published" as const,
      updatedAt: new Date(),
    };
    if (existing) {
      if (!reset) {
        // Always keep the translation link current, even on a kept post.
        await db.update(blogPosts).set({ translationSlug: post.translationSlug, lang: post.lang }).where(eq(blogPosts.id, existing.id));
        kept++;
        continue;
      }
      await db.update(blogPosts).set(values).where(eq(blogPosts.id, existing.id));
      updated++;
    } else {
      await db.insert(blogPosts).values({ ...values, slug: post.slug, publishedAt, coverImage: "" });
      created++;
    }
  }

  console.log(`Blog: ${created} created, ${updated} updated, ${kept} kept.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
