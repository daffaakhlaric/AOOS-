/**
 * The formal Capability Namespace list (docs/PROMPT-005.3A-REGISTRY-ENHANCEMENT.md
 * Enhancement 5). A Capability id (e.g. `inventory.read`) must be namespace-qualified —
 * its first dot-segment must be one of these values. The list itself is a fixed,
 * de-duplicated set; `isValidCapabilityNamespace` rejects any id outside it.
 */
export const CAPABILITY_NAMESPACES = [
  "inventory",
  "crm",
  "customer",
  "sales",
  "marketing",
  "ads",
  "social",
  "calendar",
  "communication",
  "workflow",
  "reasoning",
  "planning",
  "analytics",
  "memory",
  "knowledge",
  "permission",
  "tool",
  "connector",
  "dashboard",
  "system",
  "tenant",
] as const;

export type CapabilityNamespace = (typeof CAPABILITY_NAMESPACES)[number];

const NAMESPACE_SET: ReadonlySet<string> = new Set(CAPABILITY_NAMESPACES);

/** The dot-segment before the first `.` in a Capability id (e.g. "inventory.read" → "inventory"). */
export function extractCapabilityNamespace(capabilityId: string): string {
  return capabilityId.split(".")[0]!;
}

export function isValidCapabilityNamespace(capabilityId: string): boolean {
  return NAMESPACE_SET.has(extractCapabilityNamespace(capabilityId));
}
