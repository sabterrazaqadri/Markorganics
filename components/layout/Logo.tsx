import Link from "next/link";
import { BRAND_NAME } from "@/config/commerce";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`inline-flex items-center gap-2.5 ${className}`} aria-label={`${BRAND_NAME} home`}>
      <span className="flex gap-[3px]" aria-hidden="true">
        <span className="block h-6 w-1.5 bg-band-oil" />
        <span className="block h-6 w-1.5 bg-band-care" />
        <span className="block h-6 w-1.5 bg-band-home" />
      </span>
      <span className="font-display text-lg font-bold tracking-tight">MARKORGANICS</span>
    </Link>
  );
}
