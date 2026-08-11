import { err, type Result } from "@aos/common";
import type { ValidationError } from "@aos/errors";
import { Branch } from "@aos/meta-ads-connector";

import { Asset } from "../domain/entities/Asset.js";
import { AssetId } from "../domain/value-objects/AssetId.js";
import { AssetStatus } from "../domain/value-objects/AssetStatus.js";
import { AssetTag } from "../domain/value-objects/AssetTag.js";
import { AssetType } from "../domain/value-objects/AssetType.js";
import { FileSize } from "../domain/value-objects/FileSize.js";
import { MimeType } from "../domain/value-objects/MimeType.js";
import { PublicUrl } from "../domain/value-objects/PublicUrl.js";
import { StoragePath } from "../domain/value-objects/StoragePath.js";

/** Fluent builder (Builder Pattern) for `Asset`, with sensible defaults so callers only override what matters for their scenario — mirrors `@aos/lead-store`'s `LeadBuilder`. */
export class AssetBuilder {
  private id: AssetId = AssetId.generate();
  private tenantId = "dss-motor";
  private type: AssetType = AssetType.UNIT_PHOTO;
  private status: AssetStatus = AssetStatus.ACTIVE;
  private storagePath = "units/unit-001/photo-1700000000000.jpg";
  private publicUrl =
    "https://example.supabase.co/storage/v1/object/public/mobix-assets/units/unit-001/photo-1700000000000.jpg";
  private fileName = "photo-1700000000000.jpg";
  private mimeType = "image/jpeg";
  private fileSize = 1024;
  private tags: string[] = [];
  private unitId: string | undefined = "unit-001";
  private unitModel: string | undefined;
  private unitYear: number | undefined;
  private branch: Branch | undefined = Branch.BINTARO;
  private aiPrompt: string | undefined;
  private aiModel: string | undefined;
  private creativeBriefId: string | undefined;
  private createdAt = new Date("2026-01-01T00:00:00.000Z");
  private updatedAt = new Date("2026-01-01T00:00:00.000Z");

  withId(id: AssetId): this {
    this.id = id;
    return this;
  }

  withTenantId(tenantId: string): this {
    this.tenantId = tenantId;
    return this;
  }

  withType(type: AssetType): this {
    this.type = type;
    return this;
  }

  withStatus(status: AssetStatus): this {
    this.status = status;
    return this;
  }

  withStoragePath(storagePath: string): this {
    this.storagePath = storagePath;
    return this;
  }

  withPublicUrl(publicUrl: string): this {
    this.publicUrl = publicUrl;
    return this;
  }

  withFileName(fileName: string): this {
    this.fileName = fileName;
    return this;
  }

  withMimeType(mimeType: string): this {
    this.mimeType = mimeType;
    return this;
  }

  withFileSize(fileSize: number): this {
    this.fileSize = fileSize;
    return this;
  }

  withTags(tags: string[]): this {
    this.tags = tags;
    return this;
  }

  withUnitId(unitId: string | undefined): this {
    this.unitId = unitId;
    return this;
  }

  withUnitModel(unitModel: string | undefined): this {
    this.unitModel = unitModel;
    return this;
  }

  withUnitYear(unitYear: number | undefined): this {
    this.unitYear = unitYear;
    return this;
  }

  withBranch(branch: Branch | undefined): this {
    this.branch = branch;
    return this;
  }

  withAiPrompt(aiPrompt: string | undefined): this {
    this.aiPrompt = aiPrompt;
    return this;
  }

  withAiModel(aiModel: string | undefined): this {
    this.aiModel = aiModel;
    return this;
  }

  withCreativeBriefId(creativeBriefId: string | undefined): this {
    this.creativeBriefId = creativeBriefId;
    return this;
  }

  withCreatedAt(createdAt: Date): this {
    this.createdAt = createdAt;
    return this;
  }

  withUpdatedAt(updatedAt: Date): this {
    this.updatedAt = updatedAt;
    return this;
  }

  build(): Result<Asset, ValidationError> {
    const storagePathResult = StoragePath.create(this.storagePath);
    if (!storagePathResult.ok) {
      return err(storagePathResult.error);
    }
    const publicUrlResult = PublicUrl.create(this.publicUrl);
    if (!publicUrlResult.ok) {
      return err(publicUrlResult.error);
    }
    const mimeTypeResult = MimeType.create(this.mimeType);
    if (!mimeTypeResult.ok) {
      return err(mimeTypeResult.error);
    }
    const fileSizeResult = FileSize.create(this.fileSize);
    if (!fileSizeResult.ok) {
      return err(fileSizeResult.error);
    }
    const tags: AssetTag[] = [];
    for (const raw of this.tags) {
      const tagResult = AssetTag.create(raw);
      if (!tagResult.ok) {
        return err(tagResult.error);
      }
      tags.push(tagResult.value);
    }

    return Asset.create({
      id: this.id,
      tenantId: this.tenantId,
      type: this.type,
      status: this.status,
      storagePath: storagePathResult.value,
      publicUrl: publicUrlResult.value,
      fileName: this.fileName,
      mimeType: mimeTypeResult.value,
      fileSize: fileSizeResult.value,
      tags,
      unitId: this.unitId,
      unitModel: this.unitModel,
      unitYear: this.unitYear,
      branch: this.branch,
      aiPrompt: this.aiPrompt,
      aiModel: this.aiModel,
      creativeBriefId: this.creativeBriefId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    });
  }
}
