import type { BaseEventShape } from "../contracts/base-event.js";

/**
 * Permission Validation (docs/PROMPT-005.4-ENTERPRISE-EVENT-BUS.md — "interface" only).
 * No implementation ships in this package: enforcing "can this producer publish this event
 * type / can this subscriber receive it" requires the Permission Registry
 * (`@aos/registry`'s `RegistryKind.PERMISSION`), which the Event Bus does not depend on to
 * avoid a circular package dependency. A future integration package implements this against
 * both.
 */
export interface IPermissionValidator {
  canPublish(event: BaseEventShape, producerId: string): boolean | Promise<boolean>;
  canSubscribe(eventTypePattern: string, subscriberId: string): boolean | Promise<boolean>;
}
