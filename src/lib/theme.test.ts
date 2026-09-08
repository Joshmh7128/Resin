import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { THEMES, THEME_IDS, accentForeground, resolvePresentation } from "@/lib/theme";

const globalsCss = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

/**
 * Light is defined by the bare `[data-theme]` block, which doubles as the
 * fallback palette for an unrecognised value, so it has no selector of its own.
 */
const FALLBACK_THEME = "light";

describe("theme definitions", () => {
  it("has exactly one picker entry per theme id, in the same order", () => {
    // A missing entry wouldn't fail loudly: `themeOption` falls back to the
    // first theme, so the picker would quietly show Light for it.
    expect(THEMES.map((t) => t.id)).toEqual([...THEME_IDS]);
  });

  it("has a stylesheet block for every theme", () => {
    // The failure this catches: adding a theme in TypeScript and forgetting the
    // CSS. It saves fine, passes validation, and then renders a storefront in
    // the fallback palette. Invisible until someone picks it.
    for (const id of THEME_IDS) {
      if (id === FALLBACK_THEME) continue;
      expect(globalsCss, `globals.css has no [data-theme="${id}"] block`).toContain(
        `[data-theme="${id}"]`,
      );
    }
  });

  it("sets a colour-scheme on every theme, so form controls match", () => {
    for (const id of THEME_IDS) {
      if (id === FALLBACK_THEME) continue;
      const block = globalsCss.split(`[data-theme="${id}"]`)[1]?.split("}")[0] ?? "";
      expect(block, `[data-theme="${id}"] declares no color-scheme`).toMatch(
        /color-scheme:\s*(light|dark)/,
      );
    }
  });

  it("gives every theme a full set of swatch colours", () => {
    for (const theme of THEMES) {
      for (const [key, value] of Object.entries(theme.swatch)) {
        expect(value, `${theme.id}.swatch.${key} is not a hex colour`).toMatch(
          /^#[0-9a-f]{6}$/i,
        );
      }
    }
  });
});

describe("accentForeground", () => {
  it("puts dark text on a pale accent and light text on a dark one", () => {
    expect(accentForeground("#fde047")).toBe("#111111"); // pale yellow
    expect(accentForeground("#ffffff")).toBe("#111111");
    expect(accentForeground("#2563eb")).toBe("#ffffff"); // the default blue
    expect(accentForeground("#000000")).toBe("#ffffff");
  });

  it("falls back to light text when the colour isn't a hex triple", () => {
    // The column is a plain string, so a bad value has to render something
    // readable rather than throwing on a customer's page.
    expect(accentForeground("rebeccapurple")).toBe("#ffffff");
    expect(accentForeground("")).toBe("#ffffff");
  });
});

describe("resolvePresentation", () => {
  const store = {
    theme: "midnight",
    headerStyle: "banner",
    defaultLayout: "coverflow",
    featuredLayout: "list",
    accentColor: "#2563eb",
  };

  it("passes through values the app supports", () => {
    expect(resolvePresentation(store)).toEqual({
      theme: "midnight",
      headerStyle: "banner",
      defaultLayout: "coverflow",
      featuredLayout: "list",
      accent: "#2563eb",
      accentFg: "#ffffff",
    });
  });

  it("falls back on anything it doesn't recognise", () => {
    // These are plain string columns, so a row written by an older version (or
    // by hand) must not leave a storefront rendering unstyled.
    const result = resolvePresentation({
      ...store,
      theme: "neon",
      headerStyle: "huge",
      defaultLayout: "carousel",
      featuredLayout: "coverflow",
    });

    expect(result.theme).toBe("light");
    expect(result.headerStyle).toBe("compact");
    expect(result.defaultLayout).toBe("grid");
    expect(result.featuredLayout).toBe("carousel");
  });

  it("ignores the shop's accent on the monochrome theme", () => {
    const result = resolvePresentation({ ...store, theme: "monochrome" });
    const mono = THEMES.find((t) => t.id === "monochrome");

    expect(result.accent).toBe(mono?.forcedAccent);
    expect(result.accent).not.toBe("#2563eb");
    // The stored colour is untouched, so switching back restores it.
    expect(store.accentColor).toBe("#2563eb");
  });
});
