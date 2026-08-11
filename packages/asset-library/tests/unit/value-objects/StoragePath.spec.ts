import { describe, expect, it } from "vitest";

import { StoragePath } from "../../../src/domain/value-objects/StoragePath.js";
import { unwrapErr } from "../../helpers/result.js";

describe("StoragePath", () => {
  describe("pinned business-correctness storage_path generators", () => {
    it("unitPhoto() -> units/{unitId}/photo-{timestamp}.{ext}", () => {
      const path = StoragePath.unitPhoto("unit-123", 1700000000000, "jpg");
      expect(path.toString()).toBe("units/unit-123/photo-1700000000000.jpg");
    });

    it("brandAsset() -> brand/{filename}", () => {
      const path = StoragePath.brandAsset("logo.png");
      expect(path.toString()).toBe("brand/logo.png");
    });

    it("aiCreative() -> ai-creatives/{briefId}/{type}-{n}.{ext}", () => {
      const video = StoragePath.aiCreative("brief-001", "video", 1, "mp4");
      const image = StoragePath.aiCreative("brief-001", "image", 2, "jpg");
      expect(video.toString()).toBe("ai-creatives/brief-001/video-1.mp4");
      expect(image.toString()).toBe("ai-creatives/brief-001/image-2.jpg");
    });
  });

  it("testimonial() -> testimonials/{filename}", () => {
    const path = StoragePath.testimonial("testimonial-1.jpg");
    expect(path.toString()).toBe("testimonials/testimonial-1.jpg");
  });

  it("create() accepts a non-empty string", () => {
    const path = StoragePath.create("units/unit-1/photo-1.jpg");
    expect(path.ok).toBe(true);
  });

  it("create() rejects an empty string", () => {
    const error = unwrapErr(StoragePath.create(""));
    expect(error.message).toContain("StoragePath");
  });

  it("equals() compares by value", () => {
    const a = StoragePath.brandAsset("logo.png");
    const b = StoragePath.brandAsset("logo.png");
    const c = StoragePath.brandAsset("other.png");
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });
});
