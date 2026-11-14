/**
 * The site's public origin, for canonical URLs, the sitemap and social cards.
 *
 * NEXT_PUBLIC_SITE_URL is the one set deliberately (it is also where auth emails send
 * people back to). Netlify's own URL is the fallback, so a deploy preview still produces
 * absolute links that resolve rather than pointing at localhost.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.URL ??
  "http://localhost:3000"
).replace(/\/$/, "");

export const SITE_NAME = "Academia Scribes";

export const SITE_TAGLINE = "If your defense was tomorrow, would you be ready?";

export const SITE_DESCRIPTION =
  "Turn your final-year project into a defense you are ready for. Upload your chapters, " +
  "understand them deeply, practice the questions, and walk in prepared.";
