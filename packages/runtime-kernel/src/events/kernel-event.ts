import type { IsoDateTime } from "@aos/types";

import type { KernelEventName } from "../types/index.js";

/**
 * The payload shape for every named Kernel event. This is an in-process, synchronous
 * notification mechanism internal to a single Kernel instance — it is explicitly NOT the
 * platform Event Bus / Event Contract from docs/003.5-CONTRACT-FIRST-DESIGN.md §10, which
 * is a distributed, durable, cross-service concern out of scope for this package.
 */
export interface KernelEventPayloadMap {
  [KernelEventName.KERNEL_STARTED]: { readonly startedAt: IsoDateTime };
  [KernelEventName.KERNEL_STOPPED]: { readonly stoppedAt: IsoDateTime };
  [KernelEventName.KERNEL_FAILED]: { readonly error: string };
  [KernelEventName.KERNEL_RELOADED]: { readonly reloadedAt: IsoDateTime };
  [KernelEventName.CONFIGURATION_RELOADED]: { readonly reloadedAt: IsoDateTime };
  [KernelEventName.MODULE_LOADED]: { readonly name: string; readonly version: string };
  [KernelEventName.PLUGIN_LOADED]: { readonly name: string; readonly version: string };
  [KernelEventName.HEALTH_CHANGED]: { readonly status: string };
}

export interface KernelEvent<TName extends KernelEventName = KernelEventName> {
  readonly name: TName;
  readonly payload: KernelEventPayloadMap[TName];
  readonly emittedAt: IsoDateTime;
}
