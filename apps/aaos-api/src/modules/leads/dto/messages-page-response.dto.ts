import type { MessageResponseDto } from "./lead-detail-response.dto.js";

/** `GET /api/v1/leads/:id/messages` response envelope — the requested page + pagination metadata so the caller can tell whether more pages exist. */
export interface MessagesPageResponseDto {
  readonly messages: readonly MessageResponseDto[];
  readonly page: number;
  readonly limit: number;
  readonly total: number;
}
