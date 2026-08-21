// Stable id generation for books. Uses crypto when available, falls back to
// a counter + timestamp so tests and older runtimes keep working.
let counter = 0;

export function createId(): string {
  counter += 1;
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${counter.toString(36)}`;
  return random;
}
