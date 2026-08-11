import { BranchConfigBuilder } from "../../src/builders/BranchConfigBuilder.js";
import { SalesHumanBuilder } from "../../src/builders/SalesHumanBuilder.js";
import type { BranchManagerConfig } from "../../src/config/BranchManagerConfig.js";
import type { BranchConfig } from "../../src/domain/entities/BranchConfig.js";
import type { SalesHuman } from "../../src/domain/entities/SalesHuman.js";
import { AssignmentMode } from "../../src/domain/value-objects/AssignmentMode.js";
import { BranchId } from "../../src/domain/value-objects/BranchId.js";
import { SalesStatus } from "../../src/domain/value-objects/SalesStatus.js";
import { unwrap } from "../helpers/result.js";

export const FIXED_NOW = new Date("2026-01-15T09:00:00.000Z");

export function fixedClock(at: Date = FIXED_NOW): () => Date {
  return () => at;
}

export function makeBranchConfig(
  overrides: {
    id?: BranchId;
    displayName?: string;
    wabaPhoneNumberId?: string;
    assignmentMode?: AssignmentMode;
    maxLeadsPerSalesPerDay?: number;
  } = {},
): BranchConfig {
  const builder = new BranchConfigBuilder()
    .withId(overrides.id ?? BranchId.BINTARO)
    .withWabaPhoneNumberId(overrides.wabaPhoneNumberId ?? "PHONE_NUMBER_ID_BINTARO")
    .withAssignmentMode(overrides.assignmentMode ?? AssignmentMode.SMART_ASSIGN)
    .withMaxLeadsPerSalesPerDay(overrides.maxLeadsPerSalesPerDay ?? 10);
  if (overrides.displayName !== undefined) {
    builder.withDisplayName(overrides.displayName);
  }
  return unwrap(builder.build());
}

export function makeSalesHuman(
  overrides: {
    name?: string;
    branchId?: BranchId;
    status?: SalesStatus;
    maxLeadsPerDay?: number;
    activeLeadCount?: number;
    todayLeadCount?: number;
    joinedAt?: Date;
  } = {},
): SalesHuman {
  const builder = new SalesHumanBuilder()
    .withName(overrides.name ?? "Budi Santoso")
    .withBranchId(overrides.branchId ?? BranchId.BINTARO)
    .withStatus(overrides.status ?? SalesStatus.ON)
    .withMaxLeadsPerDay(overrides.maxLeadsPerDay ?? 10)
    .withActiveLeadCount(overrides.activeLeadCount ?? 0)
    .withTodayLeadCount(overrides.todayLeadCount ?? 0);
  if (overrides.joinedAt !== undefined) {
    builder.withJoinedAt(overrides.joinedAt);
  }
  return unwrap(builder.build());
}

export function makeBranchManagerConfig(
  overrides: Partial<BranchManagerConfig> = {},
): BranchManagerConfig {
  return {
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
    ...overrides,
  };
}
