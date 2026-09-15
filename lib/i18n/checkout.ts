import type { Lang } from "@/lib/i18n/lang";

/**
 * Checkout strings in both languages. The form is a client component, so it
 * reads the language from the store and picks the row it needs; nothing here
 * changes what is submitted to the server.
 */
const en = {
  title: "Checkout",
  intro: "One page, no account needed. Pay cash on delivery.",
  contact: "Contact",
  fullName: "Full name",
  phone: "Mobile number",
  phoneHint: "We call this number to confirm the order.",
  altPhone: "Alternate number (optional)",
  deliveryAddress: "Delivery address",
  city: "City",
  cityHint: "Not in the list? Type your town name.",
  cityPlaceholder: "Start typing, e.g. Karachi",
  address: "Full address",
  addressHint: "House or flat, street, area, and any landmark.",
  notes: "Order notes (optional)",
  notesPlaceholder: "Delivery timing, gate instructions",
  yourOrder: "Your order",
  items: "Items",
  discount: "Discount",
  delivery: "Delivery",
  free: "Free",
  calculating: "Calculating",
  total: "Total",
  cod: "Cash on delivery",
  codNote: (total: string, window: string) => `Pay ${total} to the rider when your parcel arrives. Delivery takes ${window}.`,
  placeOrder: "Place order",
  placing: "Placing order",
  agree: "By placing an order you agree to our",
  terms: "delivery and returns terms",
  empty: "There is nothing to check out yet. Add a product first.",
  seeAll: "See all products",
  loading: "Loading your cart.",
  cityBlocked: (city: string) => `We do not deliver to ${city} yet. Message us on WhatsApp and we will see what we can do.`,
  checkFields: "Please check the form and try again.",
  paymentMethods: "How you can pay",
};

const ur: typeof en = {
  title: "آرڈر مکمل کریں",
  intro: "ایک ہی صفحہ، اکاؤنٹ کی ضرورت نہیں۔ ادائیگی ڈیلیوری پر نقد۔",
  contact: "رابطہ",
  fullName: "پورا نام",
  phone: "موبائل نمبر",
  phoneHint: "آرڈر کی تصدیق کے لیے ہم اسی نمبر پر کال کرتے ہیں۔",
  altPhone: "دوسرا نمبر (اختیاری)",
  deliveryAddress: "ڈیلیوری کا پتہ",
  city: "شہر",
  cityHint: "فہرست میں نہیں؟ اپنے شہر کا نام لکھیں۔",
  cityPlaceholder: "لکھنا شروع کریں، مثلاً کراچی",
  address: "مکمل پتہ",
  addressHint: "مکان یا فلیٹ نمبر، گلی، علاقہ اور کوئی قریبی نشانی۔",
  notes: "آرڈر نوٹ (اختیاری)",
  notesPlaceholder: "ڈیلیوری کا وقت، گیٹ کی ہدایات",
  yourOrder: "آپ کا آرڈر",
  items: "اشیاء",
  discount: "رعایت",
  delivery: "ڈیلیوری",
  free: "مفت",
  calculating: "حساب ہو رہا ہے",
  total: "کل",
  cod: "ڈیلیوری پر نقد ادائیگی",
  codNote: (total: string, window: string) => `پارسل ملنے پر رائیڈر کو ${total} ادا کریں۔ ڈیلیوری ${window} میں ہوتی ہے۔`,
  placeOrder: "آرڈر کریں",
  placing: "آرڈر ہو رہا ہے",
  agree: "آرڈر کرنے کا مطلب ہے کہ آپ ہماری",
  terms: "ڈیلیوری اور واپسی کی شرائط",
  empty: "ابھی کارٹ خالی ہے۔ پہلے کوئی پروڈکٹ شامل کریں۔",
  seeAll: "تمام پروڈکٹس دیکھیں",
  loading: "آپ کا کارٹ لوڈ ہو رہا ہے۔",
  cityBlocked: (city: string) => `ہم ابھی ${city} میں ڈیلیوری نہیں کرتے۔ واٹس ایپ پر پیغام بھیجیں، ہم کوشش کریں گے۔`,
  checkFields: "براہ کرم فارم دوبارہ چیک کریں۔",
  paymentMethods: "ادائیگی کے طریقے",
};

export const CHECKOUT_COPY: Record<Lang, typeof en> = { en, ur };

/** Delivery window in Urdu, matching config/commerce.ts DELIVERY_WINDOW. */
export const DELIVERY_WINDOW_UR = "2 سے 5 کام کے دن";

/** Short shared strings used on the product page and cart. */
export const STORE_COPY = {
  en: {
    addToCart: "Add to cart",
    soldOut: "Sold out",
    orderOnWhatsApp: "Order on WhatsApp",
    onlyLeft: (n: number) => `Only ${n} left.`,
    codLine: "Cash on delivery. Pay the rider when your order arrives.",
    freeDeliveryIn: (amount: string) => `Add ${amount} more for free delivery.`,
    freeDeliveryUnlocked: "Delivery is free on this order.",
  },
  ur: {
    addToCart: "کارٹ میں ڈالیں",
    soldOut: "ختم",
    orderOnWhatsApp: "واٹس ایپ پر آرڈر کریں",
    onlyLeft: (n: number) => `صرف ${n} باقی ہیں۔`,
    codLine: "ڈیلیوری پر نقد ادائیگی۔ آرڈر ملنے پر رائیڈر کو پیسے دیں۔",
    freeDeliveryIn: (amount: string) => `مفت ڈیلیوری کے لیے ${amount} کا مزید سامان شامل کریں۔`,
    freeDeliveryUnlocked: "اس آرڈر پر ڈیلیوری مفت ہے۔",
  },
} satisfies Record<Lang, unknown>;
