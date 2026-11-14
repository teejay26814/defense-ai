import type { MetadataRoute } from "next";

import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";

/**
 * Lets a student add the app to their home screen and open it full-screen, which is how a
 * lot of them will use it in the weeks before a defense. Colours match --color-parchment
 * and the logo navy.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} - Defense Coach`,
    short_name: "Defense Coach",
    description: SITE_DESCRIPTION,
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#fdfbf7",
    theme_color: "#052659",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
