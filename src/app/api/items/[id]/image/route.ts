import { NextResponse } from "next/server";
import { resolveItemImage } from "@/lib/item-image";

/**
 * Resolves one item's cover image. Returns immediately in every case: either
 * the cached image, or "pending" while a background worker fetches it. The
 * request never waits on Discogs, so it can't be killed by a request timeout
 * no matter how many images a page is waiting on.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const result = await resolveItemImage(id);

  if (result.status === "not-found") {
    return NextResponse.json({ status: "not-found" }, { status: 404 });
  }

  return NextResponse.json(result, {
    // "ready" and "none" are final answers and safe to cache; "pending" means
    // ask again shortly.
    headers:
      result.status === "pending"
        ? { "Cache-Control": "no-store" }
        : { "Cache-Control": "public, max-age=3600" },
  });
}
