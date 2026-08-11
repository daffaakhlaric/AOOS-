import { Branch } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import { SourcePriority } from "../../../src/domain/value-objects/SourcePriority.js";
import { SourceSystem } from "../../../src/domain/value-objects/SourceSystem.js";
import {
  MOCK_UNITS,
  MockInventoryAdapter,
} from "../../../src/infrastructure/adapters/MockInventoryAdapter.js";
import { unwrap } from "../../helpers/result.js";

describe("MockInventoryAdapter", () => {
  it("declares sourceSystem MOCK and priority MOCK (0)", () => {
    const adapter = new MockInventoryAdapter();
    expect(adapter.sourceSystem).toBe(SourceSystem.MOCK);
    expect(adapter.priority).toBe(SourcePriority.MOCK);
  });

  it("isConfigured() is always true", () => {
    expect(new MockInventoryAdapter().isConfigured()).toBe(true);
  });

  it(// Corrected per the engineering report resolution #1: the spec's own literal MOCK_UNITS
  // array (13 entries, 4+5+2+2) contradicts its own "total = 15" summary line — 13 is
  // authoritative here.
  "fetchUnits() returns all 13 mock units (corrected mock_data_integrity total)", async () => {
    const result = unwrap(await new MockInventoryAdapter().fetchUnits());
    expect(result).toHaveLength(13);
  });

  it("mock data integrity: 11 AVAILABLE, 1 RESERVED, 1 SOLD (sums to 13)", async () => {
    const result = unwrap(await new MockInventoryAdapter().fetchUnits());
    const byStatus = result.reduce<Record<string, number>>((acc, unit) => {
      acc[unit.status] = (acc[unit.status] ?? 0) + 1;
      return acc;
    }, {});
    expect(byStatus.AVAILABLE).toBe(11);
    expect(byStatus.RESERVED).toBe(1);
    expect(byStatus.SOLD).toBe(1);
  });

  it("fetchUnitsByBranch(BINTARO) returns 4 units", async () => {
    const result = unwrap(await new MockInventoryAdapter().fetchUnitsByBranch(Branch.BINTARO));
    expect(result).toHaveLength(4);
  });

  it("fetchUnitsByBranch(CINERE) returns 5 units", async () => {
    const result = unwrap(await new MockInventoryAdapter().fetchUnitsByBranch(Branch.CINERE));
    expect(result).toHaveLength(5);
  });

  it("fetchUnitsByBranch(UMUM) returns 2 units (Pondok Bambu maps to UMUM)", async () => {
    const result = unwrap(await new MockInventoryAdapter().fetchUnitsByBranch(Branch.UMUM));
    expect(result).toHaveLength(2);
  });

  it("fetchUnitsByBranch(BANDUNG) returns 2 units", async () => {
    const result = unwrap(await new MockInventoryAdapter().fetchUnitsByBranch(Branch.BANDUNG));
    expect(result).toHaveLength(2);
  });

  it("fetchUnitsByBranch() for a branch with no mock units returns an empty array", async () => {
    const result = unwrap(await new MockInventoryAdapter().fetchUnitsByBranch(Branch.BOOST));
    expect(result).toEqual([]);
  });

  it("healthCheck() returns healthy: true", async () => {
    const result = unwrap(await new MockInventoryAdapter().healthCheck());
    expect(result.healthy).toBe(true);
  });

  it("MOCK_UNITS branch breakdown matches the spec's own by-branch numbers (bintaro=4, cinere=5, umum=2, bandung=2)", () => {
    const byBranch = MOCK_UNITS.reduce<Record<string, number>>((acc, unit) => {
      acc[unit.branch] = (acc[unit.branch] ?? 0) + 1;
      return acc;
    }, {});
    expect(byBranch.Bintaro).toBe(4);
    expect(byBranch.Cinere).toBe(5);
    expect(byBranch.Umum).toBe(2);
    expect(byBranch.Bandung).toBe(2);
  });
});
