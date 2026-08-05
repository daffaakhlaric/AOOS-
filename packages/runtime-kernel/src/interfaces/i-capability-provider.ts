/** A named capability a Module/Plugin declares it provides — the basis for Capability Discovery. */
export interface CapabilityDescriptor {
  readonly name: string;
  readonly version: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}
