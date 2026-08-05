import { AosError } from "@aos/errors";
import { describe, expect, it } from "vitest";

import {
  BootstrapException,
  ConfigurationException,
  DependencyException,
  KernelException,
  LifecycleException,
  ModuleException,
} from "../../src/errors/index.js";

describe("Kernel exception hierarchy", () => {
  it("KernelException extends AosError", () => {
    const error = new KernelException("boom");
    expect(error).toBeInstanceOf(AosError);
    expect(error.name).toBe("KernelException");
  });

  const cases: Array<new (message: string) => KernelException> = [
    ConfigurationException,
    BootstrapException,
    ModuleException,
    LifecycleException,
    DependencyException,
  ];

  it.each(cases)("%s extends KernelException and carries its own name", (ErrorClass) => {
    const error = new ErrorClass("message");
    expect(error).toBeInstanceOf(KernelException);
    expect(error.name).toBe(ErrorClass.name);
    expect(error.message).toBe("message");
  });

  it("preserves cause and context through the chain", () => {
    const cause = new Error("root");
    const error = new ModuleException("wrapped", { cause, context: { tenantId: "t1" } });
    expect(error.cause).toBe(cause);
    expect(error.context?.tenantId).toBe("t1");
  });
});
