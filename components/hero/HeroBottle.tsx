"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";

// three.js stays in this async chunk; it is never part of the shared bundle.
const BottleCanvas = dynamic(() => import("./BottleCanvas"), { ssr: false, loading: () => null });

/**
 * The hero visual. `/hero-bottle.png` is a plain, centred bottle render on an
 * empty background, so the rotating 3D bottle can cross-fade over it. The
 * canvas geometry in BottleCanvas.tsx is proportioned to match this render.
 *
 * Set SHOW_HERO_3D to false to keep the static image only.
 */
const SHOW_HERO_3D = true;

export const HERO_IMAGE = { src: "/hero-bottle.png", width: 1146, height: 1373 };

type NetworkInformation = { saveData?: boolean; effectiveType?: string };

function canShow3D(): boolean {
  if (!SHOW_HERO_3D) return false;
  if (typeof window === "undefined") return false;
  if (window.innerWidth < 768) return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  const conn = (navigator as Navigator & { connection?: NetworkInformation }).connection;
  if (conn?.saveData) return false;
  if (conn?.effectiveType && /(^|-)2g$/.test(conn.effectiveType)) return false;
  return true;
}

export function HeroBottle() {
  const boxRef = useRef<HTMLDivElement>(null);
  const [mount, setMount] = useState(false);
  const [ready, setReady] = useState(false);
  const onReady = useCallback(() => setReady(true), []);

  useEffect(() => {
    if (!canShow3D()) return;
    const el = boxRef.current;
    if (!el) return;
    let cancelled = false;

    const schedule = () => {
      const start = () => {
        if (!cancelled) setMount(true);
      };
      if ("requestIdleCallback" in window) {
        (window as Window & { requestIdleCallback: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback(
          start,
          { timeout: 3000 },
        );
      } else {
        setTimeout(start, 1200);
      }
    };

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          schedule();
        }
      },
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => {
      cancelled = true;
      io.disconnect();
    };
  }, []);

  return (
    // Box matches the render's own 5:6 ratio, so image and canvas share one frame.
    <div ref={boxRef} className="relative mx-auto aspect-[5/6] w-full max-w-[440px] lg:max-w-[480px]">
      <Image
        src={HERO_IMAGE.src}
        alt="A 15 ml amber glass dropper bottle with a gold collar, ivory dropper bulb and a plain amber label band."
        width={HERO_IMAGE.width}
        height={HERO_IMAGE.height}
        priority
        fetchPriority="high"
        sizes="(min-width: 1024px) 480px, (min-width: 768px) 44vw, 88vw"
        className={`h-full w-full object-contain transition-opacity duration-500 ${ready ? "opacity-0" : "opacity-100"}`}
      />
      {mount ? (
        <div className={`absolute inset-0 transition-opacity duration-700 ${ready ? "opacity-100" : "opacity-0"}`}>
          <BottleCanvas onReady={onReady} />
        </div>
      ) : null}
    </div>
  );
}
