import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Note: Turbopack is used for `next dev` (fast HMR). Production `next build`
  // stays on webpack for now — migrate to `next build --turbopack` only after
  // the current feature batch lands cleanly with no build issues.
};

export default nextConfig;
