import type { IPromptRuntime } from "../contracts/i-prompt-runtime.js";
import { IntegrationNamespace } from "../contracts/integration-namespace.js";

import {
  BaseIntegrationAdapter,
  type BaseIntegrationAdapterOptions,
} from "./base-integration-adapter.js";

/** Wraps an optional `IPromptRuntime` — see `BaseIntegrationAdapter` for the delegation contract. */
export class PromptAdapter extends BaseIntegrationAdapter<IPromptRuntime> {
  readonly namespace = IntegrationNamespace.PROMPT;

  constructor(name: string, runtime?: IPromptRuntime, options?: BaseIntegrationAdapterOptions) {
    super(name, runtime, options);
  }
}
