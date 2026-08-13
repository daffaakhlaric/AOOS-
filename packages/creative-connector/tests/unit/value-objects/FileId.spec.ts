import { describe, expect, it } from "vitest";

import { FileId } from "../../../src/domain/value-objects/FileId.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("FileId", () => {
  it("creates a valid FileId from a non-empty string", () => {
    const fileId = unwrap(FileId.create("file_abc1234"));
    expect(fileId.toString()).toBe("file_abc1234");
  });

  it("rejects an empty string", () => {
    const error = unwrapErr(FileId.create(""));
    expect(error.message).toMatch(/non-empty string/);
  });

  it("rejects a non-string value", () => {
    const error = unwrapErr(FileId.create(null as unknown as string));
    expect(error.message).toMatch(/non-empty string/);
  });

  it("two FileIds with the same value are equal", () => {
    const a = unwrap(FileId.create("file_1"));
    const b = unwrap(FileId.create("file_1"));
    expect(a.equals(b)).toBe(true);
  });

  it("two FileIds with different values are not equal", () => {
    const a = unwrap(FileId.create("file_1"));
    const b = unwrap(FileId.create("file_2"));
    expect(a.equals(b)).toBe(false);
  });
});
