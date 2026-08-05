/** Interface only — no implementation in this package. An external pluggable Health backend `KnowledgeProviderHealth` may delegate to (e.g. a live connectivity probe). */
export interface IKnowledgeProviderHealth {
  check(): boolean | Promise<boolean>;
}
