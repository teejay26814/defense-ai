"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
  safeRedirect,
  toFieldErrors,
  type AuthFormState,
} from "@/lib/validation/auth";

export async function signIn(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    // Deliberately vague. Distinguishing "no such account" from "wrong password" turns
    // the login form into a way to enumerate who has signed up.
    return { error: "That email and password combination did not work." };
  }

  revalidatePath("/", "layout");
  redirect(safeRedirect(formData.get("next")));
}

export async function signUp(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = signUpSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    institution: formData.get("institution") || undefined,
    department: formData.get("department") || undefined,
  });

  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) };
  }

  const { email, password, fullName, institution, department } = parsed.data;
  const supabase = await createClient();

  // These land in raw_user_meta_data, which the handle_new_user() trigger reads to
  // populate public.profiles. See supabase/migrations/20260815120000_profiles.sql.
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        institution: institution ?? "",
        department: department ?? "",
      },
    },
  });

  if (error) {
    return { error: error.message };
  }

  // With email confirmation on, Supabase returns a user but no session. Sending them to
  // the dashboard would just bounce off the proxy, so say what happened instead.
  if (!data.session) {
    return {
      notice:
        "Check your email to confirm your account, then sign in. The link expires in 24 hours.",
    };
  }

  revalidatePath("/", "layout");
  redirect(safeRedirect(formData.get("next")));
}

/**
 * Send a password reset link.
 *
 * The response is identical whether or not the address has an account. Saying "no account
 * with that email" would turn this form into a way to find out who has signed up, which is
 * the same reasoning as the deliberately vague sign-in error above.
 */
export async function requestPasswordReset(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get("email") });

  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };

  const supabase = await createClient();

  // Supabase appends the token to this URL. It must be an allowed redirect in the
  // dashboard, or the link in the email will be rejected when it comes back.
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/confirm?next=/reset-password`,
  });

  // Logged, never surfaced: a provider error here would otherwise reveal whether the
  // address exists.
  if (error) console.error("[requestPasswordReset] failed", error.message);

  return {
    notice:
      "If there is an account with that email, a reset link is on its way. It expires in " +
      "one hour.",
  };
}

/**
 * Set a new password.
 *
 * Reachable only with a session, which the recovery link establishes via /auth/confirm. A
 * student who lands here without one is sent to ask for a fresh link rather than shown a
 * form that cannot work.
 */
export async function resetPassword(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error:
        "That reset link has expired or was already used. Ask for a new one and try again.",
    };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) {
    // This one is surfaced: the student is already authenticated, so the message tells
    // them something actionable about their own password rather than about an account.
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
