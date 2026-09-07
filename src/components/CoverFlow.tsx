"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatPrice } from "@/lib/format";
import { Cover, coverAlt, type StorefrontItem } from "@/components/RecordCard";

/**
 * Cover flow: a deck of sleeves you swipe through side on, like the original
 * iPod.
 *
 * Built on native scroll-snap rather than a drag library, so a phone gets its
 * own momentum scrolling for free and the whole thing still works if the
 * JavaScript never arrives: without it you simply get a plain scrollable row of
 * covers, each one a link. The tilt is applied straight to the DOM nodes on
 * scroll instead of through React state, since re-rendering every sleeve on
 * every frame is exactly the sort of thing that makes a phone stutter.
 */

/** How far, in slide widths, a cover keeps tilting before it flattens off. */
const FALLOFF = 3;
const MAX_ROTATION = 55;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function CoverFlow({ slug, items }: { slug: string; items: StorefrontItem[] }) {
  const railRef = useRef<HTMLDivElement>(null);
  const centersRef = useRef<number[]>([]);
  const frameRef = useRef<number | null>(null);
  const [active, setActive] = useState(0);

  /** Caches each slide's centre so the scroll handler never triggers a layout. */
  const measure = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    const slides = rail.querySelectorAll<HTMLElement>("[data-slide]");
    centersRef.current = Array.from(slides, (slide) => slide.offsetLeft + slide.offsetWidth / 2);
  }, []);

  const paint = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;

    const centre = rail.scrollLeft + rail.clientWidth / 2;
    const slides = rail.querySelectorAll<HTMLElement>("[data-slide]");
    const width = slides[0]?.offsetWidth || 1;

    let nearest = 0;
    let nearestDistance = Infinity;

    slides.forEach((slide, index) => {
      const slideCentre = centersRef.current[index] ?? slide.offsetLeft + slide.offsetWidth / 2;
      const offset = (slideCentre - centre) / width;
      const distance = Math.abs(offset);

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = index;
      }

      const spread = clamp(offset, -FALLOFF, FALLOFF);
      const fade = Math.min(distance / FALLOFF, 1);
      slide.style.transform = `translateZ(${-Math.min(distance, 1.4) * 110}px) rotateY(${
        -spread * (MAX_ROTATION / FALLOFF) * 1.6
      }deg) scale(${1 - Math.min(distance, 1) * 0.16})`;
      slide.style.opacity = String(1 - fade * 0.6);
      slide.style.zIndex = String(100 - Math.round(distance * 10));
    });

    setActive((current) => (current === nearest ? current : nearest));
  }, []);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;

    measure();
    paint();

    const onScroll = () => {
      if (frameRef.current !== null) return;
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        paint();
      });
    };

    const observer = new ResizeObserver(() => {
      measure();
      paint();
    });
    observer.observe(rail);

    rail.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      rail.removeEventListener("scroll", onScroll);
      observer.disconnect();
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [measure, paint, items]);

  const step = useCallback((direction: -1 | 1) => {
    const rail = railRef.current;
    if (!rail) return;
    const slide = rail.querySelector<HTMLElement>("[data-slide]");
    rail.scrollBy({ left: direction * (slide?.offsetWidth ?? 240), behavior: "smooth" });
  }, []);

  const current = items[active];

  return (
    <div className="select-none">
      <div
        ref={railRef}
        // The deck is a listbox of covers to look through; the caption below
        // carries the details and the link for whichever one is centred.
        role="group"
        aria-label="Cover flow"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") {
            event.preventDefault();
            step(1);
          } else if (event.key === "ArrowLeft") {
            event.preventDefault();
            step(-1);
          }
        }}
        className="st-rail st-coverflow flex snap-x snap-mandatory items-center gap-2 overflow-x-auto overscroll-x-contain py-6 focus:outline-none sm:gap-4 sm:py-10"
        style={{ ["--st-slide" as string]: "min(58vw, 260px)" }}
      >
        {/* Spacers let the first and last cover reach the middle of the rail. */}
        <div className="shrink-0" style={{ width: "calc(50% - var(--st-slide) / 2)" }} aria-hidden />

        {items.map((item, index) => (
          <Link
            key={item.id}
            data-slide
            href={`/store/${slug}/item/${item.id}`}
            aria-label={coverAlt(item)}
            aria-current={index === active ? "true" : undefined}
            tabIndex={index === active ? 0 : -1}
            className="st-coverflow-item aspect-square shrink-0 snap-center overflow-hidden rounded-md bg-st-surface-2 shadow-lg"
            style={{ width: "var(--st-slide)" }}
          >
            <Cover item={item} />
          </Link>
        ))}

        <div className="shrink-0" style={{ width: "calc(50% - var(--st-slide) / 2)" }} aria-hidden />
      </div>

      {current && (
        <div className="mt-1 flex items-center justify-center gap-3 px-4">
          <RailButton direction={-1} onClick={() => step(-1)} disabled={active === 0} />

          <div aria-live="polite" className="min-w-0 flex-1 text-center">
            <Link href={`/store/${slug}/item/${current.id}`} className="block min-w-0">
              <p className="truncate text-base font-semibold text-st-fg">{current.title}</p>
              <p className="truncate text-sm text-st-muted">{current.artist}</p>
              <p className="mt-1 text-sm font-semibold text-st-fg">
                {formatPrice(current.price, current.priceCurrency)}
                {current.condition && (
                  <span className="font-normal text-st-faint"> · {current.condition}</span>
                )}
              </p>
            </Link>
            <p className="mt-2 text-xs text-st-faint">
              {active + 1} of {items.length}
            </p>
          </div>

          <RailButton
            direction={1}
            onClick={() => step(1)}
            disabled={active === items.length - 1}
          />
        </div>
      )}
    </div>
  );
}

function RailButton({
  direction,
  onClick,
  disabled,
}: {
  direction: -1 | 1;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={direction === 1 ? "Next record" : "Previous record"}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-st-border bg-st-surface text-st-muted transition hover:bg-st-surface-2 disabled:opacity-30"
    >
      <svg viewBox="0 0 12 12" aria-hidden className="h-4 w-4">
        <path
          d={direction === 1 ? "M4.5 2.5 8 6l-3.5 3.5" : "M7.5 2.5 4 6l3.5 3.5"}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
