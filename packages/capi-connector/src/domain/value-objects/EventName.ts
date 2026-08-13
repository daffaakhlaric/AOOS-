/** Meta CAPI standard event names this connector emits (spec "AAOS Event -> Meta Event Mapping"). */
export enum EventName {
  CONTACT = "Contact",
  INITIATE_CHECKOUT = "InitiateCheckout",
  ADD_TO_WISHLIST = "AddToWishlist",
  LEAD = "Lead",
  PURCHASE = "Purchase",
}

const VALUES: ReadonlySet<string> = new Set(Object.values(EventName));

/** True when `raw` is one of the 5 known `EventName` string values. */
export function isEventName(raw: string): raw is EventName {
  return VALUES.has(raw);
}
