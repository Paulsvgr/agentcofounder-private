import type { OverlayV1Props } from "./contracts";
import { ActionButton } from "./action-button";

export type ConfirmDialogProps = OverlayV1Props;

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
}: ConfirmDialogProps) {
  if (!open) return null;

  const titleId = "confirm-dialog-title";
  const descId = description ? "confirm-dialog-desc" : undefined;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={() => onOpenChange(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="w-full max-w-md rounded-lg border border-border bg-background p-6 shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id={titleId} className="text-lg font-semibold text-foreground">
          {title}
        </h2>
        {description ? (
          <p id={descId} className="mt-2 text-sm text-muted-foreground">
            {description}
          </p>
        ) : null}
        <div className="mt-6 flex justify-end gap-2">
          <ActionButton
            label={cancelLabel}
            variant="ghost"
            onAction={() => onOpenChange(false)}
          />
          <ActionButton
            label={confirmLabel}
            variant="danger"
            onAction={() => {
              onConfirm();
              onOpenChange(false);
            }}
          />
        </div>
      </div>
    </div>
  );
}
