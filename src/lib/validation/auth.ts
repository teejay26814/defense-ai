import { z } from "zod";

/**
 * Auth input schemas. Every one of these runs on the server inside the action, not just
 * in the browser - client-side validation is a convenience, never a control.
 */

const email = z
  .string()
  .trim()
  .min(1, "Enter your email address.")
  .max(254, "That email address is too long.")
  .email("That does not look like a valid email address.")
  .transform((v) => v.toLowerCase());

/**
 * Supabase enforces a minimum of 6 by default; 8 is the floor here. The upper bound
 * matters too - bcrypt silently truncates past 72 bytes, so a longer password would give
 * a false sense of strength.
 */
const password = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(72, "Use 72 characters or fewer.");

export const signUpSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Enter your full name.")
    .max(120, "That name is too long."),
  email,
  password,
  institution: z.string().trim().max(160, "That is too long.").optional(),
  department: z.string().trim().max(160, "That is too long.").optional(),
});

export const signInSchema = z.object({
  email,
  // Deliberately not the strict `password` rule: an existing account may predate any
  // change to the policy, and telling someone their saved password is "too short" at the
  // login screen is both confusing and a small information leak.
  password: z.string().min(1, "Enter your password."),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;

/** Shape returned by the auth server actions to `useActionState`. */
export type AuthFormState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  notice?: string;
};

/** Collapses a ZodError into the flat shape the forms render. */
export function toFieldErrors(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

/**
 * Only allow redirects to a path on this site. Without this check, `?next=` is an open
 * redirect: a crafted login link could bounce a student to an attacker's page after a
 * genuine sign-in. Protocol-relative URLs (`//evil.com`) are rejected too.
 */
export function safeRedirect(next: unknown, fallback = "/dashboard"): string {
  if (typeof next !== "string" || next.length === 0) return fallback;
  if (!next.startsWith("/") || next.startsWith("//")) return fallback;
  if (next.includes("\\")) return fallback;
  return next;
}
