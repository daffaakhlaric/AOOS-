import { describe, expect, it } from "vitest";

import { ConflictResolutionStrategyName } from "../../src/types/conflict-resolution-strategy.js";

describe("ConflictResolutionStrategyName", () => {
  it("defines exactly 2 named strategies", () => {
    expect(Object.values(ConflictResolutionStrategyName)).toHaveLength(2);
  });

  it("includes LastWriteWins and VersionPriority", () => {
    expect(ConflictResolutionStrategyName.LastWriteWins).toBe("last_write_wins");
    expect(ConflictResolutionStrategyName.VersionPriority).toBe("version_priority");
  });
});
