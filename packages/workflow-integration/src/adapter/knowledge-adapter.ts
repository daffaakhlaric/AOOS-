import type { IKnowledgeRuntime } from "../contracts/i-knowledge-runtime.js";
import { IntegrationNamespace } from "../contracts/integration-namespace.js";

import {
  BaseIntegrationAdapter,
  type BaseIntegrationAdapterOptions,
} from "./base-integration-adapter.js";

/** Wraps an optional `IKnowledgeRuntime` — see `BaseIntegrationAdapter` for the delegation contract. */
export class KnowledgeAdapter extends BaseIntegrationAdapter<IKnowledgeRuntime> {
  readonly namespace = IntegrationNamespace.KNOWLEDGE;

  constructor(name: string, runtime?: IKnowledgeRuntime, options?: BaseIntegrationAdapterOptions) {
    super(name, runtime, options);
  }
}
