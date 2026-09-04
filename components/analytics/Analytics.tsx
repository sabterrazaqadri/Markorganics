"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import { CONSENT_EVENT, readConsent, writeConsent, type ConsentValue } from "@/lib/analytics/client";

/**
 * The three browser pixels, plus the banner that gates them.
 *
 * Nothing loads until consent is granted. That is why the tags are rendered
 * conditionally rather than loaded-then-silenced: a script that has already
 * run has already set its cookies.
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

  const allowed = requireConsent ? consent === "granted" : true;
  const anyPixel = Boolean(ids.metaPixelId || ids.ga4MeasurementId || ids.tiktokPixelCode);

  return (
    <>
      {allowed && ids.metaPixelId ? (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${ids.metaPixelId}');fbq('track','PageView');`}
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
