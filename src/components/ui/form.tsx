"use client";

import { useFormStatus } from "react-dom";

/**
 * Shared form primitives for the auth screens.
 *
 * Per the design guardrails: no `transition-all` — every transition names its properties,
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
        className={`w-full rounded-lg border bg-white px-3.5 py-2.5 text-ink shadow-base
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

const controlClass = (invalid: boolean) =>
  `w-full rounded-lg border bg-white px-3.5 py-2.5 text-ink shadow-base
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
        className={`w-full rounded-lg border bg-white text-sm text-ink-muted shadow-base
          transition-[border-color] duration-150
          hover:border-navy-300
          file:mr-4 file:cursor-pointer file:border-0 file:bg-navy-050
          file:px-4 file:py-2.5 file:text-sm file:font-medium file:text-navy-700
          ${invalid ? "border-danger" : "border-navy-100"}`}
      />
      {hint && !invalid && <p className="text-xs text-ink-muted">{hint}</p>}
      {invalid && (
        <p className="text-xs font-medium text-danger">{errors!.join(" ")}</p>
      )}
    </div>
  );
}

export function SubmitButton({ children }: { children: React.ReactNode }) {
  // useFormStatus reads the pending state of the enclosing <form>, so this component has
  // to live inside it rather than receive the state as a prop.
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-navy-700 px-4 py-2.5 font-medium text-white
        shadow-elevated
        transition-[transform,background-color,opacity] duration-150
        hover:bg-navy-600
        active:translate-y-px
        disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Working…" : children}
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
