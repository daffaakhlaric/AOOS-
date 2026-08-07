import { KnowledgeAutoUpdateException } from "./knowledge-auto-update-exception.js";

export class DependencyCycleException extends KnowledgeAutoUpdateException {
  constructor(nodes: readonly string[]) {
    super(`Dependency cycle detected among: ${nodes.join(", ")}`, {
      code: "DEPENDENCY_CYCLE",
      context: { nodes },
    });
  }
}
