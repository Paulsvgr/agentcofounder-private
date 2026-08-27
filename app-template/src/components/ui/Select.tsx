import type { OptionHTMLAttributes, SelectHTMLAttributes } from "react";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {}

export function Select({ className, children, ...props }: SelectProps) {
  const classes = ["ui-select", className].filter(Boolean).join(" ");
  return (
    <select className={classes} {...props}>
      {children}
    </select>
  );
}

export interface SelectOptionProps extends OptionHTMLAttributes<HTMLOptionElement> {}

export function SelectOption(props: SelectOptionProps) {
  return <option {...props} />;
}
