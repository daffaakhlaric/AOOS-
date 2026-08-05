import type { ICapabilityRuntime } from "../contracts/i-capability-runtime.js";
import { IntegrationNamespace } from "../contracts/integration-namespace.js";

import {
  BaseIntegrationAdapter,
  type BaseIntegrationAdapterOptions,
} from "./base-integration-adapter.js";

/** Wraps an optional `ICapabilityRuntime` — see `BaseIntegrationAdapter` for the delegation contract. */
export class CapabilityAdapter extends BaseIntegrationAdapter<ICapabilityRuntime> {
  readonly namespace = IntegrationNamespace.CAPABILITY;

  constructor(name: string, runtime?: ICapabilityRuntime, options?: BaseIntegrationAdapterOptions) {
    super(name, runtime, options);
  }
}
