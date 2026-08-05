import { EventPriority } from "../contracts/event-priority.js";

/**
 * Resolves a default Event Priority for a namespace when a producer doesn't set one
 * explicitly, before schema validation applies its own fallback (Normal). Publisher
 * (publisher/event-publisher.ts) consults this so, e.g., `system.*`/`audit.*` events default
 * to a more urgent priority than `analytics.*` without every producer repeating the same
 * `priority:` field.
 */
export class PriorityResolver {
  private readonly defaultsByNamespace: ReadonlyMap<string, EventPriority>;

  constructor(overrides: Readonly<Record<string, EventPriority>> = {}) {
    this.defaultsByNamespace = new Map(
      Object.entries({
        system: EventPriority.CRITICAL,
        audit: EventPriority.HIGH,
        tenant: EventPriority.HIGH,
        analytics: EventPriority.LOW,
        monitoring: EventPriority.BACKGROUND,
        simulation: EventPriority.BACKGROUND,
        ...overrides,
      }),
    );
  }

  resolve(namespace: string): EventPriority {
    return this.defaultsByNamespace.get(namespace) ?? EventPriority.NORMAL;
  }
}
