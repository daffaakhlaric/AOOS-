import { BranchId } from "@aos/branch-manager";
import { err, ErrorCode, ok, type Result } from "@aos/common";
import { PROPERTY_TYPES } from "@aos/sales-agent";
import { z } from "zod";

import { SimulatorError } from "../domain/errors/SimulatorError.js";

/** Zod-validated wire shape for a single PROPERTY listing — mirrors `@aos/sales-agent`'s own `PropertyListing` entity field-for-field (that package's own minimal projection of a Phase 2 `listings` row). Kept as this package's own schema (not a re-export) since `@aos/sales-agent` exports `PropertyListing` as a plain `type`, not a Zod schema. */
export const PropertyListingDataSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  propertyType: z.enum(PROPERTY_TYPES),
  price: z.number(),
  city: z.string().optional(),
  bedrooms: z.number().optional(),
  bathrooms: z.number().optional(),
  landArea: z.number().optional(),
  buildArea: z.number().optional(),
  waNumber: z.string().optional(),
  mainPhotoUrl: z.string().optional(),
});
export type PropertyListingData = z.infer<typeof PropertyListingDataSchema>;

/** The 2 verticals `@aos/sales-agent`'s `JessyAgentFactory` composes (`create()` vs `createPropertyAgent()`). */
export const SIMULATOR_VERTICALS = ["AUTOMOTIVE", "PROPERTY"] as const;
export type SimulatorVertical = (typeof SIMULATOR_VERTICALS)[number];

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
 *
 * AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 8 (spec section 12 point 3) — a further, additive
 * deviation: `vertical` (defaults `"AUTOMOTIVE"`, preserving every existing caller's behavior
 * unchanged) selects which `JessyAgentFactory` composition `JessySimulationComposer.compose()`
 * builds. `listingId`/`listings` are `PROPERTY`-only inputs: `listingId` names which listing this
 * session is simulating against (Step 1's "Pilih Listing" in the real Simulasi flow — informational
 * for the caller/composer, not read by `@aos/sales-agent`'s use cases themselves, which take no
 * `listingId` input); `listings` is the already-fetched real listing data `compose()`'s PROPERTY
 * branch wraps into a real `IListingQueryService`. Deliberately NOT fetched via HTTP inside this
 * package (`JessySimulationComposer` never calls `apps/aaos-api` directly — confirmed by reading
 * how `InventoryConnectorFactory` is used, always in-process, never HTTP): the one process with a
 * real HTTP path to `apps/aaos-api`'s `ListingsController` is `apps/aaos-simulator`, so it owns the
 * fetch and passes the result down into this field.
 */
export interface SimulatorConfig {
  readonly maxTurnsPerSimulation: number;
  readonly maxDurationMs: number;
  readonly branchId: BranchId;
  readonly useRealInventory: boolean;
  readonly delayBetweenTurnsMs: number;
  readonly tenantId: string;
  readonly vertical: SimulatorVertical;
  readonly listingId?: string;
  readonly listings?: ReadonlyArray<PropertyListingData>;
}

export const SimulatorConfigSchema = z.object({
  maxTurnsPerSimulation: z.number().int().positive().default(15),
  maxDurationMs: z.number().int().positive().default(30_000),
  branchId: z.nativeEnum(BranchId).default(BranchId.CINERE),
  useRealInventory: z.boolean().default(false),
  delayBetweenTurnsMs: z.number().int().nonnegative().default(0),
  tenantId: z.string().min(1, "tenantId must not be empty").default("tenant-dss-motor"),
  vertical: z.enum(SIMULATOR_VERTICALS).default("AUTOMOTIVE"),
  listingId: z.string().min(1, "listingId must not be empty").optional(),
  listings: z.array(PropertyListingDataSchema).optional(),
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
