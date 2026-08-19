/**
 * Thin fetch wrapper to the real `apps/aaos-api` HTTP endpoints — AAOS-W4A coordinator note #2:
 * this app "proxies to `apps/aaos-api` for ALL data" rather than composing backend packages
 * (`@aos/objective-engine`/`@aos/creative-agent`/`@aos/lead-store`/`@aos/branch-manager`)
 * directly. Every `src/app/api/*` route handler in this app calls a function from this module,
 * which in turn `fetch()`es `aaos-api`, sending the `x-api-key` header `aaos-api`'s `ApiKeyGuard`
 * requires (see `apps/aaos-api/src/modules/meta-ads/guards/api-key.guard.ts`).
 *
 * Server-only by construction: `AAOS_API_KEY` is never `NEXT_PUBLIC_`-prefixed, so this module
 * must never be imported from a `"use client"` component — only from `src/app/api/*` route
 * handlers, which always run on the server.
 */

export class AaosApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "AaosApiError";
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

export interface AaosApiRequestOptions {
  readonly method?: "GET" | "POST" | "PUT" | "DELETE";
  readonly body?: unknown;
  readonly searchParams?: Record<string, string | undefined>;
  /**
   * AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY — extra headers merged on top of the always-sent
   * `x-api-key`. Used by `modules/settings`'s route handlers to forward `x-tenant-id: <the
   * caller's real session.tenantId>` (`apps/aaos-api`'s `common/tenant-context.ts` reads it) —
   * the first per-request tenant-scoping header anywhere in this app (coordinator note section 2).
   */
  readonly headers?: Record<string, string>;
}

/**
 * Calls `apps/aaos-api`'s `path` (e.g. `"/api/v1/objective"`), returning the parsed JSON body.
 * Throws `AaosApiError` (never a raw `fetch` rejection) on a non-2xx response, carrying the
 * upstream status code so route handlers can pass it straight through to the dashboard client.
 */
export async function callAaosApi<T>(
  path: string,
  options: AaosApiRequestOptions = {},
): Promise<T> {
  const baseUrl = requireEnv("AAOS_API_BASE_URL");
  const apiKey = requireEnv("AAOS_API_KEY");

  const url = new URL(path, baseUrl);
  for (const [key, value] of Object.entries(options.searchParams ?? {})) {
    if (value !== undefined) {
      url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers: {
      "x-api-key": apiKey,
      ...(options.body !== undefined ? { "content-type": "application/json" } : {}),
      ...options.headers,
    },
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    cache: "no-store",
  });

  const text = await response.text();
  // REAL BUG FIX: this used to be a bare `JSON.parse(text)` — on a malformed/non-JSON body it threw
  // a raw `SyntaxError` that bypassed the `AaosApiError` wrapping entirely, breaking this function's
  // own documented contract ("never a raw fetch rejection") and surfacing as every caller's generic
  // catch-all `{ error: { message: "Unexpected error" } }` — observed live: a scrape job's status
  // poll right after completion hit this path and showed the literal English string "Unexpected
  // error" to the user, even though the scrape itself had already finished successfully. Now a
  // parse failure is a real `AaosApiError` too, carrying the response status and a preview of the
  // actual body, instead of an opaque, undiagnosable message.
  let data: unknown;
  try {
    data = text.length > 0 ? JSON.parse(text) : undefined;
  } catch {
    throw new AaosApiError(
      response.status,
      `aaos-api request to "${path}" returned a non-JSON body (status ${String(response.status)}): ` +
        text.slice(0, 200),
    );
  }

  if (!response.ok) {
    const message =
      typeof data === "object" && data !== null && "message" in data
        ? String((data as { message: unknown }).message)
        : `aaos-api request to "${path}" failed with status ${response.status}`;
    throw new AaosApiError(response.status, message);
  }

  return data as T;
}

/**
 * Opens a raw streaming GET against `apps/aaos-api` and returns the live `Response` WITHOUT reading
 * or parsing its body (AAOS-SCRAPER-ASSET-LIBRARY) — for `aaos-api`'s `@Sse()` progress stream,
 * whose `text/event-stream` body must be piped straight through to the browser rather than buffered
 * as JSON like `callAaosApi` does.
 *
 * Server-only, same as `callAaosApi`: this is what lets the dashboard expose the SSE stream to a
 * `"use client"` component at all. The browser's native `EventSource` cannot set the `x-api-key`
 * header `aaos-api`'s `ApiKeyGuard` requires, so the browser points at this app's own
 * `/api/scraper/jobs/:jobId/stream` route, which holds the real key and forwards the frames.
 *
 * Throws `AaosApiError` on a non-2xx upstream response (its body IS read in that case, to surface
 * the real upstream message).
 */
export async function streamAaosApi(path: string): Promise<Response> {
  const baseUrl = requireEnv("AAOS_API_BASE_URL");
  const apiKey = requireEnv("AAOS_API_KEY");

  const response = await fetch(new URL(path, baseUrl), {
    method: "GET",
    headers: { "x-api-key": apiKey, accept: "text/event-stream" },
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    let message = `aaos-api stream request to "${path}" failed with status ${response.status}`;
    try {
      const data: unknown = text.length > 0 ? JSON.parse(text) : undefined;
      if (typeof data === "object" && data !== null && "message" in data) {
        message = String((data as { message: unknown }).message);
      }
    } catch {
      // Non-JSON error body — keep the generic message above.
    }
    throw new AaosApiError(response.status, message);
  }

  return response;
}

export class AaosSimulatorError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "AaosSimulatorError";
  }
}

/**
 * Calls the real, already-deployed sibling app `apps/aaos-simulator`'s `POST /api/simulate` (AAOS-
 * DASHBOARD-SIMULASI coordinator note #3) — runs one `PersonaId`'s Jessy conversation simulation +
 * AI Judge scoring. Server-only by construction, same discipline as `callAaosApi` above: only ever
 * called from `src/app/api/*` route handlers, never a `"use client"` component. Unlike
 * `callAaosApi`, no `x-api-key` header is sent — `apps/aaos-simulator`'s `/api/simulate` route has
 * no auth guard (verified against its real route handler).
 */
export async function callAaosSimulator<T>(personaId: string): Promise<T> {
  const baseUrl = requireEnv("AAOS_SIMULATOR_BASE_URL");
  const response = await fetch(new URL("/api/simulate", baseUrl), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ personaId }),
    cache: "no-store",
  });

  const text = await response.text();
  const data: unknown = text.length > 0 ? JSON.parse(text) : undefined;

  if (!response.ok) {
    const message =
      typeof data === "object" && data !== null && "error" in data
        ? String((data as { error: { message?: unknown } }).error.message ?? "unknown error")
        : `aaos-simulator request failed with status ${response.status}`;
    throw new AaosSimulatorError(response.status, message);
  }

  return data as T;
}
