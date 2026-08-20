"use client";

import { useActionState } from "react";

import { startCheckout, type BillingState } from "./actions";
import { FormMessage, SubmitButton } from "@/components/ui/form";

const initialState: BillingState = {};

export function PlanButton({
  plan,
  label,
  variant = "primary",
}: {
  plan: "proposal" | "full";
  label: string;
  variant?: "primary" | "secondary";
}) {
  const [state, formAction] = useActionState(startCheckout, initialState);

  return (
    <form action={formAction} className="mt-5 space-y-2">
      <input type="hidden" name="plan" value={plan} />
      {state.error && <FormMessage tone="error">{state.error}</FormMessage>}
      <SubmitButton variant={variant} pendingLabel="Opening Paystack…">
        {label}
      </SubmitButton>
    </form>
  );
}
