import { describe, expect, it } from "vitest";

import { CreativePackageStore } from "./creative-package.store.js";

const baseInput = {
  briefId: "A001",
  branch: "BINTARO",
  unit: "Xpander",
  title: "Xpander Bintaro",
  imageUrls: ["a.jpg", "b.jpg", "c.jpg"],
  copyVariants: [
    {
      id: "v-a",
      variantLabel: "A" as const,
      primaryText: "text a",
      headline: "h a",
      callToAction: "Hubungi",
    },
    {
      id: "v-b",
      variantLabel: "B" as const,
      primaryText: "text b",
      headline: "h b",
      callToAction: "Hubungi",
    },
  ],
};

describe("CreativePackageStore", () => {
  it("starts empty", () => {
    const store = new CreativePackageStore();
    expect(store.list()).toEqual([]);
  });

  it("create() stores a PENDING package retrievable by id", () => {
    const store = new CreativePackageStore();
    const created = store.create(baseInput, "pkg-1", "2026-08-01T00:00:00.000Z");
    expect(created.status).toBe("PENDING");
    expect(store.findById("pkg-1")).toEqual(created);
  });

  it("list() returns newest-first by createdAt", () => {
    const store = new CreativePackageStore();
    store.create(baseInput, "pkg-1", "2026-08-01T00:00:00.000Z");
    store.create(baseInput, "pkg-2", "2026-08-05T00:00:00.000Z");
    const ids = store.list().map((p) => p.id);
    expect(ids).toEqual(["pkg-2", "pkg-1"]);
  });

  it("review() transitions a PENDING package to APPROVED with a selected copy variant", () => {
    const store = new CreativePackageStore();
    store.create(baseInput, "pkg-1", "2026-08-01T00:00:00.000Z");
    const updated = store.review("pkg-1", "APPROVED", "2026-08-02T00:00:00.000Z", "v-b");
    expect(updated?.status).toBe("APPROVED");
    expect(updated?.selectedCopyVariantId).toBe("v-b");
    expect(updated?.reviewedAt).toBe("2026-08-02T00:00:00.000Z");
  });

  it("review() returns undefined for an unknown id", () => {
    const store = new CreativePackageStore();
    expect(store.review("missing", "REJECTED", "2026-08-02T00:00:00.000Z")).toBeUndefined();
  });

  it("seed() populates an empty store", () => {
    const store = new CreativePackageStore();
    store.seed([
      { ...baseInput, id: "seed-1", status: "PENDING", createdAt: "2026-01-01T00:00:00.000Z" },
    ]);
    expect(store.list()).toHaveLength(1);
  });

  it("seed() is a no-op once the store already has entries (never overwrites real data)", () => {
    const store = new CreativePackageStore();
    store.create(baseInput, "pkg-1", "2026-08-01T00:00:00.000Z");
    store.seed([
      { ...baseInput, id: "seed-1", status: "PENDING", createdAt: "2026-01-01T00:00:00.000Z" },
    ]);
    expect(store.list().map((p) => p.id)).toEqual(["pkg-1"]);
  });
});
