"use client";

interface Props {
  value: number;
  min?: number;
  max: number;
  onChange: (next: number) => void;
  label: string;
  size?: "sm" | "md";
}

export function QuantityStepper({ value, min = 1, max, onChange, label, size = "md" }: Props) {
  const h = size === "sm" ? "h-9" : "h-11";
  const w = size === "sm" ? "w-9" : "w-11";
  return (
    <div className={`inline-flex ${h} items-stretch rounded border border-rule bg-white`} role="group" aria-label={label}>
      <button
        type="button"
        className={`${w} text-lg leading-none hover:bg-paper disabled:opacity-40`}
        onClick={() => onChange(value - 1)}
        disabled={value <= min}
        aria-label="Decrease quantity"
      >
        &minus;
      </button>
      <input
        type="number"
        inputMode="numeric"
        className="tabular w-10 border-x border-rule bg-transparent text-center text-sm font-medium outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        value={value}
        min={min}
        max={max}
        aria-label="Quantity"
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(Math.max(min, Math.min(max, n)));
        }}
      />
      <button
        type="button"
        className={`${w} text-lg leading-none hover:bg-paper disabled:opacity-40`}
        onClick={() => onChange(value + 1)}
        disabled={value >= max}
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  );
}
