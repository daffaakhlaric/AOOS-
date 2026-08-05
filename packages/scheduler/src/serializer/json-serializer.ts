import { SchedulerException } from "../errors/scheduler-exception.js";

import type { ISerializer } from "./i-serializer.js";

/** The default (and, in this Engineering Task, only) Job Serializer. */
export class JsonSerializer implements ISerializer {
  readonly format = "json";

  serialize(value: unknown): string {
    return JSON.stringify(value);
  }

  deserialize<T = unknown>(data: string | Uint8Array): T {
    const text = typeof data === "string" ? data : new TextDecoder().decode(data);
    try {
      return JSON.parse(text) as T;
    } catch (error) {
      throw new SchedulerException(`Failed to deserialize JSON job payload: ${String(error)}`, {
        cause: error,
      });
    }
  }
}
