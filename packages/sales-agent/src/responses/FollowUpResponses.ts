import { FollowUpDay } from "../domain/value-objects/FollowUpDay.js";

import { pickFromPool } from "./PoolSelector.js";

/** D1 (WARM leads' first follow-up — spec "Follow-up Schedule": `FOLLOW_UP_WARM_D1`). */
export const FOLLOW_UP_WARM_D1: ReadonlyArray<string> = [
  "Hai kak! Gimana, jadi mau lanjut lihat-lihat unitnya? Clara siap bantu kalau ada pertanyaan 😊",
];

/** D3 (spec "Response Templates" — `FOLLOW_UP_D3`). */
export const FOLLOW_UP_D3: ReadonlyArray<string> = [
  "Hai kak! Clara mau follow up nih, kemarin sempat tanya soal mobil. Gimana kak, masih nyari? 😊",
  "Halo kak! Sebelumnya tanya soal unitnya. Kebetulan stoknya masih ada lho kak 😊 Mau Clara bantu lebih lanjut?",
];

/** D7. */
export const FOLLOW_UP_D7: ReadonlyArray<string> = [
  "Hai kak! Masih mikirin soal mobilnya kah? Kalau ada yang mau ditanyain, Clara siap bantu kapan aja 😊",
];

/** D14. */
export const FOLLOW_UP_D14: ReadonlyArray<string> = [
  "Halo kak! Udah 2 minggu nih, mau update aja kalau ada unit baru yang mungkin cocok. Masih berminat kak? 😊",
];

const POOL_BY_DAY: Readonly<Record<FollowUpDay, ReadonlyArray<string>>> = {
  [FollowUpDay.D1]: FOLLOW_UP_WARM_D1,
  [FollowUpDay.D3]: FOLLOW_UP_D3,
  [FollowUpDay.D7]: FOLLOW_UP_D7,
  [FollowUpDay.D14]: FOLLOW_UP_D14,
};

export function getFollowUpMessage(day: FollowUpDay, seed: number): string {
  return pickFromPool(POOL_BY_DAY[day], seed);
}
