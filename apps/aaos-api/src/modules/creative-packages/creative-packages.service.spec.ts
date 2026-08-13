import { describe, expect, it } from "vitest";

import { CreativePackageStore } from "./creative-package.store.js";
import { CreativePackagesService } from "./creative-packages.service.js";

const seedInput = {
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

function buildStoreWithOne(): CreativePackageStore {
  const store = new CreativePackageStore();
  store.create(seedInput, "pkg-1", "2026-08-01T00:00:00.000Z");
  return store;
}

describe("CreativePackagesService", () => {
  it("listPending() maps every stored package to a CreativePackageResponseDto", () => {
    const store = buildStoreWithOne();
    const service = new CreativePackagesService(store);
    const dtos = service.listPending();
    expect(dtos).toHaveLength(1);
    expect(dtos[0]?.id).toBe("pkg-1");
    expect(dtos[0]?.status).toBe("PENDING");
  });

  describe("approve", () => {
    it("approves with the given selectedCopyVariantId", () => {
      const store = buildStoreWithOne();
      const service = new CreativePackagesService(store);
      const dto = service.approve(
        "pkg-1",
        { selectedCopyVariantId: "v-b" },
        new Date("2026-08-02T00:00:00.000Z"),
      );
      expect(dto.status).toBe("APPROVED");
      expect(dto.selectedCopyVariantId).toBe("v-b");
    });

    it("defaults to the package's first copy variant when none is specified", () => {
      const store = buildStoreWithOne();
      const service = new CreativePackagesService(store);
      const dto = service.approve("pkg-1", {}, new Date("2026-08-02T00:00:00.000Z"));
      expect(dto.selectedCopyVariantId).toBe("v-a");
    });

    it("throws NotFoundError for an unknown package id", () => {
      const store = new CreativePackageStore();
      const service = new CreativePackagesService(store);
      expect(() => service.approve("missing", {}, new Date())).toThrow(/No creative package/);
    });

    it("throws ValidationError when selectedCopyVariantId isn't one of the package's variants", () => {
      const store = buildStoreWithOne();
      const service = new CreativePackagesService(store);
      expect(() =>
        service.approve("pkg-1", { selectedCopyVariantId: "not-real" }, new Date()),
      ).toThrow(/not a copy variant/);
    });
  });

  describe("reject", () => {
    it("rejects a pending package", () => {
      const store = buildStoreWithOne();
      const service = new CreativePackagesService(store);
      const dto = service.reject("pkg-1", {}, new Date("2026-08-02T00:00:00.000Z"));
      expect(dto.status).toBe("REJECTED");
    });

    it("throws NotFoundError for an unknown package id", () => {
      const store = new CreativePackageStore();
      const service = new CreativePackagesService(store);
      expect(() => service.reject("missing", {}, new Date())).toThrow(/No creative package/);
    });
  });
});
