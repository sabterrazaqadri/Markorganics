import Link from "next/link";
import { BRAND_NAME, SUPPORT_EMAIL, WHATSAPP_NUMBER } from "@/config/commerce";
import { FAMILIES, FAMILY_ORDER } from "@/lib/catalog";
import { getMenu } from "@/lib/content";
import { Logo } from "./Logo";

export async function Footer() {
  // A footer menu built in the admin replaces the Help column entirely.
  const custom = await getMenu("footer");

  return (
    <footer className="mt-16 border-t border-rule bg-surface">
      <div className="flex" aria-hidden="true">
        <span className="band bg-band-oil" />
        <span className="band bg-band-care" />
        <span className="band bg-band-home" />
      </div>
      <div className="container-x grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Logo />
          <p className="mt-4 text-sm text-ink-soft">
            Everyday oils, balms and laundry blue for Pakistani homes. Cash on delivery, nationwide.
          </p>
        </div>
        <nav aria-label="Shop">
          <h2 className="mb-3 text-sm font-semibold">Shop</h2>
          <ul className="space-y-2 text-sm text-ink-soft">
            {FAMILY_ORDER.map((f) => (
              <li key={f}>
                <Link href={`/collections/${f}`} className="hover:text-ink hover:underline underline-offset-4">
                  {FAMILIES[f].heading}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/products" className="hover:text-ink hover:underline underline-offset-4">
                All products
              </Link>
            </li>
          </ul>
        </nav>
        <nav aria-label="Help">
          <h2 className="mb-3 text-sm font-semibold">Help</h2>
          <ul className="space-y-2 text-sm text-ink-soft">
            {custom.length > 0 ? (
              custom.map((item) => (
                <li key={item.id}>
                  <Link href={item.url} className="hover:text-ink hover:underline underline-offset-4">
                    {item.label}
                  </Link>
                </li>
              ))
            ) : (
              <>
                <li>
                  <Link href="/track" className="hover:text-ink hover:underline underline-offset-4">
                    Track an order
                  </Link>
                </li>
                <li>
                  <Link href="/shipping-returns" className="hover:text-ink hover:underline underline-offset-4">
                    Shipping and returns
                  </Link>
                </li>
                <li>
                  <Link href="/faq" className="hover:text-ink hover:underline underline-offset-4">
                    FAQ
                  </Link>
                </li>
                <li>
                  <Link href="/contact" className="hover:text-ink hover:underline underline-offset-4">
                    Contact
                  </Link>
                </li>
              </>
            )}
          </ul>
        </nav>
        <nav aria-label="Company">
          <h2 className="mb-3 text-sm font-semibold">Company</h2>
          <ul className="space-y-2 text-sm text-ink-soft">
            <li>
              <Link href="/about" className="hover:text-ink hover:underline underline-offset-4">
                About {BRAND_NAME}
              </Link>
            </li>
            <li>
              <Link href="/blog" className="hover:text-ink hover:underline underline-offset-4">
                Journal
              </Link>
            </li>
            <li>
              <Link href="/privacy" className="hover:text-ink hover:underline underline-offset-4">
                Privacy
              </Link>
            </li>
            <li>
              <a href={`https://wa.me/${WHATSAPP_NUMBER}`} className="hover:text-ink hover:underline underline-offset-4" rel="noopener">
                WhatsApp us
              </a>
            </li>
            <li>
              <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-ink hover:underline underline-offset-4">
                {SUPPORT_EMAIL}
              </a>
            </li>
          </ul>
        </nav>
      </div>
      <div className="hairline">
        <div className="container-x flex flex-col gap-2 py-5 text-xs text-ink-soft sm:flex-row sm:items-center sm:justify-between">
          <p>
            &copy; {new Date().getFullYear()} {BRAND_NAME}. All prices in Pakistani rupees.
          </p>
          <p>Cash on delivery only. No card details are ever requested.</p>
        </div>
      </div>
    </footer>
  );
}
