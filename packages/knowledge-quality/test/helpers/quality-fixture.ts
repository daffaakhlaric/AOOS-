import type { IPublisher } from "@aos/event-bus";
import type { vi } from "vitest";

import type { KnowledgeQualityConfig } from "../../src/config/knowledge-quality-config.js";
import { KnowledgeQualityAssessmentMode } from "../../src/domain/knowledge-quality-assessment-mode.js";
import { KnowledgeQualityDimension } from "../../src/domain/knowledge-quality-dimension.js";
import { KnowledgeQuality } from "../../src/quality/knowledge-quality.js";

import { contextFixture } from "./context-fixture.js";
import { fakePublisher } from "./event-publisher-fixture.js";

export function qualityFixture(config: KnowledgeQualityConfig = {}): {
  quality: KnowledgeQuality;
  publisher: IPublisher;
  publish: ReturnType<typeof vi.fn>;
} {
  const { publisher, publish } = fakePublisher();
  return { quality: new KnowledgeQuality(publisher, config), publisher, publish };
}

/** Registers a Rule/Profile/Policy and creates a Draft Assessment, returning its token for further operations. */
export async function createDraftAssessment(
  quality: KnowledgeQuality,
  overrides: {
    readonly dimension?: KnowledgeQualityDimension;
    readonly mode?: KnowledgeQualityAssessmentMode;
    readonly withRule?: boolean;
    readonly withProfile?: boolean;
    readonly withPolicy?: boolean;
    readonly policyId?: string;
    readonly requestedBy?: string;
    readonly tenantId?: string;
  } = {},
): Promise<string> {
  const withRule = overrides.withRule ?? true;
  const withProfile = overrides.withProfile ?? false;
  const withPolicy = overrides.withPolicy ?? false;
  const tenantId = overrides.tenantId ?? "tenant-1";
  const dimension = overrides.dimension ?? KnowledgeQualityDimension.ACCURACY;

  const suffix = Math.random().toString(36).slice(2, 8);
  const ruleIds: string[] = [];
  let profileId: string | undefined;
  let policyId: string | undefined;

  if (withRule) {
    const ruleId = `rule-${suffix}`;
    quality.registerRule({
      ruleId,
      name: "Test Rule",
      tenantId,
      dimension,
    });
    ruleIds.push(ruleId);
  }

  if (withProfile) {
    profileId = `profile-${suffix}`;
    quality.registerProfile({
      profileId,
      name: "Test Profile",
      tenantId,
      ruleIds,
    });
  }

  if (withPolicy) {
    policyId = overrides.policyId ?? `policy-${suffix}`;
    if (!quality.resolver.tryResolvePolicy(policyId)) {
      quality.registerPolicy({
        policyId,
        name: "Test Policy",
        tenantId,
      });
    }
  }

  const context = contextFixture({ assessmentId: `assessment-${suffix}`, tenantId });
  const record = await quality.createAssessment({
    context,
    title: "Test Assessment",
    mode: overrides.mode ?? KnowledgeQualityAssessmentMode.FULL_ASSESSMENT,
    targetReference: `target-${suffix}`,
    ruleIds,
    profileId,
    policyId,
    requestedBy: overrides.requestedBy ?? "user-1",
  });

  return record.token;
}
