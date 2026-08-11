import { Branch } from "@aos/meta-ads-connector";
import { createMockLogger } from "@aos/testing";
import { describe, expect, it } from "vitest";

import { ConflictResolutionService } from "../../../src/application/services/ConflictResolutionService.js";
import { InventoryUnitBuilder } from "../../../src/builders/InventoryUnitBuilder.js";
import { SourceSystem } from "../../../src/domain/value-objects/SourceSystem.js";
import { UnitStatus } from "../../../src/domain/value-objects/UnitStatus.js";
import {
  API_XPANDER_BINTARO,
  DMS_XPANDER_BINTARO,
  MOCK_XPANDER_BINTARO,
  SHEETS_XPANDER_BINTARO,
  taggedRaw,
} from "../../fixtures/inventoryFixtures.js";
import { unwrap } from "../../helpers/result.js";

const FIXED_NOW = () => new Date("2026-01-01T00:00:00.000Z");

describe("ConflictResolutionService.resolve", () => {
  it("API unit wins over DMS unit (same model/branch)", () => {
    const service = new ConflictResolutionService(undefined, FIXED_NOW);
    const winners = service.resolve([DMS_XPANDER_BINTARO, API_XPANDER_BINTARO]);
    expect(winners).toHaveLength(1);
    expect(winners[0]!.sourceSystem).toBe(SourceSystem.API);
  });

  it("DMS unit wins over Sheets unit", () => {
    const service = new ConflictResolutionService(undefined, FIXED_NOW);
    const winners = service.resolve([SHEETS_XPANDER_BINTARO, DMS_XPANDER_BINTARO]);
    expect(winners).toHaveLength(1);
    expect(winners[0]!.sourceSystem).toBe(SourceSystem.DMS);
  });

  it("SOLD status from API overrides AVAILABLE from Sheets (spec worked example)", () => {
    const service = new ConflictResolutionService(undefined, FIXED_NOW);
    const winners = service.resolve([SHEETS_XPANDER_BINTARO, API_XPANDER_BINTARO]);
    expect(winners).toHaveLength(1);
    expect(winners[0]!.status).toBe(UnitStatus.SOLD);
    expect(winners[0]!.price.toNumber()).toBe(195_000_000);
  });

  it("different model = no conflict, both added", () => {
    const service = new ConflictResolutionService(undefined, FIXED_NOW);
    const other = taggedRaw(
      { ...SHEETS_XPANDER_BINTARO, externalId: "SHEETS-002", model: "Avanza" },
      SourceSystem.GOOGLE_SHEETS,
    );
    const winners = service.resolve([SHEETS_XPANDER_BINTARO, other]);
    expect(winners).toHaveLength(2);
  });

  it("all 4 sources for the same unit resolve to exactly one winner: API", () => {
    const service = new ConflictResolutionService(undefined, FIXED_NOW);
    const winners = service.resolve([
      MOCK_XPANDER_BINTARO,
      SHEETS_XPANDER_BINTARO,
      DMS_XPANDER_BINTARO,
      API_XPANDER_BINTARO,
    ]);
    expect(winners).toHaveLength(1);
    expect(winners[0]!.sourceSystem).toBe(SourceSystem.API);
  });

  it("skips an invalid raw unit and logs a warning, keeping valid ones", () => {
    const logger = createMockLogger();
    const service = new ConflictResolutionService(logger as never, FIXED_NOW);
    const invalid = taggedRaw({ ...SHEETS_XPANDER_BINTARO, brand: "" }, SourceSystem.GOOGLE_SHEETS);
    const winners = service.resolve([invalid, DMS_XPANDER_BINTARO]);
    expect(winners).toHaveLength(1);
    expect(winners[0]!.sourceSystem).toBe(SourceSystem.DMS);
    expect(logger.warn).toHaveBeenCalled();
  });

  it("skips a raw unit with an unrecognized branch", () => {
    const service = new ConflictResolutionService(undefined, FIXED_NOW);
    const badBranch = taggedRaw(
      { ...SHEETS_XPANDER_BINTARO, branch: "Nowhere" },
      SourceSystem.GOOGLE_SHEETS,
    );
    const winners = service.resolve([badBranch]);
    expect(winners).toHaveLength(0);
  });

  it("skips a raw unit with an unrecognized status", () => {
    const service = new ConflictResolutionService(undefined, FIXED_NOW);
    const badStatus = taggedRaw(
      { ...SHEETS_XPANDER_BINTARO, status: "UNKNOWN" },
      SourceSystem.GOOGLE_SHEETS,
    );
    const winners = service.resolve([badStatus]);
    expect(winners).toHaveLength(0);
  });

  it("skips a raw unit with an unrecognized transmission", () => {
    const service = new ConflictResolutionService(undefined, FIXED_NOW);
    const badTransmission = taggedRaw(
      { ...SHEETS_XPANDER_BINTARO, transmission: "CVT" as "AT" },
      SourceSystem.GOOGLE_SHEETS,
    );
    const winners = service.resolve([badTransmission]);
    expect(winners).toHaveLength(0);
  });

  it("skips a raw unit with a whitespace-only brand (passes Zod, fails UnitBrand)", () => {
    const service = new ConflictResolutionService(undefined, FIXED_NOW);
    const badBrand = taggedRaw(
      { ...SHEETS_XPANDER_BINTARO, brand: "   " },
      SourceSystem.GOOGLE_SHEETS,
    );
    expect(service.resolve([badBrand])).toHaveLength(0);
  });

  it("skips a raw unit with a whitespace-only model (passes Zod, fails UnitModel)", () => {
    const service = new ConflictResolutionService(undefined, FIXED_NOW);
    const badModel = taggedRaw(
      { ...SHEETS_XPANDER_BINTARO, model: "   " },
      SourceSystem.GOOGLE_SHEETS,
    );
    expect(service.resolve([badModel])).toHaveLength(0);
  });

  it("skips a raw unit with a year outside UnitYear's bounds (passes Zod, fails UnitYear)", () => {
    const service = new ConflictResolutionService(undefined, FIXED_NOW);
    const badYear = taggedRaw(
      { ...SHEETS_XPANDER_BINTARO, year: 1900 },
      SourceSystem.GOOGLE_SHEETS,
    );
    expect(service.resolve([badYear])).toHaveLength(0);
  });

  it("skips a raw unit with a kilometer beyond UnitKilometer's max (passes Zod, fails UnitKilometer)", () => {
    const service = new ConflictResolutionService(undefined, FIXED_NOW);
    const badKm = taggedRaw(
      { ...SHEETS_XPANDER_BINTARO, kilometer: 1_000_000 },
      SourceSystem.GOOGLE_SHEETS,
    );
    expect(service.resolve([badKm])).toHaveLength(0);
  });

  it("skips a raw unit with a fractional price (passes Zod, fails UnitPrice)", () => {
    const service = new ConflictResolutionService(undefined, FIXED_NOW);
    const badPrice = taggedRaw(
      { ...SHEETS_XPANDER_BINTARO, priceIDR: 100.5 },
      SourceSystem.GOOGLE_SHEETS,
    );
    expect(service.resolve([badPrice])).toHaveLength(0);
  });

  it("skips a raw unit that fails Zod schema validation entirely (e.g. empty externalId)", () => {
    const service = new ConflictResolutionService(undefined, FIXED_NOW);
    const badSchema = taggedRaw(
      { ...SHEETS_XPANDER_BINTARO, externalId: "" },
      SourceSystem.GOOGLE_SHEETS,
    );
    expect(service.resolve([badSchema])).toHaveLength(0);
  });

  it("tags a DMS-sourced unit's dmsUnitId from externalId", () => {
    const service = new ConflictResolutionService(undefined, FIXED_NOW);
    const winners = service.resolve([DMS_XPANDER_BINTARO]);
    expect(winners[0]!.dmsUnitId?.toString()).toBe(DMS_XPANDER_BINTARO.externalId);
  });

  it("leaves dmsUnitId undefined for a non-DMS source", () => {
    const service = new ConflictResolutionService(undefined, FIXED_NOW);
    const winners = service.resolve([SHEETS_XPANDER_BINTARO]);
    expect(winners[0]!.dmsUnitId).toBeUndefined();
  });

  it("derives condition from kilometer thresholds", () => {
    const service = new ConflictResolutionService(undefined, FIXED_NOW);
    const good = taggedRaw({ ...SHEETS_XPANDER_BINTARO, kilometer: 10_000 }, SourceSystem.MOCK);
    const fair = taggedRaw(
      { ...SHEETS_XPANDER_BINTARO, kilometer: 50_000, externalId: "x2" },
      SourceSystem.MOCK,
    );
    const poor = taggedRaw(
      { ...SHEETS_XPANDER_BINTARO, kilometer: 90_000, externalId: "x3", model: "Different" },
      SourceSystem.MOCK,
    );
    const winners = service.resolve([good]);
    expect(winners[0]!.condition).toBe("GOOD");
    const winnersFair = service.resolve([fair]);
    expect(winnersFair[0]!.condition).toBe("FAIR");
    const winnersPoor = service.resolve([poor]);
    expect(winnersPoor[0]!.condition).toBe("POOR");
  });

  it("returns an empty array for an empty input", () => {
    const service = new ConflictResolutionService(undefined, FIXED_NOW);
    expect(service.resolve([])).toEqual([]);
  });
});

describe("ConflictResolutionService.merge", () => {
  it("lower-priority incoming does not override existing", () => {
    const service = new ConflictResolutionService(undefined, FIXED_NOW);
    const existing = unwrap(
      new InventoryUnitBuilder().withSourceSystem(SourceSystem.API).withPrice(200).build(),
    );
    const incoming = unwrap(
      new InventoryUnitBuilder().withSourceSystem(SourceSystem.MOCK).withPrice(100).build(),
    );
    const merged = service.merge(existing, incoming);
    expect(merged).toBe(existing);
  });

  it("higher-priority incoming replaces existing content but preserves id/createdAt", () => {
    const service = new ConflictResolutionService(undefined, FIXED_NOW);
    const existing = unwrap(
      new InventoryUnitBuilder()
        .withSourceSystem(SourceSystem.GOOGLE_SHEETS)
        .withPrice(100)
        .withCreatedAt(new Date("2025-01-01T00:00:00.000Z"))
        .build(),
    );
    const incoming = unwrap(
      new InventoryUnitBuilder().withSourceSystem(SourceSystem.API).withPrice(200).build(),
    );
    const merged = service.merge(existing, incoming);
    expect(merged.id.equals(existing.id)).toBe(true);
    expect(merged.createdAt).toEqual(existing.createdAt);
    expect(merged.price.toNumber()).toBe(200);
    expect(merged.sourceSystem).toBe(SourceSystem.API);
  });

  it("equal-priority incoming is treated as a refresh and replaces existing", () => {
    const service = new ConflictResolutionService(undefined, FIXED_NOW);
    const existing = unwrap(
      new InventoryUnitBuilder().withSourceSystem(SourceSystem.DMS).withPrice(100).build(),
    );
    const incoming = unwrap(
      new InventoryUnitBuilder().withSourceSystem(SourceSystem.DMS).withPrice(150).build(),
    );
    const merged = service.merge(existing, incoming);
    expect(merged.price.toNumber()).toBe(150);
  });
});

describe("ConflictResolutionService.compositeKeyOf", () => {
  it("is case-insensitive and stable for the same logical unit", () => {
    const service = new ConflictResolutionService(undefined, FIXED_NOW);
    const a = unwrap(
      new InventoryUnitBuilder()
        .withBrand("mitsubishi")
        .withModel("xpander cross")
        .withBranch(Branch.BINTARO)
        .build(),
    );
    const b = unwrap(
      new InventoryUnitBuilder()
        .withBrand("Mitsubishi")
        .withModel("Xpander Cross")
        .withBranch(Branch.BINTARO)
        .build(),
    );
    expect(service.compositeKeyOf(a)).toBe(service.compositeKeyOf(b));
    expect(ConflictResolutionService.compositeKeyOf(a)).toBe(service.compositeKeyOf(a));
  });

  it("differs when brand/model/year/transmission/branch differ", () => {
    const service = new ConflictResolutionService(undefined, FIXED_NOW);
    const a = unwrap(new InventoryUnitBuilder().withBranch(Branch.BINTARO).build());
    const b = unwrap(new InventoryUnitBuilder().withBranch(Branch.CINERE).build());
    expect(service.compositeKeyOf(a)).not.toBe(service.compositeKeyOf(b));
  });
});
