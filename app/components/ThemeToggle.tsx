"use client";

import { Sun, Moon, Panda } from "lucide-react";
import type { ThemeName } from "@/lib/theme";
import { cn } from "@/lib/utils";

const OPTIONS: { id: ThemeName; label: string; icon: typeof Sun; hint: string }[] = [
  { id: "clean", label: "Light", icon: Sun, hint: "Clean light theme (default)" },
  { id: "dark", label: "Dark", icon: Moon, hint: "Dark theme" },
  { id: "panda", label: "Panda", icon: Panda, hint: "Panda tribute theme (original look)" },
];

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
      className="inline-flex items-center rounded-full border border-stone-200 bg-white/80 p-1 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/80"
    >
      {OPTIONS.map(({ id, label, icon: Icon, hint }) => {
        const active = theme === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            aria-pressed={active}
            title={hint}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all",
              active
                ? "text-white shadow dark:text-zinc-950"
                : "text-stone-500 hover:text-stone-800 dark:text-zinc-400 dark:hover:text-zinc-100"
            )}
            style={active ? { backgroundColor: "var(--accent)" } : undefined}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
            {label}
          </button>
        );
      })}
    </div>
  );
}
