import type { ProductFaq, ProductI18nUr } from "@/lib/db/schema";

/**
 * Per-product FAQ pairs and Urdu copy, keyed on the product slug, plus the
 * kits. Applied by scripts/seed-storefront.ts, which never overwrites an
 * FAQ list or an Urdu field that already has content unless --reset is
 * passed, so edits made in the admin survive a re-run.
 *
 * Wording stays on the comfort, warmth and care side of the line. No disease
 * claims: those are what get a page, and an ad account, taken down.
 */

export interface ProductContent {
  faqs: ProductFaq[];
  ur: ProductI18nUr;
}

export const PRODUCT_CONTENT: Record<string, ProductContent> = {
  "josh-mens-herbal-oil": {
    faqs: [
      {
        q: "What is Josh and who is it for?",
        a: "Josh is a concentrated herbal massage oil for adult men. It warms the skin within a minute of massaging it in and is used as part of a couples' massage routine. External use only.",
      },
      {
        q: "How do I use it and how much?",
        a: "Wash and dry the skin, warm 4 to 6 drops between your palms and massage gently for two to three minutes. Wash off with mild soap afterwards. One 15 ml bottle gives roughly 40 to 50 uses.",
      },
      {
        q: "Does it burn or irritate?",
        a: "It is a warming oil, so you will feel heat for twenty to thirty minutes. A tingling warmth is normal; stinging is not. Try a few drops on the forearm first, and never apply on broken skin or mucous membranes.",
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
        a: "A sesame oil base carrying the warming herbs listed under Ingredients on this page. No mineral oil, no artificial fragrance, no synthetic colour.",
      },
    ],
    ur: {
      name: "جوش ہربل آئل برائے مرد",
      shortDescription: "مردوں کے لیے گرماہٹ دینے والا ہربل مساج آئل، عقرقرحا، لونگ، ارگن اور انڈے کے تیل سے تیار۔",
      longDescription:
        "جوش ہربل آئل ایک گاڑھا مساج آئل ہے۔ تلوں کے تیل کی بنیاد میں ادرک اور لونگ کے عرق اور کلونجی کا تیل شامل ہے، اس لیے چند قطرے کافی ہوتے ہیں۔ یہ آہستہ جذب ہوتا ہے، بیس سے تیس منٹ تک جلد کو گرم رکھتا ہے اور کوئی چکنائی نہیں چھوڑتا۔ صرف بالغ افراد کے بیرونی استعمال کے لیے۔ بچوں کی پہنچ سے دور رکھیں۔",
      howToUse: ["جلد کو دھو کر خشک کریں۔", "4 سے 6 قطرے ہتھیلیوں میں گرم کریں۔", "دو سے تین منٹ تک نرمی سے مساج کریں۔", "استعمال کے بعد ہلکے صابن سے دھو لیں۔"],
      ingredients: "تلوں کا تیل، کلونجی کا تیل، ادرک کا عرق، لونگ کا تیل، دارچینی کا تیل، وٹامن ای۔",
      benefits: ["ایک منٹ میں جلد کو گرماہٹ", "گاڑھا ہے، اس لیے ایک بوتل دیر تک چلتی ہے", "نہ منرل آئل، نہ مصنوعی اجزاء", "سادہ، رازدارانہ پیکنگ"],
      faqs: [
        { q: "جوش کیا ہے اور کس کے لیے ہے؟", a: "جوش بالغ مردوں کے لیے ایک گاڑھا ہربل مساج آئل ہے۔ مساج کے ایک منٹ کے اندر جلد کو گرماہٹ دیتا ہے۔ صرف بیرونی استعمال کے لیے۔" },
        { q: "استعمال کیسے کریں؟", a: "جلد دھو کر خشک کریں، 4 سے 6 قطرے ہتھیلیوں میں گرم کریں اور دو تین منٹ نرمی سے مساج کریں۔ بعد میں ہلکے صابن سے دھو لیں۔ ایک بوتل تقریباً 40 سے 50 بار چلتی ہے۔" },
        { q: "کیا یہ جلن کرتا ہے؟", a: "یہ گرماہٹ دینے والا تیل ہے، بیس سے تیس منٹ گرمی محسوس ہوگی۔ ہلکی چبھن نارمل ہے، تیز جلن نہیں۔ پہلے بازو پر آزمائیں۔ کٹی پھٹی جلد پر نہ لگائیں۔" },
        { q: "کیا پیکنگ رازدارانہ ہے؟", a: "جی ہاں۔ پارسل سادہ ڈبے میں آتا ہے جس پر باہر پروڈکٹ کا نام نہیں ہوتا۔" },
        { q: "کیا ڈیلیوری پر ادائیگی ہو سکتی ہے؟", a: "جی ہاں۔ پورے پاکستان میں ہر آرڈر کیش آن ڈیلیوری ہے۔ کوئی پیشگی رقم نہیں۔" },
      ],
    },
  },
  "mustard-oil": {
    faqs: [
      { q: "Is this kachi ghani (cold-pressed) mustard oil?", a: "Yes. It is pressed without heat, so it keeps the sharp smell and dark colour that refined oils lose." },
      { q: "Can I use it on a baby?", a: "Mustard oil massage is a household tradition for babies from about six months. Warm a little in your palms and keep it away from the eyes. Stop if the skin turns red." },
      { q: "How often should I oil my hair with it?", a: "Once or twice a week. Massage into the scalp, leave for an hour or overnight, then shampoo. It is heavier than coconut, so a little goes a long way." },
      { q: "Is it edible?", a: "This bottle is packed for hair, scalp and massage use. Use kitchen-grade mustard oil for cooking." },
    ],
    ur: {
      name: "سرسوں کا تیل",
      shortDescription: "کچی گھانی سرسوں کا تیل، بالوں، سر کی جلد اور سردیوں کے مساج کے لیے۔",
      longDescription: "بغیر گرمی کے نکالا گیا سرسوں کا تیل، جس میں وہی تیز خوشبو اور گہرا رنگ ہے جو صاف کیے گئے تیلوں میں نہیں رہتا۔ بالوں کی جڑوں، خشک سر اور سردیوں کے جسمانی مساج کے لیے۔",
      howToUse: ["دو تین کھانے کے چمچ تیل چھوٹے پیالے میں گرم کریں۔", "بالوں میں مانگ نکال کر انگلیوں سے سر کی جلد پر لگائیں۔", "پانچ منٹ گول مساج کریں۔", "کم از کم ایک گھنٹہ یا رات بھر چھوڑیں۔", "شیمپو سے دھو لیں۔"],
      ingredients: "100% کچی گھانی کالی سرسوں کا تیل۔ کچھ اور شامل نہیں۔",
      benefits: ["باقاعدہ استعمال سے بالوں کا گرنا کم", "خشکی اور خارش والی سر کی جلد کے لیے", "مساج کے تیل کے طور پر جوڑوں کو گرماہٹ", "ایک جزو، بغیر صفائی کے"],
      faqs: [
        { q: "کیا یہ کچی گھانی تیل ہے؟", a: "جی ہاں۔ بغیر گرمی کے نکالا گیا، اس لیے تیز خوشبو اور گہرا رنگ برقرار ہے۔" },
        { q: "کیا بچے پر استعمال کر سکتے ہیں؟", a: "چھ ماہ کے بعد بچوں کے مساج کی روایت ہے۔ تھوڑا سا گرم کریں اور آنکھوں سے دور رکھیں۔ جلد سرخ ہو تو روک دیں۔" },
        { q: "بالوں میں کتنی بار لگائیں؟", a: "ہفتے میں ایک یا دو بار۔ سر کی جلد میں مساج کریں، ایک گھنٹہ یا رات بھر چھوڑیں، پھر شیمپو کریں۔" },
      ],
    },
  },
  "coconut-oil": {
    faqs: [
      { q: "Why does it turn solid in winter?", a: "Pure coconut oil sets below about 24°C. That is a sign nothing has been added to keep it liquid. Warm the bottle in your hands or in warm water and it clears again." },
      { q: "Hair or skin?", a: "Both. On damp hair ends it stops frizz; on skin after a bath it locks in moisture. It is light enough for daily use." },
      { q: "Does it smell of coconut?", a: "A mild, clean coconut smell that fades within minutes. No added fragrance." },
    ],
    ur: {
      name: "ناریل کا تیل",
      shortDescription: "خالص ناریل کا تیل جو صاف اور ہلکا رہتا ہے، بالوں اور جلد کے لیے۔",
      longDescription: "بالوں کے سروں اور جلد کے لیے ہلکا، خالص ناریل کا تیل۔ نہانے کے بعد جلد پر لگائیں تو نمی قید رہتی ہے، گیلے بالوں پر لگائیں تو الجھن کم ہوتی ہے۔ کوئی اضافی خوشبو نہیں۔",
      howToUse: ["سکے جتنی مقدار ہتھیلی میں لیں۔", "ہاتھوں میں رگڑیں تاکہ پگھل جائے۔", "گیلے یا خشک بالوں کی لمبائی اور سروں میں لگائیں۔", "جلد کے لیے نہانے کے بعد ہلکی تہہ لگائیں جب جلد نم ہو۔"],
      ingredients: "100% ناریل کا تیل، دو بار چھانا ہوا۔ نہ خوشبو، نہ منرل آئل۔",
      benefits: ["الجھن اور دو منہ والے بال کم", "جلدی جذب، چپچپاہٹ نہیں", "بچوں اور حساس جلد کے لیے محفوظ", "میک اپ اتارنے کے بھی کام آتا ہے"],
      faqs: [
        { q: "سردیوں میں جم کیوں جاتا ہے؟", a: "خالص ناریل کا تیل تقریباً 24 ڈگری سے نیچے جم جاتا ہے۔ یہ خالص ہونے کی نشانی ہے۔ ہاتھوں یا نیم گرم پانی سے گرم کریں۔" },
        { q: "بالوں کے لیے یا جلد کے لیے؟", a: "دونوں۔ گیلے بالوں کے سروں پر الجھن روکتا ہے، نہانے کے بعد جلد کی نمی قید کرتا ہے۔" },
      ],
    },
  },
  "onion-oil": {
    faqs: [
      { q: "How long before I see less hair fall?", a: "Most people notice less hair in the comb after three to four weeks of use two or three times a week. Regrowth, where it happens, is slower: give it three months." },
      { q: "Does it smell of onion?", a: "There is an onion note when you apply it, which washes out fully with shampoo. It does not linger on dry hair." },
      { q: "How do I apply it?", a: "Part the hair and massage into the scalp where it has thinned. Leave for at least an hour, or overnight, then shampoo. Two or three times a week." },
      { q: "Can women use it?", a: "Yes. It is a scalp oil for anyone with hair fall, and it is used just the same way." },
    ],
    ur: {
      name: "پیاز کا تیل",
      shortDescription: "پیاز کے بیج کے تیل کا مرکب، بالوں کے گرنے اور سست بڑھوتری کے لیے۔",
      longDescription: "پتلے ہوتے بالوں والی جگہ پر سر کی جلد میں لگانے کے لیے تیل۔ ہفتے میں دو یا تین بار مساج کریں، کم از کم ایک گھنٹہ چھوڑیں، پھر شیمپو کریں۔ پیاز کی ہلکی بو شیمپو سے مکمل نکل جاتی ہے۔",
      howToUse: ["نوزل سے سیدھا سر کی جلد پر لگائیں۔", "خون کی روانی کے لیے پانچ منٹ مساج کریں۔", "ایک سے دو گھنٹے چھوڑیں۔", "دو بار شیمپو کریں۔", "بہتر نتائج کے لیے ہفتے میں دو یا تین بار۔"],
      ingredients: "ناریل کا تیل، ارنڈی کا تیل، لال پیاز کا عرق، کلونجی کا تیل، میتھی کا عرق، کڑی پتے کا عرق، وٹامن ای۔",
      benefits: ["چار ہفتوں میں بالوں کا گرنا کم", "گھنے بال اگنے میں مدد", "ارنڈی کے تیل کی بنیاد خشک سروں کو نرم رکھتی ہے", "سیدھا سر پر لگانے کے لیے نوزل ڈھکن"],
      faqs: [
        { q: "بال گرنا کم ہونے میں کتنا وقت لگتا ہے؟", a: "زیادہ تر لوگ ہفتے میں دو تین بار استعمال کے تین چار ہفتے بعد کنگھی میں کم بال دیکھتے ہیں۔ نئے بال آنے میں تین ماہ لگ سکتے ہیں۔" },
        { q: "کیا پیاز کی بو آتی ہے؟", a: "لگاتے وقت ہلکی بو ہوتی ہے جو شیمپو سے مکمل نکل جاتی ہے۔" },
      ],
    },
  },
  "mark-balm": {
    faqs: [
      { q: "What is it for?", a: "Tension headaches, a blocked nose, tight neck and shoulders, and sore muscles after a long day. Rub a little where it hurts; the menthol cools and the camphor opens things up." },
      { q: "Can children use it?", a: "From age six, in a small amount on the chest or back, never on the face or under the nose. Keep it away from eyes and broken skin." },
      { q: "Does it melt in summer?", a: "The wax base is firm enough for a Karachi summer. Keep the lid on and out of direct sun." },
      { q: "How long does a tin last?", a: "A 25 g tin lasts a family two to three months with everyday use." },
    ],
    ur: {
      name: "مارک بام",
      shortDescription: "مینتھول اور کافور کا بام، سر درد، زکام اور پٹھوں کے درد کے لیے۔",
      longDescription: "وہ ڈبیا جو ہر دراز میں ہوتی ہے۔ موم کی بنیاد میں مینتھول اور کافور ٹھنڈک دیتے ہیں جو تناؤ والے سر درد کو آرام، بند ناک کو کھولنے اور دن بھر کی تھکن سے اکڑے پٹھوں کو ڈھیلا کرنے میں مدد کرتی ہے۔ کراچی کی گرمی میں پگھلتا نہیں اور چکنائی نہیں چھوڑتا۔",
      howToUse: ["سر درد کے لیے مٹر جتنا بام کنپٹیوں اور پیشانی پر ملیں۔", "زکام اور بند ناک کے لیے سینے اور ناک کے نیچے لگائیں۔", "درد والے پٹھوں پر جذب ہونے تک مساج کریں۔", "آنکھوں اور کٹی جلد سے دور رکھیں۔"],
      ingredients: "مینتھول، کافور، یوکلپٹس آئل، لونگ کا تیل، کاجوپٹ آئل، پیرافن بیس، موم۔",
      benefits: ["سر درد میں فوری ٹھنڈک اور آرام", "بند ناک کھولتا ہے", "گرمی میں پگھلتا نہیں", "ایک ڈبیا مہینوں چلتی ہے"],
      faqs: [
        { q: "کس کام آتا ہے؟", a: "تناؤ والے سر درد، بند ناک، گردن کندھوں کی اکڑن اور تھکے ہوئے پٹھوں کے لیے۔ جہاں درد ہو تھوڑا سا ملیں۔" },
        { q: "کیا بچے استعمال کر سکتے ہیں؟", a: "چھ سال کے بعد، تھوڑی مقدار سینے یا کمر پر۔ چہرے اور ناک کے نیچے کبھی نہیں۔" },
      ],
    },
  },
  "mark-iodex": {
    faqs: [
      { q: "Balm or Iodex, which one?", a: "Balm cools: headaches, colds, tight neck. Iodex warms: joint stiffness, backache, a sprain, sore muscles after work or exercise. Many homes keep both." },
      { q: "How do I use it?", a: "Massage a small amount into the painful area two or three times a day. Do not bandage tightly over it and do not use with a heating pad." },
      { q: "Can I use it on a fresh injury?", a: "Wait 24 to 48 hours after a sprain, and never on broken skin. For a new swollen injury, cold first; warmth after." },
      { q: "Is it safe in pregnancy?", a: "Ask your doctor before using any warming rub in pregnancy." },
    ],
    ur: {
      name: "مارک آیوڈیکس",
      shortDescription: "جوڑوں کے درد، کمر درد اور موچ کے لیے گرم مالش۔",
      longDescription: "جوڑوں کی اکڑن، کمر درد اور کام یا ورزش کے بعد تھکے ہوئے پٹھوں کے لیے گرماہٹ دینے والی مالش۔ دن میں دو تین بار تھوڑی سی مقدار درد والی جگہ پر مساج کریں۔ کٹی جلد پر نہ لگائیں اور اوپر کس کر پٹی نہ باندھیں۔",
      howToUse: ["درد والے جوڑ یا پٹھے پر پتلی تہہ لگائیں۔", "دو منٹ نرمی سے مساج کریں جب تک گرماہٹ نہ آئے۔", "دن میں تین بار تک۔", "استعمال کے بعد ہاتھ دھوئیں، آنکھوں سے دور رکھیں۔", "اوپر کس کر پٹی نہ باندھیں۔"],
      ingredients: "میتھائل سیلیسیلیٹ، مینتھول، تارپین کا تیل، یوکلپٹس آئل، کافور، موم کی بنیاد۔",
      benefits: ["جوڑوں اور کمر کے درد میں گرم آرام", "موچ اور اکڑن پر اثر", "داغ نہیں، تیز بو نہیں رہتی", "قابلِ اعتماد فارمولا، ایماندار قیمت"],
      faqs: [
        { q: "بام یا آیوڈیکس، کون سا؟", a: "بام ٹھنڈک دیتا ہے: سر درد، زکام، گردن کی اکڑن۔ آیوڈیکس گرماہٹ دیتا ہے: جوڑوں کی اکڑن، کمر درد، موچ، تھکے پٹھے۔ اکثر گھروں میں دونوں رکھے جاتے ہیں۔" },
        { q: "تازہ چوٹ پر لگا سکتے ہیں؟", a: "موچ کے 24 سے 48 گھنٹے بعد۔ کٹی جلد پر کبھی نہیں۔ نئی سوجن پر پہلے ٹھنڈا، بعد میں گرم۔" },
      ],
    },
  },
  "mark-liquid-neel": {
    faqs: [
      { q: "How much do I use?", a: "One capful in a bucket of the final rinse for a normal load. Stir until the water is evenly blue before the clothes go in. Too much leaves a blue tint; too little does nothing." },
      { q: "Will it leave patches?", a: "Not if it is stirred into the water first. Patches come from pouring neel straight onto fabric. Liquid neel dissolves fully, unlike the cake." },
      { q: "Does it work in a washing machine?", a: "Yes. Add it to the rinse-cycle compartment or the final rinse water, never with the detergent." },
      { q: "Is it safe for coloured clothes?", a: "Use it on whites and light colours only." },
    ],
    ur: {
      name: "مارک لیکوئڈ نیل",
      shortDescription: "کپڑوں کا مائع نیل جو بغیر دھبوں اور گٹھلیوں کے سفیدی لوٹاتا ہے۔",
      longDescription: "پانی میں مکمل گھل جانے والا نیل، جو ٹکیہ کی طرح گٹھلیاں نہیں بناتا اور کپڑوں پر دھبے نہیں چھوڑتا۔ آخری کھنگال کے پانی میں تھوڑا سا ملائیں اور سفید کپڑے سفید رہیں۔",
      howToUse: ["بالٹی یا مشین میں صاف کھنگال کا پانی بھریں۔", "ایک ڈھکن ڈال کر اچھی طرح ہلائیں جب تک پانی یکساں نیلا نہ ہو۔", "دھلے ہوئے سفید کپڑے ڈبو کر ایک منٹ ہلائیں۔", "ہلکا نچوڑ کر دھوپ میں سکھائیں۔"],
      ingredients: "پانی، الٹرا میرین نیلا رنگ، آپٹیکل برائٹنر، سٹیبلائزر۔ بلیچ نہیں۔",
      benefits: ["نیلے دھبے نہیں، پانی میں مکمل گھل جاتا ہے", "ایک ڈھکن فی بالٹی، بہت کفایتی", "سوتی اور ملے جلے کپڑوں کے لیے محفوظ", "مشین اور ہاتھ دونوں سے"],
      faqs: [
        { q: "کتنا استعمال کریں؟", a: "عام لوڈ کے لیے بالٹی میں ایک ڈھکن۔ زیادہ ڈالیں تو نیلاہٹ آتی ہے، کم ڈالیں تو اثر نہیں ہوتا۔" },
        { q: "کیا دھبے پڑیں گے؟", a: "پہلے پانی میں ہلا لیں تو نہیں۔ دھبے تب پڑتے ہیں جب نیل سیدھا کپڑے پر ڈالا جائے۔" },
      ],
    },
  },
};

/**
 * Kits. Component SKUs come from lib/db/seed-data.ts. Prices are about
 * 15 percent under the parts bought separately and can be changed in the
 * admin at any time; the saving line on the product page recomputes itself.
 */
export interface SeedBundle {
  name: string;
  slug: string;
  family: "oils" | "relief" | "home";
  sku: string;
  label: string;
  priceRupees: number;
  shortDescription: string;
  longDescription: string;
  benefits: string[];
  howToUse: string[];
  components: { sku: string; quantity: number }[];
  faqs: ProductFaq[];
  ur: ProductI18nUr;
  sortOrder: number;
}

export const SEED_BUNDLES: SeedBundle[] = [
  {
    name: "Winter Pain Kit",
    slug: "winter-pain-kit",
    family: "relief",
    sku: "MRK-KIT-PAIN",
    label: "Balm 25 g + Iodex 40 g",
    priceRupees: 399,
    shortDescription: "MARK Balm for the head and chest, MARK Iodex for joints and back. One kit for the whole house.",
    longDescription:
      "The two rubs every home ends up buying anyway, together at a lower price. Balm cools: tension headaches, blocked noses, a tight neck. Iodex warms: stiff knees, backache, a sprain, sore muscles after work. Keep the tin in the drawer and the tube by the bed.",
    benefits: ["Cooling and warming relief in one kit", "Cheaper than buying both separately", "Lasts a family the whole winter"],
    howToUse: ["Balm: a little on the temples, chest or neck.", "Iodex: massage into joints and back two or three times a day.", "Never on broken skin; keep away from eyes."],
    components: [
      { sku: "MRK-BALM-25", quantity: 1 },
      { sku: "MRK-IDX-40", quantity: 1 },
    ],
    faqs: [
      { q: "Which one do I use for what?", a: "Balm for headaches, colds and a stiff neck. Iodex for joints, back and muscles. The product page of each explains it in full." },
      { q: "Do both come in one parcel?", a: "Yes, one parcel, one delivery charge, cash on delivery." },
    ],
    ur: {
      name: "سردیوں کی درد کٹ",
      shortDescription: "سر اور سینے کے لیے مارک بام، جوڑوں اور کمر کے لیے مارک آیوڈیکس۔ پورے گھر کے لیے ایک کٹ۔",
      longDescription: "وہ دو مالشیں جو ہر گھر آخرکار خریدتا ہے، ساتھ میں کم قیمت پر۔ بام ٹھنڈک دیتا ہے: سر درد، بند ناک، اکڑی گردن۔ آیوڈیکس گرماہٹ دیتا ہے: گھٹنوں کی اکڑن، کمر درد، موچ، کام کے بعد تھکے پٹھے۔",
      benefits: ["ٹھنڈک اور گرماہٹ، ایک کٹ میں", "الگ خریدنے سے سستا", "پورے موسم کے لیے کافی"],
      howToUse: ["بام: کنپٹیوں، سینے یا گردن پر تھوڑا سا۔", "آیوڈیکس: جوڑوں اور کمر پر دن میں دو تین بار مساج۔", "کٹی جلد پر نہیں، آنکھوں سے دور۔"],
    },
    sortOrder: 20,
  },
  {
    name: "Hair Care Kit",
    slug: "hair-care-kit",
    family: "oils",
    sku: "MRK-KIT-HAIR",
    label: "Onion 100 ml + Coconut 100 ml",
    priceRupees: 429,
    shortDescription: "Onion oil for the scalp where hair is thinning, coconut oil for the lengths. A month of hair care.",
    longDescription:
      "Onion oil goes on the scalp two or three times a week where hair has thinned. Coconut oil goes on damp ends every day to stop frizz and breakage. Together they cover the root and the length, which is why they are sold as a pair.",
    benefits: ["Scalp and lengths covered", "About a month of use for one person", "Cheaper than the two bottles apart"],
    howToUse: ["Onion oil: massage into the scalp, leave an hour or overnight, shampoo. Two or three times a week.", "Coconut oil: a few drops on damp ends after washing.", "Give it four weeks before judging results."],
    components: [
      { sku: "MRK-OO-100", quantity: 1 },
      { sku: "MRK-CO-100", quantity: 1 },
    ],
    faqs: [
      { q: "Can I use both on the same day?", a: "Yes. Onion oil on the scalp before washing, coconut oil on the ends after." },
      { q: "Is it for men or women?", a: "Both. Hair fall does not pick sides." },
    ],
    ur: {
      name: "بالوں کی دیکھ بھال کٹ",
      shortDescription: "پتلے بالوں کے لیے پیاز کا تیل، لمبائی کے لیے ناریل کا تیل۔ ایک مہینے کی دیکھ بھال۔",
      longDescription: "پیاز کا تیل ہفتے میں دو تین بار سر کی جلد پر جہاں بال کم ہوں۔ ناریل کا تیل روزانہ گیلے بالوں کے سروں پر تاکہ الجھن اور ٹوٹنا رکے۔ جڑ اور لمبائی، دونوں کا خیال۔",
      benefits: ["جڑ اور لمبائی دونوں کے لیے", "ایک شخص کے لیے تقریباً ایک ماہ", "الگ خریدنے سے سستا"],
      howToUse: ["پیاز کا تیل: سر کی جلد پر مساج، ایک گھنٹہ یا رات بھر، پھر شیمپو۔ ہفتے میں دو تین بار۔", "ناریل کا تیل: دھونے کے بعد گیلے سروں پر چند قطرے۔", "نتیجے کا فیصلہ چار ہفتے بعد کریں۔"],
    },
    sortOrder: 21,
  },
  {
    name: "Josh Massage Kit",
    slug: "josh-massage-kit",
    family: "oils",
    sku: "MRK-KIT-JOSH",
    label: "Josh 15 ml + Mustard 100 ml",
    priceRupees: 1799,
    shortDescription: "Josh herbal oil for men with a bottle of kachi ghani mustard oil for a full-body warm massage.",
    longDescription:
      "Josh is concentrated and used in drops. Mustard oil is the traditional base for a warming full-body massage. The kit pairs the two so an evening routine has both: the body oil first, Josh where it is meant to go. Plain packaging, cash on delivery.",
    benefits: ["The concentrate and the base oil together", "Discreet plain packaging", "Below the price of the two apart"],
    howToUse: ["Warm a little mustard oil in your palms for the body massage.", "Josh: 4 to 6 drops, massage two to three minutes, wash off after.", "Adults only, external use only."],
    components: [
      { sku: "MRK-DD-15", quantity: 1 },
      { sku: "MRK-MO-100", quantity: 1 },
    ],
    faqs: [
      { q: "Is the parcel discreet?", a: "Yes. A plain box with no product name outside. The rider only sees your name and the amount to collect." },
      { q: "Can I mix the two oils?", a: "Use them one after the other rather than mixing. Josh is concentrated and is meant to be used in drops on its own." },
    ],
    ur: {
      name: "جوش مساج کٹ",
      shortDescription: "مردوں کے لیے جوش ہربل آئل کے ساتھ کچی گھانی سرسوں کے تیل کی بوتل، مکمل جسمانی گرم مساج کے لیے۔",
      longDescription: "جوش گاڑھا ہے اور قطروں میں استعمال ہوتا ہے۔ سرسوں کا تیل گرم جسمانی مساج کی روایتی بنیاد ہے۔ کٹ میں دونوں ساتھ ہیں: پہلے جسم کا تیل، پھر جوش جہاں اس کا استعمال ہے۔ سادہ پیکنگ، ڈیلیوری پر ادائیگی۔",
      benefits: ["گاڑھا تیل اور بنیادی تیل ساتھ", "رازدارانہ سادہ پیکنگ", "الگ خریدنے سے کم قیمت"],
      howToUse: ["جسمانی مساج کے لیے تھوڑا سا سرسوں کا تیل ہتھیلیوں میں گرم کریں۔", "جوش: 4 سے 6 قطرے، دو تین منٹ مساج، بعد میں دھو لیں۔", "صرف بالغ افراد، صرف بیرونی استعمال۔"],
    },
    sortOrder: 2,
  },
];
