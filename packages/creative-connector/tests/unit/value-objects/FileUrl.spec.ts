import { describe, expect, it } from "vitest";

import { FileUrl } from "../../../src/domain/value-objects/FileUrl.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("FileUrl", () => {
  it("creates a valid FileUrl from an https URL", () => {
    const url = unwrap(FileUrl.create("https://cdn.kie.ai/images/aaos-dss/xpander-001.jpg"));
    expect(url.toString()).toBe("https://cdn.kie.ai/images/aaos-dss/xpander-001.jpg");
  });

  it("creates a valid FileUrl from an http URL", () => {
    const url = unwrap(FileUrl.create("http://cdn.kie.ai/x.jpg"));
    expect(url.toString()).toBe("http://cdn.kie.ai/x.jpg");
  });

  it("rejects a relative path", () => {
    const error = unwrapErr(FileUrl.create("/images/x.jpg"));
    expect(error.message).toMatch(/absolute http\(s\) URL/);
  });

  it("rejects a non-string value", () => {
    const error = unwrapErr(FileUrl.create(42 as unknown as string));
    expect(error.message).toMatch(/absolute http\(s\) URL/);
  });

  it("two FileUrls with the same value are equal", () => {
    const a = unwrap(FileUrl.create("https://cdn.kie.ai/a.jpg"));
    const b = unwrap(FileUrl.create("https://cdn.kie.ai/a.jpg"));
    expect(a.equals(b)).toBe(true);
  });

  it("two FileUrls with different values are not equal", () => {
    const a = unwrap(FileUrl.create("https://cdn.kie.ai/a.jpg"));
    const b = unwrap(FileUrl.create("https://cdn.kie.ai/b.jpg"));
    expect(a.equals(b)).toBe(false);
  });
});
