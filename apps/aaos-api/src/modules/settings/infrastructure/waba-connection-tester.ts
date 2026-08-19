/**
 * Real (best-effort) WhatsApp Business Account connection check for `/settings`'s WABA card
 * "Test" action (Part 2 of the spec; coordinator note point 4's Settings section explicitly
 * allows "a documented best-effort check" here since `packages/whatsapp-connector`'s
 * `IWhatsAppClient` exposes only `sendText`/`sendTemplate`/`sendInteractive` — no phone-number-
 * status lookup — verified by reading that package's real contract before writing this file.
 *
 * Rather than invent a new method on that package's port (a bigger, cross-package change for one
 * settings-page button), this calls Meta's real Graph API phone-number-status endpoint directly:
 * `GET /{phone_number_id}?fields=verified_name,code_verification_status,quality_rating` — the
 * SAME Graph API `@aos/whatsapp-connector` itself talks to, just a read Meta happens to expose
 * for exactly this purpose (checking a phone number id + access token pair is valid) that this
 * package's port doesn't wrap. A real network call, never a fabricated success — mirrors
 * `modules/simulation/infrastructure/aaos-simulator-client.ts`'s standalone-function-over-`fetch`
 * shape (no axios/got anywhere in this codebase).
 */

const META_BASE_URL = "https://graph.facebook.com";
const DEFAULT_API_VERSION = "v21.0";

export interface WabaTestResult {
  readonly success: boolean;
  readonly message: string;
}

export async function testWabaConnection(
  phoneNumberId: string,
  accessToken: string,
  apiVersion: string = DEFAULT_API_VERSION,
): Promise<WabaTestResult> {
  const url = `${META_BASE_URL}/${apiVersion}/${phoneNumberId}?fields=verified_name,code_verification_status,quality_rating`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: { authorization: `Bearer ${accessToken}` },
    });
  } catch (caught) {
    return {
      success: false,
      message: `Gagal menghubungi WhatsApp Business API: ${
        caught instanceof Error ? caught.message : String(caught)
      }`,
    };
  }

  const text = await response.text();
  let body: unknown;
  try {
    body = text.length > 0 ? JSON.parse(text) : undefined;
  } catch {
    return {
      success: false,
      message: `WhatsApp Business API mengembalikan respons yang tidak valid (status ${String(response.status)})`,
    };
  }

  if (!response.ok) {
    const message =
      typeof body === "object" && body !== null && "error" in body
        ? String((body as { error: { message?: unknown } }).error.message ?? "unknown error")
        : `status ${String(response.status)}`;
    return { success: false, message: `Koneksi WABA gagal: ${message}` };
  }

  const verifiedName =
    typeof body === "object" && body !== null && "verified_name" in body
      ? String((body as { verified_name?: unknown }).verified_name ?? "")
      : "";

  return {
    success: true,
    message: verifiedName.length > 0 ? `Terhubung — ${verifiedName}` : "Terhubung",
  };
}
