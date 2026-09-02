import type { ReactNode } from "react";

export type DataListProps = {
  label: string;
  children?: ReactNode;
  empty?: ReactNode;
  isEmpty?: boolean;
};

export function DataList({ label, children, empty, isEmpty = false }: DataListProps) {
  if (isEmpty && empty) {
    return <div role="region" aria-label={label}>{empty}</div>;
  }

  return (
    <ul role="list" aria-label={label} className="space-y-3">
      {children}
    </ul>
  );
}
