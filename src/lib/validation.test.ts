import { describe, it, expect } from "vitest";
import {
  appearanceSchema,
  locationSchema,
  partialAppearanceSchema,
  shopDetailsSchema,
} from "@/lib/validation";

const emptyDetails = {
  logoUrl: "",
  bannerUrl: "",
  aboutText: "",
  websiteUrl: "",
  instagramUrl: "",
  facebookUrl: "",
  bandcampUrl: "",
  otherUrl: "",
  otherLabel: "",
};

const emptyLocation = {
  label: "",
  addressLine: "",
  city: "",
  postcode: "",
  country: "",
  phone: "",
  openingHours: "",
};

describe("shopDetailsSchema", () => {
  it("accepts a store that fills in nothing", () => {
    expect(shopDetailsSchema.safeParse(emptyDetails).success).toBe(true);
  });

  it("accepts ordinary shop details", () => {
    const result = shopDetailsSchema.safeParse({
      ...emptyDetails,
      logoUrl: "https://example.com/logo.png",
      bannerUrl: "https://example.com/banner.jpg",
      aboutText: "Second-hand jazz and soul since 1994.",
      websiteUrl: "https://example.com",
      instagramUrl: "http://instagram.com/example",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a link that isn't a URL", () => {
    const result = shopDetailsSchema.safeParse({ ...emptyDetails, websiteUrl: "not a url" });
    expect(result.success).toBe(false);
  });

  it("rejects non-http schemes, which would otherwise become live links", () => {
    // These values are rendered as anchors, or as image sources, on a public
    // page. Allowing any scheme would let a store put javascript: behind a link
    // customers click.
    for (const url of [
      "javascript:alert(1)",
      "data:text/html;base64,PHNjcmlwdD4=",
      "file:///etc/passwd",
    ]) {
      for (const field of ["websiteUrl", "logoUrl", "bannerUrl", "otherUrl"]) {
        const result = shopDetailsSchema.safeParse({ ...emptyDetails, [field]: url });
        expect(result.success, `${field}=${url} should be rejected`).toBe(false);
      }
    }
  });

  it("rejects an over-long about section rather than truncating it", () => {
    const result = shopDetailsSchema.safeParse({ ...emptyDetails, aboutText: "x".repeat(2001) });
    expect(result.success).toBe(false);
  });
});

describe("locationSchema", () => {
  it("accepts a location with only some of the fields filled in", () => {
    expect(locationSchema.safeParse(emptyLocation).success).toBe(true);
    expect(
      locationSchema.safeParse({
        ...emptyLocation,
        label: "Camden",
        addressLine: "12 Bleecker Street",
        city: "New York",
        phone: "+1 212 555 0134",
        openingHours: "Mon: Closed\nTue to Sat: 11am to 7pm",
      }).success,
    ).toBe(true);
  });

  it("rejects an over-long address rather than truncating it", () => {
    const result = locationSchema.safeParse({ ...emptyLocation, addressLine: "x".repeat(201) });
    expect(result.success).toBe(false);
  });
});

describe("appearanceSchema", () => {
  const valid = {
    theme: "sepia",
    headerStyle: "banner",
    defaultLayout: "coverflow",
    featuredLayout: "list",
    accentColor: "#2563eb",
  };

  it("accepts every combination the app implements", () => {
    expect(appearanceSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects options the storefront can't render", () => {
    // Without this a posted form could store a theme with no stylesheet behind
    // it, leaving the shop's page unstyled.
    expect(appearanceSchema.safeParse({ ...valid, theme: "neon" }).success).toBe(false);
    expect(appearanceSchema.safeParse({ ...valid, defaultLayout: "carousel" }).success).toBe(false);
    expect(appearanceSchema.safeParse({ ...valid, featuredLayout: "coverflow" }).success).toBe(
      false,
    );
    expect(appearanceSchema.safeParse({ ...valid, headerStyle: "" }).success).toBe(false);
  });

  it("rejects an accent colour that isn't a hex triple", () => {
    expect(appearanceSchema.safeParse({ ...valid, accentColor: "blue" }).success).toBe(false);
    expect(appearanceSchema.safeParse({ ...valid, accentColor: "#25f" }).success).toBe(false);
  });
});

describe("partialAppearanceSchema", () => {
  it("accepts one section's fields on their own", () => {
    // Each appearance section is its own form with its own save button, so a
    // submission carries only the fields that section owns.
    const result = partialAppearanceSchema.safeParse({ defaultLayout: "list" });
    expect(result.success).toBe(true);
    expect(result.success && result.data).toEqual({ defaultLayout: "list" });
  });

  it("still rejects a bad value in the fields it was given", () => {
    expect(partialAppearanceSchema.safeParse({ theme: "neon" }).success).toBe(false);
  });

  it("never invents values for the fields it wasn't given", () => {
    // Anything absent has to be left alone. Filling in a default here would let
    // saving the layout quietly reset the shop's theme.
    const result = partialAppearanceSchema.safeParse({ headerStyle: "banner" });
    expect(result.success && Object.keys(result.data)).toEqual(["headerStyle"]);
  });
});
