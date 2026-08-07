import { z } from "zod";

import { KnowledgeVersionState } from "./knowledge-version-state.js";

export const knowledgeVersionStateSchema = z.nativeEnum(KnowledgeVersionState);
