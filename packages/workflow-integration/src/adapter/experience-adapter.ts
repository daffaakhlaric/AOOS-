import type { IExperienceRuntime } from "../contracts/i-experience-runtime.js";
import { IntegrationNamespace } from "../contracts/integration-namespace.js";

import {
  BaseIntegrationAdapter,
  type BaseIntegrationAdapterOptions,
} from "./base-integration-adapter.js";

/** Wraps an optional `IExperienceRuntime` — see `BaseIntegrationAdapter` for the delegation contract. Its result is published as an Event only; `WorkflowIntegrationContext` has no dedicated `experienceResult` slot (see `context/with-integration-result.ts`). */
export class ExperienceAdapter extends BaseIntegrationAdapter<IExperienceRuntime> {
  readonly namespace = IntegrationNamespace.EXPERIENCE;

  constructor(name: string, runtime?: IExperienceRuntime, options?: BaseIntegrationAdapterOptions) {
    super(name, runtime, options);
  }
}
