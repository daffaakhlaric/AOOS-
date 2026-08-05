import { describe, expect, it } from "vitest";

import { JOB_STATE_TRANSITIONS, JobState } from "../../src/contracts/job-state.js";

describe("State Machine Test — JOB_STATE_TRANSITIONS", () => {
  it("every JobState has a transition table entry", () => {
    for (const state of Object.values(JobState)) {
      expect(JOB_STATE_TRANSITIONS[state]).toBeDefined();
    }
  });

  it("Completed/Cancelled/Expired are terminal — no outgoing transitions", () => {
    expect(JOB_STATE_TRANSITIONS[JobState.COMPLETED]).toEqual([]);
    expect(JOB_STATE_TRANSITIONS[JobState.CANCELLED]).toEqual([]);
    expect(JOB_STATE_TRANSITIONS[JobState.EXPIRED]).toEqual([]);
  });

  it("Pending can only move to Waiting or Cancelled", () => {
    expect(JOB_STATE_TRANSITIONS[JobState.PENDING]).toEqual([JobState.WAITING, JobState.CANCELLED]);
  });

  it("Running can reach Completed, Failed, or Cancelled", () => {
    expect(JOB_STATE_TRANSITIONS[JobState.RUNNING]).toEqual(
      expect.arrayContaining([JobState.COMPLETED, JobState.FAILED, JobState.CANCELLED]),
    );
  });

  it("Retrying can only return to Ready, Expired, or Cancelled", () => {
    expect(JOB_STATE_TRANSITIONS[JobState.RETRYING]).toEqual([
      JobState.READY,
      JobState.EXPIRED,
      JobState.CANCELLED,
    ]);
  });
});
