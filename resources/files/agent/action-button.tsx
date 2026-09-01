import { cn } from "@/lib/utils";
import type { ActionV1Props } from "./contracts";

const variantClass: Record<NonNullable<ActionV1Props["variant"]>, string> = {
  primary: "bg-primary text-primary-foreground hover:bg-primary/90",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
  danger: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
  ghost: "bg-transparent text-foreground hover:bg-accent",
};

export function ActionButton({
  label,
  onAction,
  variant = "primary",
  disabled = false,
  ariaLabel,
  type = "button",
}: ActionV1Props) {
  return (
    <button
      type={type}
      disabled={disabled}
      aria-label={ariaLabel ?? label}
      onClick={onAction}
      className={cn(
        "inline-flex h-9 items-center justify-center rounded-md px-4 text-sm font-medium",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:pointer-events-none disabled:opacity-50",
        variantClass[variant],
      )}
    >
      {label}
    </button>
  );
}
