import { err, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";
import type { Branch } from "@aos/meta-ads-connector";

import { Asset } from "../../domain/entities/Asset.js";
import { AssetId } from "../../domain/value-objects/AssetId.js";
import { parseAssetStatus } from "../../domain/value-objects/AssetStatus.js";
import { AssetTag } from "../../domain/value-objects/AssetTag.js";
import { parseAssetType } from "../../domain/value-objects/AssetType.js";
import { FileSize } from "../../domain/value-objects/FileSize.js";
import { MimeType } from "../../domain/value-objects/MimeType.js";
import { PublicUrl } from "../../domain/value-objects/PublicUrl.js";
import { StoragePath } from "../../domain/value-objects/StoragePath.js";

/** The `assets` table row shape (Constitution §6.7: `snake_case`, tenant-scoped). */
export interface AssetRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly type: string;
  readonly status: string;
  readonly storage_path: string;
  readonly public_url: string;
  readonly file_name: string;
  readonly mime_type: string;
  readonly file_size: number;
  readonly tags: readonly string[];
  readonly unit_id: string | null;
  readonly unit_model: string | null;
  readonly unit_year: number | null;
  readonly branch: string | null;
  readonly ai_prompt: string | null;
  readonly ai_model: string | null;
  readonly creative_brief_id: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

/** Maps between the domain `Asset` entity and its Supabase `assets` table row — the sole place that knows the DB column shape. */
export class AssetMapper {
  static toDomain(row: AssetRow): Result<Asset, ValidationError> {
    const idResult = AssetId.create(row.id);
    if (!idResult.ok) {
      return err(idResult.error);
    }
    const type = parseAssetType(row.type);
    if (type === undefined) {
      return err(new ValidationError(`AssetMapper: unknown asset type in row: ${row.type}`));
    }
    const status = parseAssetStatus(row.status);
    if (status === undefined) {
      return err(new ValidationError(`AssetMapper: unknown asset status in row: ${row.status}`));
    }
    const storagePathResult = StoragePath.create(row.storage_path);
    if (!storagePathResult.ok) {
      return err(storagePathResult.error);
    }
    const publicUrlResult = PublicUrl.create(row.public_url);
    if (!publicUrlResult.ok) {
      return err(publicUrlResult.error);
    }
    const mimeTypeResult = MimeType.create(row.mime_type);
    if (!mimeTypeResult.ok) {
      return err(mimeTypeResult.error);
    }
    const fileSizeResult = FileSize.create(row.file_size);
    if (!fileSizeResult.ok) {
      return err(fileSizeResult.error);
    }
    const tags: AssetTag[] = [];
    for (const raw of row.tags) {
      const tagResult = AssetTag.create(raw);
      if (!tagResult.ok) {
        return err(tagResult.error);
      }
      tags.push(tagResult.value);
    }
    const branch = row.branch === null ? undefined : (row.branch as Branch);

    return Asset.create({
      id: idResult.value,
      tenantId: row.tenant_id,
      type,
      status,
      storagePath: storagePathResult.value,
      publicUrl: publicUrlResult.value,
      fileName: row.file_name,
      mimeType: mimeTypeResult.value,
      fileSize: fileSizeResult.value,
      tags,
      unitId: row.unit_id ?? undefined,
      unitModel: row.unit_model ?? undefined,
      unitYear: row.unit_year ?? undefined,
      branch,
      aiPrompt: row.ai_prompt ?? undefined,
      aiModel: row.ai_model ?? undefined,
      creativeBriefId: row.creative_brief_id ?? undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  }

  static toRow(asset: Asset): AssetRow {
    return {
      id: asset.id.toString(),
      tenant_id: asset.tenantId,
      type: asset.type,
      status: asset.status,
      storage_path: asset.storagePath.toString(),
      public_url: asset.publicUrl.toString(),
      file_name: asset.fileName,
      mime_type: asset.mimeType.toString(),
      file_size: asset.fileSize.bytes,
      tags: asset.tags.map((tag) => tag.toString()),
      unit_id: asset.unitId ?? null,
      unit_model: asset.unitModel ?? null,
      unit_year: asset.unitYear ?? null,
      branch: asset.branch ?? null,
      ai_prompt: asset.aiPrompt ?? null,
      ai_model: asset.aiModel ?? null,
      creative_brief_id: asset.creativeBriefId ?? null,
      created_at: asset.createdAt.toISOString(),
      updated_at: asset.updatedAt.toISOString(),
    };
  }
}
