import type { IsoDateTime } from "@aos/types";

import type { RegistryKind } from "../contracts/registry-kind.js";

import type { RegistryEventName } from "./registry-event-name.js";

export interface RegistryEventPayloadMap {
  [RegistryEventName.REGISTRY_LOADED]: { readonly kind: RegistryKind; readonly count: number };
  [RegistryEventName.REGISTRY_RELOADED]: { readonly kind: RegistryKind; readonly count: number };
  [RegistryEventName.REGISTRY_UPDATED]: {
    readonly kind: RegistryKind;
    readonly id: string;
    readonly version: string;
  };
  [RegistryEventName.REGISTRY_REMOVED]: { readonly kind: RegistryKind; readonly id: string };
  [RegistryEventName.VALIDATION_FAILED]: {
    readonly kind: RegistryKind;
    readonly id: string;
    readonly reason: string;
  };
  [RegistryEventName.DEPENDENCY_FAILED]: {
    readonly kind: RegistryKind;
    readonly id: string;
    readonly reason: string;
  };
}

export interface RegistryEvent<TName extends RegistryEventName = RegistryEventName> {
  readonly name: TName;
  readonly payload: RegistryEventPayloadMap[TName];
  readonly emittedAt: IsoDateTime;
}
