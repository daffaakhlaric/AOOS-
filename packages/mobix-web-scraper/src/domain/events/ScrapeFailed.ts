/** Payload for `aaos.mobix-scraper.scrape.failed`, emitted when a fetch/parse of mobixbydss.id fails. */
export interface ScrapeFailed {
  readonly sourceUrl: string;
  readonly reason: string;
  readonly occurredAt: Date;
  readonly version: "1.0";
}
