import { ErrorCode } from "@aos/common";
import { describe, expect, it } from "vitest";

import { AssetError } from "../../../src/domain/errors/AssetError.js";
import { AssetNotFoundError } from "../../../src/domain/errors/AssetNotFoundError.js";
import { FileSizeLimitError } from "../../../src/domain/errors/FileSizeLimitError.js";
import { InvalidFileTypeError } from "../../../src/domain/errors/InvalidFileTypeError.js";
import { StorageError } from "../../../src/domain/errors/StorageError.js";

describe("AssetError", () => {
  it("defaults to VALIDATION_ERROR code", () => {
    const error = new AssetError("boom");
    expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(error.message).toBe("boom");
    expect(error.name).toBe("AssetError");
  });

  it("accepts an explicit code override", () => {
    const error = new AssetError("boom", { code: ErrorCode.INTERNAL });
    expect(error.code).toBe(ErrorCode.INTERNAL);
  });

  it("is an instance of Error", () => {
    expect(new AssetError("boom")).toBeInstanceOf(Error);
  });
});

describe("AssetNotFoundError", () => {
  it("always carries NOT_FOUND", () => {
    const error = new AssetNotFoundError("not found");
    expect(error.code).toBe(ErrorCode.NOT_FOUND);
    expect(error).toBeInstanceOf(AssetError);
    expect(error.name).toBe("AssetNotFoundError");
  });
});

describe("StorageError", () => {
  it("always carries UNAVAILABLE", () => {
    const error = new StorageError("unavailable");
    expect(error.code).toBe(ErrorCode.UNAVAILABLE);
    expect(error).toBeInstanceOf(AssetError);
  });
});

describe("InvalidFileTypeError", () => {
  it("always carries VALIDATION_ERROR", () => {
    const error = new InvalidFileTypeError("bad type");
    expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(error).toBeInstanceOf(AssetError);
  });
});

describe("FileSizeLimitError", () => {
  it("always carries VALIDATION_ERROR", () => {
    const error = new FileSizeLimitError("too big");
    expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(error).toBeInstanceOf(AssetError);
  });
});
