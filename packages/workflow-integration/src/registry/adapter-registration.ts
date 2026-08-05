import type { IIntegrationAdapter } from "../adapter/i-integration-adapter.js";

/** One registered Adapter plus its registration-time bookkeeping — returned by `list()`/`health()`. */
export interface AdapterRegistration {
  readonly adapter: IIntegrationAdapter;
  readonly registeredAt: string;
}
