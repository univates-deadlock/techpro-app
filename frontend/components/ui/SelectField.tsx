import type { Ref, SelectHTMLAttributes } from "react";

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
  id: string;
  label: string;
  /** Error message associated with the field; marks the field as invalid when present. */
  error?: string;
  /** Helper text displayed below the field when there is no error. */
  hint?: string;
  /** Options rendered inside the select. */
  options: { value: string; label: string }[];
  /** Text for the first empty option. */
  placeholder?: string;
  /** Allows the page to restore focus to this field after a failed submission. */
  ref?: Ref<HTMLSelectElement>;
};

/**
 * Form select field with a visible label, helper text, and an accessible error.
 *
 * Mirror of `Field.tsx` but renders a `<select>` instead of `<input>`.
 */
export function SelectField({
  id,
  label,
  error,
  hint,
  options,
  placeholder,
  className = "",
  ref,
  ...rest
}: SelectFieldProps) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = error ? errorId : hint ? hintId : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-tp-text-main">
        {label}
      </label>

      <select
        id={id}
        ref={ref}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`w-full rounded-tp-sm border bg-white px-3 py-2.5 text-base text-tp-text-main transition-colors focus:outline-none disabled:bg-tp-neutral-100 ${
          error
            ? "border-tp-danger focus:border-tp-danger"
            : "border-tp-border focus:border-tp-primary"
        } ${className}`}
        {...rest}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {error ? (
        <p id={errorId} className="text-sm text-tp-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-sm text-tp-text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
