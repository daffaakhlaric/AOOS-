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
export {
  RunFullScrape,
  type RunFullScrapeResult,
  type ScrapeProgressEvent,
  type ScrapeProgressListener,
} from "./application/use-cases/RunFullScrape.js";
export { ScrapeUnit, type ScrapeUnitResult } from "./application/use-cases/ScrapeUnit.js";
export type { GetStockListOptions } from "./application/services/MobixScraperService.js";

export { ScrapedUnit, ScrapedPromo, ScrapeSession } from "./domain/entities/index.js";
export type { Transmission } from "./domain/entities/index.js";
export {
  ScrapedPrice,
  ScrapedKilometer,
  ScrapeTimestamp,
  UnitUrl,
} from "./domain/value-objects/index.js";
export { normalizeCabang } from "./domain/value-objects/normalizeCabang.js";
export type { ScrapeWarning, ScrapeWarningListener } from "./domain/events/ScrapeWarning.js";
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
export type { IUnitDetailFetcher, UnitDetail } from "./contracts/IUnitDetailFetcher.js";
export type {
  IScrapedUnitRepository,
  ScrapedUnitListFilter,
  ScrapedUnitPage,
  ScrapedUnitStats,
} from "./contracts/IScrapedUnitRepository.js";

export { ScrapedUnitRepository } from "./infrastructure/supabase/ScrapedUnitRepository.js";
export { createSupabaseClient } from "./infrastructure/supabase/SupabaseClient.js";
export type { SupabaseClientLike } from "./infrastructure/supabase/SupabaseTypes.js";
export { ScrapedUnitMapper } from "./infrastructure/mappers/ScrapedUnitMapper.js";
export type { ScrapedUnitRow } from "./infrastructure/mappers/ScrapedUnitMapper.js";

export { PriceParser } from "./infrastructure/parsers/PriceParser.js";
export { KilometerParser } from "./infrastructure/parsers/KilometerParser.js";
export { PromoParser } from "./infrastructure/parsers/PromoParser.js";
export { MobixInventoryScraper } from "./infrastructure/scrapers/MobixInventoryScraper.js";
export type { MobixInventoryScraperOptions } from "./infrastructure/scrapers/MobixInventoryScraper.js";
export { MobixPromoScraper } from "./infrastructure/scrapers/MobixPromoScraper.js";
export { MobixUnitDetailFetcher } from "./infrastructure/scrapers/MobixUnitDetailFetcher.js";
export type { MobixUnitDetailFetcherOptions } from "./infrastructure/scrapers/MobixUnitDetailFetcher.js";

export {
  LISTING_API_PATH,
  DETAIL_API_PATH,
  resolveApiOrigin,
} from "./infrastructure/api/MobixApiClient.js";
export {
  absolutePhotoUrl,
  normalizeTransmission,
  toScrapedUnit,
  UNIT_PATH_PREFIX,
} from "./infrastructure/api/MobixUnitMapper.js";
