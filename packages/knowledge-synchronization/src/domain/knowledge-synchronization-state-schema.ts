import { z } from "zod";

import { KnowledgeSynchronizationState } from "./knowledge-synchronization-state.js";

export const knowledgeSynchronizationStateSchema = z.nativeEnum(KnowledgeSynchronizationState);
