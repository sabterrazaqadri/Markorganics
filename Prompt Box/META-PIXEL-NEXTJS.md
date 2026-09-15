# Meta Pixel + Conversions API — Next.js Implementation

---

## Part 1 — Pixel hai kya

Pixel ek **JavaScript snippet** hai jo aap ki website par lagta hai. Iska kaam sirf ek hai: **jab koi banda website par kuch karta hai, Meta ko batana.**

Bas itna. Koi jaadu nahi.

### Kaam kaise karta hai

```
Banda ad par click karta hai
        ↓
Website khulti hai → Pixel load hota hai
        ↓
Banda product dekhta hai   → "ViewContent" event Meta ko jata hai
Banda cart mein daalta hai  → "AddToCart" event jata hai
Banda order karta hai       → "Purchase" event jata hai (+ value)
        ↓
Meta apne data se match karta hai: "yeh banda kaun tha?"
        ↓
Meta seekhta hai: "is tarah ke log kharidte hain"
        ↓
Meta aise aur log dhoondh kar aap ka ad dikhata hai
```

### Isse kya milta hai — teen cheezein

**1. Optimization (sabse ahem)**
Pixel ke bagair Meta ko sirf pata hai ke kis ne click kiya. Pixel ke sath usko pata chalta hai kis ne **kharida**. Phir woh apne AI se aise hi log dhoondhta hai. Yehi wajah hai ke pixel data ban jane ke baad cost-per-order girta hai.

**2. Retargeting**
Jo banda website aaya magar kharida nahi — usko dobara ad dikhana. Yeh sabse sasta traffic hota hai.

**3. Lookalike audience**
30-50 purchases ke baad Meta se keh sakte hain: "jo log kharid chuke hain, unke jaise 1% Pakistanis dhoondho." Yeh naye customers ka sabse achha zariya hai.

### Standard events jo aap ko chahiye

| Event | Kab fire ho |
|---|---|
| `PageView` | Har page par (automatic) |
| `ViewContent` | Product page khulne par |
| `AddToCart` | Cart mein daalne par |
| `InitiateCheckout` | Checkout shuru karne par |
| `Purchase` | Order confirm hone par — **value aur currency ke sath** |
| `Contact` | WhatsApp button dabane par |

**Purchase mein `value` aur `currency` bhejna zaroori hai** — warna ROAS calculate nahi hoga aur value-based optimization kaam nahi karega.

---

## Part 2 — Pixel ID kahan se milega

1. business.facebook.com → **Events Manager**
2. **Connect Data Sources** → **Web** → **Meta Pixel**
3. Naam dein: `MARK Organics Pixel`
4. Dataset/Pixel ID copy karein (15-16 digit number)

Isi screen se baad mein **Conversions API access token** bhi milega — abhi rakh lein.

`.env.local`:
```
NEXT_PUBLIC_FB_PIXEL_ID=1234567890123456
FB_CAPI_ACCESS_TOKEN=EAAxxxxx...
FB_TEST_EVENT_CODE=TEST12345
```

> `NEXT_PUBLIC_` prefix sirf Pixel ID par — access token **kabhi** client par expose na karein.

---

## Part 3 — Next.js mein lagana (App Router)

### 3.1 — Pixel component

`components/MetaPixel.tsx`

```tsx
'use client';

import Script from 'next/script';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, Suspense } from 'react';

const PIXEL_ID = process.env.NEXT_PUBLIC_FB_PIXEL_ID!;

function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (typeof window.fbq === 'function') {
      window.fbq('track', 'PageView');
    }
  }, [pathname, searchParams]);

  return null;
}

export default function MetaPixel() {
  if (!PIXEL_ID) return null;

  return (
    <>
      <Script id="meta-pixel" strategy="afterInteractive">
        {`
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window,document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '${PIXEL_ID}');
        `}
      </Script>

      <noscript>
        <img
          height="1"
          width="1"
          style={{ display: 'none' }}
          src={`https://www.facebook.com/tr?id=${PIXEL_ID}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>

      <Suspense fallback={null}>
        <PageViewTracker />
      </Suspense>
    </>
  );
}
```

**Ahem:** Next.js SPA hai — page change par browser reload nahi hota, isliye `PageView` khud fire karna parta hai. Zyada tar log yeh bhool jate hain aur unka data adhoora rehta hai.

### 3.2 — Layout mein daalein

`app/layout.tsx`

```tsx
import MetaPixel from '@/components/MetaPixel';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <MetaPixel />
        {children}
      </body>
    </html>
  );
}
```

### 3.3 — Type declaration

`types/global.d.ts`

```ts
declare global {
  interface Window {
    fbq: (...args: any[]) => void;
  }
}
export {};
```

### 3.4 — Event helper

`lib/pixel.ts`

```ts
type EventData = Record<string, unknown>;

/** Client-side pixel event + parallel server-side CAPI call (deduplicated). */
export async function trackEvent(
  eventName: string,
  data: EventData = {},
  userData: { email?: string; phone?: string } = {}
) {
  const eventId = crypto.randomUUID();

  // 1. Browser Pixel
  if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
    window.fbq('track', eventName, data, { eventID: eventId });
  }

  // 2. Server (Conversions API) — same eventId so Meta dedupes
  try {
    await fetch('/api/meta-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventName,
        eventId,
        data,
        userData,
        sourceUrl: window.location.href,
      }),
    });
  } catch {
    // CAPI fail hone par browser pixel phir bhi chal chuka hai — chup rahein
  }
}
```

### 3.5 — Use karna

```tsx
'use client';
import { trackEvent } from '@/lib/pixel';

// Product page
useEffect(() => {
  trackEvent('ViewContent', {
    content_ids: [product.sku],
    content_name: product.name,
    content_type: 'product',
    value: product.price,
    currency: 'PKR',
  });
}, [product.sku]);

// Add to cart
<button onClick={() => trackEvent('AddToCart', {
  content_ids: [product.sku],
  value: product.price,
  currency: 'PKR',
})}>
  Cart mein daalein
</button>

// WhatsApp button
<a
  href="https://wa.me/92XXXXXXXXXX"
  onClick={() => trackEvent('Contact')}
>
  WhatsApp par order
</a>
```

**Purchase — order confirm hone par:**

```ts
trackEvent('Purchase', {
  content_ids: order.items.map(i => i.sku),
  content_type: 'product',
  value: order.total,          // number, string nahi
  currency: 'PKR',
  num_items: order.items.length,
}, {
  phone: order.phone,          // hashing server par hogi
  email: order.email,
});
```

---

## Part 4 — Conversions API (server-side)

### Yeh kyun zaroori hai

Browser pixel ab bharosemand nahi raha:
- iOS ki privacy settings events block kar deti hain
- Ad blockers pixel band kar dete hain
- Browser third-party cookies khatam kar rahe hain

Conversions API events **aap ke server se seedha Meta ko** bhejta hai — browser ko bypass karke. Dono sath chalane se typically kaafi zyada conversions attribute hote hain.

**Deduplication:** dono jagah se same `event_id` bhejne par Meta samajh jata hai ke yeh ek hi event hai, double count nahi karta. Yeh sabse ahem hissa hai — bina iske aap ke numbers galat honge.

### API route

`app/api/meta-event/route.ts`

```ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const PIXEL_ID = process.env.NEXT_PUBLIC_FB_PIXEL_ID!;
const TOKEN = process.env.FB_CAPI_ACCESS_TOKEN!;
const API_VERSION = 'v21.0'; // Graph API ki current version check kar lein

/** Meta ko sab PII SHA-256 hashed chahiye — normalize pehle. */
const hash = (v?: string) =>
  v ? crypto.createHash('sha256').update(v.trim().toLowerCase()).digest('hex') : undefined;

/** Pakistani numbers: E.164 without '+', e.g. 923001234567 */
const normalizePhone = (p?: string) => {
  if (!p) return undefined;
  let d = p.replace(/\D/g, '');
  if (d.startsWith('0')) d = '92' + d.slice(1);
  if (!d.startsWith('92')) d = '92' + d;
  return d;
};

export async function POST(req: NextRequest) {
  try {
    const { eventName, eventId, data = {}, userData = {}, sourceUrl } = await req.json();

    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
      req.headers.get('x-real-ip') ??
      undefined;

    const payload = {
      data: [
        {
          event_name: eventName,
          event_time: Math.floor(Date.now() / 1000),
          event_id: eventId,                  // dedup key
          event_source_url: sourceUrl,
          action_source: 'website',
          user_data: {
            em: hash(userData.email),
            ph: hash(normalizePhone(userData.phone)),
            client_ip_address: ip,
            client_user_agent: req.headers.get('user-agent') ?? undefined,
            fbp: req.cookies.get('_fbp')?.value,
            fbc: req.cookies.get('_fbc')?.value,
          },
          custom_data: data,
        },
      ],
      ...(process.env.FB_TEST_EVENT_CODE && {
        test_event_code: process.env.FB_TEST_EVENT_CODE,
      }),
    };

    const res = await fetch(
      `https://graph.facebook.com/${API_VERSION}/${PIXEL_ID}/events?access_token=${TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );

    const json = await res.json();
    if (!res.ok) {
      console.error('CAPI error:', json);
      return NextResponse.json({ ok: false }, { status: 200 });
    }

    return NextResponse.json({ ok: true, ...json });
  } catch (err) {
    console.error('CAPI route error:', err);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
```

> Route hamesha `200` return karta hai — ads tracking ki wajah se checkout kabhi na toote.

### `fbp` aur `fbc` cookies

- `_fbp` — pixel khud set karta hai (browser identifier)
- `_fbc` — jab koi `?fbclid=` wale link se aata hai

Yeh dono match quality bohat barhate hain. `_fbc` khud set karna ho to:

```ts
// app par ek dafa, client side
const fbclid = new URLSearchParams(window.location.search).get('fbclid');
if (fbclid && !document.cookie.includes('_fbc=')) {
  document.cookie = `_fbc=fb.1.${Date.now()}.${fbclid}; path=/; max-age=7776000`;
}
```

---

## Part 5 — Test kaise karein

**1. Meta Pixel Helper** — Chrome extension install karein. Website kholein, extension par events dikhne chahiyein.

**2. Test Events** — Events Manager → aap ka pixel → **Test Events** tab. Wahan se test code milta hai; `.env` mein daal kar events live dikhte hain.

**3. Event Match Quality** — Events Manager mein har event ka score dikhta hai (0-10). Phone/email hashed bhejne se yeh score barhta hai, aur score jitna behtar, optimization utni behtar.

**4. Purchase check** — ek test order karein. Purchase event `value: 1500, currency: PKR` ke sath dikhna chahiye, aur **sirf ek dafa** (dedup kaam kar raha hai).

---

## Part 6 — Aam ghaltiyan

1. **PageView SPA par fire na karna** — Next.js mein sabse aam bug
2. **`value` string bhejna** — `"1500"` nahi, `1500`
3. **Currency na bhejna** — ROAS calculate nahi hoga
4. **`event_id` na bhejna** — events double count honge, numbers jhooth bolenge
5. **Access token client par expose karna** — koi bhi aap ke pixel par jhooti conversions bhej sakta hai
6. **Purchase ko `useEffect` mein bina guard ke rakhna** — page refresh par dobara fire hota hai. Order ID ko `sessionStorage` mein rakh kar guard lagayein
7. **PII bina hash kiye bhejna** — Meta reject kar deta hai aur privacy ka masla bhi hai

---

## Aap ke case mein — ahem baat

Aap month 1 mein **WhatsApp se orders** le rahe hain, website se nahi. Isliye:

**Har WhatsApp order ko website ke through process karein** — chahe aap khud admin panel se order banayein. Yeh `Purchase` event fire karega aur pixel ko data milta rahega.

Bina iske pixel khali rahega, aur month 2 mein jab Sales campaign chalayenge to Meta ke paas seekhne ke liye kuch nahi hoga. 30-50 purchases jama ho jayein to hi lookalike audience aur purchase optimization kaam karta hai.
