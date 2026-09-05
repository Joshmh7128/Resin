const DISCOGS_API = "https://api.discogs.com";
const USER_AGENT = "ResinRecordStoreDirectory/1.0 +https://github.com/resin-app";

// Discogs allows 60 req/min authenticated, 25 req/min unauthenticated.
// Keep comfortably under that with a shared minimum interval between requests.
let lastRequestAt = 0;
function throttleInterval(hasToken: boolean) {
  return hasToken ? 1100 : 2600;
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function throttle(hasToken: boolean) {
  const minInterval = throttleInterval(hasToken);
  const elapsed = Date.now() - lastRequestAt;
  if (elapsed < minInterval) {
    await sleep(minInterval - elapsed);
  }
  lastRequestAt = Date.now();
}

export class DiscogsError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "DiscogsError";
    this.status = status;
  }
}

async function discogsFetch(path: string, token?: string | null): Promise<unknown> {
  const hasToken = Boolean(token);
  await throttle(hasToken);

  const url = path.startsWith("http") ? path : `${DISCOGS_API}${path}`;
  const headers: Record<string, string> = { "User-Agent": USER_AGENT };
  if (token) headers.Authorization = `Discogs token=${token}`;

  const res = await fetch(url, { headers, cache: "no-store" });

  if (res.status === 429) {
    // Rate limited — back off once and retry a single time.
    await sleep(5000);
    return discogsFetch(path, token);
  }

  if (res.status === 404) {
    throw new DiscogsError("Discogs user or resource not found", 404);
  }

  if (!res.ok) {
    let detail = "";
    try {
      const body = (await res.json()) as { message?: string };
      detail = body.message ?? "";
    } catch {
      // ignore
    }
    throw new DiscogsError(
      `Discogs API request failed (${res.status})${detail ? `: ${detail}` : ""}`,
      res.status,
    );
  }

  return res.json();
}

interface DiscogsPrice {
  currency: string;
  value: number;
}

interface DiscogsListingRelease {
  id: number;
  description: string;
  artist?: string;
  title?: string;
  format?: string;
  catalog_number?: string;
  year?: number;
  thumbnail?: string;
  resource_url: string;
}

export interface DiscogsListing {
  id: number;
  status: string;
  condition?: string;
  sleeve_condition?: string;
  comments?: string;
  uri: string;
  posted?: string;
  price?: DiscogsPrice;
  release: DiscogsListingRelease;
}

interface DiscogsInventoryResponse {
  pagination: {
    page: number;
    pages: number;
    per_page: number;
    items: number;
  };
  listings: DiscogsListing[];
}

export async function fetchInventoryPage(
  username: string,
  token: string | null | undefined,
  page: number,
  perPage = 100,
): Promise<DiscogsInventoryResponse> {
  const params = new URLSearchParams({
    page: String(page),
    per_page: String(perPage),
    sort: "listed",
    sort_order: "desc",
  });
  const data = await discogsFetch(
    `/users/${encodeURIComponent(username)}/inventory?${params.toString()}`,
    token,
  );
  return data as DiscogsInventoryResponse;
}

const MAX_PAGES = 300; // safety cap (~30,000 items)

export async function fetchAllInventoryListings(
  username: string,
  token: string | null | undefined,
  onProgress?: (fetched: number, total: number) => void,
): Promise<DiscogsListing[]> {
  const all: DiscogsListing[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const data = await fetchInventoryPage(username, token, page, 100);
    all.push(...data.listings);
    totalPages = data.pagination.pages || 1;
    onProgress?.(all.length, data.pagination.items ?? all.length);
    page += 1;
  } while (page <= totalPages && page <= MAX_PAGES);

  return all;
}

function parseArtistTitle(listing: DiscogsListing): { artist: string; title: string } {
  const release = listing.release;
  if (release.artist && release.title) {
    return { artist: release.artist, title: release.title };
  }
  const description = release.description ?? "";
  const separatorIndex = description.indexOf(" - ");
  if (separatorIndex !== -1) {
    return {
      artist: description.slice(0, separatorIndex).trim(),
      title: description.slice(separatorIndex + 3).trim(),
    };
  }
  return { artist: release.artist ?? "Unknown Artist", title: release.title ?? description };
}

export interface MappedInventoryItem {
  listingId: number;
  releaseId: number;
  title: string;
  artist: string;
  catalogNumber: string | null;
  format: string | null;
  year: number | null;
  condition: string | null;
  sleeveCondition: string | null;
  price: number | null;
  priceCurrency: string | null;
  comments: string | null;
  thumbUrl: string | null;
  imageUrl: string | null;
  discogsUri: string;
  releaseUri: string;
  status: string;
  searchText: string;
}

export function mapListingToItem(listing: DiscogsListing): MappedInventoryItem {
  const { artist, title } = parseArtistTitle(listing);
  const release = listing.release;
  const searchText = [artist, title, release.catalog_number]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return {
    listingId: listing.id,
    releaseId: release.id,
    title,
    artist,
    catalogNumber: release.catalog_number ?? null,
    format: release.format ?? null,
    year: release.year ?? null,
    condition: listing.condition ?? null,
    sleeveCondition: listing.sleeve_condition ?? null,
    price: listing.price?.value ?? null,
    priceCurrency: listing.price?.currency ?? null,
    comments: listing.comments ?? null,
    thumbUrl: release.thumbnail || null,
    imageUrl: release.thumbnail || null,
    discogsUri: listing.uri,
    releaseUri: `https://www.discogs.com/release/${release.id}`,
    status: listing.status,
    searchText,
  };
}

export interface DiscogsReleaseDetails {
  genres: string[];
  styles: string[];
  images: string[];
  notes: string | null;
  tracklist: { position: string; title: string; duration: string }[];
  labels: string[];
}

interface DiscogsReleaseResponse {
  genres?: string[];
  styles?: string[];
  notes?: string;
  images?: { uri: string; type: string }[];
  tracklist?: { position: string; title: string; duration: string }[];
  labels?: { name: string; catno: string }[];
}

export async function fetchReleaseDetails(
  releaseId: number,
  token: string | null | undefined,
): Promise<DiscogsReleaseDetails> {
  const data = (await discogsFetch(`/releases/${releaseId}`, token)) as DiscogsReleaseResponse;
  return {
    genres: data.genres ?? [],
    styles: data.styles ?? [],
    images: (data.images ?? []).map((img) => img.uri).filter(Boolean),
    notes: data.notes ?? null,
    tracklist: data.tracklist ?? [],
    labels: (data.labels ?? []).map((l) => `${l.name} (${l.catno})`),
  };
}

export async function verifyDiscogsUsername(
  username: string,
  token: string | null | undefined,
): Promise<boolean> {
  try {
    await discogsFetch(`/users/${encodeURIComponent(username)}`, token);
    return true;
  } catch {
    return false;
  }
}
