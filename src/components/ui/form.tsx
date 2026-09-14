"use client";

import { useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

import { buttonStyles, type ButtonVariant } from "@/components/ui/button";
import { IconEye, IconEyeOff } from "@/components/icons";

/**
 * Shared form primitives for the auth screens.
 *
 * Per the design guardrails: no `transition-all` - every transition names its properties,
 * and every interactive element carries hover, focus-visible and active states.
 */

export function Field({
  label,
  name,
  type = "text",
  autoComplete,
  required,
  hint,
  errors,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  hint?: string;
  errors?: string[];
  defaultValue?: string;
}) {
  const errorId = `${name}-error`;
  const hintId = `${name}-hint`;
  const invalid = Boolean(errors?.length);

  return (
    <div className="space-y-1.5">
      <label
        htmlFor={name}
        className="block text-sm font-medium text-ink"
      >
        {label}
        {!required && (
          <span className="ml-1.5 text-xs font-normal text-ink-muted">optional</span>
        )}
      </label>

      <input
        id={name}
        name={name}
        type={type}
        required={required}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        aria-invalid={invalid || undefined}
        aria-describedby={
          [invalid ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") ||
          undefined
        }
        className={`w-full rounded-control border bg-surface px-3.5 py-2.5 text-ink shadow-raised
          transition-[border-color,box-shadow] duration-150
          placeholder:text-ink-muted/60
          hover:border-navy-300
          focus-visible:border-navy-500
          ${invalid ? "border-danger" : "border-navy-100"}`}
      />

      {hint && !invalid && (
        <p id={hintId} className="text-xs text-ink-muted">
          {hint}
        </p>
      )}

      {invalid && (
        <p id={errorId} className="text-xs font-medium text-danger">
          {errors!.join(" ")}
        </p>
      )}
    </div>
  );
}

/**
 * A password field with a show/hide toggle and, optionally, a right-aligned slot next to
 * the label for something like a "Forgot password?" link - the reference layout puts that
 * link at the label's height rather than below the field, so it reads as part of the field
 * it belongs to instead of a stray line under the form.
 */
export function PasswordField({
  label,
  name,
  autoComplete,
  required,
  hint,
  errors,
  action,
}: {
  label: string;
  name: string;
  autoComplete?: string;
  required?: boolean;
  hint?: string;
  errors?: string[];
  action?: ReactNode;
}) {
  const [visible, setVisible] = useState(false);
  const errorId = `${name}-error`;
  const hintId = `${name}-hint`;
  const invalid = Boolean(errors?.length);

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={name} className="block text-sm font-medium text-ink">
          {label}
          {!required && (
            <span className="ml-1.5 text-xs font-normal text-ink-muted">optional</span>
          )}
        </label>
        {action}
      </div>

      <div className="relative">
        <input
          id={name}
          name={name}
          type={visible ? "text" : "password"}
          required={required}
          autoComplete={autoComplete}
          aria-invalid={invalid || undefined}
          aria-describedby={
            [invalid ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") ||
            undefined
          }
          className={`w-full rounded-control border bg-surface py-2.5 pl-3.5 pr-11 text-ink shadow-raised
            transition-[border-color,box-shadow] duration-150
            placeholder:text-ink-muted/60
            hover:border-navy-300
            focus-visible:border-navy-500
            ${invalid ? "border-danger" : "border-navy-100"}`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-ink-muted
            transition-colors duration-150 hover:text-ink"
        >
          {visible ? <IconEyeOff className="size-[18px]" /> : <IconEye className="size-[18px]" />}
        </button>
      </div>

      {hint && !invalid && (
        <p id={hintId} className="text-xs text-ink-muted">
          {hint}
        </p>
      )}

      {invalid && (
        <p id={errorId} className="text-xs font-medium text-danger">
          {errors!.join(" ")}
        </p>
      )}
    </div>
  );
}

const controlClass = (invalid: boolean) =>
  `w-full rounded-control border bg-surface px-3.5 py-2.5 text-ink shadow-raised
   transition-[border-color,box-shadow] duration-150
   placeholder:text-ink-muted/60
   hover:border-navy-300
   focus-visible:border-navy-500
   ${invalid ? "border-danger" : "border-navy-100"}`;

export function TextareaField({
  label,
  name,
  rows = 4,
  hint,
  errors,
  defaultValue,
  placeholder,
}: {
  label: string;
  name: string;
  rows?: number;
  hint?: string;
  errors?: string[];
  defaultValue?: string;
  placeholder?: string;
}) {
  const invalid = Boolean(errors?.length);
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="block text-sm font-medium text-ink">
        {label}
        <span className="ml-1.5 text-xs font-normal text-ink-muted">optional</span>
      </label>
      <textarea
        id={name}
        name={name}
        rows={rows}
        defaultValue={defaultValue}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? `${name}-error` : hint ? `${name}-hint` : undefined}
        className={`${controlClass(invalid)} resize-y`}
      />
      {hint && !invalid && (
        <p id={`${name}-hint`} className="text-xs text-ink-muted">
          {hint}
        </p>
      )}
      {invalid && (
        <p id={`${name}-error`} className="text-xs font-medium text-danger">
          {errors!.join(" ")}
        </p>
      )}
    </div>
  );
}

export function SelectField({
  label,
  name,
  options,
  placeholder,
  required,
  errors,
  defaultValue,
}: {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  placeholder?: string;
  required?: boolean;
  errors?: string[];
  defaultValue?: string;
}) {
  const invalid = Boolean(errors?.length);
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="block text-sm font-medium text-ink">
        {label}
        {!required && (
          <span className="ml-1.5 text-xs font-normal text-ink-muted">optional</span>
        )}
      </label>
      <select
        id={name}
        name={name}
        required={required}
        defaultValue={defaultValue ?? ""}
        aria-invalid={invalid || undefined}
        className={controlClass(invalid)}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {invalid && (
        <p className="text-xs font-medium text-danger">{errors!.join(" ")}</p>
      )}
    </div>
  );
}

export function FileField({
  label,
  name,
  accept,
  hint,
  errors,
}: {
  label: string;
  name: string;
  accept?: string;
  hint?: string;
  errors?: string[];
}) {
  const invalid = Boolean(errors?.length);
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="block text-sm font-medium text-ink">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type="file"
        accept={accept}
        required
        aria-invalid={invalid || undefined}
        className={`w-full rounded-control border bg-surface text-sm text-ink-muted shadow-raised
          transition-[border-color] duration-150
          hover:border-navy-300
          file:mr-4 file:cursor-pointer file:border-0 file:bg-navy-050
          file:px-4 file:py-2.5 file:text-sm file:font-medium file:text-brand
          ${invalid ? "border-danger" : "border-navy-100"}`}
      />
      {hint && !invalid && <p className="text-xs text-ink-muted">{hint}</p>}
      {invalid && (
        <p className="text-xs font-medium text-danger">{errors!.join(" ")}</p>
      )}
    </div>
  );
}

export function SubmitButton({
  children,
  variant = "primary",
  pendingLabel = "Working…",
}: {
  children: React.ReactNode;
  variant?: ButtonVariant;
  /** Say what is happening, not just that something is. */
  pendingLabel?: string;
}) {
  // useFormStatus reads the pending state of the enclosing <form>, so this component has
  // to live inside it rather than receive the state as a prop.
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={buttonStyles({ variant, full: true })}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}

export function FormMessage({
  tone,
  children,
}: {
  tone: "error" | "notice";
  children: React.ReactNode;
}) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-lg px-3.5 py-2.5 text-sm ${
        tone === "error"
          ? "bg-danger/8 text-danger"
          : "bg-success/8 text-success"
      }`}
    >
      {children}
    </p>
  );
}
