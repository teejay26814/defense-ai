import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site";

/**
 * Crawlers get the public pages only. Everything in the app is behind sign-in anyway, but
 * asking them not to try keeps the redirect-to-login responses out of search results.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/signup", "/login"],
      disallow: [
        "/dashboard",
        "/projects",
        "/billing",
        "/api/",
        "/auth/",
        "/reset-password",
        "/forgot-password",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
