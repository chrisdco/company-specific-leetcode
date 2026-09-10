/**
 * Client-side display formatters. The server already normalizes values
 * (see lib/sources.ts), so these are defensive: they re-apply the same
 * scale repairs in case a legacy/cached payload slips through, then format.
 */

/** Round to 0.1 — doubles as float hygiene (0.0058*100*100 would
 *  otherwise compare as 57.99999999999999 instead of 58). */
const round1 = (n: number): number => Math.round(n * 10) / 10;

export function frequencyValue(raw: string): number {
  const n = parseFloat(String(raw ?? "").replace("%", ""));
  if (!Number.isFinite(n)) return 0;
  if (n > 0 && n <= 1) return round1(n * 100);
  return round1(n);
}

export function formatFrequency(raw: string): string {
  const n = parseFloat(String(raw ?? "").replace("%", ""));
  if (!Number.isFinite(n)) return "—";
  const v = n > 0 && n <= 1 ? n * 100 : n;
  return `${Math.round(v * 10) / 10}%`;
}

export function acceptanceValue(raw: string): number {
  const s = String(raw ?? "").trim().replace("%", "");
  let n = parseFloat(s);
  if (!Number.isFinite(n)) return 0;
  if (n > 0 && n <= 1) n *= 100;
  if (n > 0 && n < 2) n *= 100;
  return round1(n);
}

export function formatAcceptance(raw: string): string {
  const s = String(raw ?? "").trim();
  if (!s || s === "N/A" || s === "-") return "N/A";
  const hadPercent = s.includes("%");
  let n = parseFloat(s.replace("%", ""));
  if (!Number.isFinite(n)) return "N/A";
  if (!hadPercent && n > 0 && n <= 1) n *= 100;
  if (n > 0 && n < 2) n *= 100;
  return `${Math.round(n * 10) / 10}%`;
}

// Editorial bands for the current result set only — upstream "frequency" is a
// per-company relative score (100 = that company's most-tagged problem), not
// a statistic. Kept stable so returning users can rely on the vocabulary.
export function frequencyLabel(raw: string): string {
  const n = frequencyValue(raw);
  if (n >= 70) return "Very high";
  if (n >= 50) return "High";
  if (n >= 30) return "Medium";
  if (n >= 10) return "Low";
  return "Very low";
}
