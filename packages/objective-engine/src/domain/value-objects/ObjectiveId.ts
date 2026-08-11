import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";
import type { Uuid } from "@aos/types";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Internal AAOS-generated UUID identifying an Objective. The underlying string is branded via
 * `@aos/types`' `Uuid<"ObjectiveId">` helper — the one genuine, natural use this package found
 * for `@aos/types` (see package report): it buys compile-time protection against accidentally
 * passing a raw UUID string (or a different id's `.toString()`) where an `ObjectiveId`'s backing
 * value is expected, mirroring how `@aos/meta-ads-connector`'s sibling id Value Objects
 * (`CampaignId`, `AdId`, ...) are structured, but with the brand made explicit at the type level.
 */
export class ObjectiveId {
  private constructor(private readonly value: Uuid<"ObjectiveId">) {}

  static create(raw: string): Result<ObjectiveId, ValidationError> {
    if (typeof raw !== "string" || !UUID_PATTERN.test(raw)) {
      return err(
        new ValidationError(`ObjectiveId must be a UUID, received: ${JSON.stringify(raw)}`),
      );
    }
    return ok(new ObjectiveId(raw as Uuid<"ObjectiveId">));
  }

  static generate(): ObjectiveId {
    return new ObjectiveId(crypto.randomUUID() as Uuid<"ObjectiveId">);
  }

  toString(): string {
    return this.value;
  }

  equals(other: ObjectiveId): boolean {
    return this.value === other.value;
  }
}
