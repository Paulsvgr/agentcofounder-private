/**
 * Stable unique identifiers for new records.
 *
 * Prefers crypto.randomUUID and falls back to a counter-and-random scheme for
 * environments that do not expose it, so ids stay unique in jsdom and in
 * non-secure contexts where randomUUID is absent.
 */
let counter = 0;

export function createId(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === "function") {
    return cryptoApi.randomUUID();
  }
  counter += 1;
  return `id-${Date.now().toString(36)}-${counter.toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
