import { z } from "zod";

import { ExecutionMode } from "./execution-mode.js";

export const executionModeSchema = z.nativeEnum(ExecutionMode);
