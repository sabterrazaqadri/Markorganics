import Image from "next/image";
import Link from "next/link";

export function BrandStory() {
  return (
    <section aria-labelledby="story-title" className="container-x mt-16 grid items-center gap-8 md:grid-cols-2 md:gap-12">
      <div className="card overflow-hidden">
        <Image
          src="/brand-story.jpg"
          alt="Three MARK bottles with amber, teal and indigo label bands"
          width={1200}
          height={800}
          sizes="(min-width: 768px) 50vw, 100vw"
          className="h-auto w-full"
        />
      </div>
      <div>
        <h2 id="story-title" className="text-3xl sm:text-4xl">
          Made for the shelf, not the shop window.
        </h2>
        <p className="mt-4 text-ink-soft">
          MARKORGANICS started with one mustard oil, pressed the old way and sold to neighbours in Karachi. The range has
          grown, but the rule has not: single ingredients where possible, honest prices, and a label you can read.
        </p>
        <p className="mt-3 text-ink-soft">
          Each family has its own colour band so you can find the right bottle in a dim bathroom or a crowded cabinet.
          Amber for oils, teal for relief, indigo for the home.
        </p>
        <Link href="/about" className="btn btn-secondary mt-6">
          Read our story
        </Link>
      </div>
    </section>
  );
}
