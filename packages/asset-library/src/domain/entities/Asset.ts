import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";
import type { Branch } from "@aos/meta-ads-connector";

import type { AssetId } from "../value-objects/AssetId.js";
import type { AssetStatus } from "../value-objects/AssetStatus.js";
import type { AssetTag } from "../value-objects/AssetTag.js";
import { AssetType } from "../value-objects/AssetType.js";
import type { FileSize } from "../value-objects/FileSize.js";
import type { MimeType } from "../value-objects/MimeType.js";
import type { PublicUrl } from "../value-objects/PublicUrl.js";
import type { StoragePath } from "../value-objects/StoragePath.js";

export interface AssetProps {
  readonly id: AssetId;
  readonly tenantId: string;
  readonly type: AssetType;
  readonly status: AssetStatus;
  readonly storagePath: StoragePath;
  readonly publicUrl: PublicUrl;
  readonly fileName: string;
  readonly mimeType: MimeType;
  readonly fileSize: FileSize;
  readonly tags: ReadonlyArray<AssetTag>;
  readonly unitId?: string;
  readonly unitModel?: string;
  readonly unitYear?: number;
  readonly branch?: Branch;
  readonly aiPrompt?: string;
  readonly aiModel?: string;
  readonly creativeBriefId?: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** The single source of truth for one creative asset (spec's "Asset Domain Model"). Immutable — every mutation (`withStatus`, `withTags`, ...) returns a NEW `Asset`. */
export class Asset {
  private constructor(private readonly props: AssetProps) {}

  static create(props: AssetProps): Result<Asset, ValidationError> {
    if (typeof props.tenantId !== "string" || props.tenantId.trim().length === 0) {
      return err(new ValidationError("Asset.tenantId must be a non-empty string"));
    }
    if (typeof props.fileName !== "string" || props.fileName.trim().length === 0) {
      return err(new ValidationError("Asset.fileName must be a non-empty string"));
    }
    if (
      props.type === AssetType.UNIT_PHOTO &&
      (props.unitId === undefined || props.unitId.trim().length === 0)
    ) {
      return err(new ValidationError("Asset.unitId is required when type is UNIT_PHOTO"));
    }
    if (
      props.unitYear !== undefined &&
      (!Number.isInteger(props.unitYear) || props.unitYear < 1900)
    ) {
      return err(
        new ValidationError(
          `Asset.unitYear must be a plausible year, received: ${String(props.unitYear)}`,
        ),
      );
    }
    return ok(new Asset({ ...props, tags: [...props.tags] }));
  }

  get id(): AssetId {
    return this.props.id;
  }

  get tenantId(): string {
    return this.props.tenantId;
  }

  get type(): AssetType {
    return this.props.type;
  }

  get status(): AssetStatus {
    return this.props.status;
  }

  get storagePath(): StoragePath {
    return this.props.storagePath;
  }

  get publicUrl(): PublicUrl {
    return this.props.publicUrl;
  }

  get fileName(): string {
    return this.props.fileName;
  }

  get mimeType(): MimeType {
    return this.props.mimeType;
  }

  get fileSize(): FileSize {
    return this.props.fileSize;
  }

  get tags(): ReadonlyArray<AssetTag> {
    return this.props.tags;
  }

  get unitId(): string | undefined {
    return this.props.unitId;
  }

  get unitModel(): string | undefined {
    return this.props.unitModel;
  }

  get unitYear(): number | undefined {
    return this.props.unitYear;
  }

  get branch(): Branch | undefined {
    return this.props.branch;
  }

  get aiPrompt(): string | undefined {
    return this.props.aiPrompt;
  }

  get aiModel(): string | undefined {
    return this.props.aiModel;
  }

  get creativeBriefId(): string | undefined {
    return this.props.creativeBriefId;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  withStatus(status: AssetStatus, updatedAt: Date): Asset {
    return new Asset({ ...this.props, status, updatedAt });
  }

  withTags(tags: ReadonlyArray<AssetTag>, updatedAt: Date): Asset {
    return new Asset({ ...this.props, tags: [...tags], updatedAt });
  }
}
