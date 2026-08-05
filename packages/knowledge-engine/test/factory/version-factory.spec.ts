import { describe, expect, it } from "vitest";

import { VersionFactory } from "../../src/factory/version-factory.js";

describe("Factory Test — VersionFactory", () => {
  it("defaults to 1.0.0", () => {
    const version = new VersionFactory().create();
    expect(version.label).toBe("1.0.0");
    expect(version.major).toBe(1);
    expect(version.minor).toBe(0);
    expect(version.patch).toBe(0);
  });

  it("accepts custom components and createdBy", () => {
    const version = new VersionFactory().create({
      major: 2,
      minor: 3,
      patch: 4,
      createdBy: "user-1",
    });
    expect(version.label).toBe("2.3.4");
    expect(version.createdBy).toBe("user-1");
  });
});
