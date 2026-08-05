/**
 * Branded ("nominal") type helper. Prevents structurally-identical primitives
 * (e.g. two different UUID-shaped strings) from being interchangeable at the type level.
 *
 * Used throughout AOS for identifiers such as TenantId, AgentId, EventId — see
 * docs/003.5-CONTRACT-FIRST-DESIGN.md contract field specs, which this package's
 * ./sdk-adjacent consumers rely on for compile-time tenant-scoping safety.
 */
declare const brand: unique symbol;

export type Brand<T, TBrand extends string> = T & { readonly [brand]: TBrand };

/** A branded UUID string. */
export type Uuid<TBrand extends string = "Uuid"> = Brand<string, TBrand>;

/** A branded ISO-8601 date-time string. */
export type IsoDateTime = Brand<string, "IsoDateTime">;
