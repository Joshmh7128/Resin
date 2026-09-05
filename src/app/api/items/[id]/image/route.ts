import { NextResponse } from "next/server";
import { resolveItemImage } from "@/lib/item-image";

/**
 * Resolves one item's cover image. The storefront calls this for the items on
 * the page that don't have artwork cached yet — one request per item, so no
 * single request can stall long enough to be killed by the platform's request
 * timeout.
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
