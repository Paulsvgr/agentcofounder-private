import { describe, expect, it } from "vitest";
import {
  reclaimAppOwnedPort,
  reclaimSameUserPort,
} from "../src/port-owner.js";
import { portHasListener } from "../src/verify-app.js";

describe("port reclaim helpers", () => {
  it("reports already-free for reclaimSameUserPort when nothing listens", async () => {
    // High ephemeral port unlikely to be in use in CI/dev.
    const port = 58432;
    if (await portHasListener(port)) {
      return; // skip if somehow occupied
    }
    const result = await reclaimSameUserPort(port);
    expect(result.reclaimed).toBe(true);
    expect(result.attempted).toBe(false);
    expect(result.diagnostic).toContain("already free");
  });

  it("reports already-free for reclaimAppOwnedPort when nothing listens", async () => {
    const port = 58433;
    if (await portHasListener(port)) {
      return;
    }
    const result = await reclaimAppOwnedPort(port, process.cwd());
    expect(result.reclaimed).toBe(true);
    expect(result.attempted).toBe(false);
  });
});
