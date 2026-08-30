/**
 * PUBLIC UI API — AUTHORITATIVE
 *
 * You do not need to inspect component implementations.
 * Import all primitives from `src/components/ui`.
 *
 * Button
 * - Native button props.
 * - variant?: "primary" | "secondary" | "danger" | "ghost"
 * - Defaults to type="button".
 *
 * Input
 * - Native input props.
 *
 * Select
 * - Native select props.
 *
 * SelectOption
 * - Native option props.
 *
 * Textarea
 * - Native textarea props.
 *
 * Dialog
 * - Props: {
 *     open: boolean;
 *     onClose: () => void;
 *     title: string;
 *     children: ReactNode;
 *   }
 * - Closes on Escape and backdrop click.
 *
 * Card
 * - Card, CardHeader, CardContent, CardFooter
 * - Native div props.
 *
 * Table
 * - Table, TableHeader, TableBody, TableRow,
 *   TableHead, TableCell
 * - Native corresponding HTML element props.
 *
 * All primitives support className where their native element supports it.
 */

export { Button, type ButtonProps, type ButtonVariant } from "./Button";
export { Input, type InputProps } from "./Input";
export {
  Select,
  SelectOption,
  type SelectOptionProps,
  type SelectProps,
} from "./Select";
export { Textarea, type TextareaProps } from "./Textarea";
export {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  type CardProps,
} from "./Card";
export { Dialog, type DialogProps } from "./Dialog";
export {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  type TableProps,
} from "./Table";