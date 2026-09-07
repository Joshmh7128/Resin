"use client";

import type { CSSProperties } from "react";
import { StoreLinkIcon } from "@/components/StoreLinkIcon";
import type { StoreLink } from "@/lib/store-links";
import {
  accentForeground,
  themeOption,
  type FeaturedLayoutId,
  type HeaderStyleId,
  type LayoutId,
  type ThemeId,
} from "@/lib/theme";

/**
 * A miniature of the shop's own storefront, in whichever theme and layout is
 * currently selected.
 *
 * A row of colour swatches doesn't answer the question a shop owner is actually
 * asking, which is "what will my page look like". This renders the real thing
 * at a small size using the same theme tokens the storefront uses, so the
 * answer is exact rather than approximate. It is deliberately built from
 * stand-in artwork rather than the shop's real records: it has to render
 * instantly as someone clicks between options, with no database round trip and
 * nothing to wait on.
 */

/** Stand-in sleeves. Fixed hues so the preview looks the same every render. */
const SLEEVES = [
  "linear-gradient(135deg,#c2410c,#f59e0b)",
  "linear-gradient(135deg,#1e3a8a,#0ea5e9)",
  "linear-gradient(135deg,#3f6212,#84cc16)",
  "linear-gradient(135deg,#701a75,#d946ef)",
  "linear-gradient(135deg,#7f1d1d,#f43f5e)",
  "linear-gradient(135deg,#374151,#9ca3af)",
];

export interface PreviewOptions {
  theme: ThemeId;
  headerStyle: HeaderStyleId;
  defaultLayout: LayoutId;
  featuredLayout: FeaturedLayoutId;
  accentColor: string;
  storeName: string;
  logoUrl?: string | null;
  bannerUrl?: string | null;
}

export function StorefrontPreview({
  options,
  label,
}: {
  options: PreviewOptions;
  label?: string;
}) {
  // Monochrome ignores the shop's accent, so the preview has to as well rather
  // than showing a colour the real storefront won't use.
  const accent = themeOption(options.theme).forcedAccent ?? options.accentColor;
  const banner = options.headerStyle === "banner";

  return (
    <figure className="m-0">
      <div
        data-theme={options.theme}
        style={
          { "--st-accent": accent, "--st-accent-fg": accentForeground(accent) } as CSSProperties
        }
        className="overflow-hidden rounded-lg border border-neutral-300 bg-st-bg"
        // The preview is decorative: everything in it is described by the
        // controls beside it, so a screen reader gains nothing from the mock.
        aria-hidden
      >
        <Header options={options} banner={banner} />

        <div className="space-y-2 p-2">
          <Featured layout={options.featuredLayout} />
          <BrowseBar layout={options.defaultLayout} />
          <Results layout={options.defaultLayout} />
        </div>
      </div>

      {label && <figcaption className="mt-2 text-xs text-neutral-500">{label}</figcaption>}
    </figure>
  );
}

/**
 * What a customer sees when they open "Shop info": the pictures, the about
 * copy, and the links. Previewed separately from the layout options because
 * these are typed rather than picked, and a URL that turns out to be a dead
 * link or the wrong shape is much easier to spot as a picture than as text in
 * a field.
 */
export function StoreInfoPreview({
  theme,
  accentColor,
  headerStyle,
  storeName,
  logoUrl,
  bannerUrl,
  aboutText,
  links,
}: {
  theme: ThemeId;
  accentColor: string;
  headerStyle: HeaderStyleId;
  storeName: string;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  aboutText?: string | null;
  links: StoreLink[];
}) {
  const accent = themeOption(theme).forcedAccent ?? accentColor;
  const banner = headerStyle === "banner";

  return (
    <div
      data-theme={theme}
      style={{ "--st-accent": accent, "--st-accent-fg": accentForeground(accent) } as CSSProperties}
      className="overflow-hidden rounded-lg border border-neutral-300 bg-st-surface"
    >
      {banner &&
        (bannerUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={bannerUrl} alt="" className="h-20 w-full object-cover" />
        ) : (
          <div className="flex h-20 w-full items-center justify-center bg-st-surface-2 px-3 text-center text-[10px] font-medium text-st-faint">
            No banner image yet
          </div>
        ))}

      <div className="h-1 w-full bg-st-accent" />

      <div className="p-3">
        <div className="flex items-center gap-2.5">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt=""
              className="h-10 w-10 shrink-0 rounded object-cover ring-1 ring-st-border"
            />
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-st-surface-2 text-[8px] text-st-faint ring-1 ring-st-border">
              No pic
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-st-fg">{storeName || "Your store"}</p>
            <p className="truncate text-[11px] text-st-faint">1,204 records · updated today</p>
          </div>
          <span className="shrink-0 rounded-full border border-st-border px-2 py-0.5 text-[10px] font-medium text-st-muted">
            Info
          </span>
        </div>

        <div className="mt-3 border-t border-st-border pt-3">
          {aboutText ? (
            <p className="whitespace-pre-wrap text-[11px] leading-relaxed text-st-muted">
              {aboutText}
            </p>
          ) : (
            <p className="text-[11px] italic text-st-faint">
              Your about text will appear here.
            </p>
          )}

          {links.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {links.map((link) => (
                <span
                  key={link.kind}
                  className="inline-flex items-center gap-1 rounded-full border border-st-border px-2 py-0.5 text-[10px] font-medium text-st-muted"
                >
                  <StoreLinkIcon kind={link.kind} className="h-3 w-3" />
                  {link.label}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Header({ options, banner }: { options: PreviewOptions; banner: boolean }) {
  return (
    <div className="bg-st-surface">
      {banner &&
        (options.bannerUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={options.bannerUrl} alt="" className="h-10 w-full object-cover" />
        ) : (
          <div className="flex h-10 w-full items-center justify-center bg-st-surface-2 text-[7px] font-medium text-st-faint">
            Add a banner image under Shop details
          </div>
        ))}

      <div className="h-[3px] w-full bg-st-accent" />

      <div className="flex items-center gap-1.5 px-2 py-1.5">
        {options.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={options.logoUrl}
            alt=""
            className={`shrink-0 rounded object-cover ring-1 ring-st-border ${
              banner ? "h-5 w-5" : "h-4 w-4"
            }`}
          />
        ) : (
          <div
            className={`shrink-0 rounded bg-st-surface-2 ring-1 ring-st-border ${
              banner ? "h-5 w-5" : "h-4 w-4"
            }`}
          />
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate text-[9px] font-semibold leading-tight text-st-fg">
            {options.storeName || "Your store"}
          </p>
          <p className="truncate text-[7px] leading-tight text-st-faint">
            1,204 records · updated today
          </p>
        </div>

        <span className="shrink-0 rounded-full border border-st-border px-1.5 py-0.5 text-[7px] font-medium text-st-muted">
          Info
        </span>
      </div>
    </div>
  );
}

function Featured({ layout }: { layout: FeaturedLayoutId }) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5">
        <span className="text-[8px] font-semibold text-st-fg">Featured</span>
        <span className="h-px flex-1 bg-st-accent opacity-25" />
      </div>

      {layout === "carousel" && (
        // Tiles are wider than the grid's and the row is clipped mid-sleeve, so
        // the rail reads as something you swipe rather than as a grid that
        // happens to be one line. Without that it is hard to tell the carousel
        // preview from the grid one at this size.
        <div className="relative overflow-hidden">
          <div className="flex gap-1">
            {SLEEVES.slice(0, 4).map((sleeve, i) => (
              <div key={i} className="w-[30%] shrink-0">
                <Tile sleeve={sleeve} />
                <Caption />
              </div>
            ))}
          </div>
          <div className="absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-st-bg to-transparent" />
        </div>
      )}

      {layout === "grid" && (
        <div className="grid grid-cols-4 gap-1">
          {SLEEVES.slice(0, 4).map((sleeve, i) => (
            <div key={i}>
              <Tile sleeve={sleeve} />
              <Caption />
            </div>
          ))}
        </div>
      )}

      {layout === "list" && (
        <div className="space-y-1">
          {SLEEVES.slice(0, 2).map((sleeve, i) => (
            <Row key={i} sleeve={sleeve} />
          ))}
        </div>
      )}
    </div>
  );
}

function BrowseBar({ layout }: { layout: LayoutId }) {
  return (
    <div className="space-y-1 border-t border-st-border pt-1.5">
      <div className="flex items-center gap-1">
        <div className="h-3.5 flex-1 rounded border border-st-border bg-st-surface" />
        <div className="h-3.5 w-8 rounded bg-st-accent" />
      </div>
      <div className="flex items-center gap-1">
        <div className="h-3.5 w-12 rounded border border-st-border bg-st-surface" />
        <div className="flex gap-0.5 rounded border border-st-border bg-st-surface p-0.5">
          {(["grid", "list", "coverflow"] as const).map((id) => (
            <span
              key={id}
              className={`h-2.5 w-2.5 rounded-[2px] ${
                id === layout ? "bg-st-accent" : "bg-st-surface-2"
              }`}
            />
          ))}
        </div>
        <span className="rounded-full border border-st-border px-1.5 py-0.5 text-[7px] font-medium text-st-muted">
          Filters
        </span>
      </div>
    </div>
  );
}

function Results({ layout }: { layout: LayoutId }) {
  if (layout === "list") {
    return (
      <div className="space-y-1">
        {SLEEVES.slice(0, 3).map((sleeve, i) => (
          <Row key={i} sleeve={sleeve} />
        ))}
      </div>
    );
  }

  if (layout === "coverflow") {
    // Angled neighbours around a square centre: the shape is what tells you
    // what cover flow does, more than any label would.
    return (
      <div className="flex items-center justify-center gap-1 py-1.5">
        <Angled sleeve={SLEEVES[1]} direction={1} />
        <div className="w-12 shrink-0">
          <Tile sleeve={SLEEVES[0]} />
        </div>
        <Angled sleeve={SLEEVES[2]} direction={-1} />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-4 gap-1">
      {SLEEVES.map((sleeve, i) => (
        <div key={i}>
          <Tile sleeve={sleeve} />
          <Caption />
        </div>
      ))}
    </div>
  );
}

function Tile({ sleeve }: { sleeve: string }) {
  return (
    <div
      className="aspect-square w-full rounded-[2px] border border-st-border"
      style={{ backgroundImage: sleeve }}
    />
  );
}

function Angled({ sleeve, direction }: { sleeve: string; direction: 1 | -1 }) {
  return (
    <div className="w-8 shrink-0 opacity-70" style={{ perspective: "120px" }}>
      <div style={{ transform: `rotateY(${direction * 42}deg)` }}>
        <Tile sleeve={sleeve} />
      </div>
    </div>
  );
}

function Caption() {
  return (
    <div className="mt-0.5 space-y-0.5">
      <div className="h-1 w-4/5 rounded-full bg-st-fg opacity-70" />
      <div className="h-1 w-2/5 rounded-full bg-st-muted opacity-50" />
    </div>
  );
}

function Row({ sleeve }: { sleeve: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded border border-st-border bg-st-surface p-1">
      <div
        className="h-5 w-5 shrink-0 rounded-[2px]"
        style={{ backgroundImage: sleeve }}
      />
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="h-1 w-3/5 rounded-full bg-st-fg opacity-70" />
        <div className="h-1 w-2/5 rounded-full bg-st-muted opacity-50" />
      </div>
      <div className="h-1 w-4 shrink-0 rounded-full bg-st-fg opacity-70" />
    </div>
  );
}
