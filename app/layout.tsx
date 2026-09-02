import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import { BRAND_NAME, SITE_URL } from "@/config/commerce";
import { ToastViewport } from "@/components/ui/Toast";
import { CartHydration } from "@/components/cart/CartHydration";
import "./globals.css";

// Variable fonts committed to the repo (latin subset), self-hosted by next/font.
// adjustFontFallback generates a size-adjusted fallback so text does not shift when the font loads.
const archivo = localFont({
  src: "./fonts/archivo.woff2",
  weight: "100 900",
  style: "normal",
  display: "swap",
  variable: "--font-archivo",
  adjustFontFallback: "Arial",
  preload: true,
});

const interTight = localFont({
  src: "./fonts/inter-tight.woff2",
  weight: "100 900",
  style: "normal",
  display: "swap",
  variable: "--font-inter-tight",
  adjustFontFallback: "Arial",
  preload: true,
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${BRAND_NAME} - Hair oils, pain relief balm and liquid neel`,
    template: `%s | ${BRAND_NAME}`,
  },
  description:
    "Everyday Pakistani household and personal-care products: cold-pressed hair oils, MARK Balm and Iodex for pain relief, and MARK Liquid Neel. Cash on delivery across Pakistan.",
  applicationName: BRAND_NAME,
  openGraph: {
    type: "website",
    siteName: BRAND_NAME,
    locale: "en_PK",
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#FCFBF8",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
};

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${archivo.variable} ${interTight.variable}`}>
      <body className="min-h-dvh bg-paper text-ink">
        {children}
        <CartHydration />
        <ToastViewport />
        {GA_ID ? (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
            <Script id="ga4" strategy="afterInteractive">
              {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}',{anonymize_ip:true});`}
            </Script>
          </>
        ) : null}
      </body>
    </html>
  );
}
