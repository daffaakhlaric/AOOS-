import type { BaseEventShape, ISubscriptionManager } from "@aos/event-bus";

/**
 * Invokes every handler the real `ISubscriptionManager` (`EventBroker.subscriptions`) has
 * registered for `event`, via its real `match()` routing — without going through
 * `EventBroker.publish()`'s Zod `baseEventSchema` validation.
 *
 * This is necessary because `baseEventSchema.type`'s regex (`event-bus/src/contracts/base-
 * event.ts`) is `^[a-z][a-z0-9_]*(\.[a-zA-Z0-9_]+)+$` — it does not allow hyphens in any
 * segment after the first. Every real AAOS topic string verified in the coordinator note
 * (`aaos.lead-store.lead.created`, `aaos.capi-connector.event.sent`, ...) has a hyphenated
 * package-name segment, so publishing them through a real `EventBroker.publish()` call
 * throws `ValidationException` — a pre-existing gap between `@aos/event-bus`'s schema and
 * every hyphenated AAOS package's own publish-side topic convention (`@aos/lead-store`'s
 * `LeadStoreEvents`, `@aos/closing-tracker`'s `ClosingTrackerEvents`, and this package's own
 * `CapiConnectorEvents` all hit it identically), confirmed by neither `lead-store`'s nor
 * `closing-tracker`'s own test suites ever exercising a real `EventBroker` — both always
 * inject a fake `IPublisher` instead. Fixing `@aos/event-bus`'s schema is out of scope for
 * this package; this helper exercises the real `SubscriptionManager.subscribe`/`.match`
 * routing (coordinator note #1's actual concern) while sidestepping the unrelated bug.
 */
export async function dispatchViaSubscriptionManager(
  manager: ISubscriptionManager,
  event: BaseEventShape,
): Promise<void> {
  for (const subscription of manager.match(event)) {
    await subscription.handler(event);
  }
}
