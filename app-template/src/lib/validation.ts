/** Domain-neutral field validation. Rules are plain functions, composable per field. */

export type FieldRule<Value> = (value: Value) => string | undefined;
export type FieldErrors<Fields> = Partial<Record<keyof Fields, string>>;

export function required(message = "This field is required"): FieldRule<string> {
  return (value) => (value.trim() === "" ? message : undefined);
}

export function minLength(length: number, message?: string): FieldRule<string> {
  return (value) =>
    value.trim().length < length ? (message ?? `Use at least ${length} characters`) : undefined;
}

export function maxLength(length: number, message?: string): FieldRule<string> {
  return (value) =>
    value.trim().length > length ? (message ?? `Use at most ${length} characters`) : undefined;
}

export function pattern(expression: RegExp, message: string): FieldRule<string> {
  return (value) => (value.trim() === "" || expression.test(value.trim()) ? undefined : message);
}

export function isNumber(message = "Enter a number"): FieldRule<string> {
  return (value) => (value.trim() !== "" && Number.isNaN(Number(value)) ? message : undefined);
}

export function numberRange(min: number, max: number, message?: string): FieldRule<string> {
  return (value) => {
    if (value.trim() === "") return undefined;
    const parsed = Number(value);
    if (Number.isNaN(parsed)) return message ?? "Enter a number";
    return parsed < min || parsed > max ? (message ?? `Enter a value between ${min} and ${max}`) : undefined;
  };
}

export function oneOf(allowed: readonly string[], message = "Choose one of the options"): FieldRule<string> {
  return (value) => (allowed.includes(value) ? undefined : message);
}

/** Fails when another record already uses the same normalized value. */
export function unique(existing: readonly string[], message = "This already exists"): FieldRule<string> {
  const taken = new Set(existing.map((entry) => entry.trim().replaceAll(/\s+/gu, " ").toLowerCase()));
  return (value) => (taken.has(value.trim().replaceAll(/\s+/gu, " ").toLowerCase()) ? message : undefined);
}

export function firstError<Value>(value: Value, rules: readonly FieldRule<Value>[]): string | undefined {
  for (const rule of rules) {
    const error = rule(value);
    if (error) return error;
  }
  return undefined;
}

/** Runs every field's rules and returns only the fields that failed. */
export function validateFields<Fields extends Record<string, string>>(
  values: Fields,
  rules: { [Key in keyof Fields]?: readonly FieldRule<string>[] },
): FieldErrors<Fields> {
  const errors: FieldErrors<Fields> = {};
  for (const key of Object.keys(values) as (keyof Fields)[]) {
    const fieldRules = rules[key];
    if (!fieldRules) continue;
    const error = firstError(values[key], fieldRules);
    if (error) errors[key] = error;
  }
  return errors;
}

export function hasErrors<Fields>(errors: FieldErrors<Fields>): boolean {
  return Object.values(errors).some((entry) => typeof entry === "string" && entry !== "");
}
