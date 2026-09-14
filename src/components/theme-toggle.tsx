"use client";

import { useCallback, useSyncExternalStore } from "react";

import { IconMoon, IconSun } from "./icons";

/**
 * Light/dark switch.
 *
 * Three states live in the system: "light", "dark", and unset ("system" - whatever the OS
 * prefers, handled purely in CSS via prefers-color-scheme). This control only ever writes
 * an explicit "light" or "dark" - once a student picks one, that is what they get regardless
 * of what their OS does later. There is no UI to get back to "system" short of clearing the
 * setting outside the app, which is an acceptable trade for keeping this a single click
 * rather than a three-way menu.
 *
 * The theme itself is applied by an inline script in layout.tsx that runs before paint. This
 * component only reads that result back out of the DOM, via useSyncExternalStore rather than
 * useState+useEffect: the value genuinely lives outside React (a data attribute plus
 * localStorage), and useSyncExternalStore is what lets it render the server's guess on first
 * paint and then correct to the real value on the client without a manual setState-in-effect
 * render cascade.
 */

const STORAGE_KEY = "academia-scribes-theme";

function readTheme(): "light" | "dark" {
  const stamped = document.documentElement.dataset.theme;
  if (stamped === "light" || stamped === "dark") return stamped;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

// The server cannot know the saved preference, so it renders as if light. The real value
// then applies on the client's very first paint, via useSyncExternalStore's own mechanism -
// not a follow-up effect - so there is no visible flash of the wrong icon.
function readServerTheme(): "light" | "dark" {
  return "light";
}

function subscribe(onChange: () => void) {
  // Nothing else changes the theme except this component's own click, in this tab or
  // another one open on the same account - toggle() below dispatches the same event so
  // every mounted instance (sidebar and mobile top bar both exist in the DOM at once,
  // one just hidden by breakpoint) re-reads and stays in sync.
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

export function ThemeToggle({
  variant = "icon",
  className,
}: {
  variant?: "icon" | "row";
  className?: string;
}) {
  const theme = useSyncExternalStore(subscribe, readTheme, readServerTheme);

  const toggle = useCallback(() => {
    const next = readTheme() === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    window.localStorage.setItem(STORAGE_KEY, next);
    window.dispatchEvent(new StorageEvent("storage"));
  }, []);

  const showingDark = theme === "dark";
  const Icon = showingDark ? IconSun : IconMoon;
  const label = showingDark ? "Switch to light mode" : "Switch to dark mode";

  if (variant === "row") {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-label={label}
        className={`flex w-full items-center gap-3 rounded-control px-3 py-2.5 text-sm font-medium
          transition-colors duration-150${className ? ` ${className}` : ""}`}
      >
        <Icon className="size-[18px] shrink-0" />
        {showingDark ? "Light mode" : "Dark mode"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={`rounded-control p-2 transition-colors duration-150${className ? ` ${className}` : ""}`}
    >
      <Icon className="size-[18px]" />
    </button>
  );
}
