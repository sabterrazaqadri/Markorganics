import type { Metadata } from "next";
import Link from "next/link";
import { BRAND_NAME } from "@/config/commerce";
import { PageBody, pageMetadata } from "@/components/content/PageBody";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("medical-disclaimer", {
    title: "Medical disclaimer",
    description: `${BRAND_NAME} products and information are not a substitute for medical advice, diagnosis or treatment.`,
  });
}

export default function MedicalDisclaimerPage() {
  return (
    <PageBody slug="medical-disclaimer" fallbackTitle="Medical disclaimer">
      <h2>Disclaimer (English)</h2>
      <p>
        The information on this website, {BRAND_NAME}, is for general information only. Articles, journal posts,
        product descriptions and everything else on the site are not a substitute for professional medical advice,
        diagnosis or treatment.
      </p>
      <p>
        Our products, including oils, balms, seeds, herbal capsules, shilajit and other herbal items, are not intended to
        diagnose, treat, cure or prevent any disease. They are meant to be used as part of a balanced diet and a healthy
        lifestyle, and they should not replace any medical advice or prescribed treatment.
      </p>
      <ul>
        <li>
          Always ask your doctor or another qualified health provider about any medical condition, and before starting
          any supplement, especially if you are pregnant or breastfeeding, giving it to a child, or taking regular
          medicine.
        </li>
        <li>Never ignore professional medical advice or delay seeking it because of something you read on this website.</li>
        <li>If you have, or think you have, a medical problem, contact your healthcare provider promptly.</li>
        <li>Stop using any product and see a doctor if you notice an allergic reaction or any unusual effect.</li>
      </ul>
      <p>
        You rely on any information provided by {BRAND_NAME}, its staff, contractors or partners entirely at your own
        risk. {BRAND_NAME} does not endorse any specific test, doctor, product, procedure or opinion mentioned on this
        website, and the mention of a product or service is not a recommendation.
      </p>

      <div dir="rtl" lang="ur" className="urdu mt-10">
        <h2>ڈسکلیمر (اردو)</h2>
        <p>
          اس ویب سائٹ ({BRAND_NAME}) پر دی گئی معلومات صرف عمومی معلومات کے لیے ہیں۔ مضامین، بلاگ پوسٹس، مصنوعات کی
          تفصیلات اور دیگر مواد کسی بھی پیشہ ور طبی مشورے، تشخیص یا علاج کا متبادل نہیں۔
        </p>
        <p>
          ہماری مصنوعات، جیسے تیل، بام، بیج، ہربل کیپسول، سلاجیت اور دیگر جڑی بوٹیاں، کسی بھی بیماری کی تشخیص، علاج،
          شفا یا روک تھام کے لیے نہیں ہیں۔ یہ متوازن غذا اور صحت مند طرزِ زندگی کا حصہ بننے کے لیے ہیں اور کسی طبی مشورے
          یا تجویز کردہ علاج کا متبادل نہیں۔
        </p>
        <ul>
          <li>
            کسی بھی طبی مسئلے کے بارے میں، اور کوئی بھی سپلیمنٹ شروع کرنے سے پہلے، اپنے معالج یا کسی مستند طبی ماہر سے
            مشورہ کریں، خاص طور پر حمل، دودھ پلانے کے دوران، بچوں کے لیے، یا اگر آپ باقاعدہ کوئی دوا لیتے ہیں۔
          </li>
          <li>اس ویب سائٹ پر پڑھی گئی کسی بات کی وجہ سے طبی مشورے کو نظر انداز نہ کریں اور نہ ہی علاج میں تاخیر کریں۔</li>
          <li>اگر آپ کو کسی بیماری کا شبہ ہو تو فوراً اپنے معالج سے رجوع کریں۔</li>
          <li>کسی بھی قسم کی الرجی یا غیر معمولی اثر محسوس ہو تو استعمال بند کر دیں اور ڈاکٹر سے رجوع کریں۔</li>
        </ul>
        <p>
          {BRAND_NAME} یا اس کے عملے کی فراہم کردہ کسی بھی معلومات پر انحصار مکمل طور پر آپ کی اپنی ذمہ داری ہے۔{" "}
          {BRAND_NAME} اس ویب سائٹ پر مذکور کسی مخصوص ٹیسٹ، معالج، پروڈکٹ یا طریقۂ کار کی توثیق نہیں کرتا، اور کسی پروڈکٹ
          یا سروس کا ذکر سفارش نہیں ہے۔
        </p>
      </div>

      <p className="mt-10">
        Questions about a product? <Link href="/contact">Contact us</Link> before you order.
      </p>
    </PageBody>
  );
}
