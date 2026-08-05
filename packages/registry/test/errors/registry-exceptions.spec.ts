import { AosError } from "@aos/errors";
import { describe, expect, it } from "vitest";

import {
  DependencyException,
  RegistryException,
  ResolutionException,
  SchemaException,
  ValidationException,
  VersionException,
} from "../../src/errors/index.js";

describe("Registry exception hierarchy", () => {
  it("RegistryException extends AosError", () => {
    const error = new RegistryException("boom");
    expect(error).toBeInstanceOf(AosError);
    expect(error.name).toBe("RegistryException");
  });

  const cases: Array<new (message: string) => RegistryException> = [
    ValidationException,
    DependencyException,
    SchemaException,
    VersionException,
    ResolutionException,
  ];

  it.each(cases)("%s extends RegistryException with its own name", (ErrorClass) => {
    const error = new ErrorClass("message");
    expect(error).toBeInstanceOf(RegistryException);
    expect(error.name).toBe(ErrorClass.name);
  });
});
