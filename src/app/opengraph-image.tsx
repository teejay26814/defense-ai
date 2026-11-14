import { ImageResponse } from "next/og";

import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";

/**
 * The card shown when a link to the site is shared - WhatsApp, X, LinkedIn, iMessage.
 * Rendered once at build time (nothing here is dynamic), so it costs nothing per share.
 * The mark's paths are the same ones as app/icon.svg.
 */
export const alt = `${SITE_NAME} - ${SITE_TAGLINE}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          color: "#ffffff",
          backgroundColor: "#010f26",
          backgroundImage:
            "radial-gradient(ellipse 80% 60% at 15% 0%, rgba(17,85,168,0.55), transparent 60%), radial-gradient(ellipse 70% 50% at 95% 20%, rgba(143,180,220,0.18), transparent 55%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <svg width="56" height="75" viewBox="0 0 44.748 59.754" fill="#ffffff" fillRule="evenodd">
          <path d="M43.888 11.234L6.884 11.234L6.884 3.489L44.748 3.489L44.748 0.048L5.163 0.048C0.867 0 0.219 1.45 0 4.35L0 52.541C9.552 57.885 32.998 59.754 43.888 52.832ZM27.167 17.616L33.238 36.301C33.531 37.201 33.571 38.096 33.401 38.824L26.573 17.809ZM32.907 39.885C32.709 40.125 32.464 40.303 32.179 40.396C31.839 40.506 31.476 40.486 31.117 40.358L24.056 18.627L25.814 18.055ZM31.642 43.83C30.93 42.869 30.458 42.606 30.26 41.578C31.692 41.103 33.124 40.628 34.556 40.152C34.939 41.085 34.833 41.504 34.809 42.616C34.789 43.549 34.77 44.483 34.736 45.398L33.259 45.857ZM34.894 45.863L34.939 47.129C35.029 49.232 33.953 47.068 33.448 46.341ZM17.58 17.616L11.509 36.301C11.216 37.201 11.176 38.096 11.346 38.824L18.174 17.809ZM11.841 39.885C12.039 40.125 12.283 40.303 12.569 40.396C12.909 40.506 13.272 40.486 13.631 40.358L20.691 18.627L18.933 18.055ZM13.105 43.83C13.818 42.869 14.289 42.606 14.487 41.578C13.055 41.103 11.624 40.628 10.192 40.152C9.808 41.085 9.915 41.504 9.939 42.616C9.959 43.549 9.978 44.483 10.012 45.398L11.488 45.857ZM9.853 45.863L9.809 47.129C9.718 49.232 10.794 47.068 11.299 46.341ZM17.658 32.091L23.684 32.091C23.993 32.091 24.275 32.168 24.484 32.295L17.591 32.295L17.507 32.555L24.763 32.555C24.818 32.641 24.849 32.735 24.849 32.833C24.849 32.95 24.806 33.06 24.729 33.159L17.311 33.159L15.833 37.707C15.58 38.486 15.176 39.151 14.705 39.633L21.45 18.873L21.904 19.021ZM24.396 33.419C24.199 33.517 23.952 33.575 23.684 33.575L17.27 33.575L17.27 33.419ZM25.861 33.346C25.491 33.47 25.361 33.59 25.022 33.548C25.019 33.055 25.016 32.563 25.013 32.07C25.341 32.045 25.461 32.121 25.803 32.24C26.091 32.341 26.379 32.441 26.66 32.544L26.654 33.048ZM26.82 32.541L27.218 32.655L27.279 32.673L22.843 19.021L23.298 18.873L30.042 39.633C29.572 39.151 29.168 38.486 28.914 37.707L27.351 32.893C27.2 32.952 26.954 32.999 26.823 33.038Z" />
          <path d="M8.605 6.932L43.027 6.932L43.027 5.211L8.605 5.211Z" />
          <path d="M8.605 9.514L43.032 9.514L43.032 8.653L8.605 8.653Z" />
          </svg>
          <div style={{ display: "flex", flexDirection: "column", fontSize: 34, lineHeight: 1.05 }}>
            <span style={{ fontWeight: 700 }}>Academia</span>
            <span style={{ fontWeight: 300, opacity: 0.75 }}>Scribes</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.05, maxWidth: 940, letterSpacing: -1.5 }}>
            {SITE_TAGLINE}
          </div>
          <div style={{ marginTop: 28, fontSize: 30, opacity: 0.7, maxWidth: 900 }}>
            Your final-year project, turned into a private defense coach.
          </div>
        </div>

        <div style={{ display: "flex", gap: 16, fontSize: 24, opacity: 0.85 }}>
          {["Understand", "Remember", "Practice", "Defend"].map((word) => (
            <div
              key={word}
              style={{
                display: "flex",
                padding: "10px 22px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.25)",
              }}
            >
              {word}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
