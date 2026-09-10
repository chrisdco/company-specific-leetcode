/**
 * Shared constants with zero dependencies — safe to import from client
 * components without dragging server-only modules (csv-parse) into the
 * browser bundle.
 */

export const TIME_OPTIONS = [
  "Thirty Days",
  "Three Months",
  "Six Months",
  "More Than Six Months",
  "All",
] as const;

export type TimeOption = (typeof TIME_OPTIONS)[number];
