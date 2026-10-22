import type { SupabaseClientLike } from "@aos/lead-store";
import { afterEach, expect, it, vi } from "vitest";

import type { TrustedTenantContext } from "../auth/tenant-authorization.service.js";
import { defaultGrowthPolicy } from "../automation-policy/domain/growth-policy.js";
import type { GrowthPolicyService } from "../automation-policy/growth-policy.service.js";
import type { MetaAdsConnectorRegistry } from "../meta-ads/infrastructure/meta-ads-connector-registry.js";

import type { ActionEvidenceService } from "./action-evidence.service.js";
import type { ActionLearningService } from "./action-learning.service.js";
import { ActionPolicyContext } from "./action-policy-context.js";
import type { ActionCommand } from "./action.types.js";

afterEach(() => vi.unstubAllEnvs());
function setup() {
  vi.stubEnv("META_REAL_WRITES_ENABLED", "true");
  const command = {
    tenantId: "a",
    workspaceId: "a",
    integrationId: "meta",
    credentialVersion: 2,
    adAccountId: "act_1",
    actor: { type: "HUMAN", userId: "u" },
    actionType: "PAUSE_CAMPAIGN",
    entityType: "CAMPAIGN",
    entityId: "100",
    targetState: { status: "PAUSED" },
    currentStateSnapshot: { status: "ACTIVE" },
    policyVersion: 1,
    steps: [{ key: "pause", intent: { status: "PAUSED" } }],
  } as ActionCommand;
  const identity = { tenantId: "a", workspaceId: "a", userId: "u" } as TrustedTenantContext;
  const membership = { role: "OWNER", status: "ACTIVE" };
  const tenant = {
    meta_execution_tier: "COPILOT_READY",
    meta_capabilities: {
      credentialVersion: 2,
      checkedAt: new Date().toISOString(),
      capabilities: { PAUSE_CAMPAIGN: { state: "AVAILABLE" } },
    },
  };
  const db = {
    from: vi.fn((table: string) => {
      const query = {
        select: vi.fn(),
        eq: vi.fn(),
        maybeSingle: vi.fn(async () => ({
          data: table === "tenants" ? tenant : membership,
          error: null,
        })),
      };
      query.select.mockReturnValue(query);
      query.eq.mockReturnValue(query);
      return query;
    }),
  };
  const policy = defaultGrowthPolicy();
  policy.safetyPolicy.permissions.PAUSE_CAMPAIGN = "APPROVAL_REQUIRED";
  const connection = {
    tenantId: "a",
    integrationId: "meta",
    credentialVersion: 2,
    adAccountIds: ["act_1"],
  };
  const evidence = {
    verify: vi.fn(async () => ({
      decision: { confidence: 0.95, primaryDiagnosis: "SPEND_WITHOUT_RESULT" },
      health: {
        runtimeEvidence: {
          current: { daysCovered: 7, dataSufficiency: { level: "HIGH" }, spend: 500000, leads: 0 },
        },
      },
    })),
  };
  const learning = { verify: vi.fn(async () => undefined) };
  const context = new ActionPolicyContext(
    db as unknown as SupabaseClientLike,
    { current: vi.fn(async () => ({ version: 1, policy })) } as unknown as GrowthPolicyService,
    {
      resolve: vi.fn(async () => ({ ok: true, value: connection })),
    } as unknown as MetaAdsConnectorRegistry,
    evidence as unknown as ActionEvidenceService,
    learning as unknown as ActionLearningService,
  );
  return { context, command, identity, membership, tenant, policy, connection, evidence, learning };
}
it("accepts only fresh verified capability and current membership", async () => {
  const f = setup();
  expect(await f.context.resolve(f.identity, f.command)).toBe(f.connection);
  f.membership.role = "VIEWER";
  await expect(f.context.resolve(f.identity, f.command)).rejects.toThrow(
    "ACTION_EXECUTION_FORBIDDEN",
  );
});
it("does not substitute Meta leads for the configured business outcome", async () => {
  const f = setup();
  await expect(
    f.context.resolve(f.identity, { ...f.command, actor: { type: "SAMANTHA" } }),
  ).rejects.toThrow("PAUSE_OUTCOME_BASIS_UNVERIFIED");
});
it("accepts Samantha pause evidence only after learning passes", async () => {
  const f = setup();
  f.policy.optimizationBasis = "META_LEAD";
  f.policy.conversionPolicy.primaryMetric = "LEAD";
  const command = { ...f.command, actor: { type: "SAMANTHA" as const } };
  expect(await f.context.resolve(f.identity, command)).toBe(f.connection);
  expect(f.learning.verify).toHaveBeenCalledTimes(1);
  f.learning.verify.mockRejectedValue(new Error("CAMPAIGN_LEARNING_PROTECTED"));
  await expect(f.context.resolve(f.identity, command)).rejects.toThrow(
    "CAMPAIGN_LEARNING_PROTECTED",
  );
});
it.each(["READ_ONLY", "WRITE_TESTING", "", "UNKNOWN"])(
  "rejects execution tier %s",
  async (tier) => {
    const f = setup();
    f.tenant.meta_execution_tier = tier;
    await expect(f.context.resolve(f.identity, f.command)).rejects.toThrow(
      "META_CAPABILITY_UNVERIFIED",
    );
  },
);
it("rejects stale capability and changed credentials", async () => {
  const f = setup();
  f.tenant.meta_capabilities.checkedAt = new Date(Date.now() - 16 * 60_000).toISOString();
  await expect(f.context.resolve(f.identity, f.command)).rejects.toThrow(
    "META_CAPABILITY_UNVERIFIED",
  );
  f.tenant.meta_capabilities.checkedAt = new Date().toISOString();
  f.connection.credentialVersion++;
  await expect(f.context.resolve(f.identity, f.command)).rejects.toThrow("INTEGRATION_CHANGED");
});
it("rechecks kill switch and policy revision", async () => {
  const f = setup();
  f.policy.safetyPolicy.killSwitch = true;
  await expect(f.context.resolve(f.identity, f.command)).rejects.toThrow("KILL_SWITCH");
  f.policy.safetyPolicy.killSwitch = false;
  f.command.policyVersion++;
  await expect(f.context.resolve(f.identity, f.command)).rejects.toThrow("REAPPROVAL_REQUIRED");
});
it("blocks real writes when switch is disabled", async () => {
  const f = setup();
  vi.stubEnv("META_REAL_WRITES_ENABLED", "false");
  await expect(f.context.resolve(f.identity, f.command)).rejects.toThrow("META_WRITE_DISABLED");
});
