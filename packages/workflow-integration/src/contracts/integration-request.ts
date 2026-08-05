/**
 * The generic request shape every future runtime contract in this package accepts —
 * shared across `ICapabilityRuntime`/`IToolRuntime`/etc. so this package can define a
 * single Adapter/Resolver/Pipeline flow without knowing any runtime-specific request
 * shape ahead of time. A concrete future runtime package is free to accept a richer,
 * runtime-specific request type as long as it still satisfies this shape structurally.
 */
export interface IntegrationRequest {
  readonly operation: string;
  readonly input: Readonly<Record<string, unknown>>;
  readonly metadata?: Readonly<Record<string, unknown>>;
}
