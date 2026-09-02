import type { Family } from "@/lib/catalog";

export interface SeedVariant {
  sku: string;
  label: string;
  priceRupees: number;
  compareAtRupees?: number | null;
  stock: number;
}

export interface SeedProduct {
  name: string;
  slug: string;
  family: Family;
  shortDescription: string;
  longDescription: string;
  howToUse: string[];
  ingredients: string;
  benefits: string[];
  images: string[];
  isBestseller: boolean;
  sortOrder: number;
  variants: SeedVariant[];
}

export const SEED_PRODUCTS: SeedProduct[] = [
  {
    name: "Desire Drop",
    slug: "desire-drop",
    family: "oils",
    shortDescription: "A warming massage oil for adults, made with ginger, clove and black seed.",
    longDescription:
      "Desire Drop is a concentrated massage oil for couples. A base of cold-pressed sesame carries warming ginger and clove extracts with black seed oil, so a few drops are enough. It absorbs slowly, keeps the skin warm for twenty to thirty minutes and leaves no residue. For external use by adults only. Keep away from children.",
    howToUse: [
      "Wash and dry the skin.",
      "Warm 4 to 6 drops between your palms.",
      "Massage gently into the skin for two to three minutes.",
      "Wash off with mild soap after use.",
      "Stop and rinse if you feel any burning.",
    ],
    ingredients:
      "Sesame oil, black seed (Nigella sativa) oil, ginger extract, clove oil, cinnamon bark oil, vitamin E.",
    benefits: [
      "Warms the skin within a minute",
      "Concentrated, so one bottle lasts",
      "No mineral oil, no artificial fragrance",
      "Discreet plain packaging",
    ],
    images: ["/products/desire-drop-1.jpg", "/products/desire-drop-2.jpg"],
    isBestseller: true,
    sortOrder: 1,
    variants: [{ sku: "MRK-DD-15", label: "15 ml", priceRupees: 1750, compareAtRupees: 1950, stock: 40 }],
  },
  {
    name: "Mustard Oil",
    slug: "mustard-oil",
    family: "oils",
    shortDescription: "Kachi ghani mustard oil for hair, scalp and winter body massage.",
    longDescription:
      "Our mustard oil is pressed cold from whole black mustard seed and bottled without bleaching or blending. It has the sharp, honest smell of real sarson ka tel and the dark golden colour that comes with it. Used weekly, it strengthens hair from the root, calms a dry scalp and keeps skin soft through the winter. It is also the traditional oil for baby massage once a baby is over six months old.",
    howToUse: [
      "Warm two to three tablespoons in a small bowl.",
      "Part the hair and apply to the scalp with your fingertips.",
      "Massage in circles for five minutes.",
      "Leave for at least an hour, or overnight.",
      "Wash out with shampoo.",
    ],
    ingredients: "100% cold-pressed black mustard seed oil (Brassica nigra). Nothing added.",
    benefits: [
      "Reduces hair fall with regular use",
      "Relieves dandruff and itchy scalp",
      "Warms joints when used as a massage oil",
      "Single-ingredient, unrefined",
    ],
    images: ["/products/mustard-oil-1.jpg", "/products/mustard-oil-2.jpg"],
    isBestseller: true,
    sortOrder: 2,
    variants: [
      { sku: "MRK-MO-50", label: "50 ml", priceRupees: 100, stock: 120 },
      { sku: "MRK-MO-100", label: "100 ml", priceRupees: 200, compareAtRupees: 220, stock: 80 },
    ],
  },
  {
    name: "Coconut Oil",
    slug: "coconut-oil",
    family: "oils",
    shortDescription: "Pure coconut oil that stays clear and light, for hair and skin.",
    longDescription:
      "Pure coconut oil, filtered twice so it stays clear and pours easily even in cooler weather. It is light enough for daily use on the hair ends and on the skin after a shower, and it does not leave the heavy film that blended oils do. We do not add fragrance; the natural coconut smell is mild and fades within minutes.",
    howToUse: [
      "Take a coin-sized amount in your palm.",
      "Rub between your hands until it turns liquid.",
      "Work through the lengths and ends of damp or dry hair.",
      "For skin, apply a thin layer after bathing while the skin is still damp.",
    ],
    ingredients: "100% coconut oil (Cocos nucifera), double filtered. No fragrance, no mineral oil.",
    benefits: [
      "Smooths frizz and split ends",
      "Absorbs quickly without stickiness",
      "Safe for babies and sensitive skin",
      "Doubles as a make-up remover",
    ],
    images: ["/products/coconut-oil-1.jpg", "/products/coconut-oil-2.jpg"],
    isBestseller: false,
    sortOrder: 3,
    variants: [
      { sku: "MRK-CO-50", label: "50 ml", priceRupees: 150, stock: 90 },
      { sku: "MRK-CO-100", label: "100 ml", priceRupees: 250, stock: 60 },
    ],
  },
  {
    name: "Onion Oil",
    slug: "onion-oil",
    family: "oils",
    shortDescription: "Onion seed oil blend for hair fall and slow regrowth.",
    longDescription:
      "Onion Oil is our answer to hair fall. Red onion extract and black seed oil are infused into a base of coconut and castor oil, then rested for two weeks so the sulphur compounds move fully into the oil. Used twice a week, it slows shedding within a month and makes new growth visibly thicker. The onion smell is real but mild, and washes out completely.",
    howToUse: [
      "Apply directly to the scalp using the nozzle.",
      "Massage for five minutes to improve blood flow.",
      "Leave on for one to two hours.",
      "Shampoo twice to remove.",
      "Use two or three times a week for best results.",
    ],
    ingredients:
      "Coconut oil, castor oil, red onion (Allium cepa) extract, black seed oil, fenugreek extract, curry leaf extract, vitamin E.",
    benefits: [
      "Slows hair fall within four weeks",
      "Encourages thicker regrowth",
      "Castor oil base conditions dry ends",
      "Nozzle cap for direct scalp application",
    ],
    images: ["/products/onion-oil-1.jpg", "/products/onion-oil-2.jpg"],
    isBestseller: true,
    sortOrder: 4,
    variants: [{ sku: "MRK-OO-100", label: "100 ml", priceRupees: 250, compareAtRupees: 300, stock: 70 }],
  },
  {
    name: "MARK Balm",
    slug: "mark-balm",
    family: "relief",
    shortDescription: "Menthol and camphor balm for headaches, colds and muscle aches.",
    longDescription:
      "MARK Balm is the tin that lives in every drawer. Menthol and camphor in a wax base give a strong cooling effect that eases tension headaches, opens a blocked nose and loosens tight muscles after a long day. It is firm enough not to melt in a Karachi summer and rubs in without grease. One tin lasts a family several months.",
    howToUse: [
      "Rub a pea-sized amount on the temples and forehead for headache.",
      "Apply to the chest and under the nose for cold and congestion.",
      "Massage into aching muscles until absorbed.",
      "Keep away from the eyes and broken skin.",
    ],
    ingredients: "Menthol, camphor, eucalyptus oil, clove oil, cajeput oil, paraffin base, beeswax.",
    benefits: [
      "Fast cooling relief for headaches",
      "Clears a blocked nose",
      "Does not melt in summer heat",
      "One tin lasts months",
    ],
    images: ["/products/mark-balm-1.jpg", "/products/mark-balm-2.jpg"],
    isBestseller: true,
    sortOrder: 5,
    variants: [{ sku: "MRK-BALM-25", label: "25 g", priceRupees: 250, stock: 150 }],
  },
  {
    name: "MARK Iodex",
    slug: "mark-iodex",
    family: "relief",
    shortDescription: "Deep-heat rub for joint pain, backache and sprains.",
    longDescription:
      "MARK Iodex is a warming rub for deeper pain: knees, lower back, shoulders and sprains. Methyl salicylate and turpentine oil sink below the skin and increase blood flow to the joint, while menthol takes the edge off within minutes. It is stronger than a balm, so use a small amount and wash your hands afterwards.",
    howToUse: [
      "Apply a thin layer over the painful joint or muscle.",
      "Massage gently for two minutes until warm.",
      "Use up to three times a day.",
      "Wash hands after use and keep away from the eyes.",
      "Do not bandage tightly over the rub.",
    ],
    ingredients: "Methyl salicylate, menthol, turpentine oil, eucalyptus oil, camphor, wax base.",
    benefits: [
      "Warming relief for joint and back pain",
      "Works on sprains and stiffness",
      "Non-staining, no strong lingering smell",
      "Trusted formula, honest price",
    ],
    images: ["/products/mark-iodex-1.jpg", "/products/mark-iodex-2.jpg"],
    isBestseller: false,
    sortOrder: 6,
    variants: [{ sku: "MRK-IDX-40", label: "40 g", priceRupees: 220, stock: 100 }],
  },
  {
    name: "MARK Liquid Neel",
    slug: "mark-liquid-neel",
    family: "home",
    shortDescription: "Liquid laundry blue that whitens without patches or clumps.",
    longDescription:
      "MARK Liquid Neel brings back the white in shirts, dupattas and bed sheets that have turned yellow with washing. Because it is a liquid, it mixes fully into the rinse water and never leaves the blue spots that powder neel can. A capful is enough for a full bucket, so one bottle covers weeks of laundry. Safe for cotton, linen and blends, and safe for machine rinse cycles.",
    howToUse: [
      "Fill a bucket or the machine with clean rinse water.",
      "Add one capful and stir well until the water is evenly blue.",
      "Dip the washed whites and move them around for one minute.",
      "Wring lightly and dry in the sun.",
    ],
    ingredients: "Water, ultramarine blue pigment, optical brightener, stabiliser. No bleach.",
    benefits: [
      "No blue patches, mixes fully in water",
      "One cap per bucket, very economical",
      "Safe for cotton and blends",
      "Works in machines and by hand",
    ],
    images: ["/products/mark-liquid-neel-1.jpg", "/products/mark-liquid-neel-2.jpg"],
    isBestseller: true,
    sortOrder: 7,
    variants: [{ sku: "MRK-NEEL-200", label: "200 ml", priceRupees: 250, stock: 200 }],
  },
];
