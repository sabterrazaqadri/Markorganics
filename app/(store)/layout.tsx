import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { AddedModal } from "@/components/cart/AddedModal";
import { Analytics } from "@/components/analytics/Analytics";
import { getStorefrontIntegrations } from "@/lib/integrations/config";
import { DEFAULT_SETTINGS, getIntegrationSettings } from "@/lib/settings";

/**
 * The three browser pixels mount here, not in the shared root layout, so
 * `/admin/**` (which nests inside the same root `<html>`) never loads them.
 * A database that is momentarily unreachable should cost the shop its
 * pixels, never its storefront, so both reads fail closed.
 */
async function pixelIds() {
  try {
    return await getStorefrontIntegrations();
  } catch (err) {
    console.error("could not read integration ids; rendering without pixels", err);
    return { metaPixelId: "", ga4MeasurementId: "", tiktokPixelCode: "", searchConsoleToken: "" };
  }
}

async function consentSetting(): Promise<boolean> {
  try {
    return (await getIntegrationSettings()).consentBanner;
  } catch {
    // Asking for consent we do not need is the harmless failure; loading a
    // pixel without it is not.
    return DEFAULT_SETTINGS.integrations.consentBanner;
  }
}

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [ids, requireConsent] = await Promise.all([pixelIds(), consentSetting()]);

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded focus:bg-ink focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>
      <Header />
      <main id="main" className="flex-1">
        {children}
      </main>
      <Footer />
      <CartDrawer />
      <AddedModal />
      <Analytics
        ids={{
          metaPixelId: ids.metaPixelId,
          ga4MeasurementId: ids.ga4MeasurementId,
          tiktokPixelCode: ids.tiktokPixelCode,
        }}
        requireConsent={requireConsent}
      />
    </>
  );
}
