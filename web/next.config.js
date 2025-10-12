/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.baileyhaguejoinery.co.uk",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.baileyhaguejoinery.co.uk",
        pathname: "/**",
      },
    ],
  },
};

module.exports = nextConfig;