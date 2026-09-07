import type { CSSProperties } from "react";
import type { StorePresentation } from "@/lib/theme";

/**
 * Wraps a storefront in the shop's chosen theme.
 *
 * The theme is a `data-theme` attribute rather than a class on `<html>`, so it
 * covers the storefront only. The dashboard and the marketing pages keep their
 * own look no matter what a shop picks, and one page can't leak its palette
 * into another.
 *
 * The accent is an inline custom property because it is a free-form hex a shop
 * typed in, not one of a fixed set, so it can't live in a stylesheet.
 */
export function StorefrontFrame({
  presentation,
  children,
}: {
  presentation: StorePresentation;
  children: React.ReactNode;
}) {
  return (
    <div
      data-theme={presentation.theme}
      style={
        {
          "--st-accent": presentation.accent,
          "--st-accent-fg": presentation.accentFg,
        } as CSSProperties
      }
      className="flex min-h-screen flex-col bg-st-bg text-st-fg"
    >
      {children}
    </div>
  );
}
