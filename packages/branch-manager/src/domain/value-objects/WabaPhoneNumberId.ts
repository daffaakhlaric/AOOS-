/**
 * Judgment call — second occurrence of this exact pattern in the AAOS series: the spec's folder
 * tree names this file `WabaPhoneNumberId.ts ← import from @aos/whatsapp-connector`, implying a
 * type of that exact name is exported from `@aos/whatsapp-connector`. Reading
 * `packages/whatsapp-connector/src/index.ts`'s real export list shows no `WabaPhoneNumberId`
 * export — the real exported name is `PhoneNumberId` (`export { PhoneNumberId } from
 * "./domain/value-objects/PhoneNumberId.js"`). Resolved by re-exporting/aliasing the real class
 * under the spec's chosen local name, wiring to the real underlying `PhoneNumberId` value object
 * (Meta's `phone_number_id`) rather than a broken import of a nonexistent symbol. `PhoneNumberId`
 * is a class, so this single re-export covers both the type position (`WabaPhoneNumberId` as a
 * type) and the value position (`WabaPhoneNumberId.create(...)`).
 */
export { PhoneNumberId as WabaPhoneNumberId } from "@aos/whatsapp-connector";
