export interface Problem {
    Company: string;
    Difficulty: string;
    Title: string;
    Frequency: string;
    "Acceptance Rate": string;
    Link: string;
    Topics: string[];
    /** Populated client-side when multiple companies are merged. */
    Companies?: string[];
    /** Per-company raw frequencies (same keys as Companies). Powers compare view. */
    Frequencies?: Record<string, string>;
}