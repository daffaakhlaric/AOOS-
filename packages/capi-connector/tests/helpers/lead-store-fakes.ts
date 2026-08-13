import { ok, type Result } from "@aos/common";
import type { BaseEventShape, EventCategory, EventPriority } from "@aos/event-bus";
import {
  ClosingBuilder,
  ClosingType,
  GetLead,
  LeadBuilder,
  type Closing,
  type ClosingFilter,
  type IClosingRepository,
  type ILeadRepository,
  type Lead,
  type SupabaseError,
} from "@aos/lead-store";
import { vi } from "vitest";

/** In-memory `ILeadRepository` fake, seeded with `Lead`s so `GetLead.execute(leadId)` resolves realistically — `EventListenerService` is constructed with a REAL `GetLead` wired to this fake, per the coordinator note's "real, already-composed GetLead" guidance (not a hand-rolled `GetLead`-shaped mock, since `GetLead` has a private field TypeScript can't structurally satisfy any other way). */
export function createFakeLeadRepository(seed: readonly Lead[] = []): ILeadRepository {
  const byId = new Map(seed.map((lead) => [lead.id.toString(), lead]));
  return {
    findById: vi.fn(async (id): Promise<Result<Lead | undefined, SupabaseError>> =>
      ok(byId.get(id.toString())),
    ),
    findByPhoneAndBranch: vi.fn(async (): Promise<Result<Lead | undefined, SupabaseError>> =>
      ok(undefined),
    ),
    insert: vi.fn(async (lead: Lead) => {
      byId.set(lead.id.toString(), lead);
      return ok(lead);
    }),
    update: vi.fn(async (lead: Lead) => {
      byId.set(lead.id.toString(), lead);
      return ok(lead);
    }),
    findByBranch: vi.fn(async () => ok([])),
    findHotByBranch: vi.fn(async () => ok([])),
    findBySales: vi.fn(async () => ok([])),
  };
}

export function createGetLead(seed: readonly Lead[] = []): GetLead {
  return new GetLead(createFakeLeadRepository(seed));
}

/** In-memory `IClosingRepository` fake — `findByFilter` ignores the date/campaign/ad filters (a real Supabase adapter would apply them) and just returns everything seeded, matching how `EventListenerService` narrows down to one row itself via `.id`. */
export function createFakeClosingRepository(seed: readonly Closing[] = []): IClosingRepository {
  return {
    insert: vi.fn(async (closing: Closing) => ok(closing)),
    findByFilter: vi.fn(
      async (_filter: ClosingFilter): Promise<Result<readonly Closing[], SupabaseError>> =>
        ok(seed),
    ),
  };
}

export function buildLead(
  overrides: Partial<{ leadPhone: string; adId: string; campaignId: string }> = {},
): Lead {
  const builder = new LeadBuilder().withLeadPhone(overrides.leadPhone ?? "+6281200000099");
  if (overrides.adId !== undefined) {
    builder.withAdId(overrides.adId);
  }
  if (overrides.campaignId !== undefined) {
    builder.withCampaignId(overrides.campaignId);
  }
  const result = builder.build();
  if (!result.ok) {
    throw new Error(`buildLead fixture failed: ${result.error.message}`);
  }
  return result.value;
}

export function buildClosing(
  overrides: Partial<{
    closingType: ClosingType;
    unitId: string;
    unitPrice: number;
    commissionIdr: number;
    campaignId: string;
    adId: string;
  }> = {},
): Closing {
  const builder = new ClosingBuilder().withClosingType(overrides.closingType ?? ClosingType.SPK);
  if (overrides.unitId !== undefined) {
    builder.withUnitId(overrides.unitId);
  }
  if (overrides.unitPrice !== undefined) {
    builder.withUnitPrice(overrides.unitPrice);
  }
  if (overrides.commissionIdr !== undefined) {
    builder.withCommissionIdr(overrides.commissionIdr);
  }
  if (overrides.campaignId !== undefined) {
    builder.withCampaignId(overrides.campaignId);
  }
  if (overrides.adId !== undefined) {
    builder.withAdId(overrides.adId);
  }
  const result = builder.build();
  if (!result.ok) {
    throw new Error(`buildClosing fixture failed: ${result.error.message}`);
  }
  return result.value;
}

/** Builds a minimal `BaseEventShape` for feeding into `EventListenerService`'s handlers directly (unit tests) or `EventBroker.publish` (integration tests). */
export function makeEvent<TPayload>(
  type: string,
  payload: TPayload,
  overrides: Partial<BaseEventShape> = {},
): BaseEventShape {
  return {
    eventId: overrides.eventId ?? "evt-1",
    type,
    category: (overrides.category ?? "domain") as EventCategory,
    correlationId: overrides.correlationId ?? "corr-1",
    causationId: overrides.causationId,
    tenantId: overrides.tenantId ?? "dss-motor",
    source: overrides.source ?? "@aos/lead-store",
    producer: overrides.producer ?? "@aos/lead-store",
    timestamp: overrides.timestamp ?? new Date().toISOString(),
    priority: (overrides.priority ?? "NORMAL") as EventPriority,
    version: overrides.version ?? "1.0.0",
    schemaVersion: overrides.schemaVersion ?? "1.0.0",
    payload,
    metadata: overrides.metadata,
    traceId: overrides.traceId,
  };
}
