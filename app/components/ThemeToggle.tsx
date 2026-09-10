"use client";

import { Sun, Moon, Panda } from "lucide-react";
import type { ThemeName } from "@/lib/theme";
import { cn } from "@/lib/utils";

const OPTIONS: { id: ThemeName; label: string; icon: typeof Sun }[] = [
  { id: "clean", label: "Light theme", icon: Sun },
  { id: "dark", label: "Dark theme", icon: Moon },
  { id: "panda", label: "Panda tribute theme", icon: Panda },
];

/** Vertical icon-only picker — identical footprint in every theme, no layout shift. */
export default function ThemeToggle({
  theme,
  onChange,
}: {
  theme: ThemeName;
  onChange: (t: ThemeName) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Appearance theme"
      className="inline-flex flex-col items-center gap-0.5 rounded-2xl border border-stone-200 bg-white/80 p-1 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/80"
    >
      {OPTIONS.map(({ id, label, icon: Icon }) => {
        const active = theme === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            aria-pressed={active}
            aria-label={label}
            title={label}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-xl transition-all",
              active
                ? "text-white shadow-sm dark:text-zinc-950"
                : "text-stone-500 hover:bg-stone-100 hover:text-stone-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            )}
            style={active ? { backgroundColor: "var(--accent)" } : undefined}
          >
            <Icon className="h-4 w-4" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
