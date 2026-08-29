import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";
import type { Branch } from "@aos/meta-ads-connector";

import { estimatedDp, estimatedMonthly } from "../../utils/PriceCalculator.js";
import type { DmsUnitId } from "../value-objects/DmsUnitId.js";
import type { SourcePriority } from "../value-objects/SourcePriority.js";
import type { SourceSystem } from "../value-objects/SourceSystem.js";
import type { SyncTimestamp } from "../value-objects/SyncTimestamp.js";
import type { UnitBrand } from "../value-objects/UnitBrand.js";
import { UnitCondition } from "../value-objects/UnitCondition.js";
import type { UnitId } from "../value-objects/UnitId.js";
import type { UnitKilometer } from "../value-objects/UnitKilometer.js";
import type { UnitModel } from "../value-objects/UnitModel.js";
import { UnitPrice } from "../value-objects/UnitPrice.js";
import { UnitStatus } from "../value-objects/UnitStatus.js";
import { UnitTransmission } from "../value-objects/UnitTransmission.js";
import type { UnitYear } from "../value-objects/UnitYear.js";

export interface InventoryUnitProps {
  readonly id: UnitId;
  readonly dmsUnitId?: DmsUnitId;
  readonly brand: UnitBrand;
  readonly model: UnitModel;
  readonly variant: string;
  readonly year: UnitYear;
  readonly transmission: UnitTransmission;
  readonly color: string;
  readonly kilometer: UnitKilometer;
  readonly price: UnitPrice;
  readonly condition: UnitCondition;
  readonly status: UnitStatus;
  /** `BINTARO | CINERE | BANDUNG | BOOST | MULTI | UMUM` — DSS Motor's "Pondok Bambu" branch maps to `Branch.UMUM` (see `utils/BranchDetector.ts`); the real enum has no `PONDOK_BAMBU` member. */
  readonly branch: Branch;
  readonly photos: ReadonlyArray<string>;
  readonly features: ReadonlyArray<string>;
  readonly sourceSystem: SourceSystem;
  readonly sourcePriority: SourcePriority;
  readonly syncedAt: SyncTimestamp;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * The unified, source-agnostic used-car unit — the core domain model every consumer (Clara,
 * Samantha, `@aos/branch-manager`) reads through `InventoryQueryService`, never through a
 * source-specific shape. Immutable: every mutation (`ConflictResolutionService.merge`, a status
 * change) produces a new instance via `create`, never an in-place edit.
 */
export class InventoryUnit {
  private constructor(private readonly props: InventoryUnitProps) {}

  static create(props: InventoryUnitProps): Result<InventoryUnit, ValidationError> {
    if (typeof props.variant !== "string") {
      return err(new ValidationError("InventoryUnit.variant must be a string"));
    }
    if (typeof props.color !== "string" || props.color.trim().length === 0) {
      return err(new ValidationError("InventoryUnit.color must be a non-empty string"));
    }
    if (!Object.values(UnitTransmission).includes(props.transmission)) {
      return err(
        new ValidationError(`InventoryUnit.transmission is invalid: ${String(props.transmission)}`),
      );
    }
    if (!Object.values(UnitCondition).includes(props.condition)) {
      return err(
        new ValidationError(`InventoryUnit.condition is invalid: ${String(props.condition)}`),
      );
    }
    if (!Object.values(UnitStatus).includes(props.status)) {
      return err(new ValidationError(`InventoryUnit.status is invalid: ${String(props.status)}`));
    }
    if (props.updatedAt.getTime() < props.createdAt.getTime()) {
      return err(new ValidationError("InventoryUnit.updatedAt must not precede createdAt"));
    }
    return ok(
      new InventoryUnit({ ...props, photos: [...props.photos], features: [...props.features] }),
    );
  }

  get id(): UnitId {
    return this.props.id;
  }

  get dmsUnitId(): DmsUnitId | undefined {
    return this.props.dmsUnitId;
  }

  get brand(): UnitBrand {
    return this.props.brand;
  }

  get model(): UnitModel {
    return this.props.model;
  }

  get variant(): string {
    return this.props.variant;
  }

  get year(): UnitYear {
    return this.props.year;
  }

  get transmission(): UnitTransmission {
    return this.props.transmission;
  }

  get color(): string {
    return this.props.color;
  }

  get kilometer(): UnitKilometer {
    return this.props.kilometer;
  }

  get price(): UnitPrice {
    return this.props.price;
  }

  get condition(): UnitCondition {
    return this.props.condition;
  }

  get status(): UnitStatus {
    return this.props.status;
  }

  get branch(): Branch {
    return this.props.branch;
  }

  get photos(): ReadonlyArray<string> {
    return this.props.photos;
  }

  get features(): ReadonlyArray<string> {
    return this.props.features;
  }

  get sourceSystem(): SourceSystem {
    return this.props.sourceSystem;
  }

  get sourcePriority(): SourcePriority {
    return this.props.sourcePriority;
  }

  get syncedAt(): SyncTimestamp {
    return this.props.syncedAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  /** e.g. "Mitsubishi Xpander Cross AT 2019". */
  get displayName(): string {
    const parts = [
      this.props.brand.toString(),
      this.props.model.toString(),
      this.props.variant.trim(),
      this.props.transmission,
      String(this.props.year.toNumber()),
    ].filter((part) => part.length > 0);
    return parts.join(" ");
  }

  /**
   * 15% of `price`, rounded to the nearest whole Rp 1,000,000 (juta). See `utils/PriceCalculator.ts`.
   * `UnitPrice.unsafe` is correct here (not `UnitPrice.create`): `estimatedDp`'s raw output is
   * always a non-negative integer by construction, so routing it through `create` would only add
   * an unreachable `Result.err` branch.
   */
  get estimatedDp(): UnitPrice {
    return UnitPrice.unsafe(estimatedDp(this.props.price.toNumber()));
  }

  /** Flat-rate monthly installment estimate on `price - estimatedDp`. See `utils/PriceCalculator.ts` resolution #4. */
  get estimatedMonthly(): UnitPrice {
    return UnitPrice.unsafe(
      estimatedMonthly(this.props.price.toNumber(), this.estimatedDp.toNumber()),
    );
  }

  isAffordableFor(budget: number): boolean {
    return this.props.price.toNumber() <= budget;
  }

  /** Whole days since `createdAt`, floored (partial days count as 0 until a full 24h has elapsed). */
  get ageInDays(): number {
    const elapsedMs = Date.now() - this.props.createdAt.getTime();
    return Math.max(0, Math.floor(elapsedMs / (24 * 60 * 60 * 1000)));
  }
}
