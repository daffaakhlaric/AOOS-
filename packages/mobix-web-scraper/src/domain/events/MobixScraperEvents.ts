import { randomUUID } from "node:crypto";

import { EventCategory, type IPublisher } from "@aos/event-bus";

import type { NewUnitDetected } from "./NewUnitDetected.js";
import type { PromoDetected } from "./PromoDetected.js";
import type { ScrapeCompleted } from "./ScrapeCompleted.js";
import type { ScrapeFailed } from "./ScrapeFailed.js";
import type { UnitSoldOut } from "./UnitSoldOut.js";

/**
 * Wraps the real `@aos/event-bus` `IPublisher` for this package's 5 named events, mirroring
 * `@aos/meta-ads-agent`'s `MetaAdsAgentEvents` convention. `@aos/event-bus`'s envelope `version`
 * must be a full SemVer string ("x.y.z"), distinct from each payload's own `version: "1.0"`
 * business field — always the literal `"1.0.0"` here.
 */
export class MobixScraperEvents {
  constructor(
    private readonly publisher: IPublisher,
    private readonly source: string = "@aos/mobix-web-scraper",
  ) {}

  async publishScrapeCompleted(payload: ScrapeCompleted, correlationId?: string): Promise<void> {
    await this.publish("aaos.mobix-scraper.scrape.completed", payload, correlationId);
  }

  async publishScrapeFailed(payload: ScrapeFailed, correlationId?: string): Promise<void> {
    await this.publish("aaos.mobix-scraper.scrape.failed", payload, correlationId);
  }

  async publishNewUnitDetected(payload: NewUnitDetected, correlationId?: string): Promise<void> {
    await this.publish("aaos.mobix-scraper.unit.new-detected", payload, correlationId);
  }

  async publishUnitSoldOut(payload: UnitSoldOut, correlationId?: string): Promise<void> {
    await this.publish("aaos.mobix-scraper.unit.sold-out", payload, correlationId);
  }

  async publishPromoDetected(payload: PromoDetected, correlationId?: string): Promise<void> {
    await this.publish("aaos.mobix-scraper.promo.detected", payload, correlationId);
  }

  private async publish<T>(type: string, payload: T, correlationId?: string): Promise<void> {
    await this.publisher.publish({
      type,
      category: EventCategory.DOMAIN,
      payload,
      source: this.source,
      producer: "@aos/mobix-web-scraper",
      correlationId: correlationId ?? randomUUID(),
      version: "1.0.0",
    });
  }
}
