import type { IsoDateTime, Uuid } from "@aos/types";

/** Kernel-instance-wide identity/metadata, stable for the entire process lifetime. */
export interface RuntimeContext {
  readonly kernelId: Uuid<"KernelId">;
  readonly kernelName: string;
  readonly kernelVersion: string;
  readonly environment: string;
  readonly startedAt: IsoDateTime;
}
