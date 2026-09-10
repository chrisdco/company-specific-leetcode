import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turbopack is the default bundler for `next dev` and
  // `next build`, so no flags or webpack config needed. If a future
  // custom webpack setup is ever added, builds must explicitly opt out
  // via `next build --webpack`.
  poweredByHeader: false,
  async headers() {
    // Baseline hardening that can't break rendering: no script/style CSP
    // (Next inlines both), just MIME-sniffing, clickjacking, referrer and
    // sensor guards.
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
