import { describe, expect, it } from "vitest";

import { ChangeMagnitude } from "../../src/types/change-magnitude.js";

describe("ChangeMagnitude", () => {
  it("defines exactly 4 magnitudes", () => {
    expect(Object.values(ChangeMagnitude)).toHaveLength(4);
  });

  it("includes None, MetadataOnly, Content, and Structural", () => {
    expect(ChangeMagnitude.None).toBe("none");
    expect(ChangeMagnitude.MetadataOnly).toBe("metadata_only");
    expect(ChangeMagnitude.Content).toBe("content");
    expect(ChangeMagnitude.Structural).toBe("structural");
  });
});
