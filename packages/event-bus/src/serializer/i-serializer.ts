/**
 * Serializer port. JSON ships in this package (json-serializer.ts). MessagePack and Avro
 * are future implementations of this same port (docs/PROMPT-005.4-ENTERPRISE-EVENT-BUS.md
 * — "Serializer: JSON. Future: MessagePack, Avro") — no stub class ships for them since
 * nothing in this package would consume it yet.
 */
export interface ISerializer {
  readonly format: string;
  serialize(value: unknown): string | Uint8Array;
  deserialize<T = unknown>(data: string | Uint8Array): T;
}
