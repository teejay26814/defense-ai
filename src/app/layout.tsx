import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Academia Scribes — Defense Coach",
    template: "%s · Academia Scribes",
  },
  description:
    "Turn your final-year project into a defense you are ready for. Upload your chapters, " +
    "understand them deeply, practise the questions, and walk in prepared.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
