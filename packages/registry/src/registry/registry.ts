import type { IsoDateTime, Uuid } from "@aos/types";
import type { ZodTypeAny } from "zod";

import { TtlCache } from "../cache/ttl-cache.js";
import type { BaseManifest } from "../contracts/base-manifest.js";
import { ENTRY_STATUS_TRANSITIONS, EntryStatus } from "../contracts/entry-status.js";
import type { RegistryKind } from "../contracts/registry-kind.js";
import { TenantScope } from "../contracts/tenant-scope.js";
import { DependencyGraph } from "../dependency/dependency-graph.js";
import type { RegistryEntry } from "../entities/registry-entry.js";
import { DependencyException, RegistryException, ValidationException } from "../errors/index.js";
import { RegistryEventEmitter } from "../events/registry-event-emitter.js";
import { RegistryEventName } from "../events/registry-event-name.js";
import type { IRegistry, RegisterOptions } from "../interfaces/i-registry.js";
import type { VersionReference } from "../interfaces/i-resolver.js";
import type { SearchCriteria } from "../interfaces/i-search-engine.js";
import type { ValidationContext } from "../interfaces/i-validator.js";
import { ManifestLoader } from "../loaders/manifest-loader.js";
import { RegistryMetricsCollector } from "../metrics/registry-metrics-collector.js";
import { EntryResolver } from "../resolver/entry-resolver.js";
import { SearchIndex } from "../search/search-index.js";
import { generateId, now } from "../utils/index.js";
import { BusinessValidator, type BusinessRule } from "../validators/business-validator.js";
import { DependencyValidator } from "../validators/dependency-validator.js";
import { PermissionValidator } from "../validators/permission-validator.js";
import { SchemaValidator } from "../validators/schema-validator.js";
import { ValidationPipeline } from "../validators/validation-pipeline.js";
import { VersionValidator } from "../validators/version-validator.js";

export interface RegistryOptions<TManifest extends BaseManifest> {
  readonly kind: RegistryKind;
  readonly schema: ZodTypeAny;
  readonly businessRules?: readonly BusinessRule<TManifest>[];
  readonly cacheTtlMs?: number;
  readonly events?: RegistryEventEmitter;
}

/**
 * The generic Registry engine — implements every Target capability from
 * docs/PROMPT-005.3-REGISTRY-SYSTEM.md (Register/Update/Remove/Enable/Disable/Version/
 * Validate/Load/Unload/Discover/Search/Resolve/Cache/Reload/Dependency Check/Schema
 * Validation/Hot Reload) once, generically. Every one of the 23 mandated Registry kinds
 * (registry/kinds/*.ts) is a thin instantiation of this class with a kind-specific manifest
 * schema — not a separate reimplementation.
 */
export class Registry<
  TManifest extends BaseManifest = BaseManifest,
> implements IRegistry<TManifest> {
  readonly kind: RegistryKind;

  private readonly entriesById = new Map<string, RegistryEntry<TManifest>[]>();
  private readonly cache = new TtlCache<RegistryEntry<TManifest>>();
  private readonly searchIndex = new SearchIndex<TManifest>();
  private readonly resolver: EntryResolver<TManifest>;
  private readonly dependencyGraph = new DependencyGraph();
  private readonly loader = new ManifestLoader<TManifest>();
  private readonly pipeline: ValidationPipeline<TManifest>;
  readonly metrics: RegistryMetricsCollector;
  readonly events: RegistryEventEmitter;
  private lastLoadLocation: string | undefined;

  constructor(options: RegistryOptions<TManifest>) {
    this.kind = options.kind;
    this.events = options.events ?? new RegistryEventEmitter();
    this.metrics = new RegistryMetricsCollector(() => this.count);
    this.cache = new TtlCache(options.cacheTtlMs);
    this.resolver = new EntryResolver((id) => this.entriesById.get(id) ?? []);
    this.pipeline = new ValidationPipeline<TManifest>([
      new SchemaValidator<TManifest>(options.schema),
      new BusinessValidator<TManifest>(options.businessRules ?? []),
      new DependencyValidator<TManifest>(),
      new VersionValidator<TManifest>(),
      new PermissionValidator(),
    ]);
  }

  async register(
    manifest: TManifest,
    options: RegisterOptions = {},
  ): Promise<RegistryEntry<TManifest>> {
    if ((manifest.dependencies ?? []).includes(manifest.id)) {
      throw new DependencyException(`Manifest "${manifest.id}" cannot depend on itself`);
    }

    const start = now();
    const validation = await this.pipeline.run(manifest, this.buildValidationContext(manifest.id));
    this.metrics.recordValidationTime(now() - start);

    if (!validation.valid) {
      const reason = validation.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ");
      this.events.emit(RegistryEventName.VALIDATION_FAILED, {
        kind: this.kind,
        id: manifest.id,
        reason,
      });
      throw new ValidationException(`Manifest "${manifest.id}" failed validation: ${reason}`);
    }

    const timestamp = new Date().toISOString() as IsoDateTime;
    const entry: RegistryEntry<TManifest> = {
      entryId: generateId() as Uuid<"RegistryEntryId">,
      registryKind: this.kind,
      manifest,
      status: options.status ?? EntryStatus.ACTIVE,
      tenantScope: options.tenantScope ?? TenantScope.GLOBAL,
      owner: options.owner ?? manifest.owner ?? "unknown",
      createdAt: timestamp,
      updatedAt: timestamp,
      changelog: [
        ...(this.entriesById.get(manifest.id) ?? []).map((e) => e.manifest.version),
        manifest.version,
      ],
    };

    const versions = this.entriesById.get(manifest.id) ?? [];
    this.entriesById.set(manifest.id, [...versions, entry]);
    this.searchIndex.index(entry);
    this.cache.invalidate(manifest.id);

    this.events.emit(RegistryEventName.REGISTRY_UPDATED, {
      kind: this.kind,
      id: manifest.id,
      version: manifest.version,
    });

    return entry;
  }

  async update(id: string, manifest: TManifest): Promise<RegistryEntry<TManifest>> {
    if (manifest.id !== id) {
      throw new RegistryException(
        `update() called with id "${id}" but manifest.id is "${manifest.id}"`,
      );
    }
    if (!this.has(id)) {
      throw new RegistryException(`Cannot update "${id}": no existing entry to update`);
    }
    return this.register(manifest);
  }

  async remove(id: string): Promise<void> {
    const entries = this.entriesById.get(id);
    if (!entries) {
      throw new RegistryException(`Cannot remove "${id}": not registered`);
    }
    for (const entry of entries) {
      this.searchIndex.remove(entry.entryId);
    }
    this.entriesById.delete(id);
    this.cache.invalidate(id);
    this.events.emit(RegistryEventName.REGISTRY_REMOVED, { kind: this.kind, id });
  }

  async enable(id: string): Promise<void> {
    await this.transitionStatus(id, EntryStatus.ACTIVE);
  }

  async disable(id: string): Promise<void> {
    await this.transitionStatus(id, EntryStatus.DEPRECATED);
  }

  get(id: string, versionRef?: VersionReference): RegistryEntry<TManifest> | undefined {
    if (!versionRef) {
      const cached = this.cache.get(id);
      if (cached) {
        this.metrics.recordCacheHit();
        return cached;
      }
      this.metrics.recordCacheMiss();
    }
    const resolved = this.resolver.resolve(id, versionRef);
    if (resolved && !versionRef) {
      this.cache.set(id, resolved);
    }
    return resolved;
  }

  has(id: string): boolean {
    return this.entriesById.has(id);
  }

  versions(id: string): readonly string[] {
    return (this.entriesById.get(id) ?? []).map((entry) => entry.manifest.version);
  }

  list(): readonly RegistryEntry<TManifest>[] {
    return Array.from(this.entriesById.values()).map((versions) => versions[versions.length - 1]!);
  }

  discover(): readonly RegistryEntry<TManifest>[] {
    return this.list();
  }

  search(criteria: SearchCriteria): readonly RegistryEntry<TManifest>[] {
    return this.searchIndex.search(criteria);
  }

  async load(location: string): Promise<void> {
    const start = now();
    const loadResult = await this.loader.load(location);

    if (loadResult.failed.length > 0) {
      const summary = loadResult.failed.map((f) => `${f.sourcePath}: ${f.error}`).join("; ");
      throw new RegistryException(
        `Failed to load ${loadResult.failed.length} manifest(s) from "${location}": ${summary}`,
      );
    }

    const dependenciesById = new Map<string, readonly string[]>();
    for (const entry of this.list()) {
      dependenciesById.set(entry.manifest.id, entry.manifest.dependencies ?? []);
    }
    for (const manifest of loadResult.loaded) {
      dependenciesById.set(manifest.id, manifest.dependencies ?? []);
    }

    const dependencyCheck = this.dependencyGraph.check(dependenciesById);
    this.metrics.setDependencyCount(dependenciesById.size);

    if (!dependencyCheck.ok) {
      const reason =
        dependencyCheck.circular.length > 0
          ? `Circular dependencies: ${dependencyCheck.circular.map((cycle) => cycle.join(" → ")).join("; ")}`
          : `Missing dependencies: ${dependencyCheck.missing.join(", ")}`;
      this.events.emit(RegistryEventName.DEPENDENCY_FAILED, {
        kind: this.kind,
        id: location,
        reason,
      });
      throw new DependencyException(reason);
    }

    const loadedById = new Map(loadResult.loaded.map((manifest) => [manifest.id, manifest]));
    for (const id of dependencyCheck.loadOrder) {
      const manifest = loadedById.get(id);
      if (manifest) {
        await this.register(manifest);
      }
    }

    this.metrics.recordLoadTime(now() - start);
    this.lastLoadLocation = location;
    this.events.emit(RegistryEventName.REGISTRY_LOADED, {
      kind: this.kind,
      count: loadResult.loaded.length,
    });
  }

  async unload(id: string): Promise<void> {
    await this.remove(id);
  }

  async reload(): Promise<void> {
    if (!this.lastLoadLocation) {
      throw new RegistryException(
        "Cannot reload: no location has been loaded yet — call load() first",
      );
    }
    const location = this.lastLoadLocation;
    this.entriesById.clear();
    this.searchIndex.clear();
    this.cache.clear();
    await this.load(location);
    this.events.emit(RegistryEventName.REGISTRY_RELOADED, { kind: this.kind, count: this.count });
  }

  get count(): number {
    return this.entriesById.size;
  }

  private async transitionStatus(id: string, target: EntryStatus): Promise<void> {
    const versions = this.entriesById.get(id);
    if (!versions || versions.length === 0) {
      throw new RegistryException(`Cannot change status of "${id}": not registered`);
    }
    const latest = versions[versions.length - 1]!;
    if (!ENTRY_STATUS_TRANSITIONS[latest.status].includes(target)) {
      throw new RegistryException(
        `Cannot transition "${id}" from "${latest.status}" to "${target}"`,
      );
    }
    const updated: RegistryEntry<TManifest> = {
      ...latest,
      status: target,
      updatedAt: new Date().toISOString() as IsoDateTime,
    };
    versions[versions.length - 1] = updated;
    this.searchIndex.index(updated);
    this.cache.invalidate(id);
  }

  private buildValidationContext(selfId: string): ValidationContext {
    const existingIds = new Set(this.entriesById.keys());
    existingIds.add(selfId);
    const existingVersionsById = new Map<string, readonly string[]>();
    for (const [id, versions] of this.entriesById) {
      existingVersionsById.set(
        id,
        versions.map((entry) => entry.manifest.version),
      );
    }
    return { existingIds, existingVersionsById };
  }
}
