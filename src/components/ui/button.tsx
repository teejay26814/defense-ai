import type { ComponentProps } from "react";

/**
 * The button.
 *
 * Per the design guardrails: every variant carries hover, focus-visible and active states,
 * and no transition is ever `transition-all` - each one names the properties it animates.
 * The focus ring itself is global (`:focus-visible` in globals.css), so it is identical on
 * every interactive element rather than re-invented per component.
 *
 * `buttonStyles` is exported separately because some callers are not buttons: a link that
 * should look like a button, or `SubmitButton`, which needs `useFormStatus` and therefore
 * has to be a client component of its own. Sharing the string keeps them from drifting.
 */

export type ButtonVariant = "primary" | "accent" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANTS: Record<ButtonVariant, string> = {
  // The default action. Navy is the brand surface.
  primary:
    "bg-navy-700 text-white shadow-elevated hover:bg-navy-600 active:translate-y-px",
  // Gold is reserved for the one action a screen most wants you to take. Navy text rather
  // than white: gold is a light colour and white on it fails contrast.
  accent:
    "bg-gold text-navy-900 shadow-elevated hover:bg-gold/90 active:translate-y-px",
  secondary:
    "bg-white text-navy-700 border border-navy-300 shadow-base hover:bg-navy-050 active:translate-y-px",
  ghost: "text-navy-700 hover:bg-navy-050 active:translate-y-px",
  danger: "bg-danger text-white shadow-elevated hover:bg-danger/90 active:translate-y-px",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2.5 text-sm",
  lg: "px-5 py-3 text-base",
};

export function buttonStyles({
  variant = "primary",
  size = "md",
  full = false,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  full?: boolean;
} = {}): string {
  return [
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium",
    "transition-[transform,background-color,border-color,opacity] duration-150",
    "disabled:cursor-not-allowed disabled:opacity-60 disabled:active:translate-y-0",
    VARIANTS[variant],
    SIZES[size],
    full ? "w-full" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function Button({
  variant,
  size,
  full,
  className,
  type = "button",
  ...props
}: ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  full?: boolean;
}) {
  // Defaulting type to "button" on purpose: an untyped <button> inside a <form> submits it,
  // which is a genuinely surprising bug. Callers that want submission pass type="submit"
  // - or, better, use SubmitButton, which also reports pending state.
  return (
    <button
      type={type}
      className={`${buttonStyles({ variant, size, full })}${className ? ` ${className}` : ""}`}
      {...props}
    />
  );
}
