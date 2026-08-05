import { trace, type Tracer } from "@opentelemetry/api";
import { Resource } from "@opentelemetry/resources";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";

export interface InitTracingOptions {
  readonly serviceName: string;
  readonly serviceVersion?: string;
}

export interface TracingHandle {
  readonly provider: NodeTracerProvider;
  shutdown(): Promise<void>;
}

/**
 * Initializes and globally registers a NodeTracerProvider for this process.
 * No exporter is attached here (span processors are added by whatever Runtime service
 * actually needs to ship traces somewhere — Foundation-phase packages only establish
 * the provider/registration mechanics per Architecture doc 002 §17/§23).
 */
export function initTracing(options: InitTracingOptions): TracingHandle {
  const provider = new NodeTracerProvider({
    resource: new Resource({
      "service.name": options.serviceName,
      "service.version": options.serviceVersion ?? "0.0.0",
    }),
  });

  provider.register();

  return {
    provider,
    shutdown: () => provider.shutdown(),
  };
}

/** Returns a named Tracer from the globally registered TracerProvider (OpenTelemetry API convention). */
export function getTracer(name: string): Tracer {
  return trace.getTracer(name);
}
