import { chmod, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  isHarnessSelfTestFileName,
  prepareOutput,
  stripHarnessSelfTestsFromPreparedApp,
} from "../src/prepare-output.js";

const temporaryDirectories: string[] = [];

async function fixture(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "agent-cofounder-starter-"));
  temporaryDirectories.push(root);
  await mkdir(path.join(root, "app-template-base"), { recursive: true });
  await writeFile(path.join(root, "app-template-base", "seed.txt"), "seed\n", "utf8");
  return root;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

describe("harness self-test strip", () => {
  it("classifies compact-failure reporter tests", () => {
    expect(isHarnessSelfTestFileName("compact-failure-multiple-live.test.ts")).toBe(true);
    expect(isHarnessSelfTestFileName("compact-failure-message.test.ts")).toBe(true);
    expect(isHarnessSelfTestFileName("App.test.tsx")).toBe(false);
    expect(isHarnessSelfTestFileName("books.ts")).toBe(false);
  });

  it("removes compact-failure files from prepared app test/", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "strip-harness-"));
    temporaryDirectories.push(root);
    await mkdir(path.join(root, "test"), { recursive: true });
    await writeFile(
      path.join(root, "test", "compact-failure-multiple-live.test.ts"),
      "it('harness', () => {})\n",
      "utf8",
    );
    await writeFile(path.join(root, "test", "keep-me.test.ts"), "it('product', () => {})\n", "utf8");

    const removed = await stripHarnessSelfTestsFromPreparedApp(root);
    expect(removed).toEqual(["test/compact-failure-multiple-live.test.ts"]);
    await expect(
      readFile(path.join(root, "test", "compact-failure-multiple-live.test.ts"), "utf8"),
    ).rejects.toMatchObject({ code: "ENOENT" });
    expect(await readFile(path.join(root, "test", "keep-me.test.ts"), "utf8")).toContain("product");
  });
});

describe("prepareOutput", () => {
  const permissionTestSkipped = process.platform === "win32" || process.getuid?.() === 0;
  if (permissionTestSkipped) {
    console.warn("Skipping the stale-result permission test because this process can bypass directory modes.");
  }
  const permissionTest = permissionTestSkipped ? it.skip : it;

  it("creates and safely resets a managed output", async () => {
    const root = await fixture();
    const { outputDirectory: output } = await prepareOutput(root, "output/app");
    await writeFile(path.join(output, "generated.txt"), "temporary\n", "utf8");
    await writeFile(path.join(root, "output", "result.json"), "stale\n", "utf8");
    await writeFile(path.join(root, "result.json"), "stale\n", "utf8");
    await prepareOutput(root, "output/app");

    expect(await readFile(path.join(output, "seed.txt"), "utf8")).toBe("seed\n");
    await expect(readFile(path.join(output, "generated.txt"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(path.join(root, "output", "result.json"), "utf8")).rejects.toMatchObject({
      code: "ENOENT",
    });
    await expect(readFile(path.join(root, "result.json"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("refuses to reset an unmarked directory", async () => {
    const root = await fixture();
    await mkdir(path.join(root, "output", "app"), { recursive: true });
    await expect(prepareOutput(root, "output/app")).rejects.toThrow("Refusing to reset");
  });

  it("refuses an output outside the managed root", async () => {
    const root = await fixture();
    await expect(prepareOutput(root, "../elsewhere")).rejects.toThrow("must be a child");
  });

  permissionTest("fails rather than leaving an authoritative stale root result", async () => {
    const root = await fixture();
    await writeFile(path.join(root, "result.json"), "stale\n", "utf8");
    await chmod(root, 0o555);
    try {
      await expect(prepareOutput(root, "output/app")).rejects.toMatchObject({ code: "EACCES" });
    } finally {
      await chmod(root, 0o755);
    }
  });
});
