import { describe, expect, it } from "vitest";

import { RemoteRegistryLoader } from "../../src/loaders/remote-registry-loader.js";

describe("RemoteRegistryLoader (reserved for the future)", () => {
  it("throws — Remote Registry loading is not implemented yet", async () => {
    const loader = new RemoteRegistryLoader();
    await expect(loader.load("https://example.invalid/registry")).rejects.toThrow(
      /not implemented/,
    );
  });
});
