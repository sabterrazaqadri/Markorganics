"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { CONSENT_EVENT, readConsent, writeConsent, type ConsentValue } from "@/lib/analytics/client";

/**
 * The three browser pixels, plus the banner that gates them.
 *
 * The Meta base PageView (init snippet + every client-side nav via
 * <RouteChangeTracker>) fires unconditionally, consent or not — it is
 * table-stakes ad measurement, not a tracking decision a cookie banner needs
 * to gate. GA4, TikTok, and every commerce event (ViewContent, AddToCart,
 * InitiateCheckout, Purchase, Contact — see lib/analytics/client.ts
 * `trackEvent`) still wait for consent, because those describe what a named
 * visitor actually did, not just that a page was requested.
 *
 * Server-side events are unaffected. A customer's own purchase is reported
 * from the job runner whatever the banner says, because that is the shop's
 * record of its own sale, not third-party tracking of a stranger.
 */

export interface AnalyticsIds {
  metaPixelId: string;
  ga4MeasurementId: string;
  tiktokPixelCode: string;
}

export function Analytics({ ids, requireConsent }: { ids: AnalyticsIds; requireConsent: boolean }) {
  const [consent, setConsent] = useState<ConsentValue>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setConsent(readConsent());
    setReady(true);
    const onChange = (event: Event) => setConsent((event as CustomEvent<ConsentValue>).detail ?? readConsent());
    window.addEventListener(CONSENT_EVENT, onChange);
    return () => window.removeEventListener(CONSENT_EVENT, onChange);
  }, []);

  // Capture fbclid the moment the page loads, whatever the consent banner
  // says. This only writes a first-party attribution cookie — it sends
  // nothing to Meta — so it does not need to wait for consent. Without this,
  // a visitor who lands with ?fbclid=... and navigates on before accepting
  // the banner loses the click id for good: fbclid is gone from the URL by
  // the time RouteChangeTracker (consent-gated) would otherwise catch it.
  useEffect(() => {
    const fbclid = new URLSearchParams(window.location.search).get("fbclid");
    // eslint-disable-next-line no-console
    console.log("[META-DEBUG] initial-load fbclid capture", { fbclid, url: window.location.href });
    rememberClickId(fbclid);
  }, []);

  const allowed = requireConsent ? consent === "granted" : true;
  const anyPixel = Boolean(ids.metaPixelId || ids.ga4MeasurementId || ids.tiktokPixelCode);

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log("[META-DEBUG] Analytics gating state", {
      requireConsent,
      consent,
      allowed,
      hasMetaPixelId: Boolean(ids.metaPixelId),
    });
  }, [requireConsent, consent, allowed, ids.metaPixelId]);

  return (
    <>
      {ids.metaPixelId ? (
        // Unconditional: base PageView is not consent-gated. See the note
        // at the top of this file.
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${ids.metaPixelId}');fbq('track','PageView');console.log('[META-DEBUG] fbq init + PageView fired', '${ids.metaPixelId}');`}
        </Script>
      ) : null}

      {allowed && ids.ga4MeasurementId ? (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${ids.ga4MeasurementId}`}
            strategy="afterInteractive"
          />
          <Script id="ga4" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${ids.ga4MeasurementId}',{anonymize_ip:true});`}
          </Script>
        </>
      ) : null}

      {ids.metaPixelId || ids.tiktokPixelCode ? (
        // Unconditional so Meta's follow-up PageViews keep firing without
        // consent, matching the init snippet above. ttq?.page?.() below is
        // a safe no-op until the TikTok snippet itself has loaded (still
        // consent-gated), so this costs TikTok nothing.
        // useSearchParams needs a Suspense boundary or the whole layout
        // opts into client rendering.
        <Suspense fallback={null}>
          <RouteChangeTracker />
        </Suspense>
      ) : null}

      {allowed && ids.tiktokPixelCode ? (
        <Script id="tiktok-pixel" strategy="afterInteractive">
          {`!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];ttq.setAndDefer=function(e,n){e[n]=function(){e.push([n].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(e){for(var n=ttq._i[e]||[],i=0;i<ttq.methods.length;i++)ttq.setAndDefer(n,ttq.methods[i]);return n};ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=i;ttq._t=ttq._t||{};ttq._t[e]=+new Date;ttq._o=ttq._o||{};ttq._o[e]=n||{};var o=d.createElement("script");o.type="text/javascript";o.async=!0;o.src=i+"?sdkid="+e+"&lib="+t;var a=d.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load('${ids.tiktokPixelCode}');ttq.page()}(window,document,'ttq');`}
        </Script>
      ) : null}

      {requireConsent && anyPixel && ready && consent === null ? (
        <ConsentBanner onChoose={(value) => writeConsent(value)} />
      ) : null}
    </>
  );
}

interface PixelWindow extends Window {
  fbq?: (...args: unknown[]) => void;
  ttq?: { page?: () => void };
}

/**
 * Fires PageView on every client-side navigation after the first paint, and
 * records the click id Meta puts in the URL.
 *
 * The first page view is skipped here because the init snippet sends it, and
 * the snippet may not have run yet when this effect first fires; a PageView
 * sent to a pixel that has not been initialised is silently dropped.
 */
function RouteChangeTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const last = useRef<string | null>(null);

  useEffect(() => {
    rememberClickId(searchParams.get("fbclid"));

    const key = `${pathname}?${search}`;
    if (last.current === null) {
      last.current = key;
      // eslint-disable-next-line no-console
      console.log("[META-DEBUG] RouteChangeTracker skipping first pathname (init snippet handles it)", key);
      return;
    }
    if (last.current === key) return;
    last.current = key;

    const w = window as PixelWindow;
    // eslint-disable-next-line no-console
    console.log("[META-DEBUG] RouteChangeTracker firing PageView on client-side nav", key, "fbq present:", Boolean(w.fbq));
    try {
      w.fbq?.("track", "PageView");
    } catch {
      /* ignore */
    }
    try {
      w.ttq?.page?.();
    } catch {
      /* ignore */
    }
  }, [pathname, search, searchParams]);

  return null;
}

/**
 * `_fbc` is how Meta ties a visit back to the ad that was clicked. The pixel
 * sets it itself, but only once it has loaded — a visitor who lands and
 * moves on quickly can lose it. Writing it here on arrival is cheap, and the
 * Conversions API reads the cookie on every server event.
 */
function rememberClickId(fbclid: string | null) {
  if (!fbclid || !/^[\w-]{1,255}$/.test(fbclid)) return;
  try {
    if (document.cookie.split("; ").some((c) => c.startsWith("_fbc="))) return;
    const secure = window.location.protocol === "https:" ? "; secure" : "";
    document.cookie = `_fbc=fb.1.${Date.now()}.${fbclid}; path=/; max-age=7776000; samesite=lax${secure}`;
  } catch {
    /* cookies blocked: the pixel will try again on its own */
  }
}

function ConsentBanner({ onChoose }: { onChoose: (value: "granted" | "denied") => void }) {
  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookies"
      className="fixed inset-x-0 bottom-0 z-[60] border-t border-rule bg-white px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]"
    >
      <div className="container-x flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-ink-soft">
          We use cookies to see which products people look at, so we stock the right ones. Nothing here identifies you
          personally, and your order works either way.
        </p>
        <div className="flex shrink-0 gap-2">
          <button type="button" className="btn btn-secondary" onClick={() => onChoose("denied")}>
            No thanks
          </button>
          <button type="button" className="btn btn-primary" onClick={() => onChoose("granted")}>
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
