/**
 * Shared constants with zero dependencies - safe to import from client
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

/** Cap on simultaneous company selection (bounds fan-out + URL length).
 *  Lives here (not in the picker component) because server components must
 *  never import values from "use client" modules: Next replaces every such
 *  export with a client-reference proxy, silently turning this into garbage.
 */
export const MAX_COMPANIES = 5;
