import { describe, it, expect } from "vitest";
import { domainLabel, storeLinks } from "@/lib/store-links";

const none = {
  websiteUrl: null,
  instagramUrl: null,
  facebookUrl: null,
  bandcampUrl: null,
  otherUrl: null,
  otherLabel: null,
};

describe("domainLabel", () => {
  it("names a link by its domain, without the www", () => {
    expect(domainLabel("https://www.etsy.com/shop/records")).toBe("etsy.com");
    expect(domainLabel("https://linktr.ee/shop")).toBe("linktr.ee");
  });

  it("falls back rather than throwing on something unparseable", () => {
    expect(domainLabel("not a url")).toBe("Website");
  });
});

describe("storeLinks", () => {
  it("returns nothing when a shop has filled in no links", () => {
    expect(storeLinks(none)).toEqual([]);
  });

  it("keeps the named links in a fixed order", () => {
    const links = storeLinks({
      ...none,
      bandcampUrl: "https://shop.bandcamp.com",
      websiteUrl: "https://shop.example",
      facebookUrl: "https://facebook.com/shop",
    });
    expect(links.map((l) => l.kind)).toEqual(["website", "facebook", "bandcamp"]);
  });

  it("labels the other link by its domain when the shop didn't name it", () => {
    // "Other" is a settings-form word. It should never appear as a button on a
    // customer-facing page.
    const [link] = storeLinks({ ...none, otherUrl: "https://www.etsy.com/shop/records" });
    expect(link).toEqual({
      kind: "other",
      label: "etsy.com",
      href: "https://www.etsy.com/shop/records",
    });
  });

  it("uses the shop's own name for the other link when it gave one", () => {
    const [link] = storeLinks({
      ...none,
      otherUrl: "https://www.etsy.com/shop/records",
      otherLabel: "  Our Etsy  ",
    });
    expect(link.label).toBe("Our Etsy");
  });

  it("drops a label with no link behind it", () => {
    expect(storeLinks({ ...none, otherLabel: "Our Etsy" })).toEqual([]);
  });
});
