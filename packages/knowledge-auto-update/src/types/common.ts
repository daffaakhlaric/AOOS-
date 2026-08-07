/** Opaque identifier alias used throughout the package (job/task/session/report ids, etc.). */
export type Id = string;

/** Free-form, caller-supplied metadata bag (e.g. version/checksum/timestamp fields). */
export type Metadata = Readonly<Record<string, unknown>>;

/** Injectable clock function returning epoch milliseconds — keeps time deterministic in tests. */
export type ClockFn = () => number;
