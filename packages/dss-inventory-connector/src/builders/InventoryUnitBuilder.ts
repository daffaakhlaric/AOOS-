import { err, type Result } from "@aos/common";
import type { ValidationError } from "@aos/errors";
import { Branch } from "@aos/meta-ads-connector";

import { InventoryUnit } from "../domain/entities/InventoryUnit.js";
import type { DmsUnitId } from "../domain/value-objects/DmsUnitId.js";
import { sourcePriorityFor } from "../domain/value-objects/SourcePriority.js";
import { SourceSystem } from "../domain/value-objects/SourceSystem.js";
import { SyncTimestamp } from "../domain/value-objects/SyncTimestamp.js";
import { UnitBrand } from "../domain/value-objects/UnitBrand.js";
import { UnitCondition } from "../domain/value-objects/UnitCondition.js";
import { UnitId } from "../domain/value-objects/UnitId.js";
import { UnitKilometer } from "../domain/value-objects/UnitKilometer.js";
import { UnitModel } from "../domain/value-objects/UnitModel.js";
import { UnitPrice } from "../domain/value-objects/UnitPrice.js";
import { UnitStatus } from "../domain/value-objects/UnitStatus.js";
import { UnitTransmission } from "../domain/value-objects/UnitTransmission.js";
import { UnitYear } from "../domain/value-objects/UnitYear.js";

/**
 * Fluent builder (Builder Pattern) for `InventoryUnit`, with sensible defaults for every field so
 * callers (mainly tests and `InventoryConnectorFactory` seed data) only need to override what
 * matters for their scenario.
 */
export class InventoryUnitBuilder {
  private dmsUnitId: DmsUnitId | undefined;
  private brand = "Mitsubishi";
  private model = "Xpander Cross";
  private variant = "";
  private year = 2020;
  private transmission = UnitTransmission.AT;
  private color = "Putih";
  private kilometer = 30_000;
  private priceIDR = 195_000_000;
  private condition = UnitCondition.GOOD;
  private status = UnitStatus.AVAILABLE;
  private branch: Branch = Branch.BINTARO;
  private photos: string[] = [];
  private features: string[] = [];
  private sourceSystem = SourceSystem.MOCK;
  private syncedAt = new Date("2026-01-01T00:00:00.000Z");
  private createdAt = new Date("2026-01-01T00:00:00.000Z");
  private updatedAt = new Date("2026-01-01T00:00:00.000Z");

  withDmsUnitId(id: DmsUnitId): this {
    this.dmsUnitId = id;
    return this;
  }

  withBrand(brand: string): this {
    this.brand = brand;
    return this;
  }

  withModel(model: string): this {
    this.model = model;
    return this;
  }

  withVariant(variant: string): this {
    this.variant = variant;
    return this;
  }

  withYear(year: number): this {
    this.year = year;
    return this;
  }

  withTransmission(transmission: UnitTransmission): this {
    this.transmission = transmission;
    return this;
  }

  withColor(color: string): this {
    this.color = color;
    return this;
  }

  withKilometer(kilometer: number): this {
    this.kilometer = kilometer;
    return this;
  }

  withPrice(priceIDR: number): this {
    this.priceIDR = priceIDR;
    return this;
  }

  withCondition(condition: UnitCondition): this {
    this.condition = condition;
    return this;
  }

  withStatus(status: UnitStatus): this {
    this.status = status;
    return this;
  }

  withBranch(branch: Branch): this {
    this.branch = branch;
    return this;
  }

  withPhotos(photos: string[]): this {
    this.photos = photos;
    return this;
  }

  withFeatures(features: string[]): this {
    this.features = features;
    return this;
  }

  withSourceSystem(sourceSystem: SourceSystem): this {
    this.sourceSystem = sourceSystem;
    return this;
  }

  withSyncedAt(at: Date): this {
    this.syncedAt = at;
    return this;
  }

  withCreatedAt(at: Date): this {
    this.createdAt = at;
    return this;
  }

  withUpdatedAt(at: Date): this {
    this.updatedAt = at;
    return this;
  }

  build(): Result<InventoryUnit, ValidationError> {
    const brandResult = UnitBrand.create(this.brand);
    if (!brandResult.ok) {
      return err(brandResult.error);
    }
    const modelResult = UnitModel.create(this.model);
    if (!modelResult.ok) {
      return err(modelResult.error);
    }
    const yearResult = UnitYear.create(this.year);
    if (!yearResult.ok) {
      return err(yearResult.error);
    }
    const kilometerResult = UnitKilometer.create(this.kilometer);
    if (!kilometerResult.ok) {
      return err(kilometerResult.error);
    }
    const priceResult = UnitPrice.create(this.priceIDR);
    if (!priceResult.ok) {
      return err(priceResult.error);
    }
    const syncedAtResult = SyncTimestamp.create(this.syncedAt);
    if (!syncedAtResult.ok) {
      return err(syncedAtResult.error);
    }

    return InventoryUnit.create({
      id: UnitId.generate(),
      dmsUnitId: this.dmsUnitId,
      brand: brandResult.value,
      model: modelResult.value,
      variant: this.variant,
      year: yearResult.value,
      transmission: this.transmission,
      color: this.color,
      kilometer: kilometerResult.value,
      price: priceResult.value,
      condition: this.condition,
      status: this.status,
      branch: this.branch,
      photos: this.photos,
      features: this.features,
      sourceSystem: this.sourceSystem,
      sourcePriority: sourcePriorityFor(this.sourceSystem),
      syncedAt: syncedAtResult.value,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    });
  }
}
