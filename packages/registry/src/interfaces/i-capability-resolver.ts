/**
 * Capability Resolver port (docs/PROMPT-005.3A-REGISTRY-ENHANCEMENT.md Enhancement 1):
 * "given a Capability id, which Tool/Connector should execute it for this tenant."
 *
 * INTERFACE ONLY — no implementation ships in this Engineering Task. Capability execution
 * is explicitly deferred to ENGINEERING TASK 005.8; this type exists so that task's
 * implementation has a stable contract to build against without re-touching the Registry
 * package's public surface.
 */
export interface CapabilityResolutionRequest {
  readonly capabilityId: string;
  readonly tenantId?: string;
}

export interface CapabilityResolutionResult {
  readonly capabilityId: string;
  /** Registry entry id of the Tool/Connector selected to serve this Capability. */
  readonly providerId: string;
}

export interface ICapabilityResolver {
  resolve(
    request: CapabilityResolutionRequest,
  ): Promise<CapabilityResolutionResult | undefined> | CapabilityResolutionResult | undefined;
}
