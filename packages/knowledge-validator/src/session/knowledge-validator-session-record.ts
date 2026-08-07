import { z } from "zod";

import { KnowledgeValidationSessionState } from "../domain/knowledge-validation-session-state.js";

export const knowledgeValidatorSessionRecordSchema = z.object({
  id: z.string().min(1),
  token: z.string().min(1),
  holder: z.string().min(1),
  state: z.nativeEnum(KnowledgeValidationSessionState),
  openedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  closedAt: z.string().datetime().optional(),
  renewedAt: z.string().datetime().optional(),
});

export type KnowledgeValidatorSessionRecord = z.infer<typeof knowledgeValidatorSessionRecordSchema>;
