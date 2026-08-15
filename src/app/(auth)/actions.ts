"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import {
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

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
