import type { IAgentRuntime } from "../contracts/i-agent-runtime.js";
import { IntegrationNamespace } from "../contracts/integration-namespace.js";

import {
  BaseIntegrationAdapter,
  type BaseIntegrationAdapterOptions,
} from "./base-integration-adapter.js";

/** Wraps an optional `IAgentRuntime` — see `BaseIntegrationAdapter` for the delegation contract. */
export class AgentAdapter extends BaseIntegrationAdapter<IAgentRuntime> {
  readonly namespace = IntegrationNamespace.AGENT;

  constructor(name: string, runtime?: IAgentRuntime, options?: BaseIntegrationAdapterOptions) {
    super(name, runtime, options);
  }
}
