export { MobixScraperFactory } from "./factories/MobixScraperFactory.js";
export type { MobixScraperFactoryOptions } from "./factories/MobixScraperFactory.js";
export { MobixScraperService } from "./application/services/MobixScraperService.js";
export { ScrapeInventory } from "./application/use-cases/ScrapeInventory.js";
export { ScrapePromos } from "./application/use-cases/ScrapePromos.js";
export {
  DetectInventoryChanges,
  type InventoryDiff,
} from "./application/use-cases/DetectInventoryChanges.js";
export {
  DownloadAndStorePhotos,
  type PhotoBatchResult,
  type PhotoUploadResult,
  type PhotoUploadFailure,
} from "./application/use-cases/DownloadAndStorePhotos.js";
export { RunFullScrape, type RunFullScrapeResult } from "./application/use-cases/RunFullScrape.js";

export { ScrapedUnit, ScrapedPromo, ScrapeSession } from "./domain/entities/index.js";
export type { Transmission } from "./domain/entities/index.js";
export {
  ScrapedPrice,
  ScrapedKilometer,
  ScrapeTimestamp,
  UnitUrl,
} from "./domain/value-objects/index.js";
export {
  ScraperError,
  ScrapeError,
  ParseError,
  PhotoDownloadError,
} from "./domain/errors/index.js";
export type {
  ScrapeCompleted,
  ScrapeFailed,
  NewUnitDetected,
  UnitSoldOut,
  PromoDetected,
  PhotoUploaded,
} from "./domain/events/index.js";
export { MobixScraperEvents } from "./domain/events/MobixScraperEvents.js";

export type { IInventoryScraper } from "./contracts/IInventoryScraper.js";
export type { IPromoScraper } from "./contracts/IPromoScraper.js";

export { PriceParser } from "./infrastructure/parsers/PriceParser.js";
export { KilometerParser } from "./infrastructure/parsers/KilometerParser.js";
export { UnitListingParser } from "./infrastructure/parsers/UnitListingParser.js";
export { PromoParser } from "./infrastructure/parsers/PromoParser.js";
export { MobixInventoryScraper } from "./infrastructure/scrapers/MobixInventoryScraper.js";
export { MobixPromoScraper } from "./infrastructure/scrapers/MobixPromoScraper.js";
