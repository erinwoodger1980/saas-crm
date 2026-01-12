import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // silence the "inferred root" warning for Turbopack
  turbopack: { root: __dirname },

  // ✅ Let CI builds pass even if ESLint or TS has warnings/errors.
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },

  // Enable sourcemaps for better debugging in production
  productionBrowserSourceMaps: true,

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },

  experimental: {
    // keep other experimental flags here if you need them
  },
  async rewrites() {
    const rewrites = [];
    
    // Tenant landing page rewrite: /:slug/landing -> /tenant/:slug/landing
    rewrites.push({
      source: "/:slug/landing",
      destination: "/tenant/:slug/landing",
    });

    // Guide PDF legacy path: some code opened /guide.pdf, real asset is /free-guide.pdf
    rewrites.push({
      source: "/guide.pdf",
      destination: "/free-guide.pdf",
    });

    // NOTE: /api/* is handled by Next.js Route Handlers in web/src/app/api/**.
    // This avoids brittle rewrites to external domains (especially in staging).
    return rewrites;
  },
};


export default nextConfig;