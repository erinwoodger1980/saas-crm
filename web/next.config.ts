import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ✅ correct place for Turbopack options
  turbopack: {
    root: __dirname, // silences the inferred-root warning
  },

  // ✅ don't fail production builds on ESLint errors (like no-explicit-any)
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;