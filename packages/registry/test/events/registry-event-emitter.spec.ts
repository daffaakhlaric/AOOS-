import { describe, expect, it, vi } from "vitest";

import { RegistryKind } from "../../src/contracts/registry-kind.js";
import { RegistryEventEmitter } from "../../src/events/registry-event-emitter.js";
import { RegistryEventName } from "../../src/events/registry-event-name.js";

describe("RegistryEventEmitter", () => {
  it("delivers an emitted event with a timestamp", () => {
    const emitter = new RegistryEventEmitter();
    const listener = vi.fn();
    emitter.on(RegistryEventName.REGISTRY_LOADED, listener);

    emitter.emit(RegistryEventName.REGISTRY_LOADED, { kind: RegistryKind.AGENT, count: 3 });

    expect(listener).toHaveBeenCalledOnce();
    const event = listener.mock.calls[0]![0];
    expect(event.payload.count).toBe(3);
    expect(typeof event.emittedAt).toBe("string");
  });

  it("off() stops delivery", () => {
    const emitter = new RegistryEventEmitter();
    const listener = vi.fn();
    emitter.on(RegistryEventName.REGISTRY_REMOVED, listener);
    emitter.off(RegistryEventName.REGISTRY_REMOVED, listener);
    emitter.emit(RegistryEventName.REGISTRY_REMOVED, { kind: RegistryKind.TOOL, id: "x" });
    expect(listener).not.toHaveBeenCalled();
  });

  it("listenerCount and removeAllListeners work as expected", () => {
    const emitter = new RegistryEventEmitter();
    emitter.on(RegistryEventName.VALIDATION_FAILED, () => undefined);
    expect(emitter.listenerCount(RegistryEventName.VALIDATION_FAILED)).toBe(1);
    emitter.removeAllListeners();
    expect(emitter.listenerCount(RegistryEventName.VALIDATION_FAILED)).toBe(0);
  });
});
