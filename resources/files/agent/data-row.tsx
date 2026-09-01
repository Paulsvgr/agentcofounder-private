import type { RowV1Props } from "./contracts";

export type DataRowProps = RowV1Props;

export function DataRow({ id, title, description, actions }: DataRowProps) {
  return (
    <li
      aria-labelledby={`row-title-${id}`}
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4"
    >
      <div className="min-w-0 flex-1">
        <p id={`row-title-${id}`} className="font-medium text-foreground">
          {title}
        </p>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </li>
  );
}
