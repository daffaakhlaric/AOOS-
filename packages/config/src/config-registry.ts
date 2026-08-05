/**
 * A small in-memory registry for named, already-validated configuration sections
 * (e.g. "database", "cache", "telemetry"), each registered exactly once at process
 * startup and read-only thereafter.
 *
 * This is a Foundation-phase convenience utility, NOT the Registry Contract from
 * docs/003.5-CONTRACT-FIRST-DESIGN.md §13 — that Registry is a full runtime service
 * (versioned, tenant-aware, event-emitting) that does not exist yet. This class only
 * prevents "which section holds the Postgres config" from becoming ad hoc global state
 * within a single process.
 */
export class ConfigRegistry {
  private readonly sections = new Map<string, unknown>();

  register<T>(name: string, value: T): void {
    if (this.sections.has(name)) {
      throw new Error(`Config section "${name}" is already registered`);
    }
    this.sections.set(name, value);
  }

  get<T>(name: string): T {
    if (!this.sections.has(name)) {
      throw new Error(`Config section "${name}" has not been registered`);
    }
    return this.sections.get(name) as T;
  }

  has(name: string): boolean {
    return this.sections.has(name);
  }
}
