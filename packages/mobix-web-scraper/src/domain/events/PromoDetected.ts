/** Payload for `aaos.mobix-scraper.promo.detected`, emitted once per `ScrapedPromo` found by `ScrapePromos`. */
export interface PromoDetected {
  readonly title: string;
  readonly validUntil?: string;
  readonly occurredAt: Date;
  readonly version: "1.0";
}
