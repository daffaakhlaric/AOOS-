import { AosError } from "@aos/errors";
import { describe, expect, it } from "vitest";

import { BuilderException } from "../../src/errors/builder-exception.js";
import { CycleException } from "../../src/errors/cycle-exception.js";
import { DuplicateException } from "../../src/errors/duplicate-exception.js";
import { ParseException } from "../../src/errors/parse-exception.js";
import { RegistryException } from "../../src/errors/registry-exception.js";
import { SerializationException } from "../../src/errors/serialization-exception.js";
import { ValidationException } from "../../src/errors/validation-exception.js";
import { VersionException } from "../../src/errors/version-exception.js";
import { WorkflowDefinitionException } from "../../src/errors/workflow-definition-exception.js";

describe("Workflow Definition exception hierarchy", () => {
  it.each([
    ["WorkflowDefinitionException", WorkflowDefinitionException],
    ["ValidationException", ValidationException],
    ["ParseException", ParseException],
    ["SerializationException", SerializationException],
    ["CycleException", CycleException],
    ["DuplicateException", DuplicateException],
    ["VersionException", VersionException],
    ["BuilderException", BuilderException],
    ["RegistryException", RegistryException],
  ])("%s extends AosError and carries its message/name/context", (name, ExceptionClass) => {
    const error = new ExceptionClass("boom", { context: { tenantId: "t-1" } });
    expect(error).toBeInstanceOf(AosError);
    expect(error.name).toBe(name);
    expect(error.message).toBe("boom");
    expect(error.context).toEqual({ tenantId: "t-1" });
  });

  it("carries a `cause` through to the underlying Error", () => {
    const cause = new Error("root cause");
    const error = new ValidationException("wrapped", { cause });
    expect(error.cause).toBe(cause);
  });
});
