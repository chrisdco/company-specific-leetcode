import { getMergedCompanyList, RateLimitedError } from "@/lib/sources";

export async function GET() {
  try {
    // Freshness dates ride a separate lazy endpoint (/api/freshness) so this
    // critical-path call stays at two upstream requests, not four.
    const { companies, primaryCount, fallbackCount } = await getMergedCompanyList();
    return Response.json(
      {
        companies,
        primaryCount,
        fallbackCount,
      },
      {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=86400",
        },
      }
    );
  } catch (e) {
    if (e instanceof RateLimitedError) {
      return Response.json(
        { error: e.message, companies: [] },
        {
          status: 429,
          headers:
            e.retryAfterSecs !== null
              ? { "Retry-After": String(e.retryAfterSecs) }
              : undefined,
        }
      );
    }
    const message = e instanceof Error ? e.message : "Failed to fetch companies";
    return Response.json({ error: message, companies: [] }, { status: 502 });
  }
}
