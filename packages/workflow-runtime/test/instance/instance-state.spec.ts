import { describe, expect, it } from "vitest";

import {
  INSTANCE_STATE_TRANSITIONS,
  InstanceState,
  TERMINAL_INSTANCE_STATES,
} from "../../src/instance/instance-state.js";

describe("InstanceState transitions", () => {
  it("allows every named lifecycle path", () => {
    expect(INSTANCE_STATE_TRANSITIONS[InstanceState.CREATED]).toContain(InstanceState.READY);
    expect(INSTANCE_STATE_TRANSITIONS[InstanceState.READY]).toContain(InstanceState.RUNNING);
    expect(INSTANCE_STATE_TRANSITIONS[InstanceState.RUNNING]).toContain(InstanceState.PAUSED);
    expect(INSTANCE_STATE_TRANSITIONS[InstanceState.PAUSED]).toContain(InstanceState.RUNNING);
    expect(INSTANCE_STATE_TRANSITIONS[InstanceState.RUNNING]).toContain(InstanceState.COMPLETED);
    expect(INSTANCE_STATE_TRANSITIONS[InstanceState.RUNNING]).toContain(InstanceState.FAILED);
    expect(INSTANCE_STATE_TRANSITIONS[InstanceState.FAILED]).toContain(InstanceState.COMPENSATING);
    expect(INSTANCE_STATE_TRANSITIONS[InstanceState.COMPENSATING]).toContain(
      InstanceState.COMPENSATED,
    );
  });

  it("has no outgoing transitions from any terminal-only state", () => {
    expect(INSTANCE_STATE_TRANSITIONS[InstanceState.COMPLETED]).toHaveLength(0);
    expect(INSTANCE_STATE_TRANSITIONS[InstanceState.CANCELLED]).toHaveLength(0);
    expect(INSTANCE_STATE_TRANSITIONS[InstanceState.COMPENSATED]).toHaveLength(0);
    expect(INSTANCE_STATE_TRANSITIONS[InstanceState.EXPIRED]).toHaveLength(0);
  });

  it("classifies FAILED as a terminal metrics/health state despite still allowing FAILED -> COMPENSATING", () => {
    expect(TERMINAL_INSTANCE_STATES.has(InstanceState.FAILED)).toBe(true);
    expect(INSTANCE_STATE_TRANSITIONS[InstanceState.FAILED]).toContain(InstanceState.COMPENSATING);
  });

  it("every InstanceState has a transitions table entry", () => {
    for (const state of Object.values(InstanceState)) {
      expect(INSTANCE_STATE_TRANSITIONS[state]).toBeDefined();
    }
  });
});
