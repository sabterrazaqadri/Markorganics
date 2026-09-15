/**
 * English journal posts. Bodies use the store's own rich-text dialect
 * (lib/rich-text.ts): ## headings, - lists, **bold**, [links](/path).
 *
 * Each post answers one search the competitor already ranks for, in plainer
 * words, and links to the product that fits. No disease claims.
 */
export interface SeedPost {
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  tags: string[];
  seoTitle: string;
  seoDescription: string;
  lang: "en" | "ur";
  translationSlug: string | null;
  /** Days before today, so the journal does not show twenty posts on one date. */
  daysAgo: number;
}

export const SEED_POSTS_EN: SeedPost[] = [
  {
    slug: "best-oil-for-knee-and-joint-pain-at-home",
    title: "The best oil for knee and joint pain you can use at home",
    excerpt: "Warm massage is the oldest joint-care habit in Pakistan for a reason. Here is how to do it well, which oil to use, and when a rub beats an oil.",
    tags: ["joint pain", "massage", "winter"],
    seoTitle: "Best Oil for Knee and Joint Pain at Home | MARKORGANICS",
    seoDescription: "Which oil is best for knee and joint pain? A plain guide to warm mustard oil massage, when to use a deep-heat rub like MARK Iodex, and the mistakes to avoid.",
    lang: "en",
    translationSlug: "best-oil-for-knee-and-joint-pain-at-home-ur",
    daysAgo: 1,
    body: `Stiff knees in the morning, a back that complains after a long day, fingers that take a while to loosen in winter. Most homes in Pakistan reach for an oil, and most of the time that is the right instinct. What matters is which oil, how warm, and how you rub it in.

## Why warm oil helps

Massage does three useful things: it warms the joint, it moves the fluid around it, and it relaxes the muscles that have tightened to protect it. The oil is mostly there so your hands can glide. A warm oil does the first job faster, which is why every grandmother heated it first.

## Mustard oil: the everyday choice

Kachi ghani (cold-pressed) [mustard oil](/products/mustard-oil) is the traditional joint massage oil across Punjab and Sindh. It is thick, it holds heat well, and it has a natural warming feel on the skin. Warm two tablespoons in a small bowl, sit the bowl in hot water for a minute, then massage the joint in slow circles for five to ten minutes. Do this in the evening, cover the joint, and sleep.

- Use it daily in winter and two or three times a week the rest of the year.
- Do not put mustard oil on broken skin or a fresh, swollen injury.
- Wash your hands afterwards; the smell is honest but strong.

## When a rub beats an oil

If the pain is sharper, or you want relief you can feel in minutes rather than after a routine, a deep-heat rub does more than oil can. [MARK Iodex](/products/mark-iodex) uses methyl salicylate and menthol in a wax base: a thin layer massaged in for two minutes gives a steady warmth for an hour or more. It is the better choice for a sprain that is a couple of days old, for backache after lifting, and for knees that ache after stairs.

Use it up to three times a day, never under a tight bandage, and never with a heating pad on top.

## Cooling first, warming after

One mistake we see often: warming a new injury. If a joint is swollen, red or hot to the touch because of something that happened today, warmth makes it worse. Cold water or a wrapped ice pack for the first day or two, then warmth once the swelling has settled.

## The routine that works

- Morning: a small amount of Iodex on the joint before the day starts.
- Evening: ten minutes of warm mustard oil massage, then rest.
- Two or three times a week: walk for twenty minutes. Joints that move are joints that hurt less.

If pain lasts more than two weeks, wakes you at night, or comes with a fever or swelling, see a doctor. An oil is comfort, not a diagnosis.

Both products together cost less as the [Winter Pain Kit](/products/winter-pain-kit), delivered anywhere in Pakistan, cash on delivery.`,
  },
  {
    slug: "mustard-oil-massage-benefits-hair-joints-winter",
    title: "Mustard oil massage: what it does for hair, skin and joints",
    excerpt: "Sarson ka tel is in every Pakistani home. Here is what cold-pressed mustard oil actually does, how to use it for hair and for massage, and what to avoid.",
    tags: ["mustard oil", "hair", "massage"],
    seoTitle: "Mustard Oil Benefits for Hair, Skin and Joints | MARKORGANICS",
    seoDescription: "Cold-pressed mustard oil for hair fall, dandruff, winter body massage and joint warmth. How to use it, how often, and why kachi ghani matters.",
    lang: "en",
    translationSlug: "mustard-oil-massage-benefits-hair-joints-winter-ur",
    daysAgo: 4,
    body: `Mustard oil is the one bottle almost every Pakistani household already owns. It is also the one people use most carelessly: refined oil where cold-pressed is needed, too much on the hair, none on the joints that would benefit. This is the short, honest version.

## Kachi ghani versus refined

Kachi ghani means the seed was pressed without heat. The oil keeps its dark colour, its sharp smell and its natural compounds. Refined mustard oil has been heated and filtered until it is pale and mild, which is fine for a frying pan and pointless for a scalp. For anything you put on skin or hair, use cold-pressed. Ours is [100 percent cold-pressed black mustard seed](/products/mustard-oil), nothing added.

## For hair and scalp

Mustard oil is heavy, so it sits on the scalp and softens it rather than soaking straight in. That is what makes it good for a dry, flaky, itchy scalp and for hair that breaks at the root.

- Warm two to three tablespoons in a bowl.
- Part the hair and apply to the scalp with your fingertips, not the palm.
- Massage in circles for five minutes.
- Leave for an hour, or overnight with a towel on the pillow.
- Shampoo out. It may take two washes.

Once or twice a week is enough. More than that and the hair looks greasy for no extra benefit. For the lengths of the hair, a lighter oil such as [coconut](/products/coconut-oil) works better.

## For winter body massage

The classic use. Warm the oil, massage the arms, legs and back before a bath, sit in the sun for ten minutes if you have it, then wash. It leaves the skin soft through the dry months and the warmth loosens tight muscles.

For babies, from about six months, use a little, keep it away from the eyes, and stop if the skin goes red.

## For joints

Warm mustard oil massage is the standard joint routine in every village and it still works: ten minutes in the evening on knees, ankles or shoulders. Read [our joint pain guide](/blog/best-oil-for-knee-and-joint-pain-at-home) for the full routine and for when a deep-heat rub is the better tool.

## What not to do

- Do not use it on broken skin, a rash or a fresh burn.
- Do not heat it on a flame; sit the bowl in hot water instead.
- Do not expect it to be scent-free. The smell is part of the deal and washes out.

A 100 ml bottle is [Rs 200](/products/mustard-oil), cash on delivery. Half of Pakistan's beauty advice starts here, and most of it is right.`,
  },
  {
    slug: "onion-oil-for-hair-fall-how-to-use-and-what-to-expect",
    title: "Onion oil for hair fall: how to use it and what to expect, week by week",
    excerpt: "Onion oil is the most asked-about hair product in Pakistan. Here is how to apply it, how often, when results show, and who it does not work for.",
    tags: ["hair fall", "onion oil"],
    seoTitle: "Onion Oil for Hair Fall: How to Use and Results Timeline | MARKORGANICS",
    seoDescription: "How to use onion oil for hair fall, how often to apply it, and a realistic week-by-week timeline of results. Plus who should not expect regrowth.",
    lang: "en",
    translationSlug: "onion-oil-for-hair-fall-how-to-use-and-what-to-expect-ur",
    daysAgo: 7,
    body: `Every second message we get on WhatsApp is about hair fall. Onion oil is the product people have heard of and want to try, and it is a good place to start, as long as you know what it can and cannot do.

## What is in it

Onion oil is not pressed from onions. It is a carrier oil infused with onion extract and, in a good blend, a few other things that help the scalp. [Ours](/products/onion-oil) is coconut and castor oil with red onion extract, black seed oil, fenugreek, curry leaf and vitamin E. The castor gives it body, the coconut keeps it from being sticky, and the nozzle cap puts it on the scalp rather than in your palm.

## How to apply it

- Part the hair and squeeze the oil straight onto the scalp, especially where it is thinning.
- Massage with your fingertips for five minutes. This part matters more than people think: blood flow to the scalp is half the point.
- Leave it for one to two hours. Overnight is fine with a towel on the pillow.
- Shampoo twice. The onion smell goes completely with the second wash.
- Repeat two or three times a week.

## What to expect, honestly

- **Week 1 to 2:** the scalp feels less dry and less itchy. Hair fall is the same.
- **Week 3 to 4:** most people count fewer hairs in the comb and in the shower drain. This is the first real sign.
- **Month 2 to 3:** fine new hairs along the hairline and parting, if regrowth is going to happen.

Take a photo of your parting in the same light on day one and every two weeks. Memory is a poor judge of hair.

## Who it will not help much

Hair fall from a recent illness, from stopping a medicine, or after childbirth usually stops on its own within a few months; the oil makes the scalp comfortable but is not the reason it stops. Pattern baldness that runs in the family responds slowly and partially. Bald patches that appear suddenly, or a scalp that is red, scaly or painful, need a doctor, not an oil.

## Pair it with the right second oil

Onion oil is for the scalp. For the lengths and ends, a light [coconut oil](/products/coconut-oil) after washing stops breakage, which is half of what people call hair fall. Together they cost less as the [Hair Care Kit](/products/hair-care-kit).`,
  },
  {
    slug: "coconut-oil-vs-mustard-oil-for-hair",
    title: "Coconut oil or mustard oil for hair? Pick by hair type, not by habit",
    excerpt: "Both are good. They are good at different things. A short guide to choosing between coconut and mustard oil for your scalp, your lengths and the season.",
    tags: ["hair", "coconut oil", "mustard oil"],
    seoTitle: "Coconut Oil vs Mustard Oil for Hair: Which Is Better? | MARKORGANICS",
    seoDescription: "Coconut oil versus mustard oil for hair, compared by scalp type, hair length, season and smell. Which one to use for hair fall, frizz and dandruff.",
    lang: "en",
    translationSlug: "coconut-oil-vs-mustard-oil-for-hair-ur",
    daysAgo: 10,
    body: `People use whichever oil their mother used. That is a fine reason for a lot of things, but hair oil is a case where a two-minute comparison saves months of the wrong routine.

## Coconut oil: light, for lengths and daily use

[Coconut oil](/products/coconut-oil) is thin, absorbs fast and leaves no greasy feel. It sinks into the hair shaft rather than sitting on it, which is why it is the better oil for frizz, split ends and hair that breaks when combed. It is also the one to use on damp hair after washing, a few drops on the ends.

- Best for: dry lengths, frizz, daily use, children, anyone who oils before work.
- Season: all year. In winter it sets solid in the bottle; warm it in your hands.
- Smell: faint coconut, gone in minutes.

## Mustard oil: heavy, for the scalp and winter

[Mustard oil](/products/mustard-oil) is thick and warming. It stays on the scalp and softens it, which is what a dry, flaky, itchy scalp needs, and its warmth is why it is the winter massage oil. It is too heavy for daily use on the lengths and it takes two washes to remove.

- Best for: dry or flaky scalp, hair fall at the root, weekly deep oiling, winter.
- Season: best in winter; once a week in summer is plenty.
- Smell: strong and honest. It washes out.

## By problem

- **Hair fall:** mustard oil weekly on the scalp, or [onion oil](/products/onion-oil) two or three times a week if the fall is more than a few weeks old.
- **Frizz and breakage:** coconut on damp ends every wash.
- **Dandruff and itch:** mustard oil massage weekly, left an hour.
- **Dull hair:** coconut through the lengths the night before washing.

## Use both

The routine that covers everything: mustard oil on the scalp once a week, left an hour, then shampoo; coconut on the ends after every wash. That is two bottles, [Rs 200 and Rs 250](/collections/oils), and it is the whole of hair care for most people.`,
  },
  {
    slug: "headache-relief-at-home-without-tablets",
    title: "Headache relief at home, before you reach for a tablet",
    excerpt: "Most everyday headaches are tension, dehydration or a blocked nose. Here are the things that work in twenty minutes, and how to use a menthol balm properly.",
    tags: ["headache", "balm"],
    seoTitle: "Headache Relief at Home Without Tablets | MARKORGANICS",
    seoDescription: "Simple headache relief at home: water, a dark room, neck stretches and how to use a menthol and camphor balm on the temples. When to see a doctor.",
    lang: "en",
    translationSlug: "headache-relief-at-home-without-tablets-ur",
    daysAgo: 13,
    body: `A tablet is fine for a headache. But most of the headaches that hit at four in the afternoon are not the kind that needs one, and a few small things fix them faster than the tablet takes to dissolve.

## Drink a glass of water first

Half the afternoon headaches in a Karachi office are dehydration. Drink a full glass, wait fifteen minutes, and see. If the headache started after a long time without water, this alone often ends it.

## Balm on the temples

A menthol and camphor balm does two things: the menthol cools the skin, which distracts the nerves that are reporting the pain, and the camphor opens the sinuses if a blocked nose is part of the problem. [MARK Balm](/products/mark-balm) is our version, in a wax base firm enough for a Karachi summer.

- Rub a pea-sized amount on each temple and across the forehead.
- A little on the back of the neck where the muscles meet the skull.
- Keep it well away from the eyes; the fumes sting.
- Sit somewhere dim for ten minutes.

For a headache that comes with a cold, add a small amount on the chest and under the nose.

## Loosen the neck

Tension headaches start in the neck and shoulders. Slowly drop your chin to your chest, hold for ten seconds, then tilt each ear to its shoulder. Roll the shoulders back five times. It looks like nothing and it works more often than not.

## Get off the screen

Twenty minutes with your eyes closed, or looking out of a window at something far away, resets the eye muscles that have been fixed at forty centimetres for hours.

## When it is not an everyday headache

See a doctor if a headache is the worst you have ever had, arrives suddenly like a blow, comes with a stiff neck, fever, confusion, weakness on one side, or follows a knock on the head. Also if you have headaches most days: that is a pattern worth treating properly, not managing with balm.

A 25 g tin of [MARK Balm](/products/mark-balm) is Rs 250 and lasts a family months. Keep one in the drawer and one in the bag.`,
  },
  {
    slug: "numbness-and-tingling-in-hands-and-feet-daily-habits",
    title: "Numbness and tingling in hands and feet: daily habits that help, and when to see a doctor",
    excerpt: "Pins and needles after sitting, cold feet at night, hands that fall asleep. Small daily habits and warm massage help most of the everyday causes. Some causes need a doctor.",
    tags: ["numbness", "massage", "circulation"],
    seoTitle: "Numbness and Tingling in Hands and Feet: Daily Habits That Help | MARKORGANICS",
    seoDescription: "Everyday causes of numbness and tingling in the hands and feet, daily habits and warm massage that help circulation, and the signs that mean you should see a doctor.",
    lang: "en",
    translationSlug: "numbness-and-tingling-in-hands-and-feet-daily-habits-ur",
    daysAgo: 16,
    body: `Hands that go to sleep on the pillow, feet that are cold and prickly by evening, pins and needles after an hour cross-legged on the floor. Most of it is position and circulation, and most of it responds to habits. Some of it is a sign of something that needs a doctor, and this post is clear about which is which.

## The everyday causes

- Sitting in one position: cross-legged, or with an elbow bent on a desk for hours, presses on a nerve. The tingling is the nerve waking up.
- Cold: hands and feet lose circulation first in winter.
- Tight shoes, tight sleeves, a watch strap.
- Long phone use with the wrist bent.

## Habits that help

- Change position every thirty minutes. Stand, shake out the hands, walk to the door and back.
- Warm the extremities: socks at night in winter, and a warm oil massage of the feet and calves before bed.
- Wrist straight when typing and on the phone; a folded towel under the wrist helps.
- Drink water and cut back on the fifth cup of tea; caffeine narrows small blood vessels.

## Warm massage for the feet and hands

A ten-minute massage moves blood through the small vessels that the day has squeezed shut. Warm [mustard oil](/products/mustard-oil) works well: sit with the foot on the opposite knee, press the thumbs into the sole from heel to toes, then squeeze each toe. Do the calves with long strokes towards the knee. For hands, the same from wrist to fingertips.

If you want warmth that lasts after the massage, a small amount of [MARK Iodex](/products/mark-iodex) on the calves or forearms keeps the area warm for an hour. Never on the soles right before walking, and never on broken skin.

## When to see a doctor

Numbness is a symptom, not a condition, and some of its causes matter. See a doctor soon if:

- it is in one side of the body only, or came on suddenly;
- it is constant rather than coming and going with position;
- there is weakness, or you drop things, or you cannot feel a pin prick;
- you have diabetes, and the numbness is in both feet;
- it comes with back pain that runs down a leg.

None of those are things an oil addresses. A warm massage still feels good, but the appointment comes first.`,
  },
  {
    slug: "josh-herbal-massage-oil-for-men-guide",
    title: "Josh herbal massage oil for men: what it is, how to use it, what to expect",
    excerpt: "A plain guide to Josh: the ingredients, the warming effect, how many drops, how long it lasts, and the questions men ask us on WhatsApp before ordering.",
    tags: ["josh", "men", "massage oil"],
    seoTitle: "Josh Herbal Massage Oil for Men: Guide, Ingredients and How to Use | MARKORGANICS",
    seoDescription: "Josh is a concentrated herbal massage oil for men, made in Pakistan. What is in it, how to use it, what the warming effect feels like, and how the discreet cash-on-delivery works.",
    lang: "en",
    translationSlug: "josh-herbal-massage-oil-for-men-guide-ur",
    daysAgo: 2,
    body: `[Josh](/products/josh-mens-herbal-oil) is the product people ask us the most questions about, usually in a low voice. This page answers them all, in plain words, so that nobody has to ask.

## What Josh is

Josh is a concentrated herbal massage oil for adult men. It is a warming oil: a few drops massaged in produce a steady heat in the skin within a minute that lasts twenty to thirty minutes. It is used as part of a couples' massage routine, and it is for external use only.

It is made in Pakistan in small batches. The base is sesame oil, which carries black seed (kalonji) oil, ginger extract, clove oil and cinnamon bark oil, with vitamin E to keep it fresh. There is no mineral oil, no artificial fragrance and no colour. The full list is on the [product page](/products/josh-mens-herbal-oil).

## How to use it

- Wash and dry the skin.
- Warm 4 to 6 drops between your palms.
- Massage gently for two to three minutes.
- Wash off with mild soap afterwards.

That is the whole routine. More drops do not mean more effect, only more heat. Start with four.

## What it feels like

Warmth, then a spreading heat. A tingling is normal. A sting is not: if it stings, wash it off, and next time use fewer drops or try it on the forearm first. Do not apply on broken skin, on a rash, or on mucous membranes.

## How long a bottle lasts

Josh is sold in 15 ml because it is concentrated. At five drops a use, one bottle is roughly forty to fifty uses. For most men that is two to three months. The price is [Rs 1,750](/products/josh-mens-herbal-oil), which works out to well under Rs 50 a use.

## The questions we are asked

**Is the packaging discreet?** Yes. The parcel is a plain box with no product name outside. The rider only sees your name and the amount to collect.

**Can I pay on delivery?** Yes, cash on delivery anywhere in Pakistan. No advance, no card.

**Is it safe with other products?** Use it on its own, on clean skin. Do not mix it with other oils or creams.

**Does it have a strong smell?** Clove and cinnamon, mild, gone after washing.

**What if I have a skin condition?** Ask your doctor first. The same goes for anyone with very sensitive skin.

## Order it

Add it to your cart on the [product page](/products/josh-mens-herbal-oil), or press the WhatsApp button there and we will place the order for you. Together with a bottle of mustard oil for a full-body massage, it is cheaper as the [Josh Massage Kit](/products/josh-massage-kit).`,
  },
  {
    slug: "essential-oils-vs-carrier-oils-vs-herbal-massage-oils",
    title: "Essential oils, carrier oils and herbal massage oils: what the words mean",
    excerpt: "Three phrases that get mixed up on every product label in Pakistan. A one-page explanation of what each is, what it is for, and which one you actually need.",
    tags: ["guide", "oils"],
    seoTitle: "Essential Oils vs Carrier Oils vs Herbal Massage Oils Explained | MARKORGANICS",
    seoDescription: "What is the difference between an essential oil, a carrier oil and a herbal massage oil? A beginner's guide with examples and what to use for hair, skin and massage.",
    lang: "en",
    translationSlug: "essential-oils-vs-carrier-oils-vs-herbal-massage-oils-ur",
    daysAgo: 19,
    body: `Labels in Pakistan use "essential oil" for almost anything in a dropper bottle. It matters, because a true essential oil used the wrong way burns the skin, and a carrier oil sold as an essential oil is an overcharge. Here is what the words mean.

## Carrier oils

A carrier oil is the oil pressed from a seed, nut or fruit: [mustard](/products/mustard-oil), [coconut](/products/coconut-oil), sesame, almond, olive, castor. It is mild, it can go on the skin neat, and it is what you use in quantity for hair oiling and body massage. The name comes from its job in blends: it carries the small amount of something stronger.

- Use: hair, skin, massage, baby massage.
- Amount: tablespoons.
- Price: honest, because it is a simple pressed oil.

## Essential oils

An essential oil is the concentrated aromatic extract of a plant: clove, eucalyptus, peppermint, lavender. It is distilled, not pressed, and a few drops carry the whole smell and effect of the plant. Used neat it irritates or burns skin. It is always diluted, a few drops in a carrier oil, or used in the air.

- Use: a few drops in a carrier for massage, in a balm, or for the scent.
- Amount: drops.
- Warning: never neat on skin, never near eyes, never for children without advice.

## Herbal massage oils

A herbal massage oil is a carrier oil that has been infused with herbs, or blended with small amounts of essential oils, so it does a specific job. [Onion oil](/products/onion-oil) is coconut and castor oil infused with onion extract and fenugreek for the scalp. [Josh](/products/josh-mens-herbal-oil) is sesame oil carrying ginger, clove and cinnamon for a warming massage. The carrier makes it safe to use in quantity; the herbs make it do something.

- Use: whatever the blend was made for. Read the label.
- Amount: drops for concentrated blends, tablespoons for light ones.

## Rubs and balms

Not oils at all, but they belong here because they do the same jobs. [MARK Balm](/products/mark-balm) is menthol and camphor in a wax base; [MARK Iodex](/products/mark-iodex) is methyl salicylate in wax. They stay where you put them and act longer than an oil.

## So which do you need?

- Hair oiling: a carrier oil. Coconut for lengths, mustard for the scalp.
- Hair fall: a herbal blend for the scalp, such as onion oil.
- Body massage: a carrier oil, warmed.
- Warming massage for men: a concentrated herbal oil, in drops.
- Headache, blocked nose, joint pain: a balm or rub.

If a bottle says "essential oil" and tells you to pour it on, be suspicious of either the label or the price.`,
  },
  {
    slug: "how-to-keep-white-clothes-white-liquid-neel-guide",
    title: "How to keep white clothes white: the liquid neel guide",
    excerpt: "Whites go grey and yellow from detergent residue and sun. Neel fixes it, if it is used right. How much, when, and why liquid beats the cake.",
    tags: ["laundry", "neel"],
    seoTitle: "How to Keep White Clothes White with Liquid Neel | MARKORGANICS",
    seoDescription: "Why white clothes turn grey or yellow, how laundry neel (blue) works, how much to use per bucket or machine, and how to avoid blue patches.",
    lang: "en",
    translationSlug: "how-to-keep-white-clothes-white-liquid-neel-guide-ur",
    daysAgo: 22,
    body: `A white shalwar kameez is white for about six washes. After that it drifts towards grey or yellow, and no amount of extra detergent brings it back. Neel does, in one rinse, if you know how to use it.

## Why whites go dull

Two reasons. Detergent leaves a thin residue that builds up wash after wash and scatters light, which reads as grey. And the sun, plus sweat, plus the ageing of cotton, tints the fabric yellow. Bleach strips both but also weakens the cloth.

## What neel does

Neel is a blue pigment in water. A tiny amount in the final rinse leaves a trace of blue on the fabric. Blue cancels yellow, and the eye reads the result as a brighter white. It is the same trick as blue shampoo for grey hair. No bleaching, no damage.

## Liquid versus the cake

The old neel cake has to be dissolved by hand and never fully does, which is where the blue patches come from: undissolved specks landing on the cloth. [Liquid neel](/products/mark-liquid-neel) is already dissolved. It disperses evenly in water in one stir and cannot leave a patch.

## How much and when

- Wash the clothes as usual and rinse out the detergent.
- Fill a bucket with clean water for the final rinse.
- Add one capful and stir until the water is evenly pale blue.
- Put in the whites, move them around for one minute.
- Wring lightly and dry in the sun.

In a machine: add the capful to the rinse-water compartment, or to the drum when the final rinse starts. Never with the detergent; the detergent wash rinses it straight out.

## The two mistakes

**Too much neel.** The water should be pale sky blue, not ink. Too much and the clothes take on a tint. If that happens, rinse again in clean water.

**Neel on the cloth.** Never pour it onto fabric, always into water first. This is the only way to get a patch with liquid neel, and it is easy to avoid.

## What to use it on

Whites and very light colours. Cotton, lawn, blends. Not on coloured clothes; it dulls them.

A 200 ml bottle is [Rs 250](/products/mark-liquid-neel) and, at one cap a bucket, lasts a household most of a year.`,
  },
  {
    slug: "muscle-pain-after-work-or-gym-hot-rub-or-cooling-balm",
    title: "Muscle pain after work or the gym: hot rub or cooling balm?",
    excerpt: "Sore shoulders from a shift, stiff legs after a run, a pulled back from lifting. The right choice between warming and cooling depends on when it happened.",
    tags: ["muscle pain", "gym", "balm"],
    seoTitle: "Muscle Pain After Work or Gym: Hot Rub or Cooling Balm? | MARKORGANICS",
    seoDescription: "When to use a warming deep-heat rub and when to use a cooling menthol balm for sore muscles, stiffness and strains. A simple rule by timing, with a routine.",
    lang: "en",
    translationSlug: "muscle-pain-after-work-or-gym-hot-rub-or-cooling-balm-ur",
    daysAgo: 25,
    body: `There are two kinds of rub in every pharmacy: the cooling menthol kind and the warming deep-heat kind. People pick by habit or by smell. The right way to pick is by the clock.

## The rule: cold today, heat tomorrow

- **Something that happened in the last day or two**, a pulled muscle, a knock, a twisted ankle: cooling. The area is inflamed and warmth makes it swell more. Menthol cools and takes the edge off.
- **Stiffness and ache that is a day or more old**, or that comes from work and repetition rather than an injury: warming. Heat brings blood to the muscle, loosens it and eases the ache.

## The cooling balm

[MARK Balm](/products/mark-balm) is menthol and camphor in wax. Rub a small amount into the sore spot; the cooling arrives in a minute and the muscle relaxes under it. Good for a neck stiff from a screen, shoulders after carrying, and the first day after a strain.

## The warming rub

[MARK Iodex](/products/mark-iodex) is methyl salicylate, menthol and camphor in a wax base. A thin layer massaged for two minutes gives a steady warmth for an hour. Good for legs after a run, a back that lifted too much yesterday, knees after stairs, and the general ache of a physical job.

Three times a day at most. Never under a tight bandage, never with a heating pad, never on broken skin, and wash your hands afterwards.

## A routine that works for a physical job

- After the shift: a warm shower, then Iodex on the parts that ache.
- Before bed: five minutes of stretching. Hamstrings, calves, the chest against a doorframe.
- On a day off: a twenty-minute walk. Rest is good; complete stillness makes muscles stiffer.

## For the gym

Soreness the day after a hard session is normal and needs movement, water and warmth, not treatment. A rub in the evening and a light walk the next morning shorten it. A sharp pain during a lift, that stays, is an injury: cold for two days, then warmth, and no lifting on it until it is gone.

Both rubs together are the [Winter Pain Kit](/products/winter-pain-kit), Rs 399, cash on delivery anywhere in Pakistan.`,
  },
];
