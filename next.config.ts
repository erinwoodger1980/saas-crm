import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  async rewrites() {
    const rewrites: any[] = [];

    const configured = (process.env.API_ORIGIN || process.env.NEXT_PUBLIC_API_BASE || "").trim();
    if (configured) {
      const base = configured.replace(/\/+$/g, "");
      rewrites.push({ source: "/api/:path*", destination: `${base}/:path*` });
      return rewrites;
    }

    // Dev fallback: proxy to local API on 4455
    const isProd = process.env.NODE_ENV === "production";
    if (!isProd) {
      rewrites.push({ source: "/api/:path*", destination: "http://localhost:4455/:path*" });
      return rewrites;
    }

    return rewrites;
  },
};

export default nextConfig;
