import { cn } from "@/lib/utils";
import type { FieldV1Props } from "./contracts";

export type SelectFieldProps = FieldV1Props & {
  options: string[];
  placeholder?: string;
};

export function SelectField({
  label,
  value,
  onChange,
  options,
  error,
  required = false,
  disabled = false,
  placeholder = "Choose…",
}: SelectFieldProps) {
  const selectId = `select-${label.toLowerCase().replace(/\s+/g, "-")}`;
  const errorId = error ? `${selectId}-error` : undefined;

  return (
    <div className="space-y-1">
      <label htmlFor={selectId} className="text-sm font-medium text-foreground">
        {label}
        {required ? " *" : null}
      </label>
      <select
        id={selectId}
        value={value}
        disabled={disabled}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          disabled && "cursor-not-allowed opacity-50",
          error && "border-destructive",
        )}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
