import { describe, expect, it } from "vitest";

import { Branch } from "../../../src/domain/value-objects/Branch.js";

describe("Branch (re-exported from @aos/meta-ads-connector)", () => {
  it("has no PONDOK_BAMBU member — see the engineering report's resolution #1", () => {
    expect(Object.values(Branch)).not.toContain("PONDOK_BAMBU");
  });

  it("includes UMUM, the resolution target for the spec's PONDOK_BAMBU references", () => {
    expect(Branch.UMUM).toBe("UMUM");
  });

  it("includes the three directly-named branches this package's WABA registry uses", () => {
    expect(Branch.BINTARO).toBe("BINTARO");
    expect(Branch.CINERE).toBe("CINERE");
    expect(Branch.BANDUNG).toBe("BANDUNG");
  });

  it("also exposes BOOST and MULTI — not used by this package's own WABA config, but part of the shared enum", () => {
    expect(Branch.BOOST).toBe("BOOST");
    expect(Branch.MULTI).toBe("MULTI");
  });

  it("has no duplicate values (each Branch member maps to a distinct string)", () => {
    const values = Object.values(Branch);
    expect(new Set(values).size).toBe(values.length);
  });
});
