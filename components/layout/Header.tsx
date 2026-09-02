import Link from "next/link";
import { FAMILIES, FAMILY_ORDER } from "@/lib/catalog";
import { getMenu, type MenuNode } from "@/lib/content";
import { Logo } from "./Logo";
import { CartButton } from "./CartButton";

const familyUnderline: Record<string, string> = {
  oils: "after:bg-band-oil",
  relief: "after:bg-band-care",
  home: "after:bg-band-home",
};

/** Used until someone builds a header menu in the admin. */
const FALLBACK: MenuNode[] = [
  ...FAMILY_ORDER.map((f) => ({ id: f, label: FAMILIES[f].name, url: `/collections/${f}`, children: [] })),
  { id: "all", label: "All products", url: "/products", children: [] },
  { id: "track", label: "Track order", url: "/track", children: [] },
];

/** Family links keep their colour underline wherever they appear. */
function underlineFor(url: string): string {
  const family = FAMILY_ORDER.find((f) => url === `/collections/${f}`);
  return family ? familyUnderline[family] : "";
}

export async function Header() {
  const menu = await getMenu("header");
  const items = menu.length > 0 ? menu : FALLBACK;

  return (
    <header className="sticky top-0 z-40 border-b border-rule bg-paper/95 backdrop-blur-sm">
      <div className="container-x flex h-14 items-center justify-between gap-4 sm:h-16">
        <Logo />
        <nav aria-label="Primary" className="hidden items-center gap-6 md:flex">
          {items.map((item) => (
            <Link
              key={item.id}
              href={item.url}
              className={`relative py-1 text-sm font-medium ${
                underlineFor(item.url)
                  ? `after:absolute after:inset-x-0 after:-bottom-0.5 after:h-[3px] after:scale-x-0 after:transition-transform hover:after:scale-x-100 ${underlineFor(item.url)}`
                  : "hover:underline underline-offset-4"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/track" className="btn btn-sm btn-secondary md:hidden" aria-label="Track order">
            Track
          </Link>
          <CartButton />
        </div>
      </div>
      <nav aria-label="Product families" className="border-t border-rule md:hidden">
        <ul className="container-x flex h-10 items-stretch gap-5 overflow-x-auto text-sm font-medium [scrollbar-width:none]">
          {items
            .filter((item) => item.url !== "/track")
            .map((item) => (
              <li key={item.id} className="flex shrink-0 items-stretch">
                <Link
                  href={item.url}
                  className={
                    underlineFor(item.url)
                      ? `relative flex items-center after:absolute after:inset-x-0 after:bottom-0 after:h-[3px] ${underlineFor(item.url)}`
                      : "flex items-center"
                  }
                >
                  {item.label}
                </Link>
              </li>
            ))}
        </ul>
      </nav>
    </header>
  );
}
