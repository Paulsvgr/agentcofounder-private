// A small, safe localStorage accessor usable in the browser and in jsdom.

export function getStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    const storage = window.localStorage;
    if (!storage) return null;
    // Probe write access; some browsers throw on disabled storage.
    const probeKey = "__home-library-probe__";
    storage.setItem(probeKey, "1");
    storage.removeItem(probeKey);
    return storage;
  } catch {
    return null;
  }
}
