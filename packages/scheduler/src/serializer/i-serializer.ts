/** Serializer port. JSON ships in this package; MessagePack is future work (docs/PROMPT-005.5-ENTERPRISE-SCHEDULER.md — "Serializer"). */
export interface ISerializer {
  readonly format: string;
  serialize(value: unknown): string | Uint8Array;
  deserialize<T = unknown>(data: string | Uint8Array): T;
}
