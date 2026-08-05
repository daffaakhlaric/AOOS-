/** Service Container registration lifetimes. */
export enum Lifetime {
  /** One instance for the lifetime of the Kernel. */
  SINGLETON = "singleton",
  /** One instance per resolution scope (e.g. per request). */
  SCOPED = "scoped",
  /** A new instance every time it is resolved. */
  TRANSIENT = "transient",
}
