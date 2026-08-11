import { ok, type Result } from "@aos/common";

import type { ScrapedUnit } from "../../domain/entities/ScrapedUnit.js";
import type { ScrapeSession } from "../../domain/entities/ScrapeSession.js";
import type { MobixScraperEvents } from "../../domain/events/MobixScraperEvents.js";

export interface InventoryDiff {
  readonly newUnits: ReadonlyArray<ScrapedUnit>;
  readonly soldUnits: ReadonlyArray<ScrapedUnit>;
  readonly unchangedCount: number;
}

/** Diffs a previous `ScrapeSession` against the current one by `ScrapedUnit.identityKey` and publishes `NewUnitDetected`/`UnitSoldOut` per changed unit. Never fails — an empty previous session simply yields "everything is new". */
export class DetectInventoryChanges {
  constructor(
    private readonly events: MobixScraperEvents,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(
    previous: ScrapeSession | undefined,
    current: ScrapeSession,
  ): Promise<Result<InventoryDiff, never>> {
    const previousByKey = previous ? previous.byIdentityKey() : new Map<string, ScrapedUnit>();
    const currentByKey = current.byIdentityKey();

    const newUnits: ScrapedUnit[] = [];
    const soldUnits: ScrapedUnit[] = [];
    let unchangedCount = 0;

    for (const [key, unit] of currentByKey) {
      if (previousByKey.has(key)) {
        unchangedCount += 1;
      } else {
        newUnits.push(unit);
      }
    }
    for (const [key, unit] of previousByKey) {
      if (!currentByKey.has(key)) {
        soldUnits.push(unit);
      }
    }

    for (const unit of newUnits) {
      await this.events.publishNewUnitDetected({
        identityKey: unit.identityKey,
        model: unit.model,
        year: unit.year,
        branch: String(unit.branch),
        priceIDR: unit.price.idr,
        occurredAt: this.now(),
        version: "1.0",
      });
    }
    for (const unit of soldUnits) {
      await this.events.publishUnitSoldOut({
        identityKey: unit.identityKey,
        model: unit.model,
        branch: String(unit.branch),
        occurredAt: this.now(),
        version: "1.0",
      });
    }

    return ok({ newUnits, soldUnits, unchangedCount });
  }
}
