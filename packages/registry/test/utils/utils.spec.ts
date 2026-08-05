import { describe, expect, it } from "vitest";

import { generateId, now } from "../../src/utils/index.js";

describe("utils", () => {
  it("generateId produces unique UUIDs", () => {
    expect(generateId()).not.toBe(generateId());
  });

  it("now() is monotonically non-decreasing", () => {
    expect(now() <= now()).toBe(true);
  });
});
