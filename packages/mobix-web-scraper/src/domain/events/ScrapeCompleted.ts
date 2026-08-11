/** Payload for `aaos.mobix-scraper.scrape.completed`, emitted once per successful `ScrapeSession`. */
export interface ScrapeCompleted {
  readonly sessionId: string;
  readonly unitCount: number;
  readonly sourceUrl: string;
  readonly durationMs: number;
  readonly occurredAt: Date;
  readonly version: "1.0";
}
