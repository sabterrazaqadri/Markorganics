// PLACEHOLDER — replace with real product photography.
// Requirements for the shoot: plain surface, single side light,
// no text, badges or icons inside the image file.

import type { SVGProps } from "react";

type BottleFamily = "josh" | "rahat" | "nazakat";

const NAMES: Record<BottleFamily, { en: string; ur: string }> = {
  josh: { en: "Josh", ur: "جوش" },
  rahat: { en: "Rahat", ur: "راحت" },
  nazakat: { en: "Nazakat", ur: "نزاکت" },
};

const FILL: Record<BottleFamily, string> = {
  josh: "fill-josh",
  rahat: "fill-rahat",
  nazakat: "fill-nazakat",
};

interface Props extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  family: BottleFamily;
  width: number;
  height: number;
  showUrdu?: boolean;
}

export function BottleMark({ family, width, height, showUrdu = true, className, ...rest }: Props) {
  const name = NAMES[family];
  const fill = FILL[family];
  return (
    <svg
      viewBox="0 0 120 320"
      width={width}
      height={height}
      role="img"
      aria-label={`${name.en} bottle — placeholder illustration`}
      className={className}
      {...rest}
    >
      <rect x={24} y={80} width={72} height={232} rx={12} className={fill} />
      <path d="M44 46 L76 46 L92 86 L28 86 Z" className={fill} />
      <rect x={46} y={40} width={28} height={14} className={fill} />
      <rect x={42} y={8} width={36} height={36} rx={5} className="fill-apo-gold" />
      <rect x={42} y={38} width={36} height={6} className="fill-apo-cap-lip" />
      <rect x={33} y={100} width={7} height={186} rx={3.5} className="fill-white" opacity={0.16} />
      <rect x={32} y={158} width={56} height={106} rx={3} className="fill-apo-label" />
      <text
        x={60}
        y={186}
        textAnchor="middle"
        className={`${fill} font-apo-display text-[16px] font-semibold`}
        textLength={name.en.length > 5 ? 46 : undefined}
        lengthAdjust="spacingAndGlyphs"
      >
        {name.en}
      </text>
      {showUrdu ? (
        <text x={60} y={208} textAnchor="middle" direction="rtl" className="fill-apo-body font-apo-urdu text-[12px]">
          {name.ur}
        </text>
      ) : null}
      <text x={60} y={250} textAnchor="middle" className="fill-apo-caption font-apo-sans text-[7px]" style={{ letterSpacing: "1.4px" }}>
        15 ML
      </text>
    </svg>
  );
}
