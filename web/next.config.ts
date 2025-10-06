import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turn off ESLint & TS type checks during the production build.
  // You can run `npm run lint` separately in CI if you want lint to gate PRs.
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },

  turbopack: { root: __dirname },
  experimental: {},
};

export default nextConfig;