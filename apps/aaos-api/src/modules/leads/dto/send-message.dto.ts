import { z } from "zod";

/**
 * `POST /api/v1/leads/:id/message` body — a sales human's real reply (coordinator note #5).
 * `salesHumanId`/`salesName` are client-declared identity, mirroring `ClaimLeadBodySchema`'s
 * existing convention (this app has no per-request JWT/session decoding anywhere — every other
 * "who is calling" fact, e.g. `GET /leads/my?salesHumanId=`, is client-supplied the same way).
 * `LeadsService.sendMessage` validates `salesHumanId` matches the lead's real
 * `assignedSalesId` before sending — see `leads.service.ts`'s docstring.
 */
export const SendMessageBodySchema = z.object({
  salesHumanId: z.string().min(1, "salesHumanId must not be empty"),
  salesName: z.string().min(1, "salesName must not be empty"),
  message: z.string().min(1, "message must not be empty"),
});

export type SendMessageBodyDto = z.infer<typeof SendMessageBodySchema>;
