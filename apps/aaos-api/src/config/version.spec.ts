import { describe, expect, it } from "vitest";

import { readAppVersion } from "./version.js";

describe("readAppVersion", () => {
  it("reads this app's own package.json version field", () => {
    expect(readAppVersion()).toBe("0.1.0");
  });
});
