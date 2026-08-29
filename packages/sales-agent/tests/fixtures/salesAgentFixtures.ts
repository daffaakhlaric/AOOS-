import { AssignmentMode, BranchId, BranchManagerFactory } from "@aos/branch-manager";
import type { BranchManager } from "@aos/branch-manager";
import type { IInventoryQueryService } from "@aos/dss-inventory-connector";
import { InventoryConnectorFactory } from "@aos/dss-inventory-connector";

import type { SalesAgentConfig } from "../../src/config/SalesAgentConfig.js";
import type { IListingQueryService } from "../../src/contracts/IListingQueryService.js";
import { LeadConversation } from "../../src/domain/entities/LeadConversation.js";
import type { PropertyListing } from "../../src/domain/entities/PropertyListing.js";
import { createFakePublisher, type FakePublisher } from "../helpers/publisher.js";
import { unwrap } from "../helpers/result.js";

export const FIXED_NOW = new Date("2026-08-10T09:00:00.000Z");

export function fixedClock(at: Date = FIXED_NOW): () => Date {
  return () => at;
}

export function makeSalesAgentConfig(overrides: Partial<SalesAgentConfig> = {}): SalesAgentConfig {
  return {
    tenantId: "tenant-dss-motor",
    agentName: "Clara",
    language: "id",
    hotThreshold: 65,
    warmThreshold: 31,
    noReplyTimeoutMs: 21_600_000,
    minResponseDelayMs: 800,
    maxResponseDelayMs: 3000,
    followUpEnabled: true,
    followUpDays: [3, 7, 14],
    llmReplyEnabled: false,
    openaiModel: "gpt-4o-mini",
    openaiTimeoutMs: 8_000,
    ...overrides,
  };
}

export function makeLeadConversation(
  leadPhone = "+6281200000001",
  branchId: BranchId = BranchId.CINERE,
  startedAt: Date = FIXED_NOW,
): LeadConversation {
  return LeadConversation.start(leadPhone, branchId, startedAt);
}

const BRANCH_MANAGER_CONFIG = {
  tenantId: "tenant-dss-motor",
  phoneNumberIdBintaro: "PHONE_NUMBER_ID_BINTARO",
  phoneNumberIdCinere: "PHONE_NUMBER_ID_CINERE",
  phoneNumberIdPondokBambu: "PHONE_NUMBER_ID_PONDOK_BAMBU",
  phoneNumberIdBandung: "PHONE_NUMBER_ID_BANDUNG",
  phoneNumberBintaro: "+628110000001",
  phoneNumberCinere: "+628110000002",
  phoneNumberPondokBambu: "+628110000003",
  phoneNumberBandung: "+628110000004",
  defaultMaxLeadsPerSalesPerDay: 10,
  defaultAssignmentMode: AssignmentMode.SMART_ASSIGN,
  maxQueueSize: 100,
  queueTtlMs: 86_400_000,
};

/** A real, fully-wired `@aos/branch-manager` instance (never mocked) with one available sales human per branch, so `AssignLead` succeeds with `status: "ASSIGNED"`. */
export function makeRealBranchManager(
  publisher: FakePublisher = createFakePublisher(),
): BranchManager {
  const branchManager = BranchManagerFactory.create({
    config: BRANCH_MANAGER_CONFIG,
    publisher,
    now: fixedClock(),
  });
  for (const branchId of [BranchId.BINTARO, BranchId.CINERE, BranchId.UMUM, BranchId.BANDUNG]) {
    unwrap(
      branchManager.addSalesHuman.execute({
        name: `Sales ${branchId}`,
        waNumber: "+628130000001",
        branchId,
      }),
    );
  }
  return branchManager;
}

const INVENTORY_CONFIG = {
  tenantId: "tenant-dss-motor",
  syncMode: "MOCK" as const,
  apiSyncIntervalMs: 120_000,
  dmsSyncIntervalMs: 1_800_000,
  sheetsSyncIntervalMs: 900_000,
};

/** A real, fully-synced `@aos/dss-inventory-connector` `IInventoryQueryService` (never mocked) backed by that package's real 13-unit `MockInventoryAdapter` fixture data. */
export async function makeRealSyncedInventoryQueryService(): Promise<IInventoryQueryService> {
  const connector = InventoryConnectorFactory.create({
    config: INVENTORY_CONFIG,
    publisher: createFakePublisher(),
  });
  await connector.syncInventory.execute({ correlationId: "fixture-sync" });
  return connector.queryService;
}

/** Real PROPERTY listings sample (Phase 8 fixtures) — used everywhere a real `IListingQueryService` is needed for PROPERTY-vertical tests. */
export const SAMPLE_LISTINGS: ReadonlyArray<PropertyListing> = [
  {
    id: "l1",
    title: "Rumah Bintaro 3 Kamar",
    propertyType: "RUMAH",
    price: 1_500_000_000,
    city: "Tangerang Selatan",
    bedrooms: 3,
  },
  {
    id: "l2",
    title: "Apartemen Cinere 2BR",
    propertyType: "APARTEMEN",
    price: 800_000_000,
    city: "Cinere",
    bedrooms: 2,
  },
];

/** A plain in-memory `IListingQueryService` fake (mirrors `makeRealSyncedInventoryQueryService`'s role, per `IListingQueryService.ts`'s own docstring: "tests use a plain in-memory fake"). */
export function makeListingQueryService(
  active: ReadonlyArray<PropertyListing> = SAMPLE_LISTINGS,
): IListingQueryService {
  return { getActive: () => active };
}
