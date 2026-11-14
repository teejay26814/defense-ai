import type { Metadata, Viewport } from "next";
import { Figtree, Plus_Jakarta_Sans } from "next/font/google";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
import "./globals.css";

/**
 * Typefaces.
 *
 * The logo's own face is Biennale, but only in FONTSPRINGDEMO cuts, which are
 * evaluation-only and cannot ship in a paid product (see Brand_Assest/palette.md). Figtree
 * is the OFL sans that sits close to the logo's geometry. Headings use a second, bolder sans
 * rather than a serif - CLAUDE.md requires headings and body to differ, and two sans faces
 * at different weights and geometry satisfy that as long as they stay visibly distinct.
 *
 * next/font downloads and self-hosts these at build time, so there is no request to Google
 * at runtime, no layout shift from a late swap, and no third-party origin in the critical
 * path. Both are variable fonts - one file covers the whole weight range.
 */
const display = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-display-face",
  display: "swap",
});

const body = Figtree({
  subsets: ["latin"],
  variable: "--font-body-face",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} - Defense Coach`,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  // The social card itself is app/opengraph-image.tsx; Next wires its URL in here.
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: `${SITE_NAME} - Defense Coach`,
    description: SITE_DESCRIPTION,
    url: "/",
    locale: "en_NG",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} - Defense Coach`,
    description: SITE_DESCRIPTION,
  },
  // Students share links over WhatsApp and SMS; a bare number in a project title must not
  // turn into a "call" link on iOS.
  formatDetection: { telephone: false },
};

// Tints the phone's status bar and browser chrome to the page, so the app does not sit under
// a white strip on a dark canvas. Follows the system theme; these match --color-parchment.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Lets content draw under the notch and home indicator; padding uses safe-area insets.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fdfbf7" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1830" },
  ],
};

// Runs before paint, before React hydrates, so a returning student's chosen theme never
// flashes light-then-dark. Reads only the theme key it wrote itself and writes only a data
// attribute, and it is a fixed string with no interpolated data, so there is nothing here for
// an attacker to inject. If no explicit choice was ever saved, it stamps nothing at all and
// prefers-color-scheme in globals.css decides - the same "system" default described there.
const THEME_INIT_SCRIPT = `
  try {
    var t = localStorage.getItem("academia-scribes-theme");
    if (t === "light" || t === "dark") {
      document.documentElement.setAttribute("data-theme", t);
    }
  } catch (e) {}
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`} suppressHydrationWarning>
      {/*
        The theme script sits at the top of <body>, not in <head>. Netlify injects a
        promotional HTML comment into the <head> of every production page; React then found
        that comment where it expected this script, failed hydration (error #418) and
        re-rendered every page from scratch on the client. Nothing of ours in <head> means
        nothing for that comment to collide with. A blocking inline script at the start of
        <body> still runs before any content is parsed, so there is still no theme flash.
      */}
      <body>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {children}
      </body>
    </html>
  );
}
