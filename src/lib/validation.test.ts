import { describe, it, expect } from "vitest";
import { shopDetailsSchema } from "@/lib/validation";

const empty = {
  logoUrl: "",
  addressLine: "",
  city: "",
  postcode: "",
  country: "",
  phone: "",
  openingHours: "",
  websiteUrl: "",
  instagramUrl: "",
  facebookUrl: "",
  bandcampUrl: "",
};

describe("shopDetailsSchema", () => {
  it("accepts a store that fills in nothing", () => {
    expect(shopDetailsSchema.safeParse(empty).success).toBe(true);
  });

  it("accepts ordinary shop details", () => {
    const result = shopDetailsSchema.safeParse({
      ...empty,
      addressLine: "12 Bleecker Street",
      city: "New York",
      phone: "+1 212 555 0134",
      openingHours: "Mon: Closed\nTue to Sat: 11am to 7pm",
      websiteUrl: "https://example.com",
      instagramUrl: "http://instagram.com/example",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a link that isn't a URL", () => {
    const result = shopDetailsSchema.safeParse({ ...empty, websiteUrl: "not a url" });
    expect(result.success).toBe(false);
  });

  it("rejects non-http schemes, which would otherwise become live links", () => {
    // These values are rendered as anchors on a public page, so allowing any
    // scheme would let a store put javascript: behind a link customers click.
    for (const url of [
      "javascript:alert(1)",
      "data:text/html;base64,PHNjcmlwdD4=",
      "file:///etc/passwd",
    ]) {
      const result = shopDetailsSchema.safeParse({ ...empty, websiteUrl: url });
      expect(result.success, `${url} should be rejected`).toBe(false);
    }
  });

  it("rejects an over-long address rather than truncating it", () => {
    const result = shopDetailsSchema.safeParse({ ...empty, addressLine: "x".repeat(201) });
    expect(result.success).toBe(false);
  });
});
