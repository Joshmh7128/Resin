/**
 * The links a shop can put on its storefront.
 *
 * The four named ones cover where record shops actually are; "other" is the
 * escape hatch for an Etsy shop, an eBay seller page, a Linktree or a label
 * site, without turning the settings form into an endless list of fields.
 */

export type StoreLinkKind = "website" | "instagram" | "facebook" | "bandcamp" | "other";

export interface StoreLink {
  kind: StoreLinkKind;
  label: string;
  href: string;
}

interface LinkSource {
  websiteUrl: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  bandcampUrl: string | null;
  otherUrl: string | null;
  otherLabel: string | null;
}

/**
 * Names an unlabelled link by its domain, so "Other" never appears as a button
 * on a customer-facing page. `https://www.etsy.com/shop/x` becomes "etsy.com".
 */
export function domainLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return "Website";
  }
}

export function storeLinks(store: LinkSource): StoreLink[] {
  const links: StoreLink[] = [];

  const named: [StoreLinkKind, string, string | null][] = [
    ["website", "Website", store.websiteUrl],
    ["instagram", "Instagram", store.instagramUrl],
    ["facebook", "Facebook", store.facebookUrl],
    ["bandcamp", "Bandcamp", store.bandcampUrl],
  ];

  for (const [kind, label, href] of named) {
    if (href) links.push({ kind, label, href });
  }

  if (store.otherUrl) {
    links.push({
      kind: "other",
      label: store.otherLabel?.trim() || domainLabel(store.otherUrl),
      href: store.otherUrl,
    });
  }

  return links;
}
