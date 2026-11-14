"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/**
 * The phone's header, and the sidebar as a slide-out menu.
 *
 * Below lg there is no room for the sidebar, so the header carries a menu button that slides
 * the same sidebar in from the left - every destination the desktop has, nothing hidden. The
 * sidebar's contents are passed in as children from the server layout, so the two can never
 * drift apart.
 *
 * Motion is transform and opacity only. Closed, the panel is inert, so it can be neither
 * tabbed into nor read out. It closes on Escape, on the backdrop, and on following any link.
 */
export function MobileDrawer({
  greeting,
  initials,
  logo,
  children,
}: {
  greeting: string;
  initials: string;
  logo: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    // The page behind should not scroll while the menu is open.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.querySelector<HTMLElement>("a, button")?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <>
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-navy-100/70 bg-navy-050/90 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-xl sm:px-5 lg:hidden">
        <button
          ref={buttonRef}
          type="button"
          aria-label="Open menu"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen(true)}
          className="flex size-10 shrink-0 items-center justify-center rounded-control text-ink
            transition-[transform,background-color] duration-150 hover:bg-surface active:scale-95"
        >
          <svg viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <path d="M3.5 6h13M3.5 10h13M3.5 14h13" />
          </svg>
        </button>

        <div className="min-w-0 flex-1">
          <p className="label-eyebrow">Workspace</p>
          <p className="truncate font-display text-lg leading-snug text-ink">{greeting}</p>
        </div>

        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-navy-700 text-xs font-semibold text-white"
        >
          {initials}
        </span>
      </header>

      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-40 bg-navy-900/55 backdrop-blur-[2px] transition-opacity duration-300 lg:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        id={panelId}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        inert={!open}
        onClick={(e) => {
          // Following any link (or signing out) closes the menu.
          if ((e.target as HTMLElement).closest("a")) setOpen(false);
        }}
        className={`fixed inset-y-0 left-0 z-50 flex w-[min(19rem,86vw)] flex-col overflow-y-auto bg-navy-900 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] text-white
          shadow-[24px_0_60px_-20px_rgb(0_0_0_/_0.5)] transition-transform duration-300 ease-out-strong lg:hidden ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
      >
        <div className="flex items-center justify-between">
          {logo}
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => {
              setOpen(false);
              buttonRef.current?.focus();
            }}
            className="flex size-10 items-center justify-center rounded-control text-white/70
              transition-[transform,background-color,color] duration-150 hover:bg-white/8 hover:text-white active:scale-95"
          >
            <svg viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="M5 5l10 10M15 5L5 15" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </>
  );
}
