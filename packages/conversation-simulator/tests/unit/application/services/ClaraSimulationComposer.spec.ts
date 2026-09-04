import { ClaraAgentFactory } from "@aos/sales-agent";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ClaraSimulationComposer } from "../../../../src/application/services/ClaraSimulationComposer.js";
import { makeSimulatorConfig } from "../../../fixtures/simulatorFixtures.js";
import { unwrap } from "../../../helpers/result.js";

describe("ClaraSimulationComposer", () => {
  it("compose() with useRealInventory:false (default) wires a real, fully-synced MOCK-mode Clara agent", async () => {
    const composer = new ClaraSimulationComposer();
    const composition = unwrap(await composer.compose(makeSimulatorConfig()));

    expect(composition.agent.processIncomingMessage).toBeDefined();
    expect(composition.agent.followUpService).toBeDefined();
    expect(composition.inventorySpy.wasUsedWithResult).toBe(false);
    expect(composition.salesAgentConfig.tenantId).toBe("tenant-dss-motor-test");
    expect(composition.clock.current).toBeInstanceOf(Date);
  });

  it("compose() clock is mutable and independently controlled per composition", async () => {
    const composer = new ClaraSimulationComposer();
    const composition = unwrap(await composer.compose(makeSimulatorConfig()));
    const before = composition.clock.current;
    composition.clock.current = new Date(before.getTime() + 1000);
    expect(composition.clock.current.getTime()).toBe(before.getTime() + 1000);
  });

  /**
   * Design resolution #8, verified against the real `@aos/dss-inventory-connector`: with
   * `useRealInventory: true` and no Google Sheets/DMS/API credentials configured in this package,
   * `InventorySyncService` treats "zero configured adapters" as a *degraded but successful* sync
   * (`ok(SyncSession)` with `.status === "FAILED"`), not a `Result.err` — so `compose()` itself
   * still succeeds here, just with an empty inventory. This is the honest, non-silent limitation
   * this design resolution asked to be documented: `useRealInventory: true` composes a working
   * Clara agent, but one that can never find real units until real credentials are wired up
   * (out of scope for this package).
   */
  it("compose() with useRealInventory:true (design resolution #8) composes successfully but with 0 real units synced, since no real credentials are configured in this package", async () => {
    const composer = new ClaraSimulationComposer();
    const composition = unwrap(
      await composer.compose(makeSimulatorConfig({ useRealInventory: true })),
    );
    expect(composition.inventorySpy.getAll()).toHaveLength(0);
  });

  it("compose() seeds a sales human for the configured branch so handoffs can succeed", async () => {
    const composer = new ClaraSimulationComposer();
    const composition = unwrap(await composer.compose(makeSimulatorConfig()));
    expect(composition.agent.handoffService).toBeDefined();
  });

  describe("claraPromptOverride (AAOS Self-Learning AI, Phase C wiring)", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("compose() threads config.claraPromptOverride straight into ClaraAgentFactory.create's promptOverride option", async () => {
      const spy = vi.spyOn(ClaraAgentFactory, "create");
      const composer = new ClaraSimulationComposer();
      await composer.compose(makeSimulatorConfig({ claraPromptOverride: "custom override text" }));

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0]?.[0]).toMatchObject({ promptOverride: "custom override text" });
    });

    it("compose() with no claraPromptOverride configured → omits promptOverride entirely (today's real, unchanged default)", async () => {
      const spy = vi.spyOn(ClaraAgentFactory, "create");
      const composer = new ClaraSimulationComposer();
      await composer.compose(makeSimulatorConfig());

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0]?.[0]).not.toHaveProperty("promptOverride");
    });
  });

  describe("vertical: PROPERTY (AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 8)", () => {
    it("compose() wires a real PROPERTY ClaraAgent via ClaraAgentFactory.createPropertyAgent", async () => {
      const composer = new ClaraSimulationComposer();
      const composition = unwrap(
        await composer.compose(makeSimulatorConfig({ vertical: "PROPERTY" })),
      );

      expect(composition.agent.processIncomingMessage).toBeDefined();
      expect(composition.agent.followUpService).toBeDefined();
      expect(composition.listingSpy).toBeDefined();
      expect(composition.listingSpy?.wasUsedWithResult).toBe(false);
      // No automotive inventory connector is composed on the PROPERTY path.
      expect(composition.inventorySpy).toBeUndefined();
    });

    it("compose() with no listings supplied composes successfully with 0 active listings", async () => {
      const composer = new ClaraSimulationComposer();
      const composition = unwrap(
        await composer.compose(makeSimulatorConfig({ vertical: "PROPERTY" })),
      );
      expect(composition.listingSpy?.getActive()).toHaveLength(0);
    });

    it("compose() wraps SimulatorConfig.listings into the real IListingQueryService seam", async () => {
      const composer = new ClaraSimulationComposer();
      const composition = unwrap(
        await composer.compose(
          makeSimulatorConfig({
            vertical: "PROPERTY",
            listings: [
              {
                id: "listing-1",
                title: "Rumah Minimalis Cinere",
                propertyType: "RUMAH",
                price: 1_500_000_000,
                city: "Depok",
              },
            ],
          }),
        ),
      );
      expect(composition.listingSpy?.getActive()).toHaveLength(1);
      expect(composition.listingSpy?.wasUsedWithResult).toBe(true);
    });

    it("compose() seeds a sales human so PROPERTY handoffs can succeed", async () => {
      const composer = new ClaraSimulationComposer();
      const composition = unwrap(
        await composer.compose(makeSimulatorConfig({ vertical: "PROPERTY" })),
      );
      expect(composition.agent.handoffService).toBeDefined();
    });

    describe("claraPropertyPromptOverride / LLM field threading (AAOS Self-Learning AI, PROPERTY LLM wiring)", () => {
      afterEach(() => {
        vi.restoreAllMocks();
      });

      it("compose() threads config.claraPropertyPromptOverride into ClaraAgentFactory.createPropertyAgent's promptOverride option", async () => {
        const spy = vi.spyOn(ClaraAgentFactory, "createPropertyAgent");
        const composer = new ClaraSimulationComposer();
        await composer.compose(
          makeSimulatorConfig({
            vertical: "PROPERTY",
            claraPropertyPromptOverride: "custom property override text",
          }),
        );

        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy.mock.calls[0]?.[0]).toMatchObject({
          promptOverride: "custom property override text",
        });
      });

      it("compose() with no claraPropertyPromptOverride configured → omits promptOverride entirely", async () => {
        const spy = vi.spyOn(ClaraAgentFactory, "createPropertyAgent");
        const composer = new ClaraSimulationComposer();
        await composer.compose(makeSimulatorConfig({ vertical: "PROPERTY" }));

        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy.mock.calls[0]?.[0]).not.toHaveProperty("promptOverride");
      });

      it("compose() threads llmReplyEnabled/openaiApiKey into the PROPERTY branch's config (via SalesAgentConfig, resolved before the vertical branch)", async () => {
        const spy = vi.spyOn(ClaraAgentFactory, "createPropertyAgent");
        const composer = new ClaraSimulationComposer();
        await composer.compose(
          makeSimulatorConfig({
            vertical: "PROPERTY",
            llmReplyEnabled: true,
            openaiApiKey: "sk-test",
          }),
        );

        expect(spy).toHaveBeenCalledTimes(1);
        const passedConfig = spy.mock.calls[0]?.[0]?.config;
        expect(passedConfig?.llmReplyEnabled).toBe(true);
        expect(passedConfig?.openaiApiKey).toBe("sk-test");
      });
    });
  });
});
