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
    },
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    cache: "no-store",
  });

  const text = await response.text();
  const data: unknown = text.length > 0 ? JSON.parse(text) : undefined;

  if (!response.ok) {
    const message =
      typeof data === "object" && data !== null && "message" in data
        ? String((data as { message: unknown }).message)
        : `aaos-api request to "${path}" failed with status ${response.status}`;
    throw new AaosApiError(response.status, message);
  }

  return data as T;
}
