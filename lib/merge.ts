import type { Problem } from "@/app/types/problem";

export interface CompanyResult {
  company: string;
  problems: Problem[];
  source: "primary" | "fallback";
}

export type MergedSource = "primary" | "fallback" | "mixed";

function freqValue(raw: unknown): number {
  return parseFloat(String(raw ?? "").replace("%", "")) || 0;
}

/**
 * Union problems across companies, keyed by LeetCode link.
 *
 * Deterministic regardless of selection/chip order:
 * - Frequency takes the max across sources.
 * - All other display fields (Difficulty, Acceptance, Company) follow the
 *   highest-frequency record; exact ties break alphabetically by company.
 * - Topics and Companies are order-preserving unions.
 */
export function mergeCompanyResults(results: CompanyResult[]): {
  problems: Problem[];
  source: MergedSource;
} {
  const byLink = new Map<string, Problem>();
  for (const { company, problems } of results) {
    for (const p of problems) {
      const ex = byLink.get(p.Link);
      if (!ex) {
        byLink.set(p.Link, {
          ...p,
          Company: company,
          Companies: [company],
          Topics: [...(p.Topics ?? [])],
        });
        continue;
      }
      const ef = freqValue(ex.Frequency);
      const pf = freqValue(p.Frequency);
      if (pf > ef || (pf === ef && company < ex.Company)) {
        ex.Frequency = p.Frequency;
        ex.Difficulty = p.Difficulty;
        ex.Company = company;
        if (p["Acceptance Rate"] !== "N/A") {
          ex["Acceptance Rate"] = p["Acceptance Rate"];
        }
      } else if (ex["Acceptance Rate"] === "N/A" && p["Acceptance Rate"] !== "N/A") {
        ex["Acceptance Rate"] = p["Acceptance Rate"];
      }
      ex.Topics = Array.from(new Set([...(ex.Topics ?? []), ...(p.Topics ?? [])]));
      if (!(ex.Companies ?? []).includes(company)) {
        ex.Companies = [...(ex.Companies ?? [ex.Company]), company];
      }
    }
  }
  const sources = new Set(results.map((r) => r.source));
  const source: MergedSource =
    sources.size === 1 ? (results[0].source as MergedSource) : "mixed";
  return { problems: [...byLink.values()], source };
}
