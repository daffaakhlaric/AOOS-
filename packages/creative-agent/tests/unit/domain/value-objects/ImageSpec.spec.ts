import { AspectRatio, ImageModel } from "@aos/creative-connector";
import { describe, expect, it } from "vitest";

import { ImageSpec } from "../../../../src/domain/value-objects/ImageSpec.js";
import { unwrap, unwrapErr } from "../../../helpers/result.js";

describe("ImageSpec", () => {
  it("create() accepts a positive integer count", () => {
    const spec = unwrap(
      ImageSpec.create({
        count: 3,
        aspectRatio: AspectRatio.SQUARE,
        model: ImageModel.NANO_BANANA_PRO,
      }),
    );
    expect(spec.count).toBe(3);
    expect(spec.aspectRatio).toBe(AspectRatio.SQUARE);
    expect(spec.model).toBe(ImageModel.NANO_BANANA_PRO);
  });

  it("create() rejects a zero count", () => {
    const error = unwrapErr(
      ImageSpec.create({
        count: 0,
        aspectRatio: AspectRatio.SQUARE,
        model: ImageModel.NANO_BANANA_PRO,
      }),
    );
    expect(error.message).toContain("count");
  });

  it("create() rejects a non-integer count", () => {
    const error = unwrapErr(
      ImageSpec.create({
        count: 1.5,
        aspectRatio: AspectRatio.SQUARE,
        model: ImageModel.NANO_BANANA_PRO,
      }),
    );
    expect(error.message).toContain("positive integer");
  });
});
