# @aos/registry

The AOS Registry System — the platform's in-memory metadata Single Source of Truth. **Runs nothing.** No Agent executes, no Workflow runs, no Tool is called — this package only knows _about_ them, via manifests. See `docs/PROMPT-005.3-REGISTRY-SYSTEM.md` for the explicit scope boundary, and `docs/PROMPT-005.3A-REGISTRY-ENHANCEMENT.md` / `docs/005.3A-REGISTRY-ENHANCEMENT-REPORT.md` for the backward-compatible Enterprise Multi-Tenant enhancement layered on top (27 Registry kinds total, Capability Namespaces, the Registry-kind Dependency Graph, and Solution Pack/Industry/Model Profile/Agent Blueprint).

## The Manifest Concept (binding design decision)

Every registerable component is described by a manifest — no different in spirit from the example in the source prompt:

```yaml
id: content-manager
version: 1.0.0
category: marketing
capabilities:
  - content_generation
  - image_generation
required_tools:
  - kie
  - postiz
required_models:
  - gpt-5.5
  - kie
permissions:
  - social.publish
memory:
  - campaign_memory
workflows:
  - campaign_creation
```

Consequence: a future Agent Runtime never needs to change when a new Agent is added — only a manifest is registered here, and it is discoverable, validated, and cross-checked against the Tool/Model/Memory-Provider/Workflow Registries automatically.

## Architecture: One Generic Engine, 27 Thin Registries

Rather than implementing Entity/Contract/Validator/Loader/Resolver/Indexer/Search/Version/Metadata/Dependency-Checker/Health/Metrics once per kind, this package implements them **once**, generically (`registry/registry.ts`'s `Registry<TManifest>` class), and each of the 27 Registry kinds (23 mandatory + 4 added by the 005.3A enhancement — `registry/kinds/*.ts`) is a small instantiation supplying only its own manifest schema (and, where needed, a kind-specific business rule — see Capability's namespace rule below). Adding a Registry kind requires one new file, not a parallel reimplementation of the whole engine.

### 005.3A additions (Enterprise Multi-Tenant Agentic Platform readiness)

| Addition                       | What it is                                                                                                                                                                                             |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Industry Registry              | Parent of Solution Pack (`registry/kinds/industry-registry.ts`)                                                                                                                                        |
| Solution Pack Registry         | Bundles Agents/Workflows/Tools/Capabilities/Prompts/Dashboards/Permissions/Policies per Industry (`registry/kinds/solution-pack-registry.ts`); expand a pack via `RegistrySystem.findBySolutionPack()` |
| Model Profile Registry         | Benchmark/pricing record (Reasoning/Coding/Vision/Image/Video score, latency, pricing, fallback) — distinct from the routing-oriented Model Registry (`registry/kinds/model-profile-registry.ts`)      |
| Agent Blueprint Registry       | Declarative Agent template for an AI Builder/Marketplace, not a runnable Agent (`registry/kinds/agent-blueprint-registry.ts`)                                                                          |
| Capability Registry (enriched) | `namespace`/`input_schema`/`output_schema`/`provided_by`/`lifecycle` fields + a namespace business rule (`registry/kinds/capability-registry-kind.ts`)                                                 |
| Connector Registry (enriched)  | `authentication`/`oauth`/`secret_ref`/`supported_capabilities`/`health_check_ref`/`rate_limit`/`retry_policy`/`timeout` fields (`registry/kinds/connector-registry.ts`)                                |
| Capability Namespace           | Fixed 21-namespace list + validator (`contracts/capability-namespace.ts`) — a Capability id must be namespace-qualified (e.g. `inventory.read`)                                                        |
| Registry Kind Dependency Graph | Agent → Capability → Tool → Connector chain, Cycle/Missing/Duplicate-ID/Invalid-Version checks (`bootstrap/registry-kind-graph.ts`)                                                                    |
| Registry Manifest Standard     | `baseManifestSchema` gained optional `displayName`/`description`/`industry`/`metadata` — inherited by every kind, old and new                                                                          |
| Search Engine                  | `SearchCriteria` gained optional `namespace`/`industry`/`owner`                                                                                                                                        |
| `ICapabilityResolver`          | Interface only — no execution. Capability execution is ENGINEERING TASK 005.8's scope.                                                                                                                 |

All of the above are additive: no existing `RegistryKind` value, manifest field, or `IRegistry`/`Registry<TManifest>` public method changed. See `docs/005.3A-REGISTRY-ENHANCEMENT-REPORT.md` for the full compatibility/migration report.

## Folder Structure

| Folder        | Contents                                                                                                                                                                                                                                                         |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `registry/`   | `Registry<TManifest>` (the generic engine), `RegistryHealth`, and `registry/kinds/` (all 27 concrete Registries)                                                                                                                                                 |
| `bootstrap/`  | `RegistrySystem` (aggregates all 27 Registries, implements `@aos/runtime-kernel`'s `IModule`), `cross-reference-map.ts` (declares which manifest fields reference which other Registry kind), `registry-kind-graph.ts` (Registry-kind Dependency Graph — 005.3A) |
| `contracts/`  | `baseManifestSchema`/`BaseManifest`, `RegistryKind` (27-value enum), `EntryStatus`, `TenantScope`, `ManifestFormat`, `capability-namespace.ts` (005.3A)                                                                                                          |
| `entities/`   | `RegistryEntry<TManifest>` — the stored envelope wrapping a manifest                                                                                                                                                                                             |
| `interfaces/` | `IRegistry`, `ILoader`, `IValidator`, `IResolver`, `ISearchEngine`, `ICache`, `IVersionChecker`, `IDependencyChecker`, `IMigrationHook`, `IRegistryMetrics`, `IManifestSource` — behavioral ports                                                                |
| `validators/` | `SchemaValidator`, `BusinessValidator`, `DependencyValidator`, `VersionValidator`, `PermissionValidator`, `ValidationPipeline`                                                                                                                                   |
| `loaders/`    | `ManifestLoader` (YAML/JSON/TypeScript-metadata), `RemoteRegistryLoader` (reserved, throws — future)                                                                                                                                                             |
| `search/`     | `SearchIndex` — Find By ID/Name/Tag/Capability/Category/Tenant/Version                                                                                                                                                                                           |
| `dependency/` | `DependencyGraph` (circular + missing detection, topological load order), version-compatibility/capability-check helpers                                                                                                                                         |
| `resolver/`   | `EntryResolver` — resolves an id + version reference ("latest", exact, or a SemVer range) to one entry                                                                                                                                                           |
| `version/`    | `VersionChecker` (compat/breaking-change), `MigrationHookRegistry`                                                                                                                                                                                               |
| `cache/`      | `TtlCache<T>` — backs the Registry/Metadata/Schema/Validation caches                                                                                                                                                                                             |
| `events/`     | `RegistryEventEmitter` — `RegistryLoaded/Reloaded/Updated/Removed`, `ValidationFailed`, `DependencyFailed`                                                                                                                                                       |
| `metrics/`    | `RegistryMetricsCollector` — Registry Count, Validation/Load Time, Cache Hit/Miss, Dependency Count                                                                                                                                                              |
| `errors/`     | `RegistryException` + `Validation/Dependency/Schema/Version/ResolutionException`                                                                                                                                                                                 |
| `utils/`      | `generateId`, `now`                                                                                                                                                                                                                                              |

## Usage

```ts
import { RegistrySystem, EntryStatus } from "@aos/registry";

const registries = new RegistrySystem();

await registries.tool.register({
  id: "kie",
  version: "1.0.0",
  category: "media",
  side_effect_class: "reversible_write",
  provider: "kie.ai",
});
await registries.tool.register({
  id: "postiz",
  version: "1.0.0",
  category: "social",
  side_effect_class: "reversible_write",
  provider: "postiz",
});
await registries.model.register({
  id: "gpt-5.5",
  version: "1.0.0",
  category: "chat",
  provider: "openai",
  cost_tier: "balanced",
});
await registries.memoryProvider.register({
  id: "campaign_memory",
  version: "1.0.0",
  category: "episodic",
  tier: "episodic",
});
await registries.workflow.register({
  id: "campaign_creation",
  version: "1.0.0",
  category: "marketing",
});

// Registers into the Agent Registry AND verifies required_tools/required_models/memory/workflows
// all resolve to real entries in their respective Registries — throws DependencyException otherwise.
await registries.registerWithCrossCheck("agent", {
  id: "content-manager",
  version: "1.0.0",
  category: "marketing",
  capabilities: ["content_generation", "image_generation"],
  required_tools: ["kie", "postiz"],
  required_models: ["gpt-5.5"],
  permissions: ["social.publish"],
  memory: ["campaign_memory"],
  workflows: ["campaign_creation"],
});

registries.agent.search({ capability: "content_generation" }); // Find By Capability
registries.agent.get("content-manager"); // latest version
registries.agent.get("content-manager", "^1.0.0"); // version range resolution
await registries.agent.disable("content-manager"); // Active → Deprecated
await registries.agent.load("./manifests/agents"); // Load a directory (YAML/JSON/TS)
await registries.agent.reload(); // Hot Reload the same directory
```

## Persistence

None. Every Registry is in-memory only, per `docs/PROMPT-005.3-REGISTRY-SYSTEM.md`'s explicit instruction — persistence is a future sprint.

## Testing

Run `pnpm test`, `pnpm test:coverage`, `pnpm lint`, `pnpm build`, `pnpm typecheck`. See `docs/005.3-REGISTRY-SYSTEM-REPORT.md` and `docs/005.3A-REGISTRY-ENHANCEMENT-REPORT.md` for coverage numbers, known limitations, and the readiness checklist for Engineering Task 005.4 (Event Bus) and 005.8 (Capability execution) — **neither is implemented in this package**.
