import { err, ok } from "@aos/common";
import { createMockLogger } from "@aos/testing";
import { describe, expect, it, vi } from "vitest";

import { EventListenerService } from "../../../src/application/services/EventListenerService.js";
import { EventName } from "../../../src/domain/value-objects/EventName.js";
import {
  buildClosing,
  buildLead,
  createFakeClosingRepository,
  createGetLead,
  makeEvent,
} from "../../helpers/lead-store-fakes.js";
import { createFakeSubscriptionManager } from "../../helpers/subscription-manager.js";

const occurredAt = new Date("2024-08-09T14:03:00.000Z");

function fakeCapiEventService() {
  return {
    sendContact: vi.fn(async () => ok({ eventName: EventName.CONTACT, success: true })),
    sendInitiateCheckout: vi.fn(async () =>
      ok({ eventName: EventName.INITIATE_CHECKOUT, success: true }),
    ),
    sendAddToWishlist: vi.fn(async () =>
      ok({ eventName: EventName.ADD_TO_WISHLIST, success: true }),
    ),
    sendLead: vi.fn(async () => ok({ eventName: EventName.LEAD, success: true })),
    sendPurchase: vi.fn(async () => ok({ eventName: EventName.PURCHASE, success: true })),
  };
}

describe("EventListenerService", () => {
  describe("start/stop", () => {
    it("subscribes to all 4 real lead-store topics", () => {
      const subscriptionManager = createFakeSubscriptionManager();
      const service = new EventListenerService(
        subscriptionManager,
        createGetLead(),
        createFakeClosingRepository(),
        fakeCapiEventService() as never,
        createMockLogger() as never,
        "dss-motor",
      );
      service.start();
      const topics = subscriptionManager.subscribed.map((s) => s.criteria.topic);
      expect(topics).toEqual([
        "aaos.lead-store.lead.created",
        "aaos.lead-store.lead.became-hot",
        "aaos.lead-store.lead.score-updated",
        "aaos.lead-store.closing.recorded",
      ]);
    });

    it("stop() unsubscribes every subscription start() created", () => {
      const subscriptionManager = createFakeSubscriptionManager();
      const service = new EventListenerService(
        subscriptionManager,
        createGetLead(),
        createFakeClosingRepository(),
        fakeCapiEventService() as never,
        createMockLogger() as never,
        "dss-motor",
      );
      service.start();
      expect(subscriptionManager.count).toBe(4);
      service.stop();
      expect(subscriptionManager.unsubscribed).toHaveLength(4);
      expect(subscriptionManager.count).toBe(0);
    });
  });

  describe("aaos.lead-store.lead.created -> Contact", () => {
    it("sends Contact using the payload's own leadPhone/adId/campaignId directly (no lookup needed)", async () => {
      const subscriptionManager = createFakeSubscriptionManager();
      const capiEventService = fakeCapiEventService();
      const service = new EventListenerService(
        subscriptionManager,
        createGetLead(),
        createFakeClosingRepository(),
        capiEventService as never,
        createMockLogger() as never,
        "dss-motor",
      );
      service.start();

      const event = makeEvent(
        "aaos.lead-store.lead.created",
        {
          leadId: "lead-1",
          leadPhone: "+628123456789",
          branchId: "branch-1",
          leadSource: "CTWA",
          campaignId: "camp-1",
          adId: "ad-1",
          tenantId: "dss-motor",
          correlationId: "corr-1",
          occurredAt,
          version: "1.0",
        },
        { correlationId: "corr-1" },
      );
      await subscriptionManager.dispatch("aaos.lead-store.lead.created", event);

      expect(capiEventService.sendContact).toHaveBeenCalledWith({
        phone: "+628123456789",
        adId: "ad-1",
        campaignId: "camp-1",
        occurredAt,
        tenantId: "dss-motor",
        correlationId: "corr-1",
      });
    });

    it("logs and does not throw when sendContact fails", async () => {
      const subscriptionManager = createFakeSubscriptionManager();
      const capiEventService = fakeCapiEventService();
      capiEventService.sendContact.mockResolvedValueOnce(err(new Error("boom")) as never);
      const logger = createMockLogger();
      const service = new EventListenerService(
        subscriptionManager,
        createGetLead(),
        createFakeClosingRepository(),
        capiEventService as never,
        logger as never,
        "dss-motor",
      );
      service.start();
      const event = makeEvent("aaos.lead-store.lead.created", {
        leadId: "lead-1",
        leadPhone: "+628123456789",
        branchId: "branch-1",
        leadSource: "CTWA",
        tenantId: "dss-motor",
        correlationId: "corr-1",
        occurredAt,
        version: "1.0",
      });
      await expect(
        subscriptionManager.dispatch("aaos.lead-store.lead.created", event),
      ).resolves.toBeUndefined();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe("aaos.lead-store.lead.became-hot -> AddToWishlist (via GetLead lookup)", () => {
    it("resolves phone/adId via GetLead since the payload carries neither", async () => {
      const subscriptionManager = createFakeSubscriptionManager();
      const lead = buildLead({ leadPhone: "+628129999999", adId: "ad-99" });
      const capiEventService = fakeCapiEventService();
      const service = new EventListenerService(
        subscriptionManager,
        createGetLead([lead]),
        createFakeClosingRepository(),
        capiEventService as never,
        createMockLogger() as never,
        "dss-motor",
      );
      service.start();

      const event = makeEvent("aaos.lead-store.lead.became-hot", {
        leadId: lead.id.toString(),
        branchId: "branch-1",
        score: 70,
        becameHotAt: occurredAt,
        tenantId: "dss-motor",
        correlationId: "corr-1",
        occurredAt,
        version: "1.0",
      });
      await subscriptionManager.dispatch("aaos.lead-store.lead.became-hot", event);

      expect(capiEventService.sendAddToWishlist).toHaveBeenCalledWith({
        phone: "+628129999999",
        adId: "ad-99",
        campaignId: undefined,
        occurredAt,
        tenantId: "dss-motor",
        correlationId: "corr-1",
      });
    });

    it("logs and returns when GetLead fails to find the lead", async () => {
      const subscriptionManager = createFakeSubscriptionManager();
      const capiEventService = fakeCapiEventService();
      const logger = createMockLogger();
      const service = new EventListenerService(
        subscriptionManager,
        createGetLead([]),
        createFakeClosingRepository(),
        capiEventService as never,
        logger as never,
        "dss-motor",
      );
      service.start();
      const event = makeEvent("aaos.lead-store.lead.became-hot", {
        leadId: "does-not-exist",
        branchId: "branch-1",
        score: 70,
        becameHotAt: occurredAt,
        tenantId: "dss-motor",
        correlationId: "corr-1",
        occurredAt,
        version: "1.0",
      });
      await subscriptionManager.dispatch("aaos.lead-store.lead.became-hot", event);
      expect(capiEventService.sendAddToWishlist).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalled();
    });

    it("logs and does not throw when sendAddToWishlist fails", async () => {
      const subscriptionManager = createFakeSubscriptionManager();
      const lead = buildLead({ leadPhone: "+628129999999" });
      const capiEventService = fakeCapiEventService();
      capiEventService.sendAddToWishlist.mockResolvedValueOnce(
        err(new Error("send failed")) as never,
      );
      const logger = createMockLogger();
      const service = new EventListenerService(
        subscriptionManager,
        createGetLead([lead]),
        createFakeClosingRepository(),
        capiEventService as never,
        logger as never,
        "dss-motor",
      );
      service.start();
      const event = makeEvent("aaos.lead-store.lead.became-hot", {
        leadId: lead.id.toString(),
        branchId: "branch-1",
        score: 70,
        becameHotAt: occurredAt,
        tenantId: "dss-motor",
        correlationId: "corr-1",
        occurredAt,
        version: "1.0",
      });
      await expect(
        subscriptionManager.dispatch("aaos.lead-store.lead.became-hot", event),
      ).resolves.toBeUndefined();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe("aaos.lead-store.lead.score-updated -> InitiateCheckout (threshold-crossing guard)", () => {
    it("fires when scoreAfter >= 30 && scoreBefore < 30", async () => {
      const subscriptionManager = createFakeSubscriptionManager();
      const lead = buildLead({ leadPhone: "+628127777777" });
      const capiEventService = fakeCapiEventService();
      const service = new EventListenerService(
        subscriptionManager,
        createGetLead([lead]),
        createFakeClosingRepository(),
        capiEventService as never,
        createMockLogger() as never,
        "dss-motor",
      );
      service.start();
      const event = makeEvent("aaos.lead-store.lead.score-updated", {
        leadId: lead.id.toString(),
        scoreBefore: 20,
        scoreAfter: 35,
        delta: 15,
        reason: "qualification",
        tenantId: "dss-motor",
        correlationId: "corr-1",
        occurredAt,
        version: "1.0",
      });
      await subscriptionManager.dispatch("aaos.lead-store.lead.score-updated", event);
      expect(capiEventService.sendInitiateCheckout).toHaveBeenCalledTimes(1);
    });

    it("does NOT fire when the score was already >= 30 before this update (no re-fire)", async () => {
      const subscriptionManager = createFakeSubscriptionManager();
      const lead = buildLead({ leadPhone: "+628127777777" });
      const capiEventService = fakeCapiEventService();
      const service = new EventListenerService(
        subscriptionManager,
        createGetLead([lead]),
        createFakeClosingRepository(),
        capiEventService as never,
        createMockLogger() as never,
        "dss-motor",
      );
      service.start();
      const event = makeEvent("aaos.lead-store.lead.score-updated", {
        leadId: lead.id.toString(),
        scoreBefore: 40,
        scoreAfter: 55,
        delta: 15,
        reason: "qualification",
        tenantId: "dss-motor",
        correlationId: "corr-1",
        occurredAt,
        version: "1.0",
      });
      await subscriptionManager.dispatch("aaos.lead-store.lead.score-updated", event);
      expect(capiEventService.sendInitiateCheckout).not.toHaveBeenCalled();
    });

    it("does NOT fire when the score is still below 30", async () => {
      const subscriptionManager = createFakeSubscriptionManager();
      const lead = buildLead({ leadPhone: "+628127777777" });
      const capiEventService = fakeCapiEventService();
      const service = new EventListenerService(
        subscriptionManager,
        createGetLead([lead]),
        createFakeClosingRepository(),
        capiEventService as never,
        createMockLogger() as never,
        "dss-motor",
      );
      service.start();
      const event = makeEvent("aaos.lead-store.lead.score-updated", {
        leadId: lead.id.toString(),
        scoreBefore: 5,
        scoreAfter: 20,
        delta: 15,
        reason: "qualification",
        tenantId: "dss-motor",
        correlationId: "corr-1",
        occurredAt,
        version: "1.0",
      });
      await subscriptionManager.dispatch("aaos.lead-store.lead.score-updated", event);
      expect(capiEventService.sendInitiateCheckout).not.toHaveBeenCalled();
      // GetLead is only called once the threshold-crossing guard passes.
    });

    it("logs and returns when GetLead fails after a threshold crossing", async () => {
      const subscriptionManager = createFakeSubscriptionManager();
      const capiEventService = fakeCapiEventService();
      const logger = createMockLogger();
      const service = new EventListenerService(
        subscriptionManager,
        createGetLead([]),
        createFakeClosingRepository(),
        capiEventService as never,
        logger as never,
        "dss-motor",
      );
      service.start();
      const event = makeEvent("aaos.lead-store.lead.score-updated", {
        leadId: "does-not-exist",
        scoreBefore: 10,
        scoreAfter: 40,
        delta: 30,
        reason: "qualification",
        tenantId: "dss-motor",
        correlationId: "corr-1",
        occurredAt,
        version: "1.0",
      });
      await subscriptionManager.dispatch("aaos.lead-store.lead.score-updated", event);
      expect(capiEventService.sendInitiateCheckout).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalled();
    });

    it("logs and does not throw when sendInitiateCheckout fails", async () => {
      const subscriptionManager = createFakeSubscriptionManager();
      const lead = buildLead({ leadPhone: "+628127777777" });
      const capiEventService = fakeCapiEventService();
      capiEventService.sendInitiateCheckout.mockResolvedValueOnce(
        err(new Error("send failed")) as never,
      );
      const logger = createMockLogger();
      const service = new EventListenerService(
        subscriptionManager,
        createGetLead([lead]),
        createFakeClosingRepository(),
        capiEventService as never,
        logger as never,
        "dss-motor",
      );
      service.start();
      const event = makeEvent("aaos.lead-store.lead.score-updated", {
        leadId: lead.id.toString(),
        scoreBefore: 10,
        scoreAfter: 40,
        delta: 30,
        reason: "qualification",
        tenantId: "dss-motor",
        correlationId: "corr-1",
        occurredAt,
        version: "1.0",
      });
      await expect(
        subscriptionManager.dispatch("aaos.lead-store.lead.score-updated", event),
      ).resolves.toBeUndefined();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe("aaos.lead-store.closing.recorded", () => {
    it("TEST_DRIVE -> sendLead, resolving phone via GetLead and unitId via IClosingRepository", async () => {
      const subscriptionManager = createFakeSubscriptionManager();
      const lead = buildLead({ leadPhone: "+628126666666" });
      const closing = buildClosing({ closingType: "TEST_DRIVE" as never, unitId: "unit-42" });
      const capiEventService = fakeCapiEventService();
      const service = new EventListenerService(
        subscriptionManager,
        createGetLead([lead]),
        createFakeClosingRepository([closing]),
        capiEventService as never,
        createMockLogger() as never,
        "dss-motor",
      );
      service.start();
      const event = makeEvent("aaos.lead-store.closing.recorded", {
        closingId: closing.id.toString(),
        leadId: lead.id.toString(),
        branchId: "branch-1",
        closingType: "TEST_DRIVE",
        tenantId: "dss-motor",
        correlationId: "corr-1",
        occurredAt,
        version: "1.0",
      });
      await subscriptionManager.dispatch("aaos.lead-store.closing.recorded", event);
      expect(capiEventService.sendLead).toHaveBeenCalledWith({
        phone: "+628126666666",
        unitId: "unit-42",
        occurredAt,
        tenantId: "dss-motor",
        correlationId: "corr-1",
      });
    });

    it("SPK -> sendPurchase with unitPrice from the Closing entity, never commissionIdr", async () => {
      const subscriptionManager = createFakeSubscriptionManager();
      const lead = buildLead({ leadPhone: "+628125555555" });
      const closing = buildClosing({
        closingType: "SPK" as never,
        unitId: "unit-7",
        unitPrice: 195_000_000,
        commissionIdr: 5_000_000,
      });
      const capiEventService = fakeCapiEventService();
      const service = new EventListenerService(
        subscriptionManager,
        createGetLead([lead]),
        createFakeClosingRepository([closing]),
        capiEventService as never,
        createMockLogger() as never,
        "dss-motor",
      );
      service.start();
      const event = makeEvent("aaos.lead-store.closing.recorded", {
        closingId: closing.id.toString(),
        leadId: lead.id.toString(),
        branchId: "branch-1",
        closingType: "SPK",
        commissionIdr: 5_000_000,
        tenantId: "dss-motor",
        correlationId: "corr-1",
        occurredAt,
        version: "1.0",
      });
      await subscriptionManager.dispatch("aaos.lead-store.closing.recorded", event);
      expect(capiEventService.sendPurchase).toHaveBeenCalledWith({
        phone: "+628125555555",
        unitId: "unit-7",
        unitPrice: 195_000_000,
        occurredAt,
        tenantId: "dss-motor",
        correlationId: "corr-1",
      });
    });

    it("CANCELLED -> explicit no-op, sends nothing to Meta CAPI", async () => {
      const subscriptionManager = createFakeSubscriptionManager();
      const lead = buildLead();
      const capiEventService = fakeCapiEventService();
      const logger = createMockLogger();
      const service = new EventListenerService(
        subscriptionManager,
        createGetLead([lead]),
        createFakeClosingRepository(),
        capiEventService as never,
        logger as never,
        "dss-motor",
      );
      service.start();
      const event = makeEvent("aaos.lead-store.closing.recorded", {
        closingId: "closing-1",
        leadId: lead.id.toString(),
        branchId: "branch-1",
        closingType: "CANCELLED",
        tenantId: "dss-motor",
        correlationId: "corr-1",
        occurredAt,
        version: "1.0",
      });
      await subscriptionManager.dispatch("aaos.lead-store.closing.recorded", event);
      expect(capiEventService.sendLead).not.toHaveBeenCalled();
      expect(capiEventService.sendPurchase).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalled();
    });

    it("an unrecognized closingType logs a warning and sends nothing", async () => {
      const subscriptionManager = createFakeSubscriptionManager();
      const lead = buildLead();
      const capiEventService = fakeCapiEventService();
      const logger = createMockLogger();
      const service = new EventListenerService(
        subscriptionManager,
        createGetLead([lead]),
        createFakeClosingRepository(),
        capiEventService as never,
        logger as never,
        "dss-motor",
      );
      service.start();
      const event = makeEvent("aaos.lead-store.closing.recorded", {
        closingId: "closing-1",
        leadId: lead.id.toString(),
        branchId: "branch-1",
        closingType: "SOMETHING_ELSE",
        tenantId: "dss-motor",
        correlationId: "corr-1",
        occurredAt,
        version: "1.0",
      });
      await subscriptionManager.dispatch("aaos.lead-store.closing.recorded", event);
      expect(capiEventService.sendLead).not.toHaveBeenCalled();
      expect(capiEventService.sendPurchase).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalled();
    });

    it("logs and returns when GetLead fails", async () => {
      const subscriptionManager = createFakeSubscriptionManager();
      const capiEventService = fakeCapiEventService();
      const logger = createMockLogger();
      const service = new EventListenerService(
        subscriptionManager,
        createGetLead([]),
        createFakeClosingRepository(),
        capiEventService as never,
        logger as never,
        "dss-motor",
      );
      service.start();
      const event = makeEvent("aaos.lead-store.closing.recorded", {
        closingId: "closing-1",
        leadId: "does-not-exist",
        branchId: "branch-1",
        closingType: "TEST_DRIVE",
        tenantId: "dss-motor",
        correlationId: "corr-1",
        occurredAt,
        version: "1.0",
      });
      await subscriptionManager.dispatch("aaos.lead-store.closing.recorded", event);
      expect(capiEventService.sendLead).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalled();
    });

    it("logs and returns when IClosingRepository.findByFilter fails", async () => {
      const subscriptionManager = createFakeSubscriptionManager();
      const lead = buildLead();
      const capiEventService = fakeCapiEventService();
      const logger = createMockLogger();
      const closingRepository = createFakeClosingRepository();
      (closingRepository.findByFilter as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        err(new Error("db down")),
      );
      const service = new EventListenerService(
        subscriptionManager,
        createGetLead([lead]),
        closingRepository,
        capiEventService as never,
        logger as never,
        "dss-motor",
      );
      service.start();
      const event = makeEvent("aaos.lead-store.closing.recorded", {
        closingId: "closing-1",
        leadId: lead.id.toString(),
        branchId: "branch-1",
        closingType: "TEST_DRIVE",
        tenantId: "dss-motor",
        correlationId: "corr-1",
        occurredAt,
        version: "1.0",
      });
      await subscriptionManager.dispatch("aaos.lead-store.closing.recorded", event);
      expect(capiEventService.sendLead).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalled();
    });

    it("logs and returns when no Closing in the window matches event.closingId", async () => {
      const subscriptionManager = createFakeSubscriptionManager();
      const lead = buildLead();
      const otherClosing = buildClosing({ closingType: "TEST_DRIVE" as never });
      const capiEventService = fakeCapiEventService();
      const logger = createMockLogger();
      const service = new EventListenerService(
        subscriptionManager,
        createGetLead([lead]),
        createFakeClosingRepository([otherClosing]),
        capiEventService as never,
        logger as never,
        "dss-motor",
      );
      service.start();
      const event = makeEvent("aaos.lead-store.closing.recorded", {
        closingId: "closing-does-not-match-any-seed",
        leadId: lead.id.toString(),
        branchId: "branch-1",
        closingType: "TEST_DRIVE",
        tenantId: "dss-motor",
        correlationId: "corr-1",
        occurredAt,
        version: "1.0",
      });
      await subscriptionManager.dispatch("aaos.lead-store.closing.recorded", event);
      expect(capiEventService.sendLead).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalled();
    });

    it("logs and does not throw when sendLead/sendPurchase fails", async () => {
      const subscriptionManager = createFakeSubscriptionManager();
      const lead = buildLead();
      const closing = buildClosing({ closingType: "TEST_DRIVE" as never, unitId: "unit-1" });
      const capiEventService = fakeCapiEventService();
      capiEventService.sendLead.mockResolvedValueOnce(err(new Error("send failed")) as never);
      const logger = createMockLogger();
      const service = new EventListenerService(
        subscriptionManager,
        createGetLead([lead]),
        createFakeClosingRepository([closing]),
        capiEventService as never,
        logger as never,
        "dss-motor",
      );
      service.start();
      const event = makeEvent("aaos.lead-store.closing.recorded", {
        closingId: closing.id.toString(),
        leadId: lead.id.toString(),
        branchId: "branch-1",
        closingType: "TEST_DRIVE",
        tenantId: "dss-motor",
        correlationId: "corr-1",
        occurredAt,
        version: "1.0",
      });
      await expect(
        subscriptionManager.dispatch("aaos.lead-store.closing.recorded", event),
      ).resolves.toBeUndefined();
      expect(logger.error).toHaveBeenCalled();
    });

    it("logs and does not throw when sendPurchase (SPK) fails", async () => {
      const subscriptionManager = createFakeSubscriptionManager();
      const lead = buildLead();
      const closing = buildClosing({
        closingType: "SPK" as never,
        unitId: "unit-1",
        unitPrice: 195_000_000,
      });
      const capiEventService = fakeCapiEventService();
      capiEventService.sendPurchase.mockResolvedValueOnce(err(new Error("send failed")) as never);
      const logger = createMockLogger();
      const service = new EventListenerService(
        subscriptionManager,
        createGetLead([lead]),
        createFakeClosingRepository([closing]),
        capiEventService as never,
        logger as never,
        "dss-motor",
      );
      service.start();
      const event = makeEvent("aaos.lead-store.closing.recorded", {
        closingId: closing.id.toString(),
        leadId: lead.id.toString(),
        branchId: "branch-1",
        closingType: "SPK",
        tenantId: "dss-motor",
        correlationId: "corr-1",
        occurredAt,
        version: "1.0",
      });
      await expect(
        subscriptionManager.dispatch("aaos.lead-store.closing.recorded", event),
      ).resolves.toBeUndefined();
      expect(logger.error).toHaveBeenCalled();
    });

    it("defaults unitPrice to 0 when the resolved Closing has none, for SPK", async () => {
      const subscriptionManager = createFakeSubscriptionManager();
      const lead = buildLead();
      const closing = buildClosing({ closingType: "SPK" as never });
      const capiEventService = fakeCapiEventService();
      const service = new EventListenerService(
        subscriptionManager,
        createGetLead([lead]),
        createFakeClosingRepository([closing]),
        capiEventService as never,
        createMockLogger() as never,
        "dss-motor",
      );
      service.start();
      const event = makeEvent("aaos.lead-store.closing.recorded", {
        closingId: closing.id.toString(),
        leadId: lead.id.toString(),
        branchId: "branch-1",
        closingType: "SPK",
        tenantId: "dss-motor",
        correlationId: "corr-1",
        occurredAt,
        version: "1.0",
      });
      await subscriptionManager.dispatch("aaos.lead-store.closing.recorded", event);
      expect(capiEventService.sendPurchase).toHaveBeenCalledWith(
        expect.objectContaining({ unitPrice: 0 }),
      );
    });
  });
});
