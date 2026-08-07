import type { IPublisher } from "@aos/event-bus";
import type { vi } from "vitest";

import type { KnowledgeGeneratorConfig } from "../../src/config/knowledge-generator-config.js";
import { KnowledgeGenerationAssetType } from "../../src/domain/knowledge-generation-asset-type.js";
import { KnowledgeGenerationMode } from "../../src/domain/knowledge-generation-mode.js";
import { KnowledgeGenerationProviderType } from "../../src/domain/knowledge-generation-provider-type.js";
import { KnowledgeGenerator } from "../../src/generator/knowledge-generator.js";
import { KnowledgeGeneratorRegistryBucket } from "../../src/registry/knowledge-generator-registry-bucket.js";

import { contextFixture } from "./context-fixture.js";
import { fakePublisher } from "./event-publisher-fixture.js";

export function generatorFixture(config: KnowledgeGeneratorConfig = {}): {
  generator: KnowledgeGenerator;
  publisher: IPublisher;
  publish: ReturnType<typeof vi.fn>;
} {
  const { publisher, publish } = fakePublisher();
  return { generator: new KnowledgeGenerator(publisher, config), publisher, publish };
}

/** Registers a Prompt/Context/Policy and creates a Draft Generation, returning its token for further operations. */
export async function createDraftGeneration(
  generator: KnowledgeGenerator,
  overrides: {
    readonly assetType?: KnowledgeGenerationAssetType;
    readonly mode?: KnowledgeGenerationMode;
    readonly providerType?: KnowledgeGenerationProviderType;
    readonly withPrompt?: boolean;
    readonly withContext?: boolean;
    readonly withPolicy?: boolean;
    readonly policyId?: string;
    readonly requestedBy?: string;
  } = {},
): Promise<string> {
  const withPrompt = overrides.withPrompt ?? true;
  const withContext = overrides.withContext ?? true;
  const withPolicy = overrides.withPolicy ?? false;

  const suffix = Math.random().toString(36).slice(2, 8);
  let promptReferenceId: string | undefined;
  let contextReferenceId: string | undefined;
  let policyId: string | undefined;

  if (withPrompt) {
    promptReferenceId = `prompt-${suffix}`;
    generator.registerPrompt({
      promptId: promptReferenceId,
      promptVersion: "1.0.0",
      namespace: "default",
    });
  }

  if (withContext) {
    contextReferenceId = `context-${suffix}`;
    generator.registerContext({
      contextId: contextReferenceId,
      tenantId: "tenant-1",
      workspaceId: "workspace-1",
    });
  }

  if (withPolicy) {
    policyId = overrides.policyId ?? `policy-${suffix}`;
    if (!generator.registry.get(KnowledgeGeneratorRegistryBucket.POLICY, policyId)) {
      generator.registerPolicy({
        policyId,
        name: "Test Policy",
        tenantId: "tenant-1",
      });
    }
  }

  const context = contextFixture({ generationId: `generation-${suffix}` });
  const record = await generator.createGeneration({
    context,
    title: "Test Generation",
    assetType: overrides.assetType ?? KnowledgeGenerationAssetType.FAQ,
    mode: overrides.mode ?? KnowledgeGenerationMode.CREATE,
    providerType: overrides.providerType ?? KnowledgeGenerationProviderType.OPENAI,
    promptReferenceId,
    contextReferenceId,
    policyId,
    requestedBy: overrides.requestedBy ?? "user-1",
  });

  return record.token;
}
