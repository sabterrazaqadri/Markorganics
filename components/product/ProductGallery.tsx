"use client";

import { useState } from "react";
import Image from "next/image";

interface Props {
  images: string[];
  name: string;
}

export function ProductGallery({ images, name }: Props) {
  const [index, setIndex] = useState(0);
  const list = images.length ? images : ["/products/placeholder.jpg"];
  const current = list[Math.min(index, list.length - 1)];

  return (
    <div>
      <div className="card relative aspect-square overflow-hidden bg-white">
        <Image
          key={current}
          src={current}
          alt={`${name}, photo ${index + 1} of ${list.length}`}
          fill
          priority
          fetchPriority="high"
          sizes="(min-width: 1024px) 560px, (min-width: 768px) 50vw, 100vw"
          className="object-cover"
        />
      </div>
      {list.length > 1 ? (
        <ul className="mt-3 flex gap-2" aria-label="Product photos">
          {list.map((src, i) => (
            <li key={src}>
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-pressed={i === index}
                aria-label={`Show photo ${i + 1}`}
                className={`block overflow-hidden rounded border bg-white ${i === index ? "border-ink" : "border-rule hover:border-ink-soft"}`}
              >
                <Image src={src} alt="" width={64} height={64} sizes="64px" className="h-16 w-16 object-cover" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
