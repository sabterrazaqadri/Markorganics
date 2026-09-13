import type { Metadata } from "next";
import Link from "next/link";
import { SUPPORT_EMAIL, WHATSAPP_NUMBER } from "@/config/commerce";
import { WhatsAppLink } from "@/components/analytics/WhatsAppLink";

export const metadata: Metadata = {
  title: "Contact",
  description: "Reach MARKORGANICS on WhatsApp or email for order questions, wholesale and feedback.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  const display = `+${WHATSAPP_NUMBER.slice(0, 2)} ${WHATSAPP_NUMBER.slice(2, 5)} ${WHATSAPP_NUMBER.slice(5)}`;
  return (
    <div className="container-x py-8 md:py-12">
      <h1 className="text-3xl sm:text-4xl">Contact</h1>
      <p className="mt-2 max-w-xl text-ink-soft">WhatsApp is fastest. We reply between 10am and 8pm, Monday to Saturday.</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:max-w-3xl">
        <div className="card p-5">
          <h2 className="text-lg">WhatsApp</h2>
          <p className="mt-1 text-ink-soft">{display}</p>
          <WhatsAppLink className="btn btn-band-care mt-4">Message on WhatsApp</WhatsAppLink>
        </div>
        <div className="card p-5">
          <h2 className="text-lg">Email</h2>
          <p className="mt-1 text-ink-soft">{SUPPORT_EMAIL}</p>
          <a href={`mailto:${SUPPORT_EMAIL}`} className="btn btn-secondary mt-4">
            Send an email
          </a>
        </div>
        <div className="card p-5 sm:col-span-2">
          <h2 className="text-lg">Order questions</h2>
          <p className="mt-1 text-ink-soft">
            Have your order number ready (it looks like MRK-ABC123). You can also{" "}
            <Link href="/track" className="underline underline-offset-4">
              track your order
            </Link>{" "}
            without messaging us.
          </p>
        </div>
      </div>
    </div>
  );
}
