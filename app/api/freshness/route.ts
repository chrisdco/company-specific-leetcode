import { getUpstreamFreshness } from "@/lib/sources";

/**
 * Upstream commit dates, fetched lazily by the client AFTER the company list
 * paints - keeps two GitHub API calls off the critical path.
 */
export async function GET() {
  try {
    const freshness = await getUpstreamFreshness();
    return Response.json(freshness, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=86400",
      },
    });
  } catch {
    return Response.json(
      { primary: null, fallback: null },
      {
        headers: { "Content-Type": "application/json; charset=utf-8" },
        status: 200,
      }
    );
  }
}
