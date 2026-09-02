/**
 * Seed copy for the database-backed content.
 *
 * The four pages carry exactly the words that were hard-coded in the
 * storefront before, so switching them to the database changes nothing a
 * customer sees. Terms and refund are new, written in the same voice.
 */

export interface SeedPage {
  slug: string;
  title: string;
  body: string;
  seoTitle: string;
  seoDescription: string;
  isSystem: boolean;
}

const about = `MARKORGANICS is a small Karachi company that makes the products a household actually uses every week: hair oil, a balm for headaches and sore muscles, and neel for the laundry. Nothing on this site is a luxury item, and none of it is priced like one.

## How we make things
The oils are cold-pressed in small batches and filtered, not refined. The balms follow formulas that have been used in Pakistani homes for decades. The neel is a liquid so it mixes properly. Where a product can be a single ingredient, it is.

## The colour bands
Every product family has a colour band printed across the label, the same way the band runs across this site.

- **Oils**: hair and body oils
- **Relief**: pain relief
- **Home**: laundry and home

## How we sell
Cash on delivery only, anywhere in Pakistan. We call every customer before dispatch. If a product arrives damaged or wrong, we replace it. Read the full [delivery and returns policy](/shipping-returns).`;

const privacy = `This page explains what we collect and why. It is short because we collect very little.

## What we collect
- Your name, phone number, city and address, so we can deliver the order and call to confirm it.
- Optional notes you add to the order.
- Your cart, which is stored only in your own browser until you check out.
- Basic, anonymised analytics about which pages are visited, if analytics is enabled.

## What we do not collect
- No card or bank details. We are cash on delivery only.
- No account or password. There is nothing to sign up for.

## Who sees it
Your delivery details are shared with the courier that delivers your parcel and with nobody else. We do not sell or rent customer information.

## How long we keep it
Order records are kept for accounting. Ask us to delete your details at any time by emailing hello@markorganics.pk.`;

const shipping = `## Delivery
- We deliver to every city and town in Pakistan through courier partners.
- Delivery costs Rs 200. Orders of Rs 2,000 or more are delivered free.
- Typical delivery time is 2 to 5 working days after confirmation. Remote areas can take longer.
- We call your number before dispatch. If we cannot reach you in two days, the order is cancelled.

## Cash on delivery
Pay the rider the exact amount on your confirmation page. Riders do not carry change for large notes, so keep the amount ready. Refusing a confirmed parcel repeatedly may limit future COD orders.

## Returns and replacements
- Damaged, leaking or wrong items are replaced free. Message us within 7 days of delivery with a photo.
- Opened personal-care products cannot be returned for change of mind, for hygiene reasons.
- Unopened items can be returned within 7 days. The return courier charge is deducted from the refund.
- Refunds are made by bank transfer or Easypaisa/JazzCash within 5 working days of receiving the return.

## Cancellations
Cancel any time before dispatch by messaging us with your order number. After dispatch, refuse the parcel at the door.`;

const refund = `## When we replace an item
If a parcel arrives damaged, leaking, or is not what you ordered, we replace it free. Message us within 7 days of delivery with a photo of the item and the packing slip.

## When we refund
- Unopened items returned within 7 days are refunded, less the return courier charge.
- Opened personal-care products cannot be refunded for change of mind, for hygiene reasons.
- If we cancel an order ourselves, nothing is charged, because nothing is paid before delivery.

## How a refund reaches you
By bank transfer, Easypaisa or JazzCash, within 5 working days of the returned parcel reaching us. We will ask for the account title and number, and nothing else.

## What to do first
Message us on WhatsApp with your order number. Most problems are settled in one conversation without a return.`;

const terms = `These terms cover buying from this website. They are written plainly on purpose.

## Ordering
Placing an order is an offer to buy, not a completed sale. We confirm every order by phone before it is dispatched. If we cannot reach you within two working days, the order is cancelled and nothing is charged.

## Prices and payment
Prices are in Pakistani rupees and include all taxes. Payment is cash on delivery only: you pay the rider when the parcel arrives. We never ask for card details, bank transfers or advance payment.

## Stock
Stock is reserved when you place an order. If an item sells out between your order and our confirmation call, we will offer a replacement or cancel that line.

## Refusals
Repeatedly refusing confirmed parcels costs us the courier charge both ways. We may ask for advance payment on future orders from a number that has done this several times.

## Product information
We describe what is in each product as accurately as we can. Nothing sold here is a medicine, and none of it is a substitute for advice from a doctor. Patch-test before first use, and keep everything away from the eyes and out of reach of children.

## Contact
Questions about these terms: hello@markorganics.pk.`;

export const SEED_PAGES: SeedPage[] = [
  {
    slug: "about",
    title: "About MARKORGANICS",
    body: about,
    seoTitle: "About",
    seoDescription:
      "MARKORGANICS makes everyday oils, balms and laundry blue for Pakistani homes. Honest ingredients, honest prices.",
    isSystem: true,
  },
  {
    slug: "privacy",
    title: "Privacy",
    body: privacy,
    seoTitle: "Privacy",
    seoDescription: "What MARKORGANICS collects when you order, and how it is used.",
    isSystem: true,
  },
  {
    slug: "shipping-returns",
    title: "Shipping and returns",
    body: shipping,
    seoTitle: "Shipping and returns",
    seoDescription: "Delivery charges, delivery times and the return policy for MARKORGANICS orders.",
    isSystem: true,
  },
  {
    slug: "refund",
    title: "Refund policy",
    body: refund,
    seoTitle: "Refund policy",
    seoDescription: "When MARKORGANICS replaces an item, when we refund, and how the money reaches you.",
    isSystem: true,
  },
  {
    slug: "terms",
    title: "Terms of service",
    body: terms,
    seoTitle: "Terms of service",
    seoDescription: "The terms of buying from MARKORGANICS: ordering, cash on delivery, stock and refusals.",
    isSystem: true,
  },
];

export interface SeedTemplate {
  key: string;
  name: string;
  channel: string;
  subject: string;
  body: string;
  isEnabled: boolean;
}

/** Stored and previewed only. Nothing sends these yet. */
export const SEED_TEMPLATES: SeedTemplate[] = [
  {
    key: "order_placed",
    name: "Order placed",
    channel: "whatsapp",
    subject: "We have your order {{order_number}}",
    body: "Assalam o Alaikum {{customer_name}}, this is {{store_name}}. We have your order {{order_number}} for {{total}}, cash on delivery. We will call shortly to confirm the address.",
    isEnabled: false,
  },
  {
    key: "order_confirmed",
    name: "Order confirmed",
    channel: "whatsapp",
    subject: "Order {{order_number}} is confirmed",
    body: "{{customer_name}}, your order {{order_number}} is confirmed and being packed. You will pay {{total}} to the rider on delivery in {{city}}.",
    isEnabled: false,
  },
  {
    key: "order_shipped",
    name: "Order shipped",
    channel: "whatsapp",
    subject: "Order {{order_number}} is on its way",
    body: "{{customer_name}}, order {{order_number}} has been handed to the courier for {{city}}. Please keep {{total}} ready for the rider.",
    isEnabled: false,
  },
  {
    key: "order_delivered",
    name: "Order delivered",
    channel: "whatsapp",
    subject: "Thank you for your order",
    body: "Thank you {{customer_name}}. Order {{order_number}} has been delivered. If anything arrived damaged or wrong, message us within 7 days and we will replace it.",
    isEnabled: false,
  },
];
