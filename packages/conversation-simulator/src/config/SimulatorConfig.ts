import { BranchId } from "@aos/branch-manager";
import { err, ErrorCode, ok, type Result } from "@aos/common";
import { z } from "zod";

import { SimulatorError } from "../domain/errors/SimulatorError.js";

/**
 * Simulator configuration (spec "Configuration").
 *
 * Deviation from the spec's literal 5-field interface, documented explicitly (constitution §3.13
 * composition-root discipline: every cross-cutting dependency, including tenant scoping, is
 * injected — never a hidden global): a `tenantId` field is added. It is required to drive
 * `@aos/sales-agent`'s real `ProcessIncomingMessage.execute({ ..., tenantId, correlationId })` and
 * `@aos/branch-manager`'s real `AssignLead.execute({ ..., tenantId })` — both mandatory inputs on
 * the real use cases this package composes, per the spec's own instruction to run "the real
 * `@aos/sales-agent` (Jessy) conversation engine, entirely in-memory" rather than a stub. Every
 * other field matches the spec's literal shape and defaults exactly.
 */
export interface SimulatorConfig {
  readonly maxTurnsPerSimulation: number;
  readonly maxDurationMs: number;
  readonly branchId: BranchId;
  readonly useRealInventory: boolean;
  readonly delayBetweenTurnsMs: number;
  readonly tenantId: string;
}

export const SimulatorConfigSchema = z.object({
  maxTurnsPerSimulation: z.number().int().positive().default(15),
  maxDurationMs: z.number().int().positive().default(30_000),
  branchId: z.nativeEnum(BranchId).default(BranchId.CINERE),
  useRealInventory: z.boolean().default(false),
  delayBetweenTurnsMs: z.number().int().nonnegative().default(0),
  tenantId: z.string().min(1, "tenantId must not be empty").default("tenant-dss-motor"),
});

export type SimulatorConfigInput = z.input<typeof SimulatorConfigSchema>;

/** The fully-defaulted config `SimulatorFactory` hands to a fresh `RunSimulation` call when the caller supplies no overrides. */
export const DEFAULT_SIMULATOR_CONFIG: SimulatorConfig = SimulatorConfigSchema.parse({});

/** Parses + validates raw config input (spec's `SimulatorConfig` shape), returning `Result` (constitution: expected/recoverable failures are values, not exceptions). */
export function parseSimulatorConfig(input: unknown): Result<SimulatorConfig, SimulatorError> {
  const parsed = SimulatorConfigSchema.safeParse(input ?? {});
  if (!parsed.success) {
    return err(
      new SimulatorError(
        ErrorCode.VALIDATION_ERROR,
        parsed.error.issues.map((i) => i.message).join("; "),
      ),
    );
  }
  return ok(parsed.data);
}
