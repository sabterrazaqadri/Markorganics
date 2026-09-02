import "server-only";
import { revalidatePath, revalidateTag } from "next/cache";
import { ANALYTICS_TAG } from "./analytics";
import { CONTENT_TAG, MENU_TAG } from "@/lib/content";
import { SETTINGS_TAG } from "@/lib/settings";

/** Product data changed: refresh every cached surface that shows it. */
export function revalidateCatalog(slug?: string) {
  revalidatePath("/");
  revalidatePath("/products");
  revalidatePath("/products/[slug]", "page");
  revalidatePath("/collections/[family]", "page");
  if (slug) revalidatePath(`/products/${slug}`);
  revalidatePath("/feed/meta");
  revalidatePath("/feed/google");
  revalidatePath("/sitemap.xml");
}

/** Anything that moves money or order state invalidates the reports. */
export function revalidateReports() {
  revalidateTag(ANALYTICS_TAG);
}

export function revalidateContent() {
  revalidateTag(CONTENT_TAG);
  revalidatePath("/blog");
  revalidatePath("/blog/[slug]", "page");
  revalidatePath("/sitemap.xml");
}

export function revalidateMenus() {
  revalidateTag(MENU_TAG);
  revalidatePath("/", "layout");
}

export function revalidateSettings() {
  revalidateTag(SETTINGS_TAG);
  revalidatePath("/", "layout");
  revalidatePath("/cart");
  revalidatePath("/checkout");
}
