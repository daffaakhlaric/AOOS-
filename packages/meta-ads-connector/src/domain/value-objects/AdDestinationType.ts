/**
 * The CTWA (click-to-WhatsApp) destination an ad set routes a lead to, once they click the ad.
 * AAOS-W1D-S3: DSS Motor's real strategy always uses `WHATSAPP` — lead clicks the ad, lands
 * straight in WhatsApp with Clara, follow-up happens there. The other members are kept for
 * completeness/future use (Meta itself supports all four as `destination_type` values on an
 * ad set), but AAOS-composed campaigns (`CreateCampaign`) always set `WHATSAPP`.
 */
export enum AdDestinationType {
  WHATSAPP = "WHATSAPP",
  MESSENGER = "MESSENGER",
  WEBSITE = "WEBSITE",
  INSTAGRAM = "INSTAGRAM",
}
