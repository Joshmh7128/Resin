import { NextResponse } from "next/server";
import { runPremiumMaintenance } from "@/lib/premium-expiry";

/**
 * Runs the plan expiry sweep for a scheduler: Render Cron, a GitHub Action, or
 * any service that can send a request with a bearer token. Admins can run the
 * same job by hand from the admin overview.
 *
 * It is a POST because it changes data, and it is safe to call repeatedly:
 * every store it acts on stops matching its query once it has.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not set, so this endpoint is disabled." },
      { status: 503 },
    );
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runPremiumMaintenance();
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
