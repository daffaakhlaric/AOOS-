/**
 * "MEMORY NODE: No memory implementation. Interfaces only." (docs/PROMPT-005.6C-ENTERPRISE-NODE-RUNTIME.md).
 * No class in this package implements these — the extension point a future Memory Engine
 * (005.7) implements.
 */
export interface IMemoryReader {
  read(scope: string, key: string): Promise<unknown>;
}

export interface IMemoryWriter {
  write(scope: string, key: string, value: unknown): Promise<void>;
}

export interface IMemoryProvider {
  readonly reader: IMemoryReader;
  readonly writer: IMemoryWriter;
}
