export type ThemeName = "clean" | "dark" | "panda";

export interface ThemeTokens {
  name: ThemeName;
  label: string;
  pageBg: string;
  headerBg: string;
  cardBg: string;
  cardBorder: string;
  text: string;
  muted: string;
  accent: string;
  accentSoft: string;
  buttonBg: string;
  buttonText: string;
}

export const cleanTheme: ThemeTokens = {
  name: "clean",
  label: "Light",
  pageBg: "#e8e6e1", // deeper warm paper — white cards sit *in* it, less glare
  headerBg: "#f1efe9",
  cardBg: "#ffffff",
  cardBorder: "#e7e5e4", // stone-200
  text: "#1c1917", // stone-900
  muted: "#57534e", // stone-600 — passes AA where slate-400/500 hints failed
  accent: "#4f46e5", // indigo-600 — single brand accent
  accentSoft: "#eef2ff", // indigo-50
  buttonBg: "#18181b", // zinc-900 near-black primary (Vercel/Linear idiom)
  buttonText: "#ffffff",
};

export const darkTheme: ThemeTokens = {
  name: "dark",
  label: "Dark",
  pageBg: "#09090b", // zinc-950
  headerBg: "#0e0e12",
  cardBg: "#141417",
  cardBorder: "#26262b",
  text: "#f4f4f5", // zinc-100
  muted: "#a1a1aa", // zinc-400 — AA on dark surfaces
  accent: "#818cf8", // indigo-400 — luminous on dark, same family as clean accent
  accentSoft: "rgba(129, 140, 248, 0.14)",
  buttonBg: "#fafafa",
  buttonText: "#09090b",
};

export const pandaTheme: ThemeTokens = {  name: "panda",
  label: "Panda",
  pageBg: "#d3cac2",
  // Solid header a touch deeper than the page: the old 10% wash was
  // indistinguishable from the page, satisfying neither structure nor flatness.
  headerBg: "#c6bbb0",
  cardBg: "rgba(255, 255, 255, 0.92)",
  cardBorder: "#4e737a",
  text: "#33433f",
  muted: "#5b6d68",
  accent: "#4e737a",
  accentSoft: "rgba(132, 160, 169, 0.12)",
  buttonBg: "#4e737a",
  buttonText: "#ffffff",
};

// Accessible difficulty colors — shared by both themes (WCAG AA on white).
// Deepened text shades so badges read at 12px.
export const difficultyStyles: Record<string, { bg: string; text: string; border: string }> = {
  Easy: { bg: "#ecfdf5", text: "#065f46", border: "#a7f3d0" },
  Medium: { bg: "#fffbeb", text: "#92400e", border: "#fde68a" },
  Hard: { bg: "#fff1f2", text: "#9f1239", border: "#fecdd3" },
  Unknown: { bg: "#f5f5f4", text: "#57534e", border: "#e7e5e4" },
};

export function getDifficultyStyle(difficulty: string, dark = false) {
  if (dark) {
    const key = difficulty.trim().toLowerCase();
    if (key === "easy") return darkDifficulty.Easy;
    if (key === "medium") return darkDifficulty.Medium;
    if (key === "hard") return darkDifficulty.Hard;
    return darkDifficulty.Unknown;
  }
  const key = difficulty.trim().toLowerCase();
  if (key === "easy") return difficultyStyles.Easy;
  if (key === "medium") return difficultyStyles.Medium;
  if (key === "hard") return difficultyStyles.Hard;
  return difficultyStyles.Unknown;
}

// Translucent fills + bright text so badges glow on dark instead of glaring.
const darkDifficulty: Record<string, { bg: string; text: string; border: string }> = {
  Easy: { bg: "rgba(52, 211, 153, 0.12)", text: "#6ee7b7", border: "rgba(110, 231, 183, 0.30)" },
  Medium: { bg: "rgba(251, 191, 36, 0.12)", text: "#fcd34d", border: "rgba(252, 211, 77, 0.30)" },
  Hard: { bg: "rgba(251, 113, 133, 0.12)", text: "#fda4af", border: "rgba(253, 164, 175, 0.30)" },
  Unknown: { bg: "rgba(161, 161, 170, 0.12)", text: "#d4d4d8", border: "rgba(212, 212, 216, 0.25)" },
};
