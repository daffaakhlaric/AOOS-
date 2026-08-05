import type { ISpan, ITracer, SpanAttributes } from "./i-tracer.js";
import type { TraceContext } from "./trace-context.js";

export interface RecordedSpan {
  readonly name: string;
  readonly context: TraceContext;
  readonly attributes: Record<string, string | number | boolean>;
  readonly startedAt: number;
  readonly endedAt?: number;
}

/** The default, dependency-free Tracer — keeps every span in memory for inspection/tests. */
export class InMemoryTracer implements ITracer {
  private readonly spans: RecordedSpan[] = [];

  startSpan(name: string, context: TraceContext, attributes: SpanAttributes = {}): ISpan {
    const record: { -readonly [K in keyof RecordedSpan]: RecordedSpan[K] } = {
      name,
      context,
      attributes: { ...attributes },
      startedAt: Date.now(),
    };
    this.spans.push(record);

    return {
      context,
      setAttribute: (key, value) => {
        record.attributes[key] = value;
      },
      end: (endAttributes) => {
        Object.assign(record.attributes, endAttributes);
        record.endedAt = Date.now();
      },
    };
  }

  getSpans(): readonly RecordedSpan[] {
    return this.spans;
  }

  clear(): void {
    this.spans.length = 0;
  }
}
