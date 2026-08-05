import type { BaseEventShape } from "../contracts/base-event.js";

import type { IEventFilter } from "./i-filter.js";

/**
 * Capability Filter — accepts an event if it doesn't name a capability at all, or if the
 * capability id it names (`event.metadata.capabilityId`, populated by `capability.*`
 * namespace producers per the 005.4 addendum) is in the allowed set. Deliberately decoupled
 * from `@aos/registry`'s Capability Registry (no package dependency) — a future integration
 * layer is expected to populate `allowedCapabilityIds` from that Registry.
 */
export class CapabilityFilter implements IEventFilter {
  readonly name = "capability";

  constructor(private readonly allowedCapabilityIds: ReadonlySet<string>) {}

  accepts(event: BaseEventShape): boolean {
    const capabilityId = event.metadata?.["capabilityId"];
    if (typeof capabilityId !== "string") {
      return true;
    }
    return this.allowedCapabilityIds.has(capabilityId);
  }
}
