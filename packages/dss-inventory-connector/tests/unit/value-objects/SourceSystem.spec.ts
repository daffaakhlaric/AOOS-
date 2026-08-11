import { describe, expect, it } from "vitest";

import { SourceSystem } from "../../../src/domain/value-objects/SourceSystem.js";

describe("SourceSystem", () => {
  it("has GOOGLE_SHEETS, DMS, API, MOCK members", () => {
    expect(SourceSystem.GOOGLE_SHEETS).toBe("GOOGLE_SHEETS");
    expect(SourceSystem.DMS).toBe("DMS");
    expect(SourceSystem.API).toBe("API");
    expect(SourceSystem.MOCK).toBe("MOCK");
  });
});
