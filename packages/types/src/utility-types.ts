/**
 * Generic, dependency-free TypeScript utility types shared across every AOS package.
 * No business logic lives here — only structural type helpers.
 */

/** Makes every property of T optional, recursively. */
export type DeepPartial<T> = T extends (infer U)[]
  ? DeepPartial<U>[]
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;

/** Makes every property of T readonly, recursively. */
export type DeepReadonly<T> = T extends (infer U)[]
  ? ReadonlyArray<DeepReadonly<U>>
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T;

/** T or null. */
export type Nullable<T> = T | null;

/** T or undefined. */
export type Optional<T> = T | undefined;

/** T, null, or undefined. */
export type Maybe<T> = T | null | undefined;

/** The union of a mapped object type's own value types. */
export type ValueOf<T> = T[keyof T];

/** A non-empty array of T. */
export type NonEmptyArray<T> = [T, ...T[]];

/** Extracts the resolved type of a Promise. */
export type UnwrapPromise<T> = T extends Promise<infer U> ? U : T;

/** A type with at least one of the given keys of T required. */
export type AtLeastOne<T, K extends keyof T = keyof T> = K extends unknown
  ? Required<Pick<T, K>> & Partial<Omit<T, K>>
  : never;

/** A constructor function type for T. */
export type Constructor<T = unknown> = new (...args: unknown[]) => T;
