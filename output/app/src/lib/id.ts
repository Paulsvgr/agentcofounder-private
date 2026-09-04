/** Domain-neutral identifier helpers. */

const ID_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

/** Creates a collision-resistant identifier without external dependencies. */
export function createId(prefix = ""): string {
  const random = globalThis.crypto?.randomUUID?.();
  if (random) return prefix ? `${prefix}_${random}` : random;

  let value = "";
  for (let index = 0; index < 16; index += 1) {
    value += ID_ALPHABET[Math.floor(Math.random() * ID_ALPHABET.length)];
  }
  const stamp = Date.now().toString(36);
  return prefix ? `${prefix}_${stamp}${value}` : `${stamp}${value}`;
}

/** Normalizes free text for duplicate detection: trimmed, collapsed, case-insensitive. */
export function normalizeKey(value: string): string {
  return value.trim().replaceAll(/\s+/gu, " ").toLowerCase();
}
