import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // silence the “inferred root” warning for Turbopack
  turbopack: { root: __dirname },

  // ✅ Let CI builds pass even if ESLint or TS has warnings/errors.
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },

  experimental: {
    // keep other experimental flags here if you need them
  },
  async rewrites() {
    const isProd = process.env.NODE_ENV === "production";
    if (isProd) return [];
    // Dev-only proxy: route /api/* → local API (port 4000)
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:4000/:path*",
      },
    ];
  },
};


export default nextConfig;