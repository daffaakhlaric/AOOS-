import { metrics, type Meter } from "@opentelemetry/api";
import { Resource } from "@opentelemetry/resources";
import { MeterProvider } from "@opentelemetry/sdk-metrics";

export interface InitMetricsOptions {
  readonly serviceName: string;
  readonly serviceVersion?: string;
}

export interface MetricsHandle {
  readonly provider: MeterProvider;
  shutdown(): Promise<void>;
}

/**
 * Initializes and globally registers a MeterProvider for this process.
 * No metric reader/exporter is attached here — see tracer.ts's InitTracingOptions note;
 * the same "mechanics only, no destination yet" scoping applies.
 */
export function initMetrics(options: InitMetricsOptions): MetricsHandle {
  const provider = new MeterProvider({
    resource: new Resource({
      "service.name": options.serviceName,
      "service.version": options.serviceVersion ?? "0.0.0",
    }),
  });

  metrics.setGlobalMeterProvider(provider);

  return {
    provider,
    shutdown: () => provider.shutdown(),
  };
}

/** Returns a named Meter from the globally registered MeterProvider (OpenTelemetry API convention). */
export function getMeter(name: string): Meter {
  return metrics.getMeter(name);
}
