import type { IntegrationRequest } from "../../src/contracts/integration-request.js";
import type { IntegrationResult } from "../../src/contracts/integration-result.js";

export interface FakeRuntime {
  execute(request: IntegrationRequest): Promise<IntegrationResult>;
}

export function successfulRuntime(output: Readonly<Record<string, unknown>> = {}): FakeRuntime {
  return {
    execute: async (): Promise<IntegrationResult> => ({ success: true, output }),
  };
}

export function failingRuntime(error = "runtime failure"): FakeRuntime {
  return {
    execute: async (): Promise<IntegrationResult> => ({ success: false, error }),
  };
}

export function trackingRuntime(): FakeRuntime & { readonly calls: IntegrationRequest[] } {
  const calls: IntegrationRequest[] = [];
  return {
    calls,
    execute: async (request: IntegrationRequest): Promise<IntegrationResult> => {
      calls.push(request);
      return { success: true, output: {} };
    },
  };
}
