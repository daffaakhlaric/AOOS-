import { expect, it } from "vitest";

import { assertLoopTransition, LoopTriggerSchema } from "./loop-runtime.js";
it("requires approval to return through policy rather than execute directly", () => {
  expect(() => assertLoopTransition("AWAITING_APPROVAL", "EXECUTING")).toThrow(
    "INVALID_LOOP_TRANSITION",
  );
  expect(() => assertLoopTransition("AWAITING_APPROVAL", "POLICY_CHECK")).not.toThrow();
});
it("prevents terminal or uncertain runs from being blindly reopened", () => {
  for (const state of ["FAILED", "BLOCKED", "COMPLETED"] as const)
    expect(() => assertLoopTransition(state, "EXECUTING")).toThrow();
});
it("allows explicit hold completion and monitoring with insufficient outcome evidence", () => {
  expect(() => assertLoopTransition("POLICY_CHECK", "COMPLETED")).not.toThrow();
  expect(() => assertLoopTransition("VALIDATING", "MONITORING")).not.toThrow();
});
it("rejects an unversioned arbitrary event", () => {
  expect(
    LoopTriggerSchema.safeParse({ type: "campaign.metrics.updated", payload: {} }).success,
  ).toBe(false);
});
