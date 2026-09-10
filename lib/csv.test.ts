import { describe, expect, it } from "vitest";
import { problemsToCsv, sanitizeCsvCell } from "./csv";
import type { Problem } from "@/app/types/problem";

describe("sanitizeCsvCell", () => {
  it("quotes plain values and escapes quotes", () => {
    expect(sanitizeCsvCell("Two Sum")).toBe('"Two Sum"');
    expect(sanitizeCsvCell('say "hi"')).toBe('"say ""hi"""');
  });
  it("neutralizes formula prefixes", () => {
    for (const cell of ["=cmd|'/c calc'!A0", "+123", "-2+3", "@SUM(A1)", "\t123", "\r123"]) {
      const out = sanitizeCsvCell(cell);
      // single-quote guard must be the first payload character inside quotes
      expect(out[1]).toBe("'");
      // stripping the guard restores the exact original text (no data loss)
      expect(out.slice(2, -1).replace(/""/g, '"')).toBe(cell);
    }
  });
  it("leaves safe values untouched apart from quoting", () => {
    expect(sanitizeCsvCell("57.8%")).toBe('"57.8%"');
    expect(sanitizeCsvCell("Array; Hash Table")).toBe('"Array; Hash Table"');
  });
});

describe("problemsToCsv", () => {
  const problem: Problem = {
    Company: "Google",
    Companies: ["Google", "Meta"],
    Difficulty: "Easy",
    Title: "=HYPERLINK(\"evil\")",
    Frequency: "100",
    "Acceptance Rate": "57.8%",
    Link: "https://leetcode.com/problems/two-sum",
    Topics: ["Array", "Hash Table"],
  };

  it("emits a header plus one row per problem", () => {
    const lines = problemsToCsv([problem]).split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe('"Title","Difficulty","Frequency %","Acceptance","Link","Companies","Topics"');
  });

  it("neutralizes a malicious title while keeping data intact", () => {
    const row = problemsToCsv([problem]).split("\n")[1];
    expect(row).toContain("\"'=HYPERLINK(\"\"evil\"\")\"");
    expect(row).toContain("https://leetcode.com/problems/two-sum");
    expect(row).toContain("Google; Meta");
  });
});
