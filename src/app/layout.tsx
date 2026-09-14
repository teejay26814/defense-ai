import type { Metadata } from "next";
import { Figtree, Plus_Jakarta_Sans } from "next/font/google";
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
  title: {
    default: "Academia Scribes - Defense Coach",
    template: "%s · Academia Scribes",
  },
  description:
    "Turn your final-year project into a defense you are ready for. Upload your chapters, " +
    "understand them deeply, practice the questions, and walk in prepared.",
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
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
