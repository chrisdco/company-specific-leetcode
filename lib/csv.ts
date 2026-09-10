import type { Problem } from "@/app/types/problem";
import { formatAcceptance, formatFrequency } from "./format";

/**
 * CSV cell sanitization against formula injection.
 *
 * OWASP guidance: when untrusted text lands in a spreadsheet, any cell whose
 * first character is =, +, -, @ (or starts with tab / carriage return, which
 * some parsers also treat as formula prefixes) must be neutralized. Quoting
 * alone does NOT help — Excel evaluates quoted "=cmd" too. Prefixing with a
 * single quote forces text treatment while staying invisible-ish in Sheets
 * and explicit in Excel. Delimiters and quotes are handled separately by
 * quoting.
 */
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

export function sanitizeCsvCell(value: unknown): string {
  const s = String(value ?? "");
  const escaped = s.replace(/"/g, '""');
  const cell = FORMULA_PREFIX.test(s) ? `'${escaped}` : escaped;
  return `"${cell}"`;
}

export function problemsToCsv(problems: Problem[]): string {
  const header = ["Title", "Difficulty", "Frequency %", "Acceptance", "Link", "Companies", "Topics"];
  const lines = problems.map((p) =>
    [
      p.Title,
      p.Difficulty,
      formatFrequency(p.Frequency),
      formatAcceptance(p["Acceptance Rate"]),
      p.Link,
      (p.Companies ?? [p.Company]).join("; "),
      (p.Topics ?? []).join("; "),
    ]
      .map(sanitizeCsvCell)
      .join(",")
  );
  return [header.map(sanitizeCsvCell).join(","), ...lines].join("\n");
}
