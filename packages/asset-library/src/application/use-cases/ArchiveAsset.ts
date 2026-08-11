import { err, ok, type Result } from "@aos/common";

import type { IAssetRepository } from "../../contracts/IAssetRepository.js";
import type { Asset } from "../../domain/entities/Asset.js";
import type { AssetError } from "../../domain/errors/AssetError.js";
import { AssetNotFoundError } from "../../domain/errors/AssetNotFoundError.js";
import type { AssetLibraryEvents } from "../../domain/events/AssetLibraryEvents.js";
import { AssetId } from "../../domain/value-objects/AssetId.js";
import { AssetStatus } from "../../domain/value-objects/AssetStatus.js";

export interface ArchiveAssetInput {
  readonly id: string;
  readonly tenantId: string;
  readonly correlationId: string;
}

/** Marks a single asset `ARCHIVED` without deleting it from storage (spec: "keep for history"). */
export class ArchiveAsset {
  constructor(
    private readonly repository: IAssetRepository,
    private readonly events: AssetLibraryEvents,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(input: ArchiveAssetInput): Promise<Result<Asset, AssetError>> {
    const idResult = AssetId.create(input.id);
    if (!idResult.ok) {
      return err(new AssetNotFoundError(idResult.error.message));
    }
    const found = await this.repository.findById(idResult.value);
    if (!found.ok) {
      return err(found.error);
    }
    if (found.value === undefined) {
      return err(new AssetNotFoundError(`Asset not found: ${input.id}`));
    }

    const now = this.now();
    const archived = found.value.withStatus(AssetStatus.ARCHIVED, now);
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

    return ok(updateResult.value);
  }
}
