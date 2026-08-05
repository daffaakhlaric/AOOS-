import { z } from "zod";

import { KnowledgeRetrievalState } from "./knowledge-retrieval-state.js";

export const knowledgeRetrievalStateSchema = z.nativeEnum(KnowledgeRetrievalState);
