import { createHmac } from "node:crypto";

import { MetaAdsConnectorFactory, WebhookVerifier } from "@aos/meta-ads-connector";
import { Logger } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { toConnectorConfig } from "../../config/to-connector-config.js";
import { createFakePublisher, type FakePublisher } from "../../test-support/fake-publisher.js";
import { createFakeSupabaseClient } from "../../test-support/fake-supabase-client.js";
import { buildTestConfig } from "../../test-support/fixtures.js";
import type { AdTenantIndexRepository } from "../meta-ads/infrastructure/ad-tenant-index.repository.js";
import { SystemWebhookConfigRepository } from "../superadmin/infrastructure/system-webhook-config.repository.js";
import { WebhookSecretsService } from "../webhook-config/webhook-secrets.service.js";

import { extractAdId, WebhookService } from "./webhook.service.js";

function buildFakeAdTenantIndex(
  overrides: Partial<AdTenantIndexRepository> = {},
): AdTenantIndexRepository {
  return {
    upsertMany: vi.fn(async () => undefined),
    findTenantByAdMetaId: vi.fn(async () => undefined),
    ...overrides,
  } as unknown as AdTenantIndexRepository;
}

function buildService(
  options: {
    adTenantIndex?: AdTenantIndexRepository;
    /**
     * Overrides the resolved connector's `processLeadWebhook.execute` — used only by the
     * tenant-ROUTING tests below, which care which tenantId/connector `WebhookService` resolves,
     * not `ProcessLeadWebhook`'s own real ad-resolution business logic (already covered by that
     * package's own tests, and by this file's pre-existing signature/schema-validation tests,
     * which keep the real connector precisely so those real checks stay exercised).
     */
    processLeadWebhookExecute?: ReturnType<typeof vi.fn>;
  } = {},
): {
  service: WebhookService;
  publisher: FakePublisher;
  adTenantIndex: AdTenantIndexRepository;
  registryResolve: ReturnType<typeof vi.fn>;
} {
  const config = buildTestConfig();
  const connectorConfig = toConnectorConfig(config);
  if (!connectorConfig.ok) {
    throw new Error("test setup failed");
  }
  const publisher = createFakePublisher();
  const staticConnector = MetaAdsConnectorFactory.create({
    config: connectorConfig.value,
    publisher,
  });
  const connectorContext = {
    ...staticConnector,
    accessToken: config.META_ACCESS_TOKEN,
    adAccountIds: config.META_AD_ACCOUNT_IDS,
    ...(options.processLeadWebhookExecute !== undefined
      ? { processLeadWebhook: { execute: options.processLeadWebhookExecute } }
      : {}),
  };
  const registry = {
    resolve: vi.fn(async (tenantId: string) =>
      tenantId === config.AAOS_TENANT_ID
        ? { ok: true, value: connectorContext }
        : { ok: false, error: new Error(`no connector configured for tenant "${tenantId}"`) },
    ),
  };
  const adTenantIndex = options.adTenantIndex ?? buildFakeAdTenantIndex();
  const webhookSecrets = new WebhookSecretsService(
    new SystemWebhookConfigRepository(createFakeSupabaseClient()),
    config,
  );
  const service = new WebhookService(
    config,
    registry as never,
    new WebhookVerifier(),
    webhookSecrets,
    adTenantIndex,
  );
  return { service, publisher, adTenantIndex, registryResolve: registry.resolve };
}

function signPayload(rawBody: string, secret: string): string {
  return `sha256=${createHmac("sha256", secret).update(rawBody, "utf8").digest("hex")}`;
}

describe("extractAdId", () => {
  it("extracts entry[0].changes[0].value.ad_id from a leadgen change", () => {
    const rawBody = JSON.stringify({
      object: "page",
      entry: [
        {
          id: "entry-1",
          changes: [
            {
              field: "leadgen",
              value: { ad_id: "ad-xyz", form_id: "form-1", leadgen_id: "lead-1", created_time: 1 },
            },
          ],
        },
      ],
    });
    expect(extractAdId(rawBody)).toBe("ad-xyz");
  });

  it("extracts ad_id from a ctwa_message change", () => {
    const rawBody = JSON.stringify({
      object: "page",
      entry: [
        {
          id: "entry-1",
          changes: [
            {
              field: "ctwa_message",
              value: { ad_id: "ad-ctwa-1", waba_id: "waba-1", phone_number: "+6281234567890" },
            },
          ],
        },
      ],
    });
    expect(extractAdId(rawBody)).toBe("ad-ctwa-1");
  });

  it("returns undefined for malformed JSON", () => {
    expect(extractAdId("{not json")).toBeUndefined();
  });

  it("returns undefined when no entry/changes/value.ad_id is present", () => {
    expect(extractAdId("{}")).toBeUndefined();
    expect(extractAdId(JSON.stringify({ entry: [] }))).toBeUndefined();
    expect(extractAdId(JSON.stringify({ entry: [{ changes: [] }] }))).toBeUndefined();
  });
});

describe("WebhookService", () => {
  describe("verifyHandshake", () => {
    it("returns ok(challenge) for a valid subscribe handshake", async () => {
      const { service } = buildService();
      const result = await service.verifyHandshake(
        "subscribe",
        "test-verify-token",
        "challenge-xyz",
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe("challenge-xyz");
      }
    });

    it("returns err(TokenVerificationError) for a wrong verify token", async () => {
      const { service } = buildService();
      const result = await service.verifyHandshake("subscribe", "wrong-token", "challenge-xyz");
      expect(result.ok).toBe(false);
    });

    it("returns err(TokenVerificationError) for a non-subscribe mode", async () => {
      const { service } = buildService();
      const result = await service.verifyHandshake(
        "unsubscribe",
        "test-verify-token",
        "challenge-xyz",
      );
      expect(result.ok).toBe(false);
    });

    it("returns err(TokenVerificationError) when the challenge is missing", async () => {
      const { service } = buildService();
      const result = await service.verifyHandshake("subscribe", "test-verify-token", undefined);
      expect(result.ok).toBe(false);
    });
  });

  describe("processLeadWebhook", () => {
    it("throws the raw WebhookError when signature verification fails", async () => {
      const { service } = buildService();
      await expect(service.processLeadWebhook("{}", undefined, "corr-1")).rejects.toMatchObject({
        name: "SignatureVerificationError",
      });
    });

    it("throws a PayloadParseError when the signature is valid but the payload fails schema validation", async () => {
      const config = buildTestConfig();
      const { service } = buildService();
      const rawBody = JSON.stringify({ not: "a valid webhook payload" });
      const signature = signPayload(rawBody, config.META_WEBHOOK_APP_SECRET);
      await expect(service.processLeadWebhook(rawBody, signature, "corr-2")).rejects.toMatchObject({
        name: "PayloadParseError",
      });
    });

    it("publishes no event through the injected publisher when processing fails", async () => {
      const { service, publisher } = buildService();
      await service.processLeadWebhook("{}", undefined, "corr-3").catch(() => undefined);
      expect(publisher.published).toHaveLength(0);
    });

    function buildLeadgenPayload(adId: string) {
      return JSON.stringify({
        object: "page",
        entry: [
          {
            id: "entry-1",
            changes: [
              {
                field: "leadgen",
                value: {
                  ad_id: adId,
                  form_id: "form-1",
                  leadgen_id: "lead-1",
                  created_time: 1_700_000_000,
                },
              },
            ],
          },
        ],
      });
    }

    it("routes to the ad_id's indexed tenant when ad_tenant_index has an entry (AAOS-MULTI-TENANT-PHASE1C)", async () => {
      const config = buildTestConfig();
      const adTenantIndex = buildFakeAdTenantIndex({
        findTenantByAdMetaId: vi.fn(async (adId: string) =>
          adId === "ad-known" ? config.AAOS_TENANT_ID : undefined,
        ),
      });
      const processLeadWebhookExecute = vi.fn(async () => ({ ok: true, value: undefined }));
      const {
        service,
        adTenantIndex: index,
        registryResolve,
      } = buildService({
        adTenantIndex,
        processLeadWebhookExecute,
      });
      const rawBody = buildLeadgenPayload("ad-known");
      const signature = signPayload(rawBody, config.META_WEBHOOK_APP_SECRET);

      const result = await service.processLeadWebhook(rawBody, signature, "corr-4");

      expect(result).toEqual({ received: true });
      expect(index.findTenantByAdMetaId).toHaveBeenCalledWith("ad-known");
      expect(registryResolve).toHaveBeenCalledWith(config.AAOS_TENANT_ID);
      expect(processLeadWebhookExecute).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: config.AAOS_TENANT_ID }),
      );
    });

    it("falls back to the static tenant with a warning logged when ad_id has no ad_tenant_index entry", async () => {
      const config = buildTestConfig();
      const adTenantIndex = buildFakeAdTenantIndex();
      const processLeadWebhookExecute = vi.fn(async () => ({ ok: true, value: undefined }));
      const { service } = buildService({ adTenantIndex, processLeadWebhookExecute });
      const rawBody = buildLeadgenPayload("ad-unindexed");
      const signature = signPayload(rawBody, config.META_WEBHOOK_APP_SECRET);
      const warnSpy = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);

      const result = await service.processLeadWebhook(rawBody, signature, "corr-5");

      expect(result).toEqual({ received: true });
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("ad-unindexed"));
      warnSpy.mockRestore();
    });

    it("falls back to the static tenant when ad_id is unparseable (malformed/missing), without a warning about a missing index entry", async () => {
      const config = buildTestConfig();
      const { service } = buildService();
      const rawBody = JSON.stringify({ object: "page", entry: [] });
      const signature = signPayload(rawBody, config.META_WEBHOOK_APP_SECRET);

      const result = await service.processLeadWebhook(rawBody, signature, "corr-6");

      expect(result).toEqual({ received: true });
    });
  });
});
