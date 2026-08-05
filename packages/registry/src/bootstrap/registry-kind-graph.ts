import { ALL_REGISTRY_KINDS, RegistryKind } from "../contracts/registry-kind.js";
import { DependencyGraph } from "../dependency/dependency-graph.js";
import type { DependencyCheckResult } from "../interfaces/i-dependency-checker.js";
import { VersionChecker } from "../version/version-checker.js";

import { CROSS_REFERENCE_MAP } from "./cross-reference-map.js";
import type { RegistrySystem } from "./registry-system.js";

/**
 * The canonical, declarative Registry-KIND dependency chain (docs/PROMPT-005.3A-REGISTRY-
 * ENHANCEMENT.md Enhancement 6): "Agent Registry → Capability Registry → Tool Registry →
 * Connector Registry → Provider Registry → External System." Provider/External System are
 * not Registry kinds (nothing to register), so the modeled chain ends at CONNECTOR.
 * Reuses the already-tested `DependencyGraph` engine at kind-granularity instead of
 * reimplementing cycle detection.
 */
export const REGISTRY_KIND_GRAPH_EDGES: Partial<Record<RegistryKind, readonly RegistryKind[]>> = {
  [RegistryKind.AGENT]: [RegistryKind.CAPABILITY],
  [RegistryKind.AGENT_BLUEPRINT]: [RegistryKind.CAPABILITY, RegistryKind.TOOL],
  [RegistryKind.CAPABILITY]: [RegistryKind.TOOL],
  [RegistryKind.TOOL]: [RegistryKind.CONNECTOR],
  [RegistryKind.SOLUTION_PACK]: [
    RegistryKind.INDUSTRY,
    RegistryKind.AGENT,
    RegistryKind.WORKFLOW,
    RegistryKind.TOOL,
    RegistryKind.CAPABILITY,
  ],
};

export interface DuplicateRegistryId {
  readonly id: string;
  readonly kinds: readonly RegistryKind[];
}

export interface InvalidVersionReference {
  readonly kind: RegistryKind;
  readonly id: string;
  readonly field: string;
  readonly reference: string;
  readonly reason: string;
}

export interface RegistryGraphAuditResult {
  /** Cycle Detection + Missing Dependency, at Registry-kind granularity. */
  readonly kindGraph: DependencyCheckResult;
  /** The same entry id registered under more than one Registry kind. */
  readonly duplicateIds: readonly DuplicateRegistryId[];
  /** Cross-reference fields that pin a target with `id@versionRange` where the range is malformed or unsatisfied. */
  readonly invalidVersionReferences: readonly InvalidVersionReference[];
  readonly ok: boolean;
}

/**
 * Validates the Registry-kind dependency chain, and (given a live `RegistrySystem`) audits
 * registered entries for cross-kind duplicate ids and invalid `id@versionRange` pins in
 * cross-reference fields (docs/bootstrap/cross-reference-map.ts). Complements, but does not
 * replace, `RegistrySystem.validateCrossReferences()` (which only checks presence, not
 * cycles/duplicates/version compatibility).
 */
export class RegistryKindGraph {
  private readonly graph = new DependencyGraph();
  private readonly versionChecker = new VersionChecker();

  /** Cycle Detection + Missing Dependency over `REGISTRY_KIND_GRAPH_EDGES`. */
  validateKindGraph(): DependencyCheckResult {
    const edgesByKind = new Map<string, readonly string[]>();
    for (const kind of ALL_REGISTRY_KINDS) {
      edgesByKind.set(kind, REGISTRY_KIND_GRAPH_EDGES[kind] ?? []);
    }
    return this.graph.check(edgesByKind);
  }

  /** Duplicate ID + Invalid Version, computed over the entries actually registered in `system`. */
  audit(system: RegistrySystem): RegistryGraphAuditResult {
    const kindGraph = this.validateKindGraph();
    const duplicateIds = this.findDuplicateIds(system);
    const invalidVersionReferences = this.findInvalidVersionReferences(system);

    return {
      kindGraph,
      duplicateIds,
      invalidVersionReferences,
      ok: kindGraph.ok && duplicateIds.length === 0 && invalidVersionReferences.length === 0,
    };
  }

  private findDuplicateIds(system: RegistrySystem): DuplicateRegistryId[] {
    const kindsById = new Map<string, RegistryKind[]>();
    for (const registry of system.list()) {
      for (const entry of registry.list()) {
        const kinds = kindsById.get(entry.manifest.id) ?? [];
        kinds.push(registry.kind);
        kindsById.set(entry.manifest.id, kinds);
      }
    }
    return Array.from(kindsById.entries())
      .filter(([, kinds]) => kinds.length > 1)
      .map(([id, kinds]) => ({ id, kinds }));
  }

  /**
   * A cross-reference field value of the form `"tool-x@^2.0.0"` pins the referenced entry to
   * a SemVer range. Plain ids (no `@`) are untouched — this is an opt-in convention, not a
   * requirement, so existing manifests using plain ids are unaffected.
   */
  private findInvalidVersionReferences(system: RegistrySystem): InvalidVersionReference[] {
    const issues: InvalidVersionReference[] = [];

    for (const registry of system.list()) {
      const fieldMap = CROSS_REFERENCE_MAP[registry.kind];
      if (!fieldMap) {
        continue;
      }
      for (const entry of registry.list()) {
        for (const [field, targetKind] of Object.entries(fieldMap)) {
          const rawValue = (entry.manifest as Record<string, unknown>)[field];
          if (rawValue === undefined) {
            continue;
          }
          const refs = Array.isArray(rawValue) ? (rawValue as string[]) : [rawValue as string];
          for (const ref of refs) {
            const issue = this.checkVersionPin(
              system,
              registry.kind,
              entry.manifest.id,
              field,
              targetKind,
              ref,
            );
            if (issue) {
              issues.push(issue);
            }
          }
        }
      }
    }

    return issues;
  }

  private checkVersionPin(
    system: RegistrySystem,
    kind: RegistryKind,
    id: string,
    field: string,
    targetKind: RegistryKind,
    ref: string,
  ): InvalidVersionReference | undefined {
    const atIndex = ref.indexOf("@");
    if (atIndex <= 0) {
      return undefined;
    }
    const targetId = ref.slice(0, atIndex);
    const range = ref.slice(atIndex + 1);
    const targetRegistry = system.get(targetKind);
    const targetEntry = targetRegistry?.get(targetId);
    if (!targetEntry) {
      return { kind, id, field, reference: ref, reason: `target "${targetId}" not found` };
    }
    try {
      if (!this.versionChecker.isCompatible(targetEntry.manifest.version, range)) {
        return {
          kind,
          id,
          field,
          reference: ref,
          reason: `registered version "${targetEntry.manifest.version}" does not satisfy "${range}"`,
        };
      }
    } catch (error) {
      return {
        kind,
        id,
        field,
        reference: ref,
        reason: error instanceof Error ? error.message : "invalid version range",
      };
    }
    return undefined;
  }
}
