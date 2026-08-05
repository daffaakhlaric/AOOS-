import { z } from "zod";

import { InstanceState } from "./instance-state.js";

export const instanceStateSchema = z.nativeEnum(InstanceState);
