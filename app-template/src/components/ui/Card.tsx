import type { HTMLAttributes } from "react";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {}

export function Card({ className, ...props }: CardProps) {
  const classes = ["ui-card", className].filter(Boolean).join(" ");
  return <div className={classes} {...props} />;
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  const classes = ["ui-card__header", className].filter(Boolean).join(" ");
  return <div className={classes} {...props} />;
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  const classes = ["ui-card__content", className].filter(Boolean).join(" ");
  return <div className={classes} {...props} />;
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  const classes = ["ui-card__footer", className].filter(Boolean).join(" ");
  return <div className={classes} {...props} />;
}
