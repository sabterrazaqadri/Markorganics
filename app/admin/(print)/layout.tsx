import "../admin.css";
import "./print.css";

export const metadata = { title: "Packing slip", robots: { index: false, follow: false } };

/**
 * Print route group: no sidebar, no chrome, A5 pages.
 * It sits outside (panel) so nothing but the slip is on the paper.
 */
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <div className="a-shell p-slips">{children}</div>;
}
