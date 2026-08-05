/**
 * Port for resolving secret values referenced from configuration. No implementation ships
 * here (Vault/AWS Secrets Manager per TSR §3.22 is a Runtime-phase concern) — the
 * Configuration Service accepts any ISecretProvider, defaulting to one that resolves nothing.
 */
export interface ISecretProvider {
  resolve(key: string): Promise<string | undefined>;
}

/** A no-op ISecretProvider — the Configuration Service's default when no provider is supplied. */
export class NullSecretProvider implements ISecretProvider {
  async resolve(_key: string): Promise<string | undefined> {
    return undefined;
  }
}
