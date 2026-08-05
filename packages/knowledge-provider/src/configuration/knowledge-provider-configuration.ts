import { ProviderConfigurationException } from "../errors/provider-configuration-exception.js";

const SECRET_KEY_PATTERN = /secret|password|token|api[-_]?key|credential|oauth/i;

/**
 * "CONFIGURATION: Configuration model only. NO OAuth. NO Secrets. NO API Clients. Only
 * metadata." (docs/PROMPT-005.7F-KNOWLEDGE-PROVIDER.md) — `KnowledgeProviderConfiguration`
 * validates that a Provider's `providerConfiguration` settings object contains only
 * metadata-driven values, rejecting any key that looks like a credential. This is a
 * real, enforced guard — not merely a documentation comment.
 */
export class KnowledgeProviderConfiguration {
  validate(settings: Readonly<Record<string, unknown>>): boolean {
    return this.findSecretLikeKeys(settings).length === 0;
  }

  assertValid(settings: Readonly<Record<string, unknown>>): void {
    const secretKeys = this.findSecretLikeKeys(settings);
    if (secretKeys.length > 0) {
      throw new ProviderConfigurationException(
        `Provider configuration must not contain secret-looking keys: ${secretKeys.join(", ")}`,
      );
    }
  }

  merge(
    base: Readonly<Record<string, unknown>>,
    overrides: Readonly<Record<string, unknown>>,
  ): Readonly<Record<string, unknown>> {
    return { ...base, ...overrides };
  }

  private findSecretLikeKeys(settings: Readonly<Record<string, unknown>>): readonly string[] {
    return Object.keys(settings).filter((key) => SECRET_KEY_PATTERN.test(key));
  }
}
