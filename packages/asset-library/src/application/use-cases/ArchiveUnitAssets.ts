import { err, ok, type Result } from "@aos/common";

import type { IAssetRepository } from "../../contracts/IAssetRepository.js";
import type { AssetError } from "../../domain/errors/AssetError.js";
import type { AssetLibraryEvents } from "../../domain/events/AssetLibraryEvents.js";
import { AssetStatus } from "../../domain/value-objects/AssetStatus.js";

export interface ArchiveUnitAssetsInput {
  readonly unitId: string;
  readonly tenantId: string;
  readonly correlationId: string;
}

/**
 * Marks every `ACTIVE` asset for a unit `ARCHIVED` (spec: "Mark all unit photos as ARCHIVED. Do
 * not delete from storage. Emit AssetArchived events").
 *
 * Scope boundary (design resolution #3): the spec describes this as "called when UnitSold event
 * received from lead-store", but that is a FUTURE caller's responsibility, not this package's.
 * `@aos/asset-library`'s `package.json` does not depend on `@aos/lead-store`, and its own stated
 * scope ("Does NOT: Make Meta Ads API calls", narrow dependency list) confirms it is a passive
 * library, not an active cross-package event subscriber. This use case is a plain callable that
 * some future orchestration layer (not built here) invokes after observing `lead-store`'s own
 * sold/closing event — it does NOT subscribe to `@aos/lead-store`'s event stream itself.
 */
export class ArchiveUnitAssets {
  constructor(
    private readonly repository: IAssetRepository,
    private readonly events: AssetLibraryEvents,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(input: ArchiveUnitAssetsInput): Promise<Result<void, AssetError>> {
    const found = await this.repository.findByUnitId(input.unitId, AssetStatus.ACTIVE);
    if (!found.ok) {
      return err(found.error);
    }

    const now = this.now();
    for (const asset of found.value) {
      const archived = asset.withStatus(AssetStatus.ARCHIVED, now);
      const updateResult = await this.repository.update(archived);
      if (!updateResult.ok) {
        return err(updateResult.error);
      }
      await this.events.publishAssetArchived({
        assetId: updateResult.value.id.toString(),
        unitId: updateResult.value.unitId,
        tenantId: input.tenantId,
        correlationId: input.correlationId,
        occurredAt: now,
        version: "1.0",
      });
    }

    return ok(undefined);
  }
}
