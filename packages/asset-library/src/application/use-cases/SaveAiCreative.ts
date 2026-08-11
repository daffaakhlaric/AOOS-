import { err, ErrorCode, ok, type Result } from "@aos/common";
import { Branch } from "@aos/meta-ads-connector";
import { z } from "zod";

import type { IAssetRepository } from "../../contracts/IAssetRepository.js";
import type { IAssetTagger } from "../../contracts/IAssetTagger.js";
import { Asset } from "../../domain/entities/Asset.js";
import { AssetCollection } from "../../domain/entities/AssetCollection.js";
import { AssetError } from "../../domain/errors/AssetError.js";
import type { AssetLibraryEvents } from "../../domain/events/AssetLibraryEvents.js";
import { AssetId } from "../../domain/value-objects/AssetId.js";
import { AssetStatus } from "../../domain/value-objects/AssetStatus.js";
import { AssetType } from "../../domain/value-objects/AssetType.js";
import { StoragePath } from "../../domain/value-objects/StoragePath.js";
import type { StorageService } from "../services/StorageService.js";

export interface SaveAiCreativeInput {
  readonly videoBuffer?: Buffer;
  readonly imageBuffers: readonly Buffer[];
  readonly creativeBriefId: string;
  readonly unitId?: string;
  readonly branch: Branch;
  readonly aiPrompt: string;
  readonly aiModel: string;
  readonly tenantId: string;
  readonly correlationId: string;
}

const SaveAiCreativeInputSchema = z.object({
  creativeBriefId: z.string().min(1),
  unitId: z.string().min(1).optional(),
  branch: z.nativeEnum(Branch),
  aiPrompt: z.string().min(1),
  aiModel: z.string().min(1),
  tenantId: z.string().min(1),
  correlationId: z.string().min(1),
});

const IMAGE_MIME_TYPE = "image/jpeg";
const IMAGE_EXTENSION = "jpg";
const VIDEO_MIME_TYPE = "video/mp4";
const VIDEO_EXTENSION = "mp4";

/**
 * Called by Kai after generating creative (spec). Uploads the video + all images to
 * `ai-creatives/{creativeBriefId}/{type}-{n}.{ext}` (design resolution #2's pinned naming, using
 * `creativeBriefId` — not a separate creative-id — as the folder segment), tags every asset with
 * `creativeBriefId`, and emits a single `CollectionUpdated` event for the whole batch.
 */
export class SaveAiCreative {
  constructor(
    private readonly repository: IAssetRepository,
    private readonly storageService: StorageService,
    private readonly tagger: IAssetTagger,
    private readonly events: AssetLibraryEvents,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(input: SaveAiCreativeInput): Promise<Result<AssetCollection, AssetError>> {
    const parsed = SaveAiCreativeInputSchema.safeParse(input);
    if (!parsed.success) {
      return err(
        new AssetError(`SaveAiCreative input validation failed: ${parsed.error.message}`, {
          code: ErrorCode.VALIDATION_ERROR,
        }),
      );
    }
    const data = parsed.data;

    if (input.imageBuffers.length === 0 && input.videoBuffer === undefined) {
      return err(
        new AssetError("SaveAiCreative: at least one of videoBuffer or imageBuffers is required", {
          code: ErrorCode.VALIDATION_ERROR,
        }),
      );
    }

    const now = this.now();
    const saved: Asset[] = [];

    for (const [index, imageBuffer] of input.imageBuffers.entries()) {
      const path = StoragePath.aiCreative(
        data.creativeBriefId,
        "image",
        index + 1,
        IMAGE_EXTENSION,
      );
      const asset = await this.uploadCreativeAsset({
        path,
        buffer: imageBuffer,
        mimeType: IMAGE_MIME_TYPE,
        type: AssetType.AI_IMAGE,
        data,
        now,
      });
      if (!asset.ok) {
        return err(asset.error);
      }
      saved.push(asset.value);
    }

    if (input.videoBuffer !== undefined) {
      const path = StoragePath.aiCreative(data.creativeBriefId, "video", 1, VIDEO_EXTENSION);
      const asset = await this.uploadCreativeAsset({
        path,
        buffer: input.videoBuffer,
        mimeType: VIDEO_MIME_TYPE,
        type: AssetType.AI_VIDEO,
        data,
        now,
      });
      if (!asset.ok) {
        return err(asset.error);
      }
      saved.push(asset.value);
    }

    await this.events.publishCollectionUpdated({
      assetIds: saved.map((asset) => asset.id.toString()),
      creativeBriefId: data.creativeBriefId,
      unitId: data.unitId,
      tenantId: data.tenantId,
      correlationId: data.correlationId,
      occurredAt: now,
      version: "1.0",
    });

    return ok(AssetCollection.of(saved));
  }

  private async uploadCreativeAsset(params: {
    readonly path: StoragePath;
    readonly buffer: Buffer;
    readonly mimeType: string;
    readonly type: AssetType.AI_IMAGE | AssetType.AI_VIDEO;
    readonly data: z.infer<typeof SaveAiCreativeInputSchema>;
    readonly now: Date;
  }): Promise<Result<Asset, AssetError>> {
    const storedResult = await this.storageService.store(
      params.path,
      params.buffer,
      params.mimeType,
    );
    if (!storedResult.ok) {
      return err(storedResult.error);
    }
    const stored = storedResult.value;

    const tags = this.tagger.deriveTags({ type: params.type, branch: params.data.branch });

    const assetResult = Asset.create({
      id: AssetId.generate(),
      tenantId: params.data.tenantId,
      type: params.type,
      status: AssetStatus.ACTIVE,
      storagePath: params.path,
      publicUrl: stored.publicUrl,
      fileName: params.path.toString().split("/").pop() ?? params.path.toString(),
      mimeType: stored.mimeType,
      fileSize: stored.fileSize,
      tags,
      unitId: params.data.unitId,
      branch: params.data.branch,
      aiPrompt: params.data.aiPrompt,
      aiModel: params.data.aiModel,
      creativeBriefId: params.data.creativeBriefId,
      createdAt: params.now,
      updatedAt: params.now,
    });
    /* v8 ignore start -- every field passed to Asset.create above is either a hardcoded literal
       (AI_IMAGE/AI_VIDEO type, ACTIVE status) or sourced from already Zod-validated input, and
       this method never sets unitYear, so Asset.create's failure modes can never trigger here. */
    if (!assetResult.ok) {
      return err(new AssetError(assetResult.error.message, { code: ErrorCode.VALIDATION_ERROR }));
    }
    /* v8 ignore stop */

    return this.repository.insert(assetResult.value);
  }
}
