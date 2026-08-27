import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";

export interface TableProps extends HTMLAttributes<HTMLTableElement> {}

export function Table({ className, ...props }: TableProps) {
  const classes = ["ui-table", className].filter(Boolean).join(" ");
  return <table className={classes} {...props} />;
}

export function TableHeader({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  const classes = ["ui-table__header", className].filter(Boolean).join(" ");
  return <thead className={classes} {...props} />;
}

export function TableBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  const classes = ["ui-table__body", className].filter(Boolean).join(" ");
  return <tbody className={classes} {...props} />;
}

export function TableRow({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  const classes = ["ui-table__row", className].filter(Boolean).join(" ");
  return <tr className={classes} {...props} />;
}

export function TableHead({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  const classes = ["ui-table__head", className].filter(Boolean).join(" ");
  return <th className={classes} scope="col" {...props} />;
}

export function TableCell({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  const classes = ["ui-table__cell", className].filter(Boolean).join(" ");
  return <td className={classes} {...props} />;
}
