import type { Metadata } from "next";
import { ToastViewport } from "@/components/ui/Toast";
import "./admin.css";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · MARK admin" },
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="a-shell">
      {children}
      <ToastViewport />
    </div>
  );
}
