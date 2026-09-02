"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export interface NavItem {
  href: string;
  label: string;
  count?: number;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

function isCurrent(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminNav({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="a-btn a-btn-xs m-2 md:hidden"
        aria-expanded={open}
        aria-controls="admin-nav"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "Hide menu" : "Menu"}
      </button>
      <nav
        id="admin-nav"
        aria-label="Admin sections"
        className={`${open ? "block" : "hidden"} px-2 pb-3 md:block`}
      >
        {groups.map((group) => (
          <div key={group.title}>
            <p className="a-nav-group">{group.title}</p>
            <ul className="space-y-px">
              {group.items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    prefetch={false}
                    className="a-nav-link"
                    aria-current={isCurrent(pathname, item.href) ? "page" : undefined}
                    onClick={() => setOpen(false)}
                  >
                    <span>{item.label}</span>
                    {item.count ? <span className="a-nav-count">{item.count > 99 ? "99+" : item.count}</span> : null}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </>
  );
}
