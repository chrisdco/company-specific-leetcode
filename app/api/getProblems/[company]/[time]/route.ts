import { NextRequest } from "next/server";
import {
  TIME_OPTIONS,
  getMergedCompanyList,
  getProblemsWithFallback,
  normalizeKey,
} from "@/lib/sources";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ company: string; time: string }> }
) {
  const { company, time } = await params;

  if (!company || typeof company !== "string" || company.length > 100) {
    return Response.json({ error: "Invalid company" }, { status: 400 });
  }
  if (!(TIME_OPTIONS as readonly string[]).includes(time)) {
    return Response.json({ error: "Invalid time" }, { status: 400 });
  }

  // Allowlist against merged canonical list (fuzzy: exact or normalized match
  // so URL-encoded variants and casing differences still validate safely).
  try {
    const { companies } = await getMergedCompanyList();
    let decoded = company;
    try {
      decoded = decodeURIComponent(company);
    } catch {
      decoded = company;
    }
    const target = normalizeKey(decoded);
    const canonical =
      companies.find((c) => c === company) ??
      companies.find((c) => normalizeKey(c) === target);
    if (!canonical) {
      return Response.json({ error: "Invalid company" }, { status: 400 });
    }

    const { problems, source, fallbackUsed } = await getProblemsWithFallback(
      canonical,
      time
    );
    return Response.json(
      {
        company: canonical,
        time,
        source, // "primary" (liquidslr) | "fallback" (snehasishroy)
        fallbackUsed,
        count: problems.length,
        problems,
      },
      {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        },
      }
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to fetch problems";
    const status = /not found/i.test(message) ? 404 : 502;
    return Response.json({ error: message, problems: [] }, { status });
  }
}
