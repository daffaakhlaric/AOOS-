import { describe, expect, it } from "vitest";

import { MediaUrl } from "../../../src/domain/value-objects/MediaUrl.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("MediaUrl", () => {
  it("creates a valid MediaUrl from an https URL", () => {
    const url = unwrap(MediaUrl.create("https://cdn.kie.ai/videos/out.mp4"));
    expect(url.toString()).toBe("https://cdn.kie.ai/videos/out.mp4");
  });

  it("rejects a relative path", () => {
    const error = unwrapErr(MediaUrl.create("videos/out.mp4"));
    expect(error.message).toMatch(/absolute http\(s\) URL/);
  });

  it("rejects a non-string value", () => {
    const error = unwrapErr(MediaUrl.create(undefined as unknown as string));
    expect(error.message).toMatch(/absolute http\(s\) URL/);
  });

  it("two MediaUrls with the same value are equal", () => {
    const a = unwrap(MediaUrl.create("https://cdn.kie.ai/a.mp4"));
    const b = unwrap(MediaUrl.create("https://cdn.kie.ai/a.mp4"));
    expect(a.equals(b)).toBe(true);
  });

  it("two MediaUrls with different values are not equal", () => {
    const a = unwrap(MediaUrl.create("https://cdn.kie.ai/a.mp4"));
    const b = unwrap(MediaUrl.create("https://cdn.kie.ai/b.mp4"));
    expect(a.equals(b)).toBe(false);
  });
});
