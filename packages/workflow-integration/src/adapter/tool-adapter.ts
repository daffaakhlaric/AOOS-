import type { IToolRuntime } from "../contracts/i-tool-runtime.js";
import { IntegrationNamespace } from "../contracts/integration-namespace.js";

import {
  BaseIntegrationAdapter,
  type BaseIntegrationAdapterOptions,
} from "./base-integration-adapter.js";

/** Wraps an optional `IToolRuntime` — see `BaseIntegrationAdapter` for the delegation contract. */
export class ToolAdapter extends BaseIntegrationAdapter<IToolRuntime> {
  readonly namespace = IntegrationNamespace.TOOL;

  constructor(name: string, runtime?: IToolRuntime, options?: BaseIntegrationAdapterOptions) {
    super(name, runtime, options);
  }
}
