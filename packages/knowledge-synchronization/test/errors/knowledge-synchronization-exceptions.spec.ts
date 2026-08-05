import { AosError } from "@aos/errors";
import { describe, expect, it } from "vitest";

import { ConflictResolutionNotSupportedException } from "../../src/errors/conflict-resolution-not-supported-exception.js";
import { ConnectionValidationException } from "../../src/errors/connection-validation-exception.js";
import { DuplicateSynchronizationEntryException } from "../../src/errors/duplicate-synchronization-entry-exception.js";
import { IllegalSynchronizationTransitionException } from "../../src/errors/illegal-synchronization-transition-exception.js";
import { InvalidSynchronizationJobException } from "../../src/errors/invalid-synchronization-job-exception.js";
import { KnowledgeSynchronizationException } from "../../src/errors/knowledge-synchronization-exception.js";
import { ProviderNotFoundException } from "../../src/errors/provider-not-found-exception.js";
import { ScheduleNotFoundException } from "../../src/errors/schedule-not-found-exception.js";
import { SynchronizationLeaseException } from "../../src/errors/synchronization-lease-exception.js";
import { SynchronizationNotFoundException } from "../../src/errors/synchronization-not-found-exception.js";
import { SynchronizationPermissionDeniedException } from "../../src/errors/synchronization-permission-denied-exception.js";
import { SynchronizationPolicyViolationException } from "../../src/errors/synchronization-policy-violation-exception.js";
import { SynchronizationSessionException } from "../../src/errors/synchronization-session-exception.js";
import { SynchronizationValidationException } from "../../src/errors/synchronization-validation-exception.js";

describe("KnowledgeSynchronizationException", () => {
  it("extends AosError", () => {
    expect(new KnowledgeSynchronizationException("boom")).toBeInstanceOf(AosError);
  });

  it("carries the message", () => {
    expect(new KnowledgeSynchronizationException("boom").message).toBe("boom");
  });

  it("carries an optional cause", () => {
    const cause = new Error("root cause");
    const error = new KnowledgeSynchronizationException("boom", { cause });
    expect(error.cause).toBe(cause);
  });
});

describe.each([
  ["IllegalSynchronizationTransitionException", IllegalSynchronizationTransitionException],
  ["SynchronizationNotFoundException", SynchronizationNotFoundException],
  ["DuplicateSynchronizationEntryException", DuplicateSynchronizationEntryException],
  ["SynchronizationValidationException", SynchronizationValidationException],
  ["SynchronizationPermissionDeniedException", SynchronizationPermissionDeniedException],
  ["SynchronizationPolicyViolationException", SynchronizationPolicyViolationException],
  ["ProviderNotFoundException", ProviderNotFoundException],
  ["ConflictResolutionNotSupportedException", ConflictResolutionNotSupportedException],
  ["SynchronizationSessionException", SynchronizationSessionException],
  ["SynchronizationLeaseException", SynchronizationLeaseException],
  ["InvalidSynchronizationJobException", InvalidSynchronizationJobException],
  ["ScheduleNotFoundException", ScheduleNotFoundException],
  ["ConnectionValidationException", ConnectionValidationException],
])("%s", (name, ExceptionClass) => {
  it(`is a ${name} extending KnowledgeSynchronizationException`, () => {
    const error = new ExceptionClass("something went wrong");
    expect(error).toBeInstanceOf(KnowledgeSynchronizationException);
    expect(error.message).toBe("something went wrong");
  });
});
