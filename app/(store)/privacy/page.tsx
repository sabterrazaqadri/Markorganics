import type { Metadata } from "next";
import { SUPPORT_EMAIL } from "@/config/commerce";
import { PageBody, pageMetadata } from "@/components/content/PageBody";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("privacy", {
    title: "Privacy",
    description: "What MARKORGANICS collects when you order, and how it is used.",
  });
}

export default function PrivacyPage() {
  return (
    <PageBody slug="privacy" fallbackTitle="Privacy">
      <p>This page explains what we collect and why. It is short because we collect very little.</p>
      <h2>What we collect</h2>
      <ul>
        <li>Your name, phone number, city and address, so we can deliver the order and call to confirm it.</li>
        <li>Optional notes you add to the order.</li>
        <li>Your cart, which is stored only in your own browser until you check out.</li>
        <li>Basic, anonymised analytics about which pages are visited, if analytics is enabled.</li>
      </ul>
      <h2>What we do not collect</h2>
      <ul>
        <li>No card or bank details. We are cash on delivery only.</li>
        <li>No account or password. There is nothing to sign up for.</li>
      </ul>
      <h2>Who sees it</h2>
      <p>
        Your delivery details are shared with the courier that delivers your parcel and with nobody else. We do not sell
        or rent customer information.
      </p>
      <h2>How long we keep it</h2>
      <p>Order records are kept for accounting. Ask us to delete your details at any time by emailing {SUPPORT_EMAIL}.</p>
    </PageBody>
  );
}
