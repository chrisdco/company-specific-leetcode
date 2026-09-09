import { getMergedCompanyList } from "./sources";

/** Backwards-compatible: canonical merged company list (primary + fallback extras). */
export async function getCompanyList(): Promise<string[]> {
  const { companies } = await getMergedCompanyList();
  return companies;
}

export { getMergedCompanyList };
