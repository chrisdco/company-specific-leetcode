import { describe, expect, it } from "vitest";
import type { Problem } from "@/app/types/problem";
import { mergeCompanyResults } from "./merge";

function problem(overrides: Partial<Problem> & { Title: string; Link: string }): Problem {
  return {
    Company: "Test",
    Difficulty: "Medium",
    Frequency: "50",
    "Acceptance Rate": "40%",
    Topics: [],
    ...overrides,
  };
}

describe("mergeCompanyResults", () => {
  it("passes a single company through with Companies set", () => {
    const p = problem({ Title: "Two Sum", Link: "https://leetcode.com/problems/two-sum", Company: "Google" });
    const { problems, source } = mergeCompanyResults([
      { company: "Google", problems: [p], source: "primary" },
    ]);
    expect(source).toBe("primary");
    expect(problems).toHaveLength(1);
    expect(problems[0].Companies).toEqual(["Google"]);
  });

  it("unions across companies with max frequency winning display fields", () => {
    const g = problem({
      Title: "Two Sum",
      Link: "https://leetcode.com/problems/two-sum",
      Company: "Google",
      Difficulty: "Easy",
      Frequency: "60",
      "Acceptance Rate": "50%",
      Topics: ["Array"],
    });
    const m = problem({
      Title: "Two Sum",
      Link: "https://leetcode.com/problems/two-sum",
      Company: "Meta",
      Difficulty: "Medium",
      Frequency: "100",
      "Acceptance Rate": "55%",
      Topics: ["Hash Table"],
    });
    const { problems, source } = mergeCompanyResults([
      { company: "Google", problems: [g], source: "primary" },
      { company: "Meta", problems: [m], source: "primary" },
    ]);
    expect(source).toBe("primary");
    expect(problems).toHaveLength(1);
    const merged = problems[0];
    expect(merged.Frequency).toBe("100");
    expect(merged.Difficulty).toBe("Medium");
    expect(merged.Company).toBe("Meta");
    expect(merged["Acceptance Rate"]).toBe("55%");
    expect(merged.Topics).toEqual(["Array", "Hash Table"]);
    expect(merged.Companies).toEqual(["Google", "Meta"]);
  });

  it("breaks exact frequency ties alphabetically (order-independent)", () => {
    const a = problem({ Title: "X", Link: "https://leetcode.com/problems/x", Company: "Meta", Frequency: "80", Difficulty: "Hard" });
    const b = problem({ Title: "X", Link: "https://leetcode.com/problems/x", Company: "Google", Frequency: "80", Difficulty: "Easy" });
    const first = mergeCompanyResults([
      { company: "Meta", problems: [a], source: "primary" },
      { company: "Google", problems: [b], source: "primary" },
    ]).problems[0];
    const second = mergeCompanyResults([
      { company: "Google", problems: [b], source: "primary" },
      { company: "Meta", problems: [a], source: "primary" },
    ]).problems[0];
    expect(first.Company).toBe("Google");
    expect(second.Company).toBe("Google");
    expect(first.Difficulty).toBe(second.Difficulty);
  });

  it("fills in N/A acceptance from the other source", () => {
    const a = problem({ Title: "X", Link: "https://leetcode.com/problems/x", Company: "A", Frequency: "90", "Acceptance Rate": "N/A" });
    const b = problem({ Title: "X", Link: "https://leetcode.com/problems/x", Company: "B", Frequency: "10", "Acceptance Rate": "30%" });
    const { problems } = mergeCompanyResults([
      { company: "A", problems: [a], source: "primary" },
      { company: "B", problems: [b], source: "fallback" },
    ]);
    expect(problems[0]["Acceptance Rate"]).toBe("30%");
  });

  it("reports mixed sources", () => {
    const a = problem({ Title: "X", Link: "https://leetcode.com/problems/x", Company: "A" });
    const { source } = mergeCompanyResults([
      { company: "A", problems: [a], source: "primary" },
      { company: "B", problems: [{ ...a, Company: "B" }], source: "fallback" },
    ]);
    expect(source).toBe("mixed");
  });
});
