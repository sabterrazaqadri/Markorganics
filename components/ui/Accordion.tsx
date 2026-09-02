import type { ReactNode } from "react";

interface Item {
  id: string;
  title: string;
  content: ReactNode;
  defaultOpen?: boolean;
}

/**
 * Native <details> accordion: keyboard accessible with no JavaScript.
 * The summary is the button; the browser manages expanded state and announces it.
 */
export function Accordion({ items }: { items: Item[] }) {
  return (
    <div className="divide-y divide-rule border-y border-rule">
      {items.map((item) => (
        <details key={item.id} id={item.id} className="group" open={item.defaultOpen}>
          <summary className="flex cursor-pointer list-none items-center justify-between py-4 font-display text-base font-semibold [&::-webkit-details-marker]:hidden">
            {item.title}
            <span
              aria-hidden="true"
              className="ml-4 inline-block text-xl leading-none text-ink-soft transition-transform group-open:rotate-45"
            >
              +
            </span>
          </summary>
          <div className="pb-5 text-ink-soft">{item.content}</div>
        </details>
      ))}
    </div>
  );
}
