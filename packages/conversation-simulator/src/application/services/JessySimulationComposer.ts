import { AssignmentMode, BranchManagerFactory, type BranchManager } from "@aos/branch-manager";
import { err, ok, type Result } from "@aos/common";
import { InventoryConnectorFactory } from "@aos/dss-inventory-connector";
import {
  JessyAgentFactory,
  parseSalesAgentConfig,
  type JessyAgentComposition,
  type SalesAgentConfig,
} from "@aos/sales-agent";

import type { SimulatorConfig } from "../../config/SimulatorConfig.js";
import { SimulatorError } from "../../domain/errors/SimulatorError.js";

import { InventoryQueryServiceSpy } from "./InventoryQueryServiceSpy.js";
import { ObservablePublisher } from "./ObservablePublisher.js";

/** A mutable clock box the simulator controls directly — `now: () => box.current` is the exact injectable-clock shape `@aos/sales-agent`'s own tests use (a plain `() => Date` closure), except here the closure reads a mutable cell so the simulator can *advance* time mid-session (design resolution #3) without rebuilding the whole composed agent. */
export interface SimulationClock {
  current: Date;
}

export interface JessySimulationComposition {
  readonly agent: JessyAgentComposition;
  readonly publisher: ObservablePublisher;
  readonly inventorySpy: InventoryQueryServiceSpy;
  readonly clock: SimulationClock;
  readonly salesAgentConfig: SalesAgentConfig;
}

const BRANCH_MANAGER_CONFIG = {
  tenantId: "tenant-dss-motor-simulator",
  phoneNumberIdBintaro: "PHONE_NUMBER_ID_BINTARO_SIM",
  phoneNumberIdCinere: "PHONE_NUMBER_ID_CINERE_SIM",
  phoneNumberIdPondokBambu: "PHONE_NUMBER_ID_PONDOK_BAMBU_SIM",
  phoneNumberIdBandung: "PHONE_NUMBER_ID_BANDUNG_SIM",
  phoneNumberBintaro: "+628190000001",
  phoneNumberCinere: "+628190000002",
  phoneNumberPondokBambu: "+628190000003",
  phoneNumberBandung: "+628190000004",
  defaultMaxLeadsPerSalesPerDay: 10,
  defaultAssignmentMode: AssignmentMode.SMART_ASSIGN,
  maxQueueSize: 100,
  queueTtlMs: 86_400_000,
} as const;

/**
 * Composes one fresh, fully-wired `JessyAgent` per simulation session (spec "Simulation Engine"
 * step 2-3: "Create fresh LeadConversation" / "Create fresh MockInventoryStore"). Never mocks
 * `@aos/sales-agent` itself, `@aos/branch-manager`'s `AssignLead`, or (when `useRealInventory` is
 * `false` — design resolution #8) `@aos/dss-inventory-connector`'s real `MOCK`-mode sync — only
 * the clock and the 2 observation seams (`ObservablePublisher`, `InventoryQueryServiceSpy`) are
 * simulator-owned.
 */
export class JessySimulationComposer {
  async compose(
    config: SimulatorConfig,
  ): Promise<Result<JessySimulationComposition, SimulatorError>> {
    const salesAgentConfigResult = parseSalesAgentConfig({ tenantId: config.tenantId });
    /* v8 ignore start -- unreachable in practice: `config.tenantId` is already validated
       non-empty by `SimulatorConfigSchema` before a `SimulatorConfig` can exist, and every other
       `SalesAgentConfig` field defaults from `@aos/sales-agent`'s own schema, so
       `parseSalesAgentConfig` can only fail here if that non-empty-string invariant is broken
       upstream. */
    if (!salesAgentConfigResult.ok) {
      return err(
        new SimulatorError(
          salesAgentConfigResult.error.code,
          `Failed to build SalesAgentConfig: ${salesAgentConfigResult.error.message}`,
          { cause: salesAgentConfigResult.error },
        ),
      );
    }
    /* v8 ignore stop */
    const salesAgentConfig = salesAgentConfigResult.value;

    const clock: SimulationClock = { current: new Date() };
    const now = (): Date => clock.current;

    const publisher: ObservablePublisher = new ObservablePublisher();
    const branchManager: BranchManager = BranchManagerFactory.create({
      config: { ...BRANCH_MANAGER_CONFIG, tenantId: config.tenantId },
      publisher,
      now,
    });

    const added = branchManager.addSalesHuman.execute({
      name: `Sales ${config.branchId}`,
      waNumber: "+628195000001",
      branchId: config.branchId,
    });
    /* v8 ignore start -- unreachable in practice: `config.branchId` is always one of the 4
       `BranchId` enum members `BranchManagerFactory` seeds branches for, and the seeded
       name/waNumber literals above are always well-formed, so `AddSalesHuman.execute` can only
       fail here if `@aos/branch-manager`'s own validation rules change — the same "unreachable"
       judgment call `@aos/branch-manager`'s own `BranchManagerFactory` makes for its analogous
       seed-building step. */
    if (!added.ok) {
      return err(
        new SimulatorError(added.error.code, `Failed to seed sales human: ${added.error.message}`, {
          cause: added.error,
        }),
      );
    }
    /* v8 ignore stop */

    const inventoryConnector = InventoryConnectorFactory.create({
      config: {
        tenantId: config.tenantId,
        syncMode: config.useRealInventory ? "LIVE" : "MOCK",
        apiSyncIntervalMs: 120_000,
        dmsSyncIntervalMs: 1_800_000,
        sheetsSyncIntervalMs: 900_000,
      },
      publisher,
    });
    const syncResult = await inventoryConnector.syncInventory.execute({
      correlationId: "simulator-sync",
    });
    /* v8 ignore start -- unreachable in practice, verified by reading `@aos/dss-inventory-
       connector`'s real `InventorySyncService.fail()`: a sync with zero configured adapters (the
       `useRealInventory: true` case in this package, design resolution #8 — no real Google
       Sheets/DMS/API credentials are configured here) is recorded as a *degraded but successful*
       `ok(SyncSession)` whose `.status` is `"FAILED"`, never a `Result.err` — `err` is reserved
       for exceptional infra failures in that package's own design, not "no adapters available".
       This branch would only fire if that upstream contract changed. The real, verified
       `useRealInventory: true` behavior (composes successfully, 0 units synced) is covered by
       `JessySimulationComposer.spec.ts`. */
    if (!syncResult.ok) {
      return err(
        new SimulatorError(
          syncResult.error.code,
          `Inventory sync failed (useRealInventory=${config.useRealInventory}): ${syncResult.error.message}`,
          { cause: syncResult.error },
        ),
      );
    }
    /* v8 ignore stop */

    const inventorySpy = new InventoryQueryServiceSpy(inventoryConnector.queryService);

    const agent = JessyAgentFactory.create({
      config: salesAgentConfig,
      branchId: config.branchId,
      publisher,
      assignLead: branchManager.assignLead,
      salesTeamRegistry: branchManager.salesTeamRegistry,
      inventoryQueryService: inventorySpy,
      now,
    });

    return ok({ agent, publisher, inventorySpy, clock, salesAgentConfig });
  }
}
