import { cookies } from "next/headers";
import HomeClient from "./components/HomeClient";
import { MAX_COMPANIES, TIME_OPTIONS } from "@/lib/constants";
import type { ThemeName } from "@/lib/theme";

function validTheme(v: unknown): ThemeName | null {
  return v === "clean" || v === "dark" || v === "panda" ? v : null;
}

function toArray(v: string | string[] | undefined): string[] {
  const list = Array.isArray(v) ? v : v === undefined ? [] : [v];
  return list.filter(Boolean).slice(0, MAX_COMPANIES);
}

/**
 * Server entry: resolves shareable-link state (URL params + theme cookie)
 * BEFORE first paint, so SSR HTML and client hydration agree by
 * construction. No window reads, no lazy theme guessing, no client-side regen.
 */
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const [store, params] = await Promise.all([cookies(), searchParams]);
  const urlTheme = typeof params.theme === "string" ? validTheme(params.theme) : null;
  const tm = typeof params.time === "string" ? params.time : null;
  return (
    <HomeClient
      initialTheme={urlTheme ?? validTheme(store.get("csl-theme")?.value) ?? "clean"}
      initialSelected={toArray(params.company)}
      initialTime={tm && (TIME_OPTIONS as readonly string[]).includes(tm) ? tm : "All"}
    />
  );
}
