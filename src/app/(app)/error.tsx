"use client";

import { ErrorPanel } from "@/components/boundaries/error-panel";

/**
 * Catches a failing page inside the signed-in app. Sits below the app layout, so the
 * sidebar and navigation stay put and the student is never stranded on a blank screen.
 */
export default function AppError(props: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return <ErrorPanel {...props} />;
}
