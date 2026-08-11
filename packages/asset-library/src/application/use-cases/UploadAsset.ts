import { err, ErrorCode, ok, type Result } from "@aos/common";
import { Branch } from "@aos/meta-ads-connector";
import { z } from "zod";

import type { IAssetRepository } from "../../contracts/IAssetRepository.js";
import type { IAssetTagger } from "../../contracts/IAssetTagger.js";
import { Asset } from "../../domain/entities/Asset.js";
import { AssetError } from "../../domain/errors/AssetError.js";
import type { AssetLibraryEvents } from "../../domain/events/AssetLibraryEvents.js";
import { AssetId } from "../../domain/value-objects/AssetId.js";
import { AssetStatus } from "../../domain/value-objects/AssetStatus.js";
import { AssetTag } from "../../domain/value-objects/AssetTag.js";
import { AssetType } from "../../domain/value-objects/AssetType.js";
import { StoragePath } from "../../domain/value-objects/StoragePath.js";
import type { StorageService } from "../services/StorageService.js";

export interface UploadAssetInput {
  readonly file: Buffer;
  readonly fileName: string;
  readonly mimeType: string;
  readonly type: AssetType;
  readonly unitId?: string;
  readonly unitModel?: string;
  readonly unitYear?: number;
  readonly branch?: Branch;
  readonly tags?: readonly string[];
  readonly tenantId: string;
  readonly correlationId: string;
}

const UploadAssetInputSchema = z.object({
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  type: z.nativeEnum(AssetType),
  unitId: z.string().min(1).optional(),
  unitModel: z.string().min(1).optional(),
  unitYear: z.number().int().optional(),
  branch: z.nativeEnum(Branch).optional(),
  tags: z.array(z.string().min(1)).optional(),
  tenantId: z.string().min(1),
  correlationId: z.string().min(1),
});

/**
 * Uploads a file to Supabase Storage and persists its metadata (spec: "Upload to Supabase Storage
 * → get public URL → save metadata"). Storage-path selection dispatches on `type`:
 *   - `UNIT_PHOTO` -> `units/{unitId}/photo-{timestamp}.{ext}` (requires `unitId`)
 *   - `BRAND` / `OVERLAY` -> `brand/{fileName}` (bucket diagram groups overlays under `brand/`)
 *   - `TESTIMONIAL` -> `testimonials/{fileName}`
 *   - `AI_VIDEO` / `AI_IMAGE` -> `ai-creatives/manual/{type}-1.{ext}` — a generic manual-upload
 *     fallback; the spec's pinned `ai-creatives/{briefId}/{type}-{n}.{ext}` naming is produced by
 *     `SaveAiCreative`, which has a real `creativeBriefId` to slot in (this use case's `Input`
 *     never carries one).
 */
export class UploadAsset {
  constructor(
    private readonly repository: IAssetRepository,
    private readonly storageService: StorageService,
    private readonly tagger: IAssetTagger,
    private readonly events: AssetLibraryEvents,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(input: UploadAssetInput): Promise<Result<Asset, AssetError>> {
    const parsed = UploadAssetInputSchema.safeParse(input);
    if (!parsed.success) {
      return err(
        new AssetError(`UploadAsset input validation failed: ${parsed.error.message}`, {
          code: ErrorCode.VALIDATION_ERROR,
        }),
      );
    }
    const data = parsed.data;

    if (data.type === AssetType.UNIT_PHOTO && data.unitId === undefined) {
      return err(
        new AssetError("UploadAsset: unitId is required when type is UNIT_PHOTO", {
          code: ErrorCode.VALIDATION_ERROR,
        }),
      );
    }

    const now = this.now();
    const extensionGuess = extensionFromMime(data.mimeType);
    const path = buildStoragePath(data.type, {
      unitId: data.unitId,
      fileName: data.fileName,
      timestampMs: now.getTime(),
      extension: extensionGuess,
    });

    const storedResult = await this.storageService.store(path, input.file, data.mimeType);
    if (!storedResult.ok) {
      return err(storedResult.error);
    }
    const stored = storedResult.value;

    const manualTags: AssetTag[] = [];
    for (const raw of data.tags ?? []) {
      const tagResult = AssetTag.create(raw);
      /* v8 ignore start -- every entry in data.tags already passed the Zod schema's
         z.string().min(1), so AssetTag.create's only failure mode can never trigger here. */
      if (!tagResult.ok) {
        return err(new AssetError(tagResult.error.message, { code: ErrorCode.VALIDATION_ERROR }));
      }
      /* v8 ignore stop */
      manualTags.push(tagResult.value);
    }
    const derivedTags = this.tagger.deriveTags({
      type: data.type,
      unitModel: data.unitModel,
      unitYear: data.unitYear,
      branch: data.branch,
    });

    const assetResult = Asset.create({
      id: AssetId.generate(),
      tenantId: data.tenantId,
      type: data.type,
      status: AssetStatus.ACTIVE,
      storagePath: path,
      publicUrl: stored.publicUrl,
      fileName: data.fileName,
      mimeType: stored.mimeType,
      fileSize: stored.fileSize,
      tags: [...derivedTags, ...manualTags],
      unitId: data.unitId,
      unitModel: data.unitModel,
      unitYear: data.unitYear,
      branch: data.branch,
      createdAt: now,
      updatedAt: now,
    });
    if (!assetResult.ok) {
      return err(new AssetError(assetResult.error.message, { code: ErrorCode.VALIDATION_ERROR }));
    }

    const insertResult = await this.repository.insert(assetResult.value);
    if (!insertResult.ok) {
      return err(insertResult.error);
    }

    await this.events.publishAssetUploaded({
      assetId: insertResult.value.id.toString(),
      assetType: data.type,
      unitId: data.unitId,
      branch: data.branch,
      storagePath: path.toString(),
      publicUrl: stored.publicUrl.toString(),
      tenantId: data.tenantId,
      correlationId: data.correlationId,
      occurredAt: now,
      version: "1.0",
    });

    return ok(insertResult.value);
  }
}

function extensionFromMime(mimeType: string): string {
  const map: Readonly<Record<string, string>> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "video/mp4": "mp4",
  };
  return map[mimeType] ?? "bin";
}

interface StoragePathContext {
  readonly unitId?: string;
  readonly fileName: string;
  readonly timestampMs: number;
  readonly extension: string;
}

function buildStoragePath(type: AssetType, ctx: StoragePathContext): StoragePath {
  switch (type) {
    case AssetType.UNIT_PHOTO:
      /* v8 ignore next -- UNIT_PHOTO always has unitId by this point: the caller validates it
         above and returns early otherwise, so the fallback empty string can never be reached. */
      return StoragePath.unitPhoto(ctx.unitId ?? "", ctx.timestampMs, ctx.extension);
    case AssetType.BRAND:
    case AssetType.OVERLAY:
      return StoragePath.brandAsset(ctx.fileName);
    case AssetType.TESTIMONIAL:
      return StoragePath.testimonial(ctx.fileName);
    case AssetType.AI_VIDEO:
      return StoragePath.aiCreative("manual", "video", 1, ctx.extension);
    case AssetType.AI_IMAGE:
      return StoragePath.aiCreative("manual", "image", 1, ctx.extension);
  }
}
