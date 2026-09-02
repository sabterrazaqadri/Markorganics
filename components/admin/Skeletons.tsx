/**
 * Loading states sized to the real layout, so nothing shifts when data lands.
 * Each one mirrors the page it stands in for: same header height, same filter
 * bar, same number of table rows.
 */

export function ListSkeleton({
  tabs = 0,
  filters = 0,
  rows = 10,
  cols = 6,
}: {
  tabs?: number;
  filters?: number;
  rows?: number;
  cols?: number;
}) {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>

      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="a-skel h-[22px] w-40" />
          <div className="a-skel mt-1.5 h-3 w-56" />
        </div>
        <div className="a-skel h-[30px] w-28" />
      </div>

      {tabs > 0 ? (
        <div className="a-tabs mb-3 gap-4 pb-1.5">
          {Array.from({ length: tabs }).map((_, i) => (
            <div key={i} className="a-skel h-3.5 w-16" />
          ))}
        </div>
      ) : null}

      {filters > 0 ? (
        <div className="a-card mb-3 grid gap-2 p-2 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: filters }).map((_, i) => (
            <div key={i}>
              <div className="a-skel mb-1 h-2.5 w-14" />
              <div className="a-skel h-[30px] w-full" />
            </div>
          ))}
        </div>
      ) : null}

      <div className="a-card">
        <table className="a-table">
          <tbody>
            {Array.from({ length: rows }).map((_, r) => (
              <tr key={r}>
                {Array.from({ length: cols }).map((__, c) => (
                  <td key={c}>
                    <span
                      className="a-skel block h-3.5"
                      style={{ width: c === 0 ? "72%" : c === cols - 1 ? "42%" : "56%" }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function TilesSkeleton({ tiles = 4, cards = 2 }: { tiles?: number; cards?: number }) {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>

      <div className="mb-4">
        <div className="a-skel h-[22px] w-52" />
        <div className="a-skel mt-1.5 h-3 w-64" />
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: tiles }).map((_, i) => (
          <div key={i} className="a-card p-3">
            <div className="a-skel h-2.5 w-20" />
            <div className="a-skel mt-2 h-5 w-24" />
            <div className="a-skel mt-2 h-2.5 w-28" />
          </div>
        ))}
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-2">
        {Array.from({ length: cards }).map((_, i) => (
          <div key={i} className="a-card">
            <div className="a-card-head">
              <div className="a-skel h-3.5 w-32" />
            </div>
            <div className="space-y-2 p-3">
              {Array.from({ length: 6 }).map((__, r) => (
                <div key={r} className="a-skel h-3.5" style={{ width: `${90 - r * 8}%` }} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function FormSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite" className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_300px]">
      <span className="sr-only">Loading</span>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="a-card space-y-3 p-3">
            <div className="a-skel h-3.5 w-24" />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="a-skel h-[30px]" />
              <div className="a-skel h-[30px]" />
            </div>
            <div className="a-skel h-20" />
          </div>
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="a-card space-y-2 p-3">
            <div className="a-skel h-3.5 w-20" />
            <div className="a-skel h-[30px]" />
            <div className="a-skel h-[30px]" />
          </div>
        ))}
      </div>
    </div>
  );
}
