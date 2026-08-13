import { ErrorCode } from "@aos/common";
import { describe, expect, it } from "vitest";

import { CreativeConnectorError } from "../../../../src/domain/errors/CreativeConnectorError.js";
import { FileUploadError } from "../../../../src/domain/errors/FileUploadError.js";

describe("FileUploadError", () => {
  it("defaults to ErrorCode.UNAVAILABLE", () => {
    const error = new FileUploadError("upload failed");
    expect(error.code).toBe(ErrorCode.UNAVAILABLE);
  });

  it("is a CreativeConnectorError", () => {
    expect(new FileUploadError("x")).toBeInstanceOf(CreativeConnectorError);
  });

  it("accepts an explicit ErrorCode override (e.g. for a mime-type validation failure)", () => {
    const error = new FileUploadError("bad mime type", {}, ErrorCode.VALIDATION_ERROR);
    expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
  });
});
