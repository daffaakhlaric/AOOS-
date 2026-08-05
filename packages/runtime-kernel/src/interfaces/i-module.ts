import type { ModuleDescriptor } from "../contracts/module-descriptor.js";

import type { LifecycleParticipant } from "./i-lifecycle-hooks.js";

/**
 * The interface a real Module implements. No concrete Module ships in this package —
 * this is the mechanism, exercised in tests with fakes, that a future business module
 * (out of scope here) will implement against.
 */
export type IModule = ModuleDescriptor & LifecycleParticipant;
