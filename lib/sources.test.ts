import { describe, expect, it } from "vitest";
import {
  isValidLeetCodeLink,
  normalizeAcceptance,
  normalizeDifficulty,
  normalizeFrequency,
  normalizeKey,
  normalizeTopics,
  parseFallbackCsv,
  parsePrimaryCsv,
  prettifySlug,
  toFallbackSlug,
} from "./sources";

describe("normalizeFrequency", () => {
  it("passes through 0–100 scale with or without %", () => {
    expect(normalizeFrequency("100.0")).toBe("100");
    expect(normalizeFrequency("100.0%")).toBe("100");
    expect(normalizeFrequency("62.5")).toBe("62.5");
  });
  it("scales fractions", () => {
    expect(normalizeFrequency("0.5")).toBe("50");
  });
  it("clamps garbage and out-of-range input", () => {
    expect(normalizeFrequency("abc")).toBe("0");
    expect(normalizeFrequency("")).toBe("0");
    expect(normalizeFrequency("250")).toBe("100");
    expect(normalizeFrequency("-5")).toBe("0");
  });
});

describe("normalizeAcceptance", () => {
  it("keeps correct percent values as-is", () => {
    expect(normalizeAcceptance("57.8%")).toBe("57.8%");
  });
  it("repairs double-divided upstream values", () => {
    // upstream stores ~0.0058 instead of ~58%
    expect(normalizeAcceptance("0.0058")).toBe("58%");
  });
  it("scales plain fractions once", () => {
    expect(normalizeAcceptance("0.59")).toBe("59%");
  });
  it("passes through missing values", () => {
    expect(normalizeAcceptance("")).toBe("N/A");
    expect(normalizeAcceptance("N/A")).toBe("N/A");
    expect(normalizeAcceptance("-")).toBe("N/A");
    expect(normalizeAcceptance("n/a")).toBe("N/A");
    expect(normalizeAcceptance("???")).toBe("N/A");
  });
});

describe("normalizeDifficulty", () => {
  it("normalizes case, whitespace and abbreviations", () => {
    expect(normalizeDifficulty("EASY")).toBe("Easy");
    expect(normalizeDifficulty("  hard ")).toBe("Hard");
    expect(normalizeDifficulty("med")).toBe("Medium");
    expect(normalizeDifficulty("Medium")).toBe("Medium");
  });
  it("falls back to Unknown", () => {
    expect(normalizeDifficulty("")).toBe("Unknown");
    expect(normalizeDifficulty("nightmare")).toBe("Unknown");
  });
});

describe("slug helpers", () => {
  it("normalizeKey strips to alphanumerics", () => {
    expect(normalizeKey("J.P. Morgan")).toBe("jpmorgan");
    expect(normalizeKey("AQR Capital Management")).toBe("aqrcapitalmanagement");
  });
  it("toFallbackSlug guesses dashed slugs", () => {
    expect(toFallbackSlug("Amazon")).toBe("amazon");
    expect(toFallbackSlug("AQR Capital Management")).toBe("aqr-capital-management");
    expect(toFallbackSlug("AT&T")).toBe("atandt");
  });
  it("prettifySlug title-cases", () => {
    expect(prettifySlug("aqr-capital-management")).toBe("Aqr Capital Management");
    expect(prettifySlug("jpmorgan")).toBe("Jpmorgan");
  });
});

describe("normalizeTopics", () => {
  it("splits comma- and semicolon-separated lists", () => {
    expect(normalizeTopics("Array, Hash Table")).toEqual(["Array", "Hash Table"]);
    expect(normalizeTopics("Array;Hash Table")).toEqual(["Array", "Hash Table"]);
    expect(normalizeTopics("")).toEqual([]);
  });
});

describe("parsePrimaryCsv", () => {
  const csv = [
    "Difficulty,Title,Frequency,Acceptance Rate,Link,Topics",
    'EASY,Two Sum,100.0,0.0058,https://leetcode.com/problems/two-sum,"Array, Hash Table"',
    "MEDIUM,,50,0.5,https://leetcode.com/problems/x,Array",
    "MEDIUM,Bad Link,50,0.5,https://example.com/x,Array",
  ].join("\n");

  it("parses valid rows and drops bad ones", () => {
    const rows = parsePrimaryCsv(csv, "Google");
    expect(rows).toHaveLength(1);
    expect(rows[0].Title).toBe("Two Sum");
    expect(rows[0].Difficulty).toBe("Easy");
    expect(rows[0].Topics).toEqual(["Array", "Hash Table"]);
  });
});

describe("parseFallbackCsv", () => {
  const csv = [
    "ID,URL,Title,Difficulty,Acceptance %,Frequency %",
    "1,https://leetcode.com/problems/two-sum,Two Sum,Easy,57.8%,100.0%",
  ].join("\n");

  it("maps URL/percent columns and leaves topics empty", () => {
    const rows = parseFallbackCsv(csv, "Google");
    expect(rows).toHaveLength(1);
    expect(rows[0].Link).toBe("https://leetcode.com/problems/two-sum");
    expect(rows[0]["Acceptance Rate"]).toBe("57.8%");
    expect(rows[0].Topics).toEqual([]);
  });
});

describe("isValidLeetCodeLink", () => {
  it("accepts canonical problem URLs", () => {
    expect(isValidLeetCodeLink("https://leetcode.com/problems/two-sum")).toBe(true);
    expect(isValidLeetCodeLink("https://leetcode.com/problems/two-sum/")).toBe(true);
  });
  it("rejects anything else", () => {
    expect(isValidLeetCodeLink("")).toBe(false);
    expect(isValidLeetCodeLink("https://example.com/problems/two-sum")).toBe(false);
    expect(isValidLeetCodeLink("javascript:alert(1)")).toBe(false);
    expect(isValidLeetCodeLink("https://leetcode.com/contest/weekly")).toBe(false);
  });
});
