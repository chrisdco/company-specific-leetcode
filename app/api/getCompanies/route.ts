import { getMergedCompanyList } from "@/lib/sources";

export async function GET() {
  try {
    const { companies, primaryCount, fallbackCount } = await getMergedCompanyList();
    return Response.json(
      {
        companies,
        primaryCount,
        fallbackCount,
        updatedAt: new Date().toISOString(),
      },
      {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=86400",
        },
      }
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to fetch companies";
    return Response.json({ error: message, companies: [] }, { status: 502 });
  }
}
