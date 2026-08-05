import { z } from "zod";

import { KnowledgeSourceState } from "./knowledge-source-state.js";

export const knowledgeSourceStateSchema = z.nativeEnum(KnowledgeSourceState);
