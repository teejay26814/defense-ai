import type { Metadata } from "next";
import { Figtree, Fraunces } from "next/font/google";
import "./globals.css";

/**
 * Typefaces.
 *
 * The logo's own face is Biennale, but only in FONTSPRINGDEMO cuts, which are
 * evaluation-only and cannot ship in a paid product (see Brand_Assest/palette.md). These
 * two are the documented way forward: an OFL sans that sits close to the logo's geometry,
 * and a serif for headings, since CLAUDE.md requires headings and body to differ.
 *
 * next/font downloads and self-hosts these at build time, so there is no request to Google
 * at runtime, no layout shift from a late swap, and no third-party origin in the critical
 * path. Both are variable fonts - one file covers the whole weight range.
 */
const display = Fraunces({
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
