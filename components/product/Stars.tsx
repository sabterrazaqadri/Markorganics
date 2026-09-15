/** Five stars, filled to `value` (0 to 5, halves allowed). Pure SVG, no client code. */
export function Stars({ value, size = 16, label }: { value: number; size?: number; label?: string }) {
  const v = Math.max(0, Math.min(5, value));
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={label ?? `${v} out of 5 stars`}>
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, v - i));
        const id = `star-${i}-${Math.round(fill * 100)}`;
        return (
          <svg key={i} width={size} height={size} viewBox="0 0 20 20" aria-hidden="true" className="shrink-0">
            <defs>
              <linearGradient id={id} x1="0" x2="1" y1="0" y2="0">
                <stop offset={`${fill * 100}%`} stopColor="#C1841B" />
                <stop offset={`${fill * 100}%`} stopColor="#E3DFD4" />
              </linearGradient>
            </defs>
            <path
              fill={`url(#${id})`}
              d="M10 1.6l2.5 5.3 5.8.7-4.3 4 1.1 5.8L10 14.6l-5.1 2.8 1.1-5.8-4.3-4 5.8-.7z"
            />
          </svg>
        );
      })}
    </span>
  );
}
