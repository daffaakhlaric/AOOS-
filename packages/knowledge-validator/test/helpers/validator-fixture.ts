import type { IPublisher } from "@aos/event-bus";
import type { vi } from "vitest";

import type { KnowledgeValidatorConfig } from "../../src/config/knowledge-validator-config.js";
import { KnowledgeValidationCategory } from "../../src/domain/knowledge-validation-category.js";
import { KnowledgeValidator } from "../../src/validation/knowledge-validator.js";

import { contextFixture } from "./context-fixture.js";
import { fakePublisher } from "./event-publisher-fixture.js";

export function validatorFixture(config: KnowledgeValidatorConfig = {}): {
  validator: KnowledgeValidator;
  publisher: IPublisher;
  publish: ReturnType<typeof vi.fn>;
} {
  const { publisher, publish } = fakePublisher();
  return { validator: new KnowledgeValidator(publisher, config), publisher, publish };
}

/** Registers a Rule/Policy and creates a Draft Validation, returning its token for further operations. */
export async function createDraftValidation(
  validator: KnowledgeValidator,
  overrides: {
    readonly category?: KnowledgeValidationCategory;
    readonly withRule?: boolean;
    readonly withPolicy?: boolean;
    readonly policyId?: string;
    readonly requestedBy?: string;
    readonly tenantId?: string;
  } = {},
): Promise<string> {
  const withRule = overrides.withRule ?? true;
  const withPolicy = overrides.withPolicy ?? false;
  const tenantId = overrides.tenantId ?? "tenant-1";
  const category = overrides.category ?? KnowledgeValidationCategory.STRUCTURE_VALIDATION;

  const suffix = Math.random().toString(36).slice(2, 8);
  const ruleIds: string[] = [];
  let policyId: string | undefined;

  if (withRule) {
    const ruleId = `rule-${suffix}`;
    validator.registerRule({
      ruleId,
      name: "Test Rule",
      tenantId,
      category,
    });
    ruleIds.push(ruleId);
  }

  if (withPolicy) {
    policyId = overrides.policyId ?? `policy-${suffix}`;
    if (!validator.resolver.tryResolvePolicy(policyId)) {
      validator.registerPolicy({
        policyId,
        name: "Test Policy",
        tenantId,
      });
    }
  }

  const context = contextFixture({ validationId: `validation-${suffix}`, tenantId });
  const record = await validator.createValidation({
    context,
    title: "Test Validation",
    category,
    targetReference: `target-${suffix}`,
    ruleIds,
    policyId,
    requestedBy: overrides.requestedBy ?? "user-1",
  });

  return record.token;
}

/** Drives a Draft Validation all the way to Reviewing, returning its token. */
export async function createReviewingValidation(
  validator: KnowledgeValidator,
  overrides: Parameters<typeof createDraftValidation>[1] = {},
): Promise<string> {
  const token = await createDraftValidation(validator, overrides);
  await validator.queue({ token });
  await validator.prepare({ token });
  await validator.start({ token });
  await validator.review({ token });
  return token;
}
