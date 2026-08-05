import { describe, expect, it } from "vitest";

import { KernelStateMachine } from "../../src/kernel/kernel-state-machine.js";
import { KernelState } from "../../src/types/index.js";

describe("KernelStateMachine (State Machine Test)", () => {
  it("starts in CREATED", () => {
    const machine = new KernelStateMachine();
    expect(machine.state).toBe(KernelState.CREATED);
  });

  it("walks the full happy-path chain: Created → ... → Running", () => {
    const machine = new KernelStateMachine();
    const path = [
      KernelState.BOOTING,
      KernelState.LOADING_CONFIGURATION,
      KernelState.LOADING_MODULES,
      KernelState.LOADING_PLUGINS,
      KernelState.READY,
      KernelState.RUNNING,
    ];
    for (const next of path) {
      expect(machine.canTransitionTo(next)).toBe(true);
      machine.transitionTo(next);
      expect(machine.state).toBe(next);
    }
  });

  it("walks the full stop chain: Running → Stopping → Stopped", () => {
    const machine = new KernelStateMachine();
    for (const next of [
      KernelState.BOOTING,
      KernelState.LOADING_CONFIGURATION,
      KernelState.LOADING_MODULES,
      KernelState.LOADING_PLUGINS,
      KernelState.READY,
      KernelState.RUNNING,
      KernelState.STOPPING,
      KernelState.STOPPED,
    ]) {
      machine.transitionTo(next);
    }
    expect(machine.state).toBe(KernelState.STOPPED);
  });

  it("allows Stopped → Restarting → Booting", () => {
    const machine = new KernelStateMachine();
    for (const next of [
      KernelState.BOOTING,
      KernelState.LOADING_CONFIGURATION,
      KernelState.LOADING_MODULES,
      KernelState.LOADING_PLUGINS,
      KernelState.READY,
      KernelState.RUNNING,
      KernelState.STOPPING,
      KernelState.STOPPED,
      KernelState.RESTARTING,
      KernelState.BOOTING,
    ]) {
      machine.transitionTo(next);
    }
    expect(machine.state).toBe(KernelState.BOOTING);
  });

  it("allows Running → LoadingConfiguration for reload() short-circuit, and back to Running", () => {
    const machine = new KernelStateMachine();
    for (const next of [
      KernelState.BOOTING,
      KernelState.LOADING_CONFIGURATION,
      KernelState.LOADING_MODULES,
      KernelState.LOADING_PLUGINS,
      KernelState.READY,
      KernelState.RUNNING,
      KernelState.LOADING_CONFIGURATION,
      KernelState.RUNNING,
    ]) {
      machine.transitionTo(next);
    }
    expect(machine.state).toBe(KernelState.RUNNING);
  });

  it("allows any state to reach Failed except the terminal handling already covers", () => {
    const machine = new KernelStateMachine();
    machine.transitionTo(KernelState.BOOTING);
    expect(machine.canTransitionTo(KernelState.FAILED)).toBe(true);
    machine.transitionTo(KernelState.FAILED);
    expect(machine.state).toBe(KernelState.FAILED);
  });

  it("allows Failed → Restarting and Failed → Stopped for recovery", () => {
    const machine = new KernelStateMachine();
    machine.transitionTo(KernelState.BOOTING);
    machine.transitionTo(KernelState.FAILED);
    expect(machine.canTransitionTo(KernelState.RESTARTING)).toBe(true);
    expect(machine.canTransitionTo(KernelState.STOPPED)).toBe(true);
  });

  it("rejects an invalid transition (Created → Running) and leaves state unchanged", () => {
    const machine = new KernelStateMachine();
    expect(machine.canTransitionTo(KernelState.RUNNING)).toBe(false);
    expect(() => machine.transitionTo(KernelState.RUNNING)).toThrow(
      /Invalid Kernel state transition/,
    );
    expect(machine.state).toBe(KernelState.CREATED);
  });

  it("rejects transitioning to the same state when not explicitly allowed", () => {
    const machine = new KernelStateMachine();
    expect(machine.canTransitionTo(KernelState.CREATED)).toBe(false);
  });
});
