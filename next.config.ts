import type { NextConfig } from "next";

/**
 * Security headers on every response.
 *
 * - frame-ancestors / X-Frame-Options: nobody can embed the app in a frame to clickjack a
 *   student into deleting a project or paying. Paystack checkout is a top-level redirect,
 *   not an iframe, so nothing here needs framing.
 * - Permissions-Policy: the microphone stays available to this origin only, because mock
 *   defense answers can be dictated (components/ui/dictate-button.tsx). Everything else a
 *   page could ask for is switched off.
 * - HSTS: once a browser has seen the site over HTTPS it never downgrades.
 *
 * A full script-src CSP is deliberately not here yet: the theme script in app/layout.tsx is
 * inline, and a nonce-based policy is its own piece of work. frame-ancestors carries no such
 * risk, so it ships now.
 */
const securityHeaders = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "microphone=(self), camera=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  // No "X-Powered-By: Next.js" - it tells an attacker which exploits to try first.
  poweredByHeader: false,

  experimental: {
    serverActions: {
      // Chapter uploads go through a server action (projects/actions.ts). Next caps action
      // bodies at 1 MB by default, which silently rejected most real thesis PDFs while the
      // UI promised 25 MB. This matches MAX_FILE_BYTES in lib/types.ts plus room for the
      // multipart envelope - keep the two in step.
      bodySizeLimit: "26mb",
    },
    // src/proxy.ts runs in front of every request, and Next buffers the body for it - only
    // up to 10 MB by default, truncating anything past that. Same ceiling as above, so a
    // large chapter is not cut short before the upload action even sees it.
    proxyClientMaxBodySize: "26mb",
  },

  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
