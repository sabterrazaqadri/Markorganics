import Link from "next/link";
import { HeroBottle } from "./HeroBottle";

export function Hero() {
  return (
    <section className="container-x grid items-center gap-8 py-10 md:grid-cols-2 md:gap-12 md:py-16 lg:py-20" aria-labelledby="hero-title">
      <div className="order-2 md:order-1">
        <p className="font-display text-sm font-semibold tracking-tight text-ink-soft">MARKORGANICS</p>
        <h1 id="hero-title" className="mt-3 text-4xl sm:text-5xl lg:text-[3.5rem]">
          Honest oils, balms and neel for every Pakistani home.
        </h1>
        <p className="mt-5 text-lg text-ink-soft">
          Cold-pressed hair oils, a balm for every drawer and a liquid neel that never leaves patches. Pay cash when it
          arrives.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/collections/oils" className="btn btn-band-oil">
            Shop oils
          </Link>
          <Link href="/products" className="btn btn-secondary">
            See all products
          </Link>
        </div>
        <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-soft">
          <li>Cash on delivery</li>
          <li>Delivery across Pakistan</li>
          <li>7-day easy returns</li>
        </ul>
      </div>
      <div className="order-1 md:order-2">
        <HeroBottle />
      </div>
    </section>
  );
}
