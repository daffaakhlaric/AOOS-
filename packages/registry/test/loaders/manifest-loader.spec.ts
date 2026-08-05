import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ManifestLoader } from "../../src/loaders/manifest-loader.js";

describe("Registry Loading Test — ManifestLoader", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "aos-registry-loader-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("loads a YAML manifest", async () => {
    writeFileSync(join(dir, "a.yaml"), "id: a\nversion: 1.0.0\ncategory: test\n");
    const loader = new ManifestLoader();
    const result = await loader.load(dir);
    expect(result.loaded).toEqual([{ id: "a", version: "1.0.0", category: "test" }]);
    expect(result.failed).toHaveLength(0);
  });

  it("loads a JSON manifest", async () => {
    writeFileSync(
      join(dir, "b.json"),
      JSON.stringify({ id: "b", version: "1.0.0", category: "test" }),
    );
    const loader = new ManifestLoader();
    const result = await loader.load(dir);
    expect(result.loaded).toEqual([{ id: "b", version: "1.0.0", category: "test" }]);
  });

  it("loads a TypeScript-metadata (.mjs, compiled-JS-equivalent) manifest via a named `manifest` export", async () => {
    writeFileSync(
      join(dir, "c.mjs"),
      "export const manifest = { id: 'c', version: '1.0.0', category: 'test' };\n",
    );
    const loader = new ManifestLoader();
    const result = await loader.load(dir);
    expect(result.loaded).toEqual([{ id: "c", version: "1.0.0", category: "test" }]);
  });

  it("loads a TypeScript-metadata manifest via a default export", async () => {
    writeFileSync(
      join(dir, "d.mjs"),
      "export default { id: 'd', version: '1.0.0', category: 'test' };\n",
    );
    const loader = new ManifestLoader();
    const result = await loader.load(dir);
    expect(result.loaded).toEqual([{ id: "d", version: "1.0.0", category: "test" }]);
  });

  it("ignores files with unsupported extensions", async () => {
    writeFileSync(join(dir, "readme.md"), "# not a manifest");
    writeFileSync(join(dir, "a.yaml"), "id: a\nversion: 1.0.0\ncategory: test\n");
    const loader = new ManifestLoader();
    const result = await loader.load(dir);
    expect(result.loaded).toHaveLength(1);
  });

  it("records a per-file failure without aborting the whole batch", async () => {
    writeFileSync(
      join(dir, "good.json"),
      JSON.stringify({ id: "good", version: "1.0.0", category: "test" }),
    );
    writeFileSync(join(dir, "bad.json"), "{ not valid json");
    const loader = new ManifestLoader();
    const result = await loader.load(dir);
    expect(result.loaded).toHaveLength(1);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]?.sourcePath).toContain("bad.json");
  });

  it("reports a top-level failure when the directory does not exist", async () => {
    const loader = new ManifestLoader();
    const result = await loader.load(join(dir, "does-not-exist"));
    expect(result.loaded).toHaveLength(0);
    expect(result.failed).toHaveLength(1);
  });

  it("reports a failure for a module with neither a manifest nor default export", async () => {
    writeFileSync(join(dir, "empty.mjs"), "export const somethingElse = 1;\n");
    const loader = new ManifestLoader();
    const result = await loader.load(dir);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]?.error).toContain("does not export");
  });
});
