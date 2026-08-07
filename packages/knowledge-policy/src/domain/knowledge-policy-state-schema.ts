import { z } from "zod";

import { KnowledgePolicyState } from "./knowledge-policy-state.js";

export const knowledgePolicyStateSchema = z.nativeEnum(KnowledgePolicyState);
