import type {
  DependencyCheckResult,
  IDependencyChecker,
} from "../interfaces/i-dependency-checker.js";

/**
 * Full-graph Dependency Checker: Dependency Graph construction, Circular Dependency Detection,
 * Missing Dependency Detection, and a topological load order — run once per `Registry.load()`
 * batch, complementing the per-manifest DependencyValidator (validators/dependency-validator.ts)
 * which only catches missing dependencies, not cycles.
 */
export class DependencyGraph implements IDependencyChecker {
  check(dependenciesById: ReadonlyMap<string, readonly string[]>): DependencyCheckResult {
    const missing = this.findMissing(dependenciesById);
    const circular = this.findCircular(dependenciesById);

    if (missing.length > 0 || circular.length > 0) {
      return { ok: false, missing, circular, loadOrder: [] };
    }

    return {
      ok: true,
      missing: [],
      circular: [],
      loadOrder: this.topologicalSort(dependenciesById),
    };
  }

  private findMissing(dependenciesById: ReadonlyMap<string, readonly string[]>): string[] {
    const known = new Set(dependenciesById.keys());
    const missing = new Set<string>();
    for (const deps of dependenciesById.values()) {
      for (const dep of deps) {
        if (!known.has(dep)) {
          missing.add(dep);
        }
      }
    }
    return Array.from(missing);
  }

  private findCircular(dependenciesById: ReadonlyMap<string, readonly string[]>): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const stack: string[] = [];
    const onStack = new Set<string>();

    const visit = (id: string): void => {
      if (onStack.has(id)) {
        const cycleStart = stack.indexOf(id);
        cycles.push([...stack.slice(cycleStart), id]);
        return;
      }
      if (visited.has(id)) {
        return;
      }
      visited.add(id);
      stack.push(id);
      onStack.add(id);
      for (const dep of dependenciesById.get(id) ?? []) {
        if (dependenciesById.has(dep)) {
          visit(dep);
        }
      }
      stack.pop();
      onStack.delete(id);
    };

    for (const id of dependenciesById.keys()) {
      visit(id);
    }

    return cycles;
  }

  private topologicalSort(dependenciesById: ReadonlyMap<string, readonly string[]>): string[] {
    const order: string[] = [];
    const visited = new Set<string>();

    const visit = (id: string): void => {
      if (visited.has(id)) {
        return;
      }
      visited.add(id);
      for (const dep of dependenciesById.get(id) ?? []) {
        visit(dep);
      }
      order.push(id);
    };

    for (const id of dependenciesById.keys()) {
      visit(id);
    }

    return order;
  }
}
