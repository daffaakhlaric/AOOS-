import type { IMemoryRuntime } from "../contracts/i-memory-runtime.js";
import { IntegrationNamespace } from "../contracts/integration-namespace.js";

import {
  BaseIntegrationAdapter,
  type BaseIntegrationAdapterOptions,
} from "./base-integration-adapter.js";

/** Wraps an optional `IMemoryRuntime` — see `BaseIntegrationAdapter` for the delegation contract. */
export class MemoryAdapter extends BaseIntegrationAdapter<IMemoryRuntime> {
  readonly namespace = IntegrationNamespace.MEMORY;

  constructor(name: string, runtime?: IMemoryRuntime, options?: BaseIntegrationAdapterOptions) {
    super(name, runtime, options);
  }
}
