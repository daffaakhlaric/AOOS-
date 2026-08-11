import { createMockLogger } from "@aos/testing";
import { describe, expect, it } from "vitest";

import { ConflictResolutionService } from "../../../src/application/services/ConflictResolutionService.js";
import { InventorySyncService } from "../../../src/application/services/InventorySyncService.js";
import { AdapterError } from "../../../src/domain/errors/index.js";
import { DssInventoryConnectorEvents } from "../../../src/domain/events/DssInventoryConnectorEvents.js";
import { SourcePriority } from "../../../src/domain/value-objects/SourcePriority.js";
import { SourceSystem } from "../../../src/domain/value-objects/SourceSystem.js";
import { MockInventoryAdapter } from "../../../src/infrastructure/adapters/MockInventoryAdapter.js";
import { InventorySourceRegistry } from "../../../src/infrastructure/registry/InventorySourceRegistry.js";
import { InMemoryInventoryStore } from "../../../src/infrastructure/store/InMemoryInventoryStore.js";
import { createFakeAdapter } from "../../helpers/fakeAdapter.js";
import { createFakePublisher } from "../../helpers/publisher.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

const FIXED_NOW = () => new Date("2026-01-01T00:00:00.000Z");

function buildService(options: {
  readonly syncMode: "MOCK" | "LIVE" | "HYBRID";
  readonly registry?: InventorySourceRegistry;
  readonly store?: InMemoryInventoryStore;
}) {
  const registry = options.registry ?? new InventorySourceRegistry();
  const store = options.store ?? new InMemoryInventoryStore();
  const logger = createMockLogger();
  const publisher = createFakePublisher();
  const events = new DssInventoryConnectorEvents(publisher);
  const resolver = new ConflictResolutionService(logger as never, FIXED_NOW);
  const service = new InventorySyncService(
    registry,
    store,
    resolver,
    events,
    logger as never,
    { syncMode: options.syncMode, tenantId: "dss-motor" },
    FIXED_NOW,
  );
  return { service, registry, store, logger, publisher };
}

describe("InventorySyncService.syncAll — MOCK mode", () => {
  it("with only mock configured → COMPLETED, 13 units added (corrected mock_data_integrity)", async () => {
    const { service, registry, store, publisher } = buildService({ syncMode: "MOCK" });
    registry.register(new MockInventoryAdapter());

    const session = unwrap(await service.syncAll("corr-1"));
    expect(session.status).toBe("COMPLETED");
    expect(session.unitsAdded).toBe(13);
    expect(store.size()).toBe(13);
    expect(publisher.published.some((p) => p.type === "aaos.inventory.sync.completed")).toBe(true);
    expect(publisher.published.some((p) => p.type === "aaos.inventory.unit.added")).toBe(true);
    expect(publisher.published.some((p) => p.type === "aaos.inventory.changed")).toBe(true);
  });

  it("with no mock adapter registered → FAILED session (ok Result, SyncFailed event)", async () => {
    const { service, publisher } = buildService({ syncMode: "MOCK" });
    const session = unwrap(await service.syncAll("corr-1"));
    expect(session.status).toBe("FAILED");
    expect(publisher.published.some((p) => p.type === "aaos.inventory.sync.failed")).toBe(true);
  });
});

describe("InventorySyncService.syncAll — graceful skip of unconfigured adapters", () => {
  it("HYBRID with 3 unconfigured real adapters + configured mock → COMPLETED using only mock data", async () => {
    const { service, registry, logger } = buildService({ syncMode: "HYBRID" });
    registry.register(new MockInventoryAdapter());
    registry.register(
      createFakeAdapter({
        sourceSystem: SourceSystem.GOOGLE_SHEETS,
        priority: SourcePriority.SHEETS,
        configured: false,
      }),
    );
    registry.register(
      createFakeAdapter({
        sourceSystem: SourceSystem.DMS,
        priority: SourcePriority.DMS,
        configured: false,
      }),
    );
    registry.register(
      createFakeAdapter({
        sourceSystem: SourceSystem.API,
        priority: SourcePriority.API,
        configured: false,
      }),
    );

    const session = unwrap(await service.syncAll("corr-1"));
    expect(session.status).toBe("COMPLETED");
    expect(session.unitsAdded).toBe(13);
    expect(logger.warn).toHaveBeenCalled();
  });
});

describe("InventorySyncService.syncAll — failure scenarios", () => {
  it("all configured adapters failing → FAILED session + SyncFailed event", async () => {
    const { service, registry, publisher } = buildService({ syncMode: "HYBRID" });
    registry.register(
      createFakeAdapter({
        sourceSystem: SourceSystem.MOCK,
        priority: SourcePriority.MOCK,
        configured: true,
        fetchError: new AdapterError("boom", { source: SourceSystem.MOCK }),
      }),
    );
    registry.register(
      createFakeAdapter({
        sourceSystem: SourceSystem.API,
        priority: SourcePriority.API,
        configured: true,
        rejectWith: new Error("network down"),
      }),
    );

    const session = unwrap(await service.syncAll("corr-1"));
    expect(session.status).toBe("FAILED");
    expect(session.errors.length).toBeGreaterThan(0);
    expect(publisher.published.some((p) => p.type === "aaos.inventory.sync.failed")).toBe(true);
  });

  it("LIVE mode with nothing configured → FAILED session (ok Result) + SyncFailed event", async () => {
    const { service, registry, publisher } = buildService({ syncMode: "LIVE" });
    registry.register(new MockInventoryAdapter()); // excluded from LIVE regardless of configured
    const session = unwrap(await service.syncAll("corr-1"));
    expect(session.status).toBe("FAILED");
    expect(session.errors[0]).toContain("LIVE sync mode requires");
    expect(publisher.published.some((p) => p.type === "aaos.inventory.sync.failed")).toBe(true);
  });

  it("PARTIAL when one configured adapter fails but another succeeds", async () => {
    const { service, registry } = buildService({ syncMode: "HYBRID" });
    registry.register(new MockInventoryAdapter());
    registry.register(
      createFakeAdapter({
        sourceSystem: SourceSystem.API,
        priority: SourcePriority.API,
        configured: true,
        fetchError: new AdapterError("api down", { source: SourceSystem.API }),
      }),
    );

    const session = unwrap(await service.syncAll("corr-1"));
    expect(session.status).toBe("PARTIAL");
    expect(session.errors).toHaveLength(1);
  });
});

describe("InventorySyncService.syncAll — LIVE mode", () => {
  it("only attempts the 3 real-source adapters, never mock", async () => {
    const { service, registry, store } = buildService({ syncMode: "LIVE" });
    registry.register(new MockInventoryAdapter());
    registry.register(
      createFakeAdapter({
        sourceSystem: SourceSystem.API,
        priority: SourcePriority.API,
        configured: true,
        units: [
          {
            externalId: "API-1",
            brand: "Toyota",
            model: "Fortuner",
            year: 2021,
            transmission: "AT",
            color: "Hitam",
            kilometer: 20_000,
            priceIDR: 400_000_000,
            branch: "Bintaro",
            status: "AVAILABLE",
          },
        ],
      }),
    );
    const session = unwrap(await service.syncAll("corr-1"));
    expect(session.status).toBe("COMPLETED");
    expect(session.unitsAdded).toBe(1);
    expect(store.size()).toBe(1);
  });
});

describe("InventorySyncService.syncAll — status transitions and events", () => {
  it("emits UnitSold when a unit's resolved status changes AVAILABLE → SOLD across syncs", async () => {
    const { service, registry, publisher } = buildService({ syncMode: "MOCK" });
    const unit = {
      externalId: "X-1",
      brand: "Mitsubishi",
      model: "Xpander",
      year: 2020,
      transmission: "AT" as const,
      color: "Putih",
      kilometer: 30_000,
      priceIDR: 200_000_000,
      branch: "Bintaro",
      status: "AVAILABLE",
    };
    const adapter = createFakeAdapter({
      sourceSystem: SourceSystem.MOCK,
      priority: SourcePriority.MOCK,
      configured: true,
      units: [unit],
    });
    registry.register(adapter);

    const first = unwrap(await service.syncAll("corr-1"));
    expect(first.unitsAdded).toBe(1);
    expect(publisher.published.filter((p) => p.type === "aaos.inventory.unit.sold")).toHaveLength(
      0,
    );

    // Second sync: the same fake adapter now reports the unit as SOLD.
    (adapter as unknown as { fetchUnits: () => Promise<unknown> }).fetchUnits = async () => ({
      ok: true,
      value: [{ ...unit, status: "SOLD" }],
    });

    const second = unwrap(await service.syncAll("corr-2"));
    expect(second.unitsSold).toBe(1);
    expect(publisher.published.some((p) => p.type === "aaos.inventory.unit.sold")).toBe(true);
  });

  it("emits UnitReserved when a unit's resolved status changes to RESERVED", async () => {
    const { service, registry, publisher } = buildService({ syncMode: "MOCK" });
    const unit = {
      externalId: "X-2",
      brand: "Honda",
      model: "Brio",
      year: 2020,
      transmission: "AT" as const,
      color: "Merah",
      kilometer: 20_000,
      priceIDR: 150_000_000,
      branch: "Cinere",
      status: "AVAILABLE",
    };
    const adapter = createFakeAdapter({
      sourceSystem: SourceSystem.MOCK,
      priority: SourcePriority.MOCK,
      configured: true,
      units: [unit],
    });
    registry.register(adapter);
    await service.syncAll("corr-1");

    (adapter as unknown as { fetchUnits: () => Promise<unknown> }).fetchUnits = async () => ({
      ok: true,
      value: [{ ...unit, status: "RESERVED" }],
    });
    const second = unwrap(await service.syncAll("corr-2"));
    expect(second.unitsUpdated).toBeGreaterThanOrEqual(1);
    expect(publisher.published.some((p) => p.type === "aaos.inventory.unit.reserved")).toBe(true);
  });

  it("emits UnitUpdated when a unit's price changes without a status transition", async () => {
    const { service, registry, publisher } = buildService({ syncMode: "MOCK" });
    const unit = {
      externalId: "X-3",
      brand: "Toyota",
      model: "Rush",
      year: 2020,
      transmission: "AT" as const,
      color: "Hitam",
      kilometer: 20_000,
      priceIDR: 200_000_000,
      branch: "Bandung",
      status: "AVAILABLE",
    };
    const adapter = createFakeAdapter({
      sourceSystem: SourceSystem.MOCK,
      priority: SourcePriority.MOCK,
      configured: true,
      units: [unit],
    });
    registry.register(adapter);
    await service.syncAll("corr-1");

    (adapter as unknown as { fetchUnits: () => Promise<unknown> }).fetchUnits = async () => ({
      ok: true,
      value: [{ ...unit, priceIDR: 210_000_000 }],
    });
    const second = unwrap(await service.syncAll("corr-2"));
    expect(second.unitsUpdated).toBe(1);
    expect(publisher.published.some((p) => p.type === "aaos.inventory.unit.updated")).toBe(true);
  });

  it("emits UnitUpdated when only color changes (diffFields includes 'color')", async () => {
    const { service, registry, publisher } = buildService({ syncMode: "MOCK" });
    const unit = {
      externalId: "X-6",
      brand: "Daihatsu",
      model: "Xenia",
      year: 2020,
      transmission: "AT" as const,
      color: "Silver",
      kilometer: 20_000,
      priceIDR: 160_000_000,
      branch: "Bintaro",
      status: "AVAILABLE",
    };
    const adapter = createFakeAdapter({
      sourceSystem: SourceSystem.MOCK,
      priority: SourcePriority.MOCK,
      configured: true,
      units: [unit],
    });
    registry.register(adapter);
    await service.syncAll("corr-1");

    (adapter as unknown as { fetchUnits: () => Promise<unknown> }).fetchUnits = async () => ({
      ok: true,
      value: [{ ...unit, color: "Hitam" }],
    });
    const second = unwrap(await service.syncAll("corr-2"));
    expect(second.unitsUpdated).toBe(1);
    const updatedEvent = publisher.published.find((p) => p.type === "aaos.inventory.unit.updated");
    expect((updatedEvent?.payload as { changedFields: string[] }).changedFields).toEqual(["color"]);
  });

  it("emits UnitUpdated when only kilometer/condition change (diffFields includes both)", async () => {
    const { service, registry, publisher } = buildService({ syncMode: "MOCK" });
    const unit = {
      externalId: "X-4",
      brand: "Honda",
      model: "Jazz",
      year: 2020,
      transmission: "AT" as const,
      color: "Silver",
      kilometer: 10_000, // GOOD
      priceIDR: 180_000_000,
      branch: "Bintaro",
      status: "AVAILABLE",
    };
    const adapter = createFakeAdapter({
      sourceSystem: SourceSystem.MOCK,
      priority: SourcePriority.MOCK,
      configured: true,
      units: [unit],
    });
    registry.register(adapter);
    await service.syncAll("corr-1");

    (adapter as unknown as { fetchUnits: () => Promise<unknown> }).fetchUnits = async () => ({
      ok: true,
      value: [{ ...unit, kilometer: 50_000 }], // crosses into FAIR
    });
    const second = unwrap(await service.syncAll("corr-2"));
    expect(second.unitsUpdated).toBe(1);
    const updatedEvent = publisher.published.find((p) => p.type === "aaos.inventory.unit.updated");
    expect((updatedEvent?.payload as { changedFields: string[] }).changedFields).toEqual(
      expect.arrayContaining(["kilometer", "condition"]),
    );
  });

  it("counts a sourceSystem change (no price/status/kilometer change) as UnitUpdated", async () => {
    const { service, registry, publisher } = buildService({ syncMode: "HYBRID" });
    const unit = {
      externalId: "X-5",
      brand: "Suzuki",
      model: "Ertiga",
      year: 2020,
      transmission: "AT" as const,
      color: "Putih",
      kilometer: 15_000,
      priceIDR: 175_000_000,
      branch: "Bintaro",
      status: "AVAILABLE",
    };
    registry.register(
      createFakeAdapter({
        sourceSystem: SourceSystem.MOCK,
        priority: SourcePriority.MOCK,
        units: [],
      }),
    );
    const sheetsAdapter = createFakeAdapter({
      sourceSystem: SourceSystem.GOOGLE_SHEETS,
      priority: SourcePriority.SHEETS,
      units: [unit],
    });
    registry.register(sheetsAdapter);
    await service.syncAll("corr-1");

    // Second sync: a higher-priority DMS source reports the exact same content — only sourceSystem differs.
    registry.register(
      createFakeAdapter({
        sourceSystem: SourceSystem.DMS,
        priority: SourcePriority.DMS,
        units: [unit],
      }),
    );
    (sheetsAdapter as unknown as { fetchUnits: () => Promise<unknown> }).fetchUnits = async () => ({
      ok: true,
      value: [],
    });
    const second = unwrap(await service.syncAll("corr-2"));
    expect(second.unitsUpdated).toBe(1);
    const updatedEvent = publisher.published.find((p) => p.type === "aaos.inventory.unit.updated");
    expect((updatedEvent?.payload as { changedFields: string[] }).changedFields).toEqual([
      "sourceSystem",
    ]);
  });

  it("does not double-count an unchanged unit as added or updated on a second identical sync", async () => {
    const { service, registry } = buildService({ syncMode: "MOCK" });
    registry.register(new MockInventoryAdapter());
    await service.syncAll("corr-1");
    const second = unwrap(await service.syncAll("corr-2"));
    expect(second.unitsAdded).toBe(0);
    expect(second.unitsUpdated).toBe(0);
    expect(second.unitsSold).toBe(0);
    expect(second.status).toBe("COMPLETED");
  });
});

describe("InventorySyncService.syncFromSource", () => {
  it("syncs from exactly one registered source", async () => {
    const { service, registry, store } = buildService({ syncMode: "MOCK" });
    registry.register(new MockInventoryAdapter());
    const session = unwrap(await service.syncFromSource(SourceSystem.MOCK, "corr-1"));
    expect(session.sources).toEqual([SourceSystem.MOCK]);
    expect(store.size()).toBe(13);
  });

  it("returns err(SyncError) for an unregistered source", async () => {
    const { service } = buildService({ syncMode: "MOCK" });
    const error = unwrapErr(await service.syncFromSource(SourceSystem.DMS, "corr-1"));
    expect(error.message).toContain("No adapter registered");
  });
});
