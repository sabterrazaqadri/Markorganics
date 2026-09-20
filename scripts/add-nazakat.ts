import "./env";
import { eq, isNull, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { createProduct } from "@/lib/queries/products-admin";
import type { ProductValues } from "@/lib/validation/product";

/**
 * One-off: adds NAZAKAT, the third product in the Josh / Rahat / Nazakat
 * range, from the details the owner supplied directly (no seed file, since
 * this is a real catalogue addition, not fixture data).
 *
 *   npx tsx scripts/add-nazakat.ts
 */
const SLUG = "mark-nazakat-bust-massage-oil";

const values: ProductValues = {
  name: "MARK Nazakat Bust Massage Oil",
  slug: SLUG,
  family: "oils",
  status: "active",
  productType: "Body Care",
  vendor: "Hammad Hamza",
  tags: [],
  seoTitle: "",
  seoDescription: "",
  shortDescription:
    "Nourishing herbal bust massage oil for women — almond, kalonji, jojoba, fenugreek-infused sesame, pomegranate seed and rosehip oils.",
  longDescription:
    "Nazakat is a gentle herbal massage oil formulated to nourish, moisturise and care for the skin. A blend of almond, kalonji (black seed), jojoba, fenugreek-infused sesame, pomegranate seed and rosehip oils, carried with vitamin E and geranium, frankincense and lavender essential oils. Regular massage helps maintain a soft, smooth and healthy skin feel and supports skin elasticity. For external use only.",
  howToUse: [
    "After bathing, while the skin is still slightly damp, take 5 to 6 drops of oil in your palm.",
    "Massage each breast gently in circular motions from bottom to top for 3 to 5 minutes.",
    "Avoid the nipple and the area immediately around it.",
    "Use nightly as part of your regular massage-care routine.",
  ],
  ingredients:
    "Almond Oil, Kalonji (Black Seed) Oil, Jojoba Oil, Fenugreek-Infused Sesame Oil, Pomegranate Seed Oil, Rosehip Oil, Vitamin E Oil, Geranium Oil, Frankincense Oil, Lavender Oil",
  benefits: [
    "Nourishes and moisturises the skin",
    "Supports skin elasticity",
    "Leaves skin feeling soft and smooth",
    "100% herbal ingredients",
    "For external use only",
  ],
  images: [],
  isBestseller: false,
  isArchived: false,
  sortOrder: 2,
  variants: [
    {
      sku: "MRK-MN-15",
      label: "15 ml",
      barcode: "",
      priceRupees: 2250,
      compareAtRupees: 3000,
      stock: 10,
      lowStockThreshold: 5,
      costRupees: null,
    },
  ],
  metafields: [],
  collectionIds: [],
  faqs: [
    {
      q: "What is Nazakat and who is it for?",
      a: "Nazakat is a nourishing herbal bust massage oil for women, blended with almond, kalonji, jojoba, fenugreek-infused sesame, pomegranate seed and rosehip oils. For external use only.",
    },
    {
      q: "How do I use it and how much?",
      a: "After bathing, while the skin is still slightly damp, take 5 to 6 drops in your palm. Massage each breast gently from bottom to top in circular motions for 3 to 5 minutes, avoiding the nipple and areola. Use nightly as part of your regular care routine.",
    },
    {
      q: "Is the packaging discreet?",
      a: "Yes. The parcel is a plain box with no product name on the outside, and the rider only sees your name and the amount to collect.",
    },
    {
      q: "Can I pay cash on delivery?",
      a: "Yes. Every order is cash on delivery across Pakistan. There is no advance payment and no card is asked for.",
    },
    {
      q: "What is in it?",
      a: "A blend of almond, kalonji, jojoba, fenugreek-infused sesame, pomegranate seed and rosehip oils with vitamin E and geranium, frankincense and lavender essential oils. No mineral oil, no artificial fragrance, no synthetic colour.",
    },
    {
      q: "Is it safe to use every night?",
      a: "Yes, it is formulated for nightly external massage. Stop use if irritation occurs, and never apply to broken or irritated skin.",
    },
  ],
  urdu: {
    name: "نزاکت",
    shortDescription:
      "خواتین کے لیے نرمی سے پرورش کرنے والا ہربل بسٹ مساج آئل، بادام، کلونجی، جوجوبا اور انار کے بیج کے تیل سے تیار۔",
    longDescription:
      "نزاکت ایک نرمی سے پرورش کرنے والا ہربل مساج آئل ہے، جو بادام، کلونجی، جوجوبا، میتھی میں بھگوئے تلوں کے تیل، انار کے بیج اور گلاب ہپ کے تیل سے تیار کیا گیا ہے۔ باقاعدہ مساج سے جلد نرم، ملائم اور صحت مند محسوس ہوتی ہے۔ صرف بیرونی استعمال کے لیے۔",
    howToUse: [
      "نہانے کے بعد جب جلد ہلکی نم ہو، 5 سے 6 قطرے ہتھیلی پر لیں۔",
      "ہر بریسٹ پر نیچے سے اوپر کی طرف، گول گول انداز میں 3 سے 5 منٹ نرمی سے مساج کریں۔",
      "نپل اور اس کے اردگرد کے حصے پر نہ لگائیں۔",
      "روزانہ رات کو اپنی مساج کیئر روٹین کے طور پر استعمال کریں۔",
    ],
    ingredients: "بادام کا تیل، کلونجی کا تیل، جوجوبا آئل، میتھی میں بھگوئے تلوں کا تیل، انار کے بیج کا تیل، گلاب ہپ آئل، وٹامن ای، جیرینیم، لوبان، لیوینڈر۔",
    benefits: [
      "جلد کو نمی اور غذائیت فراہم کرتا ہے",
      "جلد کی لچک میں مدد دیتا ہے",
      "نرم اور ملائم جلد کا احساس",
      "100% ہربل اجزاء",
      "صرف بیرونی استعمال کے لیے",
    ],
    faqs: [
      { q: "نزاکت کیا ہے اور کس کے لیے ہے؟", a: "نزاکت خواتین کے لیے ایک نرمی سے پرورش کرنے والا ہربل بسٹ مساج آئل ہے۔ صرف بیرونی استعمال کے لیے۔" },
      { q: "استعمال کیسے کریں؟", a: "نہانے کے بعد جب جلد ہلکی نم ہو، 5 سے 6 قطرے ہتھیلی پر لیں اور ہر بریسٹ پر نیچے سے اوپر کی طرف گول گول 3 سے 5 منٹ نرمی سے مساج کریں، نپل والے حصے سے بچتے ہوئے۔" },
      { q: "کیا پیکنگ رازدارانہ ہے؟", a: "جی ہاں۔ پارسل سادہ ڈبے میں آتا ہے جس پر باہر پروڈکٹ کا نام نہیں ہوتا۔" },
      { q: "کیا ڈیلیوری پر ادائیگی ہو سکتی ہے؟", a: "جی ہاں۔ پورے پاکستان میں ہر آرڈر کیش آن ڈیلیوری ہے۔ کوئی پیشگی رقم نہیں۔" },
      { q: "کیا یہ ہر رات استعمال کیا جا سکتا ہے؟", a: "جی ہاں، یہ روزانہ رات کے بیرونی مساج کے لیے بنایا گیا ہے۔ جلن ہو تو استعمال بند کریں اور کٹی پھٹی جلد پر نہ لگائیں۔" },
    ],
  },
  isBundle: false,
  bundleComponents: [],
};

async function main() {
  const existing = await db.query.products.findFirst({ where: and(eq(products.slug, SLUG), isNull(products.deletedAt)) });
  if (existing) {
    console.log(`Nazakat already exists (${existing.id}), skipping.`);
    process.exit(0);
  }
  const id = await createProduct(values);
  console.log(`Created Nazakat: ${id}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
