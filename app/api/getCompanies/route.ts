import { getMergedCompanyList, getUpstreamFreshness, RateLimitedError } from "@/lib/sources";

export async function GET() {
  try {
    const [{ companies, primaryCount, fallbackCount }, freshness] = await Promise.all([
      getMergedCompanyList(),
      getUpstreamFreshness(),
    ]);
    return Response.json(
      {
        companies,
        primaryCount,
        fallbackCount,
        // Real upstream commit dates (ISO) — the UI shows these as "data as of".
        dataAsOf: freshness,
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
