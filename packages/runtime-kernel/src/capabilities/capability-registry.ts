import type { CapabilityDescriptor } from "../interfaces/i-capability-provider.js";

/**
 * Capability Discovery and Service Discovery share one mechanism at Kernel scope: a registry
 * of named, versioned things a Module/Plugin declares it provides, queryable by anything else
 * loaded into the same Kernel — no network/service-mesh discovery is implemented here.
 */
export class CapabilityRegistry {
  private readonly capabilities = new Map<string, CapabilityDescriptor>();

  register(descriptor: CapabilityDescriptor): void {
    this.capabilities.set(descriptor.name, descriptor);
  }

  has(name: string): boolean {
    return this.capabilities.has(name);
  }

  get(name: string): CapabilityDescriptor | undefined {
    return this.capabilities.get(name);
  }

  list(): readonly CapabilityDescriptor[] {
    return Array.from(this.capabilities.values());
  }

  unregister(name: string): boolean {
    return this.capabilities.delete(name);
  }

  get count(): number {
    return this.capabilities.size;
  }
}
