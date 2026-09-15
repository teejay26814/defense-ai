import type { SVGProps } from "react";

/**
 * A small inline icon set for the sidebar and dashboard.
 *
 * Hand-drawn rather than pulled from a library. The set needed is fixed and small - a
 * dozen-odd icons - so a dependency would cost more in bundle size and a CDN request than it saves in
 * typing paths once. Every icon shares the same geometry: 20x20, 1.6px stroke, round caps,
 * currentColor - so mixing them never reads as mixing styles.
 */

type IconProps = SVGProps<SVGSVGElement>;

const base = {
  viewBox: "0 0 20 20",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  focusable: false,
};

export function IconGrid(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="2.5" y="2.5" width="6.5" height="6.5" rx="1.3" />
      <rect x="11" y="2.5" width="6.5" height="6.5" rx="1.3" />
      <rect x="2.5" y="11" width="6.5" height="6.5" rx="1.3" />
      <rect x="11" y="11" width="6.5" height="6.5" rx="1.3" />
    </svg>
  );
}

export function IconFolder(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M2.5 5.3c0-.7.6-1.3 1.3-1.3h3.4l1.6 1.8h7.4c.7 0 1.3.6 1.3 1.3v7.6c0 .7-.6 1.3-1.3 1.3H3.8c-.7 0-1.3-.6-1.3-1.3Z" />
    </svg>
  );
}

export function IconShield(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M10 2.5 16.5 5v4.3c0 4-2.7 6.9-6.5 8.2-3.8-1.3-6.5-4.2-6.5-8.2V5Z" />
      <path d="M7.3 9.8 9.2 11.7l3.5-3.9" />
    </svg>
  );
}

export function IconBook(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3 4.3c1.9-.9 4.3-.9 6.2 0v11.4c-1.9-.9-4.3-.9-6.2 0Z" />
      <path d="M17 4.3c-1.9-.9-4.3-.9-6.2 0v11.4c1.9-.9 4.3-.9 6.2 0Z" />
    </svg>
  );
}

export function IconCards(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="2.8" y="5.5" width="10.5" height="8.4" rx="1.4" transform="rotate(-8 8 9.7)" />
      <rect x="6.7" y="6" width="10.5" height="8.4" rx="1.4" />
    </svg>
  );
}

export function IconSpark(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M10 2.5c.4 2.7 1.3 4.5 3.5 5.5-2.2 1-3.1 2.8-3.5 5.5-.4-2.7-1.3-4.5-3.5-5.5 2.2-1 3.1-2.8 3.5-5.5Z" />
      <path d="M15.8 13c.2 1.3.7 2.2 1.7 2.7-1 .5-1.5 1.4-1.7 2.7-.2-1.3-.7-2.2-1.7-2.7 1-.5 1.5-1.4 1.7-2.7Z" />
    </svg>
  );
}

export function IconBulb(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M10 2.7a5 5 0 0 1 2.8 9.1c-.5.4-.8 1-.8 1.7v.3h-4v-.3c0-.7-.3-1.3-.8-1.7A5 5 0 0 1 10 2.7Z" />
      <path d="M7.8 16.3h4.4" />
      <path d="M8.4 18h2.8" />
    </svg>
  );
}

export function IconMessage(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3 4.8c0-.7.6-1.3 1.3-1.3h11.4c.7 0 1.3.6 1.3 1.3v7.3c0 .7-.6 1.3-1.3 1.3H8l-3.4 2.9v-2.9H4.3c-.7 0-1.3-.6-1.3-1.3Z" />
    </svg>
  );
}

export function IconUpload(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M10 13.5v-9" />
      <path d="M6.3 7.8 10 4.5l3.7 3.3" />
      <path d="M4 14.5v1.7c0 .7.6 1.3 1.3 1.3h9.4c.7 0 1.3-.6 1.3-1.3v-1.7" />
    </svg>
  );
}

export function IconChevronRight(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M7.5 4.5 13 10l-5.5 5.5" />
    </svg>
  );
}

export function IconChevronLeft(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12.5 4.5 7 10l5.5 5.5" />
    </svg>
  );
}

export function IconDots(props: IconProps) {
  return (
    <svg {...base} fill="currentColor" stroke="none" {...props}>
      <circle cx="4.5" cy="10" r="1.2" />
      <circle cx="10" cy="10" r="1.2" />
      <circle cx="15.5" cy="10" r="1.2" />
    </svg>
  );
}

export function IconSignOut(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M8.5 17H5.3C4.6 17 4 16.4 4 15.7V4.3C4 3.6 4.6 3 5.3 3h3.2" />
      <path d="M12.8 6.3 16.5 10l-3.7 3.7" />
      <path d="M16.5 10H8" />
    </svg>
  );
}

export function IconSun(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="10" cy="10" r="3.4" />
      <path d="M10 2.8v1.7M10 15.5v1.7M17.2 10h-1.7M4.5 10H2.8M15.1 4.9l-1.2 1.2M6.1 13.9l-1.2 1.2M15.1 15.1l-1.2-1.2M6.1 6.1 4.9 4.9" />
    </svg>
  );
}

export function IconMoon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M16.5 12.4A6.8 6.8 0 0 1 7.6 3.5a6.8 6.8 0 1 0 8.9 8.9Z" />
    </svg>
  );
}

export function IconEye(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M2 10s2.8-5.5 8-5.5S18 10 18 10s-2.8 5.5-8 5.5S2 10 2 10Z" />
      <circle cx="10" cy="10" r="2.3" />
    </svg>
  );
}

export function IconEyeOff(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M2 10s2.8-5.5 8-5.5c1.5 0 2.8.4 3.9 1M18 10s-1 2-3 3.4M11.6 12a2.3 2.3 0 0 1-3.2-3.2" />
      <path d="M8.3 5.2C4.2 6.2 2 10 2 10s.7 1.4 2.1 2.8M14.6 14.5c-1.3.7-2.9 1-4.6 1" />
      <path d="M3 3l14 14" />
    </svg>
  );
}
