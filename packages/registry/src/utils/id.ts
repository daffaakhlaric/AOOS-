import { randomUUID } from "node:crypto";

/**
 * Generates a fresh random identifier. Deliberately duplicated (not imported) from
 * @aos/runtime-kernel's identical helper — Registry depends on Kernel only through the
 * IModule interface (bootstrap/registry-module.ts), never through internal utilities, to
 * keep the two pillars decoupled per Constitution §3.11 Hexagonal Architecture.
 */
export function generateId(): string {
  return randomUUID();
}
