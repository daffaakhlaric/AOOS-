import { BranchId, SalesHumanId } from "@aos/branch-manager";
import { err, ok, type Result } from "@aos/common";
import {
  ClosingBuilder,
  ClosingId,
  ClosingType,
  GetClosingStats,
  LeadId,
  type Closing,
  type ClosingFilter,
  type IClosingRepository,
  type ISpendProvider,
  type SupabaseError,
} from "@aos/lead-store";

import {
  DEFAULT_CLOSING_TRACKER_CONFIG,
  type ClosingTrackerConfig,
} from "../../src/config/ClosingTrackerConfig.js";
import type {
  ActiveCampaignSnapshot,
  ICampaignActivityProvider,
} from "../../src/contracts/ICampaignActivityProvider.js";
import { ReportPeriod } from "../../src/domain/value-objects/ReportPeriod.js";

export const FIXED_NOW = new Date("2026-08-15T09:00:00.000Z");

export function fixedClock(at: Date = FIXED_NOW): () => Date {
  return () => at;
}

let idCounter = 0;
/** Deterministic, per-test-run-unique id — good enough for fixtures. */
export function nextId(prefix = "id"): string {
  idCounter += 1;
  return `${prefix}-${String(idCounter).padStart(6, "0")}`;
}

export interface MakeClosingOverrides {
  readonly leadId?: LeadId;
  readonly salesHumanId?: SalesHumanId;
  readonly branchId?: BranchId;
  readonly closingType?: ClosingType;
  readonly unitId?: string;
  readonly unitModel?: string;
  readonly unitPrice?: number;
  readonly campaignId?: string;
  readonly adId?: string;
  readonly commissionIdr?: number;
  readonly commissionPct?: number;
  readonly testDriveAt?: Date;
  readonly spkAt?: Date;
  readonly createdAt?: Date;
}

/** Builds a real `Closing` entity via `@aos/lead-store`'s `ClosingBuilder`, defaulting to a same-day SPK in `BINTARO`. */
export function makeClosing(overrides: MakeClosingOverrides = {}): Closing {
  const createdAt = overrides.createdAt ?? FIXED_NOW;
  const closingType = overrides.closingType ?? ClosingType.SPK;
  const builder = new ClosingBuilder()
    .withId(ClosingId.generate())
    .withLeadId(overrides.leadId ?? LeadId.generate())
    .withSalesHumanId(overrides.salesHumanId ?? SalesHumanId.generate())
    .withBranchId(overrides.branchId ?? BranchId.BINTARO)
    .withClosingType(closingType)
    .withUnitId(overrides.unitId)
    .withUnitModel(overrides.unitModel)
    .withUnitPrice(overrides.unitPrice)
    .withCampaignId(overrides.campaignId)
    .withAdId(overrides.adId)
    .withCommissionIdr(overrides.commissionIdr)
    .withCommissionPct(overrides.commissionPct)
    .withCreatedAt(createdAt)
    .withTestDriveAt(
      overrides.testDriveAt ?? (closingType === ClosingType.TEST_DRIVE ? createdAt : undefined),
    )
    .withSpkAt(overrides.spkAt ?? (closingType === ClosingType.SPK ? createdAt : undefined));

  const result = builder.build();
  if (!result.ok) {
    throw new Error(`makeClosing: failed to build fixture — ${result.error.message}`);
  }
  return result.value;
}

export function makeConfig(overrides: Partial<ClosingTrackerConfig> = {}): ClosingTrackerConfig {
  return {
    tenantId: "dss-motor",
    ...DEFAULT_CLOSING_TRACKER_CONFIG,
    ...overrides,
  };
}

export function makePeriod(month: number, year: number): ReportPeriod {
  const result = ReportPeriod.forMonth(month, year);
  if (!result.ok) {
    throw new Error(`makePeriod: failed to build fixture — ${result.error.message}`);
  }
  return result.value;
}

/** A hand-rolled `IClosingRepository` test double — seeds `Closing` entities directly, filters in-memory the same way the real Supabase-backed repository would (date range, campaignId, adId, branchId, salesHumanId). */
export class FakeClosingRepository implements IClosingRepository {
  private closings: Closing[] = [];
  private forcedError: SupabaseError | undefined;

  seed(closings: readonly Closing[]): void {
    this.closings.push(...closings);
  }

  forceError(error: SupabaseError): void {
    this.forcedError = error;
  }

  async insert(closing: Closing): Promise<Result<Closing, SupabaseError>> {
    if (this.forcedError !== undefined) {
      const error = this.forcedError;
      this.forcedError = undefined;
      return err(error);
    }
    this.closings.push(closing);
    return ok(closing);
  }

  async findByFilter(filter: ClosingFilter): Promise<Result<readonly Closing[], SupabaseError>> {
    if (this.forcedError !== undefined) {
      const error = this.forcedError;
      this.forcedError = undefined;
      return err(error);
    }
    const filtered = this.closings.filter((c) => {
      if (c.createdAt.getTime() < filter.fromDate.getTime()) {
        return false;
      }
      if (c.createdAt.getTime() > filter.toDate.getTime()) {
        return false;
      }
      if (filter.campaignId !== undefined && c.campaignId !== filter.campaignId) {
        return false;
      }
      if (filter.adId !== undefined && c.adId !== filter.adId) {
        return false;
      }
      if (filter.branchId !== undefined && c.branchId !== filter.branchId) {
        return false;
      }
      if (filter.salesHumanId !== undefined && c.salesHumanId.toString() !== filter.salesHumanId) {
        return false;
      }
      return true;
    });
    return ok(filtered);
  }
}

/** A hand-rolled `ISpendProvider` test double — matches the real interface (design resolution #3 in `@aos/lead-store`). */
export function makeSpendProvider(spendByCampaign: Record<string, number> = {}): ISpendProvider {
  return {
    getSpendByCampaign: async (campaignIds: readonly string[]) =>
      new Map(campaignIds.map((id) => [id, spendByCampaign[id] ?? 0])),
  };
}

/** Builds a real `GetClosingStats` use case (from `@aos/lead-store`) over a `FakeClosingRepository`/fake `ISpendProvider` pair — used everywhere this package's tests need the *real* lead-store aggregation logic (coordinator note #1), not a re-implementation of it. */
export function makeGetClosingStats(
  closingRepository: IClosingRepository,
  spendByCampaign: Record<string, number> = {},
): GetClosingStats {
  return new GetClosingStats(closingRepository, makeSpendProvider(spendByCampaign));
}

/** A hand-rolled `ICampaignActivityProvider` test double. */
export class FakeCampaignActivityProvider implements ICampaignActivityProvider {
  private byDay = new Map<string, ActiveCampaignSnapshot[]>();
  private byPeriod = new Map<BranchId, ActiveCampaignSnapshot[]>();

  seedDay(branch: BranchId, date: Date, candidates: readonly ActiveCampaignSnapshot[]): void {
    this.byDay.set(this.dayKey(branch, date), [...candidates]);
  }

  seedPeriod(branch: BranchId, candidates: readonly ActiveCampaignSnapshot[]): void {
    this.byPeriod.set(branch, [...candidates]);
  }

  async getActiveCampaignsForBranch(
    branch: BranchId,
    date: Date,
  ): Promise<ReadonlyArray<ActiveCampaignSnapshot>> {
    return Promise.resolve(this.byDay.get(this.dayKey(branch, date)) ?? []);
  }

  async getActiveCampaignsForBranchInPeriod(
    branch: BranchId,
    _fromDate: Date,
    _toDate: Date,
  ): Promise<ReadonlyArray<ActiveCampaignSnapshot>> {
    return Promise.resolve(this.byPeriod.get(branch) ?? []);
  }

  private dayKey(branch: BranchId, date: Date): string {
    return `${branch}:${date.toISOString().slice(0, 10)}`;
  }
}
