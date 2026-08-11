import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Internal AAOS-generated UUID identifying a Campaign (distinct from Meta's raw `metaId`). */
export class CampaignId {
  private constructor(private readonly value: string) {}

  static create(raw: string): Result<CampaignId, ValidationError> {
    if (typeof raw !== "string" || !UUID_PATTERN.test(raw)) {
      return err(
        new ValidationError(`CampaignId must be a UUID, received: ${JSON.stringify(raw)}`),
      );
    }
    return ok(new CampaignId(raw));
  }

  static generate(): CampaignId {
    return new CampaignId(crypto.randomUUID());
  }

  toString(): string {
    return this.value;
  }

  equals(other: CampaignId): boolean {
    return this.value === other.value;
  }
}
