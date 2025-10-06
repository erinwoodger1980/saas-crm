import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ✅ belongs at the top level (not under experimental)
  turbopack: {
    // optional: silences the “inferred root” warning
    root: __dirname,
  },

  // keep anything else you had here
  experimental: {
    // leave empty or keep other experimental flags (but NOT turbopack)
  },
};

export default nextConfig;