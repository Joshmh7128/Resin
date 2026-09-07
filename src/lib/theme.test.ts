import { describe, it, expect } from "vitest";
import { THEMES, accentForeground, resolvePresentation } from "@/lib/theme";

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
