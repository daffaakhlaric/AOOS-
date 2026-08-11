import { describe, expect, it } from "vitest";

import { EvergreenScore } from "../../../../src/domain/value-objects/EvergreenScore.js";

describe("EvergreenScore", () => {
  it("creates a valid score", () => {
    const result = EvergreenScore.create(85);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.value).toBe(85);
  });

  it("rejects a score below 0", () => {
    expect(EvergreenScore.create(-1).ok).toBe(false);
  });

  it("rejects a score above 100", () => {
    expect(EvergreenScore.create(101).ok).toBe(false);
  });

  it("rejects a non-finite score", () => {
    expect(EvergreenScore.create(Number.NaN).ok).toBe(false);
  });

  it("isHealthy() is true at and above 70", () => {
    const at70 = EvergreenScore.create(70);
    const above = EvergreenScore.create(90);
    expect(at70.ok && at70.value.isHealthy()).toBe(true);
    expect(above.ok && above.value.isHealthy()).toBe(true);
  });

  it("isHealthy() is false below 70", () => {
    const result = EvergreenScore.create(69);
    expect(result.ok && result.value.isHealthy()).toBe(false);
  });
});
