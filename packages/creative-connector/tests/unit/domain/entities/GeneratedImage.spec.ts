import { describe, expect, it } from "vitest";

import { GeneratedImage } from "../../../../src/domain/entities/GeneratedImage.js";
import { AspectRatio } from "../../../../src/domain/value-objects/AspectRatio.js";
import { ImageModel } from "../../../../src/domain/value-objects/ImageModel.js";
import { MediaUrl } from "../../../../src/domain/value-objects/MediaUrl.js";
import { TaskId } from "../../../../src/domain/value-objects/TaskId.js";
import { unwrap } from "../../../helpers/result.js";

describe("GeneratedImage", () => {
  it("creates a GeneratedImage with multiple image variants", () => {
    const imageUrl = unwrap(MediaUrl.create("https://cdn.kie.ai/img1.jpg"));
    const image2 = unwrap(MediaUrl.create("https://cdn.kie.ai/img2.jpg"));
    const image = unwrap(
      GeneratedImage.create({
        taskId: unwrap(TaskId.create("task_1")),
        imageUrl,
        images: [imageUrl, image2],
        model: ImageModel.NANO_BANANA_PRO,
        aspectRatio: AspectRatio.SQUARE,
      }),
    );
    expect(image.taskId.toString()).toBe("task_1");
    expect(image.imageUrl.toString()).toBe("https://cdn.kie.ai/img1.jpg");
    expect(image.images).toHaveLength(2);
    expect(image.model).toBe(ImageModel.NANO_BANANA_PRO);
    expect(image.aspectRatio).toBe(AspectRatio.SQUARE);
  });

  it("defensively copies the images array", () => {
    const imageUrl = unwrap(MediaUrl.create("https://cdn.kie.ai/img1.jpg"));
    const source = [imageUrl];
    const image = unwrap(
      GeneratedImage.create({
        taskId: unwrap(TaskId.create("task_1")),
        imageUrl,
        images: source,
        model: ImageModel.NANO_BANANA_PRO,
        aspectRatio: AspectRatio.SQUARE,
      }),
    );
    source.push(imageUrl);
    expect(image.images).toHaveLength(1);
  });
});
