import { z } from "zod";

import { ExecutionMode } from "../contracts/execution-mode.js";

export const executionModeSchema = z.nativeEnum(ExecutionMode);
