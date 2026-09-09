import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next 16: Turbopack is the default bundler for `next dev` and
  // `next build`, so no flags or webpack config needed. If a future
  // custom webpack setup is ever added, builds must explicitly opt out
  // via `next build --webpack`.
};

export default nextConfig;
