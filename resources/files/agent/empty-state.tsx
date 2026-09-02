import type { ReactNode } from "react";
import type { StateV1Props } from "./contracts";

export type EmptyStateProps = StateV1Props & {
  action?: ReactNode;
};

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div
      role="status"
      className="rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center"
    >
      <p className="font-medium text-foreground">{title}</p>
      {description ? (
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
