import { err, ErrorCode, ok, type Result } from "@aos/common";
import { z } from "zod";

import type { IAssetRepository } from "../../contracts/IAssetRepository.js";
import type { Asset } from "../../domain/entities/Asset.js";
import { AssetError } from "../../domain/errors/AssetError.js";
import { AssetNotFoundError } from "../../domain/errors/AssetNotFoundError.js";
import type { AssetLibraryEvents } from "../../domain/events/AssetLibraryEvents.js";
import { AssetId } from "../../domain/value-objects/AssetId.js";
import { AssetTag } from "../../domain/value-objects/AssetTag.js";

export interface TagAssetInput {
  readonly id: string;
  readonly tags: readonly string[];
  readonly tenantId: string;
  readonly correlationId: string;
}

const TagAssetInputSchema = z.object({
  id: z.string().min(1),
  tags: z.array(z.string().min(1)).min(1),
  tenantId: z.string().min(1),
  correlationId: z.string().min(1),
});

/** Adds tags to an existing asset, merging with (never replacing) its existing tags. */
export class TagAsset {
  constructor(
    private readonly repository: IAssetRepository,
    private readonly events: AssetLibraryEvents,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(input: TagAssetInput): Promise<Result<Asset, AssetError>> {
    const parsed = TagAssetInputSchema.safeParse(input);
    if (!parsed.success) {
      return err(
        new AssetError(`TagAsset input validation failed: ${parsed.error.message}`, {
          code: ErrorCode.VALIDATION_ERROR,
        }),
      );
    }

    const idResult = AssetId.create(parsed.data.id);
    /* v8 ignore start -- parsed.data.id already passed the Zod schema's z.string().min(1), so
       AssetId.create's only failure mode can never trigger here. */
    if (!idResult.ok) {
      return err(new AssetNotFoundError(idResult.error.message));
    }
    /* v8 ignore stop */
    const found = await this.repository.findById(idResult.value);
    if (!found.ok) {
      return err(found.error);
    }
    if (found.value === undefined) {
      return err(new AssetNotFoundError(`Asset not found: ${parsed.data.id}`));
    }

    const newTags: AssetTag[] = [];
    for (const raw of parsed.data.tags) {
      const tagResult = AssetTag.create(raw);
      /* v8 ignore start -- every entry in parsed.data.tags already passed the Zod schema's
         z.string().min(1), so AssetTag.create's only failure mode can never trigger here. */
      if (!tagResult.ok) {
        return err(new AssetError(tagResult.error.message, { code: ErrorCode.VALIDATION_ERROR }));
      }
      /* v8 ignore stop */
      newTags.push(tagResult.value);
    }

    const existingValues = new Set(found.value.tags.map((tag) => tag.toString()));
    const merged = [
      ...found.value.tags,
      ...newTags.filter((tag) => !existingValues.has(tag.toString())),
    ];

    const now = this.now();
    const tagged = found.value.withTags(merged, now);
    const updateResult = await this.repository.update(tagged);
    if (!updateResult.ok) {
      return err(updateResult.error);
    }

    await this.events.publishAssetTagged({
      assetId: updateResult.value.id.toString(),
      tags: parsed.data.tags,
      tenantId: parsed.data.tenantId,
      correlationId: parsed.data.correlationId,
      occurredAt: now,
      version: "1.0",
    });

    return ok(updateResult.value);
  }
}
