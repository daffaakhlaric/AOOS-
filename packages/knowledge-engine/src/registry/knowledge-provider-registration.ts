/** One entry in the `PROVIDER` bucket — a caller-supplied implementation of one of this package's 14 interface-only Extension Point contracts (e.g. `IKnowledgeIndexer`), registered by id/kind for later lookup. This package never constructs or calls the `instance` itself. */
export interface KnowledgeProviderRegistration {
  readonly id: string;
  readonly kind: string;
  readonly instance: unknown;
}
