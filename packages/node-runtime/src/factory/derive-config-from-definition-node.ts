import { NodeType as DefinitionNodeType, type Node } from "@aos/workflow-definition";

/**
 * Best-effort extraction of a `NodeInstance.config` from a `@aos/workflow-definition` Node
 * — only the fields the mapped Node Runtime Manifest's `configSchema` actually expects
 * are copied. `Condition`/`Loop`/`Wait` carry a structured `Expression` object in
 * `@aos/workflow-definition` with no direct string representation this package's built-in
 * manifests expect, so they (and Node Types with no direct Node Runtime equivalent —
 * `Task`/`SubWorkflow`, mapped to `Custom`) yield an empty config — a documented
 * limitation, not a silent bug.
 */
export function deriveConfigFromDefinitionNode(node: Node): Record<string, unknown> {
  switch (node.type) {
    case DefinitionNodeType.CAPABILITY:
      return { capabilityId: node.capability, capabilityVersion: node.capabilityVersion };
    case DefinitionNodeType.DELAY:
      return { durationMs: node.durationMs };
    case DefinitionNodeType.HUMAN:
      return { assigneeRole: node.assigneeRole, formRef: node.formRef };
    default:
      return {};
  }
}
