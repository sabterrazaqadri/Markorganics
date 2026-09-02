"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SettingsTabs({ tabs }: { tabs: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Settings sections" className="a-tabs mb-3">
      {tabs.map((tab) => (
        <Link key={tab.href} href={tab.href} className="a-tab" aria-current={pathname === tab.href ? "page" : undefined}>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
