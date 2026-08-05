import type { IModule } from "@aos/runtime-kernel";

import type { BaseManifest } from "../contracts/base-manifest.js";
import { RegistryKind } from "../contracts/registry-kind.js";
import type { RegistryEntry } from "../entities/registry-entry.js";
import { DependencyException } from "../errors/index.js";
import { RegistryEventEmitter } from "../events/registry-event-emitter.js";
import {
  createAgentBlueprintRegistry,
  createAgentRegistry,
  createAnalyticsRegistry,
  createCapabilityRegistry,
  createConfigurationRegistry,
  createConnectorRegistry,
  createEventRegistry,
  createFeatureRegistry,
  createIndustryRegistry,
  createIntegrationRegistry,
  createKnowledgeRegistry,
  createMemoryProviderRegistry,
  createModelProfileRegistry,
  createModelRegistry,
  createPermissionRegistry,
  createPluginRegistry,
  createPolicyRegistry,
  createPromptRegistry,
  createQueueRegistry,
  createSchedulerRegistry,
  createSecretProviderRegistry,
  createSimulationRegistry,
  createSolutionPackRegistry,
  createStorageRegistry,
  createTenantRegistry,
  createToolRegistry,
  createWorkflowRegistry,
} from "../registry/kinds/index.js";
import type { Registry } from "../registry/registry.js";

import { CROSS_REFERENCE_MAP } from "./cross-reference-map.js";

export interface CrossReferenceIssue {
  readonly field: string;
  readonly targetKind: RegistryKind;
  readonly missingIds: readonly string[];
}

export interface CrossReferenceResult {
  readonly valid: boolean;
  readonly issues: readonly CrossReferenceIssue[];
}

/**
 * The Registry System — aggregates all 23 mandatory Registries (docs/PROMPT-005.3-REGISTRY-SYSTEM.md)
 * behind one composition root, and adds cross-registry reference validation (an Agent's
 * `required_tools` must exist in the Tool Registry, etc. — the user's revised manifest concept).
 * Implements @aos/runtime-kernel's `IModule` so it can be registered into a Kernel via
 * `buildKernel({ modules: [registrySystem] })`, per the readiness checklist in
 * docs/005.2-CORE-RUNTIME-KERNEL-REPORT.md §10 — this is that integration point, not yet wired
 * into any actual Kernel bootstrap call (no application does that in this Engineering Task).
 */
export class RegistrySystem implements IModule {
  readonly name = "RegistrySystemModule";
  readonly version = "0.1.0";

  readonly events = new RegistryEventEmitter();

  readonly agent = createAgentRegistry(this.events);
  readonly tool = createToolRegistry(this.events);
  readonly workflow = createWorkflowRegistry(this.events);
  readonly prompt = createPromptRegistry(this.events);
  readonly model = createModelRegistry(this.events);
  readonly plugin = createPluginRegistry(this.events);
  readonly event = createEventRegistry(this.events);
  readonly queue = createQueueRegistry(this.events);
  readonly scheduler = createSchedulerRegistry(this.events);
  readonly memoryProvider = createMemoryProviderRegistry(this.events);
  readonly storage = createStorageRegistry(this.events);
  readonly knowledge = createKnowledgeRegistry(this.events);
  readonly capability = createCapabilityRegistry(this.events);
  readonly permission = createPermissionRegistry(this.events);
  readonly policy = createPolicyRegistry(this.events);
  readonly integration = createIntegrationRegistry(this.events);
  readonly connector = createConnectorRegistry(this.events);
  readonly tenant = createTenantRegistry(this.events);
  readonly configuration = createConfigurationRegistry(this.events);
  readonly feature = createFeatureRegistry(this.events);
  readonly secretProvider = createSecretProviderRegistry(this.events);
  readonly analytics = createAnalyticsRegistry(this.events);
  readonly simulation = createSimulationRegistry(this.events);
  // 005.3A additions — additive only, no existing property removed/renamed.
  readonly industry = createIndustryRegistry(this.events);
  readonly solutionPack = createSolutionPackRegistry(this.events);
  readonly modelProfile = createModelProfileRegistry(this.events);
  readonly agentBlueprint = createAgentBlueprintRegistry(this.events);

  private readonly registriesByKind: ReadonlyMap<RegistryKind, Registry<BaseManifest>>;

  constructor() {
    this.registriesByKind = new Map<RegistryKind, Registry<BaseManifest>>([
      [RegistryKind.AGENT, this.agent],
      [RegistryKind.TOOL, this.tool],
      [RegistryKind.WORKFLOW, this.workflow],
      [RegistryKind.PROMPT, this.prompt],
      [RegistryKind.MODEL, this.model],
      [RegistryKind.PLUGIN, this.plugin],
      [RegistryKind.EVENT, this.event],
      [RegistryKind.QUEUE, this.queue],
      [RegistryKind.SCHEDULER, this.scheduler],
      [RegistryKind.MEMORY_PROVIDER, this.memoryProvider],
      [RegistryKind.STORAGE, this.storage],
      [RegistryKind.KNOWLEDGE, this.knowledge],
      [RegistryKind.CAPABILITY, this.capability],
      [RegistryKind.PERMISSION, this.permission],
      [RegistryKind.POLICY, this.policy],
      [RegistryKind.INTEGRATION, this.integration],
      [RegistryKind.CONNECTOR, this.connector],
      [RegistryKind.TENANT, this.tenant],
      [RegistryKind.CONFIGURATION, this.configuration],
      [RegistryKind.FEATURE, this.feature],
      [RegistryKind.SECRET_PROVIDER, this.secretProvider],
      [RegistryKind.ANALYTICS, this.analytics],
      [RegistryKind.SIMULATION, this.simulation],
      [RegistryKind.INDUSTRY, this.industry],
      [RegistryKind.SOLUTION_PACK, this.solutionPack],
      [RegistryKind.MODEL_PROFILE, this.modelProfile],
      [RegistryKind.AGENT_BLUEPRINT, this.agentBlueprint],
    ]);
  }

  get(kind: RegistryKind): Registry<BaseManifest> | undefined {
    return this.registriesByKind.get(kind);
  }

  list(): readonly Registry<BaseManifest>[] {
    return Array.from(this.registriesByKind.values());
  }

  get totalEntryCount(): number {
    return this.list().reduce((sum, registry) => sum + registry.count, 0);
  }

  /**
   * Validates every declared cross-registry reference field on `manifest` (per
   * cross-reference-map.ts) resolves to an existing entry in the target Registry.
   */
  validateCrossReferences(kind: RegistryKind, manifest: BaseManifest): CrossReferenceResult {
    const fieldMap = CROSS_REFERENCE_MAP[kind];
    if (!fieldMap) {
      return { valid: true, issues: [] };
    }

    const issues: CrossReferenceIssue[] = [];
    for (const [field, targetKind] of Object.entries(fieldMap)) {
      const rawValue = (manifest as Record<string, unknown>)[field];
      if (rawValue === undefined) {
        continue;
      }
      const ids = Array.isArray(rawValue) ? (rawValue as string[]) : [rawValue as string];
      const targetRegistry = this.get(targetKind);
      const missingIds = ids.filter((id) => !targetRegistry?.has(id));
      if (missingIds.length > 0) {
        issues.push({ field, targetKind, missingIds });
      }
    }

    return { valid: issues.length === 0, issues };
  }

  /** register() on the target Registry, then enforce validateCrossReferences() — throws DependencyException if any reference is missing. */
  async registerWithCrossCheck<TManifest extends BaseManifest>(
    kind: RegistryKind,
    manifest: TManifest,
  ): Promise<void> {
    const registry = this.get(kind);
    if (!registry) {
      throw new DependencyException(`Unknown Registry kind "${kind}"`);
    }
    const crossCheck = this.validateCrossReferences(kind, manifest);
    if (!crossCheck.valid) {
      const reason = crossCheck.issues
        .map(
          (issue) =>
            `${issue.field} → ${issue.targetKind}: missing [${issue.missingIds.join(", ")}]`,
        )
        .join("; ");
      throw new DependencyException(
        `Cross-reference validation failed for "${manifest.id}": ${reason}`,
      );
    }
    await registry.register(manifest);
  }

  /**
   * "Search by Solution Pack" (Enhancement 9): expands a Solution Pack entry into the
   * concrete entries it bundles, by resolving each of its `agents`/`workflows`/`tools`/
   * `capabilities`/`prompts` ids against their own Registries. Ids that don't (yet) resolve
   * are silently omitted — use `validateCrossReferences(RegistryKind.SOLUTION_PACK, ...)` to
   * detect missing references instead.
   */
  findBySolutionPack(solutionPackId: string): {
    readonly agents: readonly RegistryEntry<BaseManifest>[];
    readonly workflows: readonly RegistryEntry<BaseManifest>[];
    readonly tools: readonly RegistryEntry<BaseManifest>[];
    readonly capabilities: readonly RegistryEntry<BaseManifest>[];
    readonly prompts: readonly RegistryEntry<BaseManifest>[];
  } {
    const pack = this.solutionPack.get(solutionPackId);
    const resolve = (
      registry: Registry<BaseManifest>,
      ids: readonly string[] | undefined,
    ): readonly RegistryEntry<BaseManifest>[] =>
      (ids ?? [])
        .map((id) => registry.get(id))
        .filter((entry): entry is RegistryEntry<BaseManifest> => entry !== undefined);

    if (!pack) {
      return { agents: [], workflows: [], tools: [], capabilities: [], prompts: [] };
    }

    const manifest = pack.manifest as BaseManifest & {
      agents?: readonly string[];
      workflows?: readonly string[];
      tools?: readonly string[];
      capabilities?: readonly string[];
      prompts?: readonly string[];
    };

    return {
      agents: resolve(this.agent, manifest.agents),
      workflows: resolve(this.workflow, manifest.workflows),
      tools: resolve(this.tool, manifest.tools),
      capabilities: resolve(this.capability, manifest.capabilities),
      prompts: resolve(this.prompt, manifest.prompts),
    };
  }

  async onBootstrap(): Promise<void> {
    // Nothing to do — every Registry is already constructed and ready to accept register()/load() calls.
  }

  async onShutdown(): Promise<void> {
    this.events.removeAllListeners();
  }
}
