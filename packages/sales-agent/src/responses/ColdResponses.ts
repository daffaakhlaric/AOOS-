import { pickFromPool } from "./PoolSelector.js";

/** Nurture pool for a still-active but COLD-scored conversation (NURTURE stage, mid-conversation — distinct from the scheduled D3/D7/D14 follow-up sends in `FollowUpResponses.ts`). */
export const COLD_NURTURE_POOL: ReadonlyArray<string> = [
  "Gak buru-buru kok kak, santai aja 😊 Kalau nanti udah siap atau ada pertanyaan, tinggal chat Jessy lagi ya!",
  "Oke kak, Jessy standby kalau sewaktu-waktu mau tanya-tanya lagi soal mobil ya 😊",
];

export function getColdNurtureResponse(seed: number): string {
  return pickFromPool(COLD_NURTURE_POOL, seed);
}
