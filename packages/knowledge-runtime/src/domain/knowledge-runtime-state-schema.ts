import { z } from "zod";

import { KnowledgeRuntimeState } from "./knowledge-runtime-state.js";

export const knowledgeRuntimeStateSchema = z.nativeEnum(KnowledgeRuntimeState);
