import type { IConnectorRuntime } from "../contracts/i-connector-runtime.js";
import { IntegrationNamespace } from "../contracts/integration-namespace.js";

import {
  BaseIntegrationAdapter,
  type BaseIntegrationAdapterOptions,
} from "./base-integration-adapter.js";

/** Wraps an optional `IConnectorRuntime` — see `BaseIntegrationAdapter` for the delegation contract. */
export class ConnectorAdapter extends BaseIntegrationAdapter<IConnectorRuntime> {
  readonly namespace = IntegrationNamespace.CONNECTOR;

  constructor(name: string, runtime?: IConnectorRuntime, options?: BaseIntegrationAdapterOptions) {
    super(name, runtime, options);
  }
}
