import { MetadataRoute } from "next";
import { headers } from "next/headers";

const MARKETING_HOSTS = new Set(["lignumwindows.com", "www.lignumwindows.com"]);

export default async function robots(): Promise<MetadataRoute.Robots> {
  const hdrs = await headers();
  const hostHeader = (hdrs.get("x-forwarded-host") || hdrs.get("host") || "").toLowerCase();
  const hostname = hostHeader.split(":")[0];

  if (hostname && MARKETING_HOSTS.has(hostname)) {
    return {
      rules: [
        {
          userAgent: "*",
          allow: "/",
          disallow: [
            "/api",
            "/app",
            "/dashboard",
            "/leads",
            "/opportunities",
            "/tasks",
            "/settings",
            "/billing",
            "/setup",
          ],
        },
      ],
      sitemap: "https://lignumwindows.com/sitemap.xml",
    };
  }

  // Default (joineryai.app and other hosts): keep behavior permissive, but avoid crawling authenticated app areas.
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://joineryai.app";
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api",
          "/app",
          "/dashboard",
          "/leads",
          "/opportunities",
          "/tasks",
          "/settings",
          "/billing",
          "/setup",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
