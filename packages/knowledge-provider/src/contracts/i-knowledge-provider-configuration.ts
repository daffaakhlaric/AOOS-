/** Interface only — no implementation in this package. "Configuration model only. NO OAuth. NO Secrets. NO API Clients. Only metadata." An external pluggable configuration validator `KnowledgeProviderConfiguration` may delegate to. */
export interface IKnowledgeProviderConfiguration {
  validate(settings: Readonly<Record<string, unknown>>): boolean;
}
