import type {
  CapabilityExecutionRequest,
  CapabilityExecutionResult,
  ICapabilityExecutor,
} from "../../src/capability/i-capability-executor.js";

export function successfulCapabilityExecutor(): ICapabilityExecutor {
  return {
    execute: async (): Promise<CapabilityExecutionResult> => ({ success: true, output: {} }),
    validate: async (): Promise<boolean> => true,
    cancel: async (): Promise<void> => {},
  };
}

export function failingCapabilityExecutor(error = "capability boom"): ICapabilityExecutor {
  return {
    execute: async (): Promise<CapabilityExecutionResult> => ({ success: false, error }),
    validate: async (): Promise<boolean> => true,
    cancel: async (): Promise<void> => {},
  };
}

export function trackingCapabilityExecutor(): ICapabilityExecutor & {
  readonly calls: CapabilityExecutionRequest[];
} {
  const calls: CapabilityExecutionRequest[] = [];
  return {
    calls,
    execute: async (request: CapabilityExecutionRequest): Promise<CapabilityExecutionResult> => {
      calls.push(request);
      return { success: true, output: {} };
    },
    validate: async (): Promise<boolean> => true,
    cancel: async (): Promise<void> => {},
  };
}
