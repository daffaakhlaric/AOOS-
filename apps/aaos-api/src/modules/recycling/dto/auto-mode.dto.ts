import { z } from "zod";

/** `POST /api/v1/recycling/auto-mode` body — the page header's "Toggle Auto Mode" switch. */
export const SetAutoModeBodySchema = z.object({
  autoMode: z.boolean(),
});
export type SetAutoModeBodyDto = z.infer<typeof SetAutoModeBodySchema>;

export interface AutoModeResponseDto {
  readonly autoMode: boolean;
}
