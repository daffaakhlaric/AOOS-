import { z } from "zod";

import { KnowledgeProviderState } from "./knowledge-provider-state.js";

export const knowledgeProviderStateSchema = z.nativeEnum(KnowledgeProviderState);
