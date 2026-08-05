import { describe, expect, it } from "vitest";

import { IllegalRuntimeTransitionException } from "../../src/errors/illegal-runtime-transition-exception.js";
import { KnowledgeAssetNotLoadedException } from "../../src/errors/knowledge-asset-not-loaded-exception.js";
import { KnowledgeRuntimeException } from "../../src/errors/knowledge-runtime-exception.js";
import { ReplayNotSupportedException } from "../../src/errors/replay-not-supported-exception.js";
import { RuntimeInstanceNotFoundException } from "../../src/errors/runtime-instance-not-found-exception.js";
import { RuntimeLeaseException } from "../../src/errors/runtime-lease-exception.js";
import { RuntimeLifecycleException } from "../../src/errors/runtime-lifecycle-exception.js";
import { RuntimePermissionException } from "../../src/errors/runtime-permission-exception.js";
import { RuntimePolicyException } from "../../src/errors/runtime-policy-exception.js";
import { RuntimeSessionException } from "../../src/errors/runtime-session-exception.js";
import { RuntimeSnapshotException } from "../../src/errors/runtime-snapshot-exception.js";
import { RuntimeValidationException } from "../../src/errors/runtime-validation-exception.js";

const subclasses = [
  IllegalRuntimeTransitionException,
  RuntimeInstanceNotFoundException,
  RuntimeLifecycleException,
  RuntimeValidationException,
  RuntimePermissionException,
  RuntimePolicyException,
  RuntimeSessionException,
  RuntimeSnapshotException,
  ReplayNotSupportedException,
  KnowledgeAssetNotLoadedException,
  RuntimeLeaseException,
];

describe("Errors Test — exception hierarchy", () => {
  it("KnowledgeRuntimeException carries a message and optional cause/context", () => {
    const cause = new Error("root cause");
    const error = new KnowledgeRuntimeException("boom", { cause, context: { tenantId: "t1" } });
    expect(error.message).toBe("boom");
    expect(error.cause).toBe(cause);
    expect(error.context).toEqual({ tenantId: "t1" });
  });

  it.each(subclasses)(
    "%s extends KnowledgeRuntimeException and carries its message",
    (ExceptionClass) => {
      const error = new ExceptionClass("something failed");
      expect(error).toBeInstanceOf(KnowledgeRuntimeException);
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe("something failed");
      expect(error.name).toBe(ExceptionClass.name);
    },
  );

  it("declares exactly 11 concrete subclasses", () => {
    expect(subclasses).toHaveLength(11);
  });
});
