import type { ReactNode } from "react";

/** Shared prop contracts for agent-facing components (Pi docs reference these). */

export type FieldV1Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  disabled?: boolean;
};

export type ActionV1Props = {
  label: string;
  onAction: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  disabled?: boolean;
  ariaLabel?: string;
  type?: "button" | "submit";
};

export type OverlayV1Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  onConfirm: () => void;
  cancelLabel?: string;
};

export type RowV1Props = {
  id: string;
  title: string;
  description?: string;
  actions?: ReactNode;
};

export type StateV1Props = {
  title: string;
  description?: string;
};
