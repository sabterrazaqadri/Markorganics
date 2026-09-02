import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

export default function NotFound() {
  return (
    <>
      <Header />
      <main id="main" className="container-x py-16 md:py-24">
        <p className="text-sm font-medium text-ink-soft">404</p>
        <h1 className="mt-1 text-3xl sm:text-4xl">That page is not here.</h1>
        <p className="mt-3 max-w-xl text-ink-soft">
          The link may be old or the product may have been renamed. Everything we sell is on the products page.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/products" className="btn btn-primary">
            See all products
          </Link>
          <Link href="/" className="btn btn-secondary">
            Go to the homepage
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
