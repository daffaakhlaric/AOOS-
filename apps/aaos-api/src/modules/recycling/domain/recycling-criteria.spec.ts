import { BranchId } from "@aos/branch-manager";
import { LeadBuilder, LeadStatus } from "@aos/lead-store";
import { describe, expect, it } from "vitest";

import {
  isInRecyclingPool,
  isReadyToSend,
  RECYCLING_CRITERIA,
  shouldArchiveAfterBroadcast,
} from "./recycling-criteria.js";

const NOW = new Date("2026-01-15T10:00:00.000Z"); // 17:00 WIB — inside send hours

function poolLead(overrides: Partial<Parameters<typeof buildLead>[0]> = {}) {
  return buildLead(overrides);
}

function buildLead(overrides: {
  status?: LeadStatus;
  score?: number;
  broadcastCount?: number;
  recyclingArchived?: boolean;
  createdAt?: Date;
  lastBroadcastAt?: Date;
}) {
  const builder = new LeadBuilder()
    .withBranchId(BranchId.BINTARO)
    .withStatus(overrides.status ?? LeadStatus.WARM)
    .withTemperature(LeadStatus.WARM)
    .withScore(overrides.score ?? 40)
    .withBroadcastCount(overrides.broadcastCount ?? 0)
    .withRecyclingArchived(overrides.recyclingArchived ?? false)
    .withCreatedAt(overrides.createdAt ?? new Date("2026-01-10T00:00:00.000Z"))
    .withUpdatedAt(overrides.createdAt ?? new Date("2026-01-10T00:00:00.000Z"));
  if (overrides.lastBroadcastAt !== undefined) {
    builder.withLastBroadcastAt(overrides.lastBroadcastAt);
  }
  const result = builder.build();
  if (!result.ok) {
    throw new Error(`test lead build failed: ${result.error.message}`);
  }
  return result.value;
}

describe("isInRecyclingPool", () => {
  it("accepts a WARM lead below the score threshold, old enough, not archived", () => {
    expect(isInRecyclingPool(poolLead({}), NOW)).toBe(true);
  });

  it("accepts a COLD lead the same way", () => {
    expect(isInRecyclingPool(poolLead({ status: LeadStatus.COLD }), NOW)).toBe(true);
  });

  it("rejects a NEW/HOT/ASSIGNED/CLOSED lead", () => {
    expect(isInRecyclingPool(poolLead({ status: LeadStatus.NEW }), NOW)).toBe(false);
    expect(isInRecyclingPool(poolLead({ status: LeadStatus.HOT }), NOW)).toBe(false);
  });

  it(`rejects score >= ${RECYCLING_CRITERIA.scoreBelow}`, () => {
    expect(isInRecyclingPool(poolLead({ score: 65 }), NOW)).toBe(false);
    expect(isInRecyclingPool(poolLead({ score: 64 }), NOW)).toBe(true);
  });

  it(`rejects broadcastCount >= ${RECYCLING_CRITERIA.maxBroadcastCount}`, () => {
    expect(isInRecyclingPool(poolLead({ broadcastCount: 3 }), NOW)).toBe(false);
    expect(isInRecyclingPool(poolLead({ broadcastCount: 2 }), NOW)).toBe(true);
  });

  it("rejects a recyclingArchived lead", () => {
    expect(isInRecyclingPool(poolLead({ recyclingArchived: true }), NOW)).toBe(false);
  });

  it(`rejects a lead younger than minAgeDays=${RECYCLING_CRITERIA.minAgeDays}`, () => {
    const justCreated = new Date(NOW.getTime() - 1000);
    expect(isInRecyclingPool(poolLead({ createdAt: justCreated }), NOW)).toBe(false);
  });
});

describe("isReadyToSend", () => {
  it("is true for a fresh pool lead with no lastBroadcastAt inside send hours", () => {
    expect(isReadyToSend(poolLead({}), NOW)).toBe(true);
  });

  it("is false outside 08:00-20:00 WIB", () => {
    const midnightUtc = new Date("2026-01-15T18:00:00.000Z"); // 01:00 WIB next day
    expect(isReadyToSend(poolLead({}), midnightUtc)).toBe(false);
  });

  it("is false for a WARM lead within its 3-day cooldown", () => {
    const lastBroadcastAt = new Date(NOW.getTime() - 1 * 24 * 60 * 60 * 1000); // 1 day ago
    expect(isReadyToSend(poolLead({ status: LeadStatus.WARM, lastBroadcastAt }), NOW)).toBe(false);
  });

  it("is true for a WARM lead past its 3-day cooldown", () => {
    const lastBroadcastAt = new Date(NOW.getTime() - 4 * 24 * 60 * 60 * 1000);
    expect(isReadyToSend(poolLead({ status: LeadStatus.WARM, lastBroadcastAt }), NOW)).toBe(true);
  });

  it("is false for a COLD lead within its 7-day cooldown", () => {
    const lastBroadcastAt = new Date(NOW.getTime() - 3 * 24 * 60 * 60 * 1000);
    expect(isReadyToSend(poolLead({ status: LeadStatus.COLD, lastBroadcastAt }), NOW)).toBe(false);
  });

  it("is true for a COLD lead past its 7-day cooldown", () => {
    const lastBroadcastAt = new Date(NOW.getTime() - 8 * 24 * 60 * 60 * 1000);
    expect(isReadyToSend(poolLead({ status: LeadStatus.COLD, lastBroadcastAt }), NOW)).toBe(true);
  });

  it("is false when not in the pool at all (e.g. archived)", () => {
    expect(isReadyToSend(poolLead({ recyclingArchived: true }), NOW)).toBe(false);
  });
});

describe("shouldArchiveAfterBroadcast", () => {
  it(`is true once broadcastCount reaches ${RECYCLING_CRITERIA.maxBroadcastCount}`, () => {
    expect(shouldArchiveAfterBroadcast(3)).toBe(true);
    expect(shouldArchiveAfterBroadcast(2)).toBe(false);
  });
});
