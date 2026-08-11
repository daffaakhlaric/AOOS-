import type { Logger } from "@aos/logger";
import { z } from "zod";

import type { IConflictResolver } from "../../contracts/IConflictResolver.js";
import { InventoryUnit } from "../../domain/entities/InventoryUnit.js";
import { DmsUnitId } from "../../domain/value-objects/DmsUnitId.js";
import { sourcePriorityFor } from "../../domain/value-objects/SourcePriority.js";
import { SourceSystem } from "../../domain/value-objects/SourceSystem.js";
import { SyncTimestamp } from "../../domain/value-objects/SyncTimestamp.js";
import { UnitBrand } from "../../domain/value-objects/UnitBrand.js";
import { UnitCondition } from "../../domain/value-objects/UnitCondition.js";
import { UnitId } from "../../domain/value-objects/UnitId.js";
import { UnitKilometer } from "../../domain/value-objects/UnitKilometer.js";
import { UnitModel } from "../../domain/value-objects/UnitModel.js";
import { UnitPrice } from "../../domain/value-objects/UnitPrice.js";
import { parseUnitStatus } from "../../domain/value-objects/UnitStatus.js";
import { parseUnitTransmission } from "../../domain/value-objects/UnitTransmission.js";
import { UnitYear } from "../../domain/value-objects/UnitYear.js";
import type { SourceTaggedRawUnit } from "../../types/InventoryTypes.js";
import { detectBranch } from "../../utils/BranchDetector.js";

/**
 * Validates the shape of a raw unit from *any* source before it's allowed into the domain layer
 * (Constitution: "All external inputs validated with Zod") — a `RawInventoryUnit` is external
 * data as far as this package's domain is concerned, regardless of which adapter produced it.
 */
const RawInventoryUnitSchema = z.object({
  externalId: z.string().min(1),
  brand: z.string().min(1),
  model: z.string().min(1),
  year: z.number().int(),
  transmission: z.string().min(1),
  color: z.string().min(1),
  kilometer: z.number().int().nonnegative(),
  priceIDR: z.number().nonnegative(),
  branch: z.string().min(1),
  status: z.string().min(1),
  photos: z.array(z.string()).optional(),
  features: z.array(z.string()).optional(),
  rawData: z.record(z.unknown()).optional(),
  sourceSystem: z.nativeEnum(SourceSystem),
});

/** DSS Motor doesn't send a condition grade over any current source — derived heuristically from `kilometer` until a real inspection integration exists (documented judgment call). */
function deriveCondition(kilometer: number): UnitCondition {
  if (kilometer <= 30_000) {
    return UnitCondition.GOOD;
  }
  if (kilometer <= 70_000) {
    return UnitCondition.FAIR;
  }
  return UnitCondition.POOR;
}

/** `brand|model|year|transmission|branch`, case-insensitive — the fuzzy-ish match key units are grouped by across sources. */
function compositeKeyOf(unit: InventoryUnit): string {
  return [
    unit.brand.toString().toLowerCase(),
    unit.model.toString().toLowerCase(),
    unit.year.toNumber(),
    unit.transmission,
    String(unit.branch).toLowerCase(),
  ].join("|");
}

export class ConflictResolutionService implements IConflictResolver {
  constructor(
    private readonly logger?: Logger,
    private readonly now: () => Date = () => new Date(),
  ) {}

  static compositeKeyOf(unit: InventoryUnit): string {
    return compositeKeyOf(unit);
  }

  compositeKeyOf(unit: InventoryUnit): string {
    return compositeKeyOf(unit);
  }

  resolve(units: ReadonlyArray<SourceTaggedRawUnit>): InventoryUnit[] {
    const built: InventoryUnit[] = [];
    for (const raw of units) {
      const result = this.buildUnit(raw);
      if (!result.ok) {
        this.logger?.warn(
          { error: result.error, externalId: raw.externalId, sourceSystem: raw.sourceSystem },
          "dss-inventory-connector: skipped invalid raw unit during conflict resolution",
        );
        continue;
      }
      built.push(result.value);
    }

    const groups = new Map<string, InventoryUnit[]>();
    for (const unit of built) {
      const key = compositeKeyOf(unit);
      const group = groups.get(key);
      if (group) {
        group.push(unit);
      } else {
        groups.set(key, [unit]);
      }
    }

    const winners: InventoryUnit[] = [];
    for (const group of groups.values()) {
      let winner = group[0]!;
      for (const candidate of group.slice(1)) {
        if (candidate.sourcePriority > winner.sourcePriority) {
          winner = candidate;
        }
      }
      winners.push(winner);
    }
    return winners;
  }

  merge(existing: InventoryUnit, incoming: InventoryUnit): InventoryUnit {
    if (incoming.sourcePriority < existing.sourcePriority) {
      return existing;
    }
    // Equal-priority incoming data is treated as a refresh and replaces existing (newer wins on
    // ties) — same-source resyncs are the common equal-priority case.
    const result = InventoryUnit.create({
      id: existing.id,
      dmsUnitId: incoming.dmsUnitId,
      brand: incoming.brand,
      model: incoming.model,
      variant: incoming.variant,
      year: incoming.year,
      transmission: incoming.transmission,
      color: incoming.color,
      kilometer: incoming.kilometer,
      price: incoming.price,
      condition: incoming.condition,
      status: incoming.status,
      branch: incoming.branch,
      photos: incoming.photos,
      features: incoming.features,
      sourceSystem: incoming.sourceSystem,
      sourcePriority: incoming.sourcePriority,
      syncedAt: incoming.syncedAt,
      createdAt: existing.createdAt,
      updatedAt: this.now(),
    });
    // Unreachable: every field above is copied from `incoming`, itself already a successfully
    // `InventoryUnit.create`-d instance, except `id`/`createdAt` (from `existing`, same
    // reasoning) and `updatedAt` (always >= createdAt since `this.now()` is called after sync
    // started). `InventoryUnit.create`'s validation can therefore never fail here.
    /* v8 ignore next 3 */
    if (!result.ok) {
      return existing;
    }
    return result.value;
  }

  private buildUnit(
    raw: SourceTaggedRawUnit,
  ): { ok: true; value: InventoryUnit } | { ok: false; error: string } {
    const parsed = RawInventoryUnitSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.message };
    }
    const data = parsed.data;

    const brandResult = UnitBrand.create(data.brand);
    if (!brandResult.ok) {
      return { ok: false, error: brandResult.error.message };
    }
    const modelResult = UnitModel.create(data.model);
    if (!modelResult.ok) {
      return { ok: false, error: modelResult.error.message };
    }
    const yearResult = UnitYear.create(data.year);
    if (!yearResult.ok) {
      return { ok: false, error: yearResult.error.message };
    }
    const transmissionResult = parseUnitTransmission(data.transmission);
    if (!transmissionResult.ok) {
      return { ok: false, error: transmissionResult.error.message };
    }
    const kilometerResult = UnitKilometer.create(data.kilometer);
    if (!kilometerResult.ok) {
      return { ok: false, error: kilometerResult.error.message };
    }
    const priceResult = UnitPrice.create(data.priceIDR);
    if (!priceResult.ok) {
      return { ok: false, error: priceResult.error.message };
    }
    const branchResult = detectBranch(data.branch);
    if (!branchResult.ok) {
      return { ok: false, error: branchResult.error.message };
    }
    const statusResult = parseUnitStatus(data.status);
    if (!statusResult.ok) {
      return { ok: false, error: statusResult.error.message };
    }

    const at = this.now();
    const syncedAtResult = SyncTimestamp.create(at);
    if (!syncedAtResult.ok) {
      // Unreachable: `this.now()` always returns a valid `Date`.
      /* v8 ignore next 2 */
      return { ok: false, error: syncedAtResult.error.message };
    }

    const dmsUnitId =
      raw.sourceSystem === SourceSystem.DMS ? DmsUnitId.create(raw.externalId) : undefined;

    const built = InventoryUnit.create({
      id: UnitId.generate(),
      dmsUnitId: dmsUnitId?.ok ? dmsUnitId.value : undefined,
      brand: brandResult.value,
      model: modelResult.value,
      variant: "",
      year: yearResult.value,
      transmission: transmissionResult.value,
      color: data.color,
      kilometer: kilometerResult.value,
      price: priceResult.value,
      condition: deriveCondition(data.kilometer),
      status: statusResult.value,
      branch: branchResult.value,
      photos: data.photos ?? [],
      features: data.features ?? [],
      sourceSystem: raw.sourceSystem,
      sourcePriority: sourcePriorityFor(raw.sourceSystem),
      syncedAt: syncedAtResult.value,
      createdAt: at,
      updatedAt: at,
    });
    // Unreachable: every field above is already validated (Zod schema + each value object's own
    // `create`), `variant: ""` is always a valid string, and `updatedAt === createdAt` never
    // precedes it — `InventoryUnit.create` can never fail here.
    /* v8 ignore next 3 */
    if (!built.ok) {
      return { ok: false, error: built.error.message };
    }
    return { ok: true, value: built.value };
  }
}
