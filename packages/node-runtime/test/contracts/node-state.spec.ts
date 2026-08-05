import { describe, expect, it } from "vitest";

import {
  NODE_STATE_TRANSITIONS,
  NodeState,
  TERMINAL_NODE_STATES,
} from "../../src/contracts/node-state.js";

describe("NodeState transitions", () => {
  it("allows every named lifecycle path", () => {
    expect(NODE_STATE_TRANSITIONS[NodeState.CREATED]).toContain(NodeState.READY);
    expect(NODE_STATE_TRANSITIONS[NodeState.READY]).toContain(NodeState.RUNNING);
    expect(NODE_STATE_TRANSITIONS[NodeState.RUNNING]).toContain(NodeState.PAUSED);
    expect(NODE_STATE_TRANSITIONS[NodeState.PAUSED]).toContain(NodeState.RUNNING);
    expect(NODE_STATE_TRANSITIONS[NodeState.RUNNING]).toContain(NodeState.COMPLETED);
    expect(NODE_STATE_TRANSITIONS[NodeState.RUNNING]).toContain(NodeState.FAILED);
    expect(NODE_STATE_TRANSITIONS[NodeState.FAILED]).toContain(NodeState.COMPENSATED);
    expect(NODE_STATE_TRANSITIONS[NodeState.READY]).toContain(NodeState.SKIPPED);
    expect(NODE_STATE_TRANSITIONS[NodeState.RUNNING]).toContain(NodeState.TIMED_OUT);
  });

  it("has no outgoing transitions from any terminal-only state", () => {
    expect(NODE_STATE_TRANSITIONS[NodeState.COMPLETED]).toHaveLength(0);
    expect(NODE_STATE_TRANSITIONS[NodeState.CANCELLED]).toHaveLength(0);
    expect(NODE_STATE_TRANSITIONS[NodeState.SKIPPED]).toHaveLength(0);
    expect(NODE_STATE_TRANSITIONS[NodeState.TIMED_OUT]).toHaveLength(0);
    expect(NODE_STATE_TRANSITIONS[NodeState.COMPENSATED]).toHaveLength(0);
  });

  it("classifies FAILED as a terminal metrics/health state despite still allowing FAILED -> COMPENSATED", () => {
    expect(TERMINAL_NODE_STATES.has(NodeState.FAILED)).toBe(true);
    expect(NODE_STATE_TRANSITIONS[NodeState.FAILED]).toContain(NodeState.COMPENSATED);
  });

  it("every NodeState has a transitions table entry", () => {
    for (const state of Object.values(NodeState)) {
      expect(NODE_STATE_TRANSITIONS[state]).toBeDefined();
    }
  });
});
