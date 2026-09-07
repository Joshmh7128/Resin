"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A horizontally scrolling row with arrow buttons.
 *
 * The row itself is a plain scroll-snap container, so touch swiping is the
 * browser's own and it works with no JavaScript at all. The arrows are the only
 * part that needs a client component, and they are for pointer users who have
 * no easy way to swipe; they hide themselves when there is nothing to scroll to.
 *
 * Children are rendered on the server and passed in, so a rail of cards costs
 * nothing extra in the client bundle beyond these buttons.
 */
export function FeaturedRail({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: false, end: false });

  const update = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    const maxScroll = rail.scrollWidth - rail.clientWidth;
    setEdges({
      start: rail.scrollLeft > 4,
      // A couple of pixels of slack: sub-pixel widths mean scrollLeft rarely
      // lands exactly on the maximum.
      end: rail.scrollLeft < maxScroll - 4,
    });
  }, []);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    update();
    const observer = new ResizeObserver(update);
    observer.observe(rail);
    rail.addEventListener("scroll", update, { passive: true });
    return () => {
      rail.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [update, children]);

  const step = (direction: -1 | 1) => {
    const rail = railRef.current;
    if (!rail) return;
    rail.scrollBy({ left: direction * Math.round(rail.clientWidth * 0.8), behavior: "smooth" });
  };

  return (
    <div className="relative">
      <div
        ref={railRef}
        role="group"
        aria-label={label}
        className="st-rail -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-4 pb-1 sm:mx-0 sm:gap-4 sm:px-0"
      >
        {children}
      </div>

      <Arrow direction={-1} visible={edges.start} onClick={() => step(-1)} />
      <Arrow direction={1} visible={edges.end} onClick={() => step(1)} />
    </div>
  );
}

function Arrow({
  direction,
  visible,
  onClick,
}: {
  direction: -1 | 1;
  visible: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      tabIndex={visible ? 0 : -1}
      aria-hidden={!visible}
      aria-label={direction === 1 ? "Scroll right" : "Scroll left"}
      // Hidden on touch-first widths, where swiping is the natural gesture and
      // an overlaid button would just cover a sleeve.
      className={`absolute top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-st-border bg-st-surface text-st-muted shadow-md transition hover:bg-st-surface-2 sm:flex ${
        direction === 1 ? "-right-3" : "-left-3"
      } ${visible ? "opacity-100" : "pointer-events-none opacity-0"}`}
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
