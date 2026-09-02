import type { SeriesPoint } from "@/lib/admin/analytics";
import { formatPKR } from "@/lib/money";

/**
 * Revenue and order count over time as inline SVG.
 *
 * No chart library: two series over at most 90 points is a path and some bars,
 * and the admin bundle stays small.
 */
export function SeriesChart({ points }: { points: SeriesPoint[] }) {
  const width = 560;
  const height = 180;
  const padX = 8;
  const padTop = 10;
  const padBottom = 22;

  const maxRevenue = Math.max(1, ...points.map((p) => p.revenuePaisa));
  const maxOrders = Math.max(1, ...points.map((p) => p.orders));
  const plotH = height - padTop - padBottom;
  const step = points.length > 1 ? (width - padX * 2) / (points.length - 1) : 0;

  const x = (i: number) => padX + i * step;
  const yRevenue = (v: number) => padTop + plotH - (v / maxRevenue) * plotH;

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${yRevenue(p.revenuePaisa).toFixed(1)}`).join(" ");
  const area = `${line} L${x(points.length - 1).toFixed(1)},${padTop + plotH} L${padX},${padTop + plotH} Z`;
  const barW = Math.max(1.5, Math.min(10, step * 0.5));

  const total = points.reduce((n, p) => n + p.revenuePaisa, 0);
  const orders = points.reduce((n, p) => n + p.orders, 0);
  const label = (day: string) => day.slice(8) + "/" + day.slice(5, 7);

  return (
    <figure>
      <figcaption className="mb-2 flex flex-wrap items-baseline gap-3 text-[12px]">
        <span>
          <strong className="text-[15px]">{formatPKR(total)}</strong>{" "}
          <span className="text-[var(--a-soft)]">revenue</span>
        </span>
        <span>
          <strong className="text-[15px]">{orders}</strong> <span className="text-[var(--a-soft)]">orders</span>
        </span>
      </figcaption>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        role="img"
        aria-label={`Revenue and orders per day. Total ${formatPKR(total)} from ${orders} orders.`}
      >
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line
            key={f}
            x1={padX}
            x2={width - padX}
            y1={padTop + plotH - plotH * f}
            y2={padTop + plotH - plotH * f}
            stroke="var(--a-border)"
            strokeWidth="1"
          />
        ))}

        {/* Orders as faint bars behind the revenue line. */}
        {points.map((p, i) => (
          <rect
            key={p.day}
            x={x(i) - barW / 2}
            y={padTop + plotH - (p.orders / maxOrders) * plotH}
            width={barW}
            height={(p.orders / maxOrders) * plotH}
            fill="var(--a-border-strong)"
            opacity="0.5"
          >
            <title>
              {p.day}: {p.orders} orders, {formatPKR(p.revenuePaisa)}
            </title>
          </rect>
        ))}

        {points.length > 1 ? (
          <>
            <path d={area} fill="var(--a-info)" opacity="0.08" />
            <path d={line} fill="none" stroke="var(--a-info)" strokeWidth="1.8" strokeLinejoin="round" />
          </>
        ) : null}

        {points.map((p, i) =>
          i === 0 || i === points.length - 1 || (points.length > 8 && i === Math.floor(points.length / 2)) ? (
            <text
              key={`l-${p.day}`}
              x={x(i)}
              y={height - 6}
              fontSize="9"
              fill="var(--a-soft)"
              textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}
            >
              {label(p.day)}
            </text>
          ) : null,
        )}
      </svg>

      <p className="a-hint">Line is revenue, bars are order count. Hover a bar for the day&rsquo;s figures.</p>
    </figure>
  );
}
