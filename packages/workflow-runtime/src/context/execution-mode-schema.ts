import { z } from "zod";

import { ExecutionMode } from "./execution-mode.js";

export const executionMode = z.nativeEnum(ExecutionMode);
