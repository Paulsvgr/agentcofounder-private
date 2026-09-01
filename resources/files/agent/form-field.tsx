import { cn } from "@/lib/utils";
import type { FieldV1Props } from "./contracts";

export type FormFieldProps = FieldV1Props & {
  placeholder?: string;
  type?: "text" | "search" | "email";
};

export function FormField({
  label,
  value,
  onChange,
  error,
  required = false,
  disabled = false,
  placeholder,
  type = "text",
}: FormFieldProps) {
  const inputId = `field-${label.toLowerCase().replace(/\s+/g, "-")}`;
  const errorId = error ? `${inputId}-error` : undefined;

  return (
    <div className="space-y-1">
      <label htmlFor={inputId} className="text-sm font-medium text-foreground">
        {label}
        {required ? " *" : null}
      </label>
      <input
        id={inputId}
        type={type}
        value={value}
        disabled={disabled}
        required={required}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          disabled && "cursor-not-allowed opacity-50",
          error && "border-destructive",
        )}
      />
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
