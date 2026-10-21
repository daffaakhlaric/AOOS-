import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
/**
 * Re-implemented 1:1 from apps/eyvra-dashboard/src/lib/api.ts — thin, server-only fetch wrapper to
 * the real apps/aaos-api HTTP endpoints. Every src/app/api/* route handler in this app calls
 * callAaosApi, which sends the x-api-key header ApiKeyGuard requires. Never imported from a
 * "use client" component (AAOS_API_KEY is never NEXT_PUBLIC_-prefixed).
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
  readonly method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  readonly body?: unknown;
  readonly searchParams?: Record<string, string | undefined>;
  readonly headers?: Record<string, string>;
  /** Optional request cancellation/timeout signal for long-running upstream reads. */
  readonly signal?: AbortSignal;
  readonly timeoutMs?: number;
}

/** Calls apps/aaos-api's `path`, returning the parsed JSON body. Throws AaosApiError (never a raw fetch rejection) on a non-2xx response. */
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

  const controller = new AbortController();
  const timeoutId =
    options.timeoutMs !== undefined
      ? setTimeout(() => controller.abort(), options.timeoutMs)
      : undefined;
  const abortFromCaller = (): void => controller.abort();
  options.signal?.addEventListener("abort", abortFromCaller, { once: true });

  const store = cookies();
  const auth = createServerClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (values: { name: string; value: string; options: CookieOptions }[]) => {
          for (const { name, value, options } of values) store.set(name, value, options);
        },
      },
    },
  );
  const { data: identity, error: identityError } = await auth.auth.getSession();
  if (identityError || !identity.session?.access_token)
    throw new AaosApiError(401, "Authenticated session required");
  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? "GET",
      headers: {
        "x-api-key": apiKey,
        ...(options.body !== undefined ? { "content-type": "application/json" } : {}),
        ...options.headers,
        authorization: "Bearer " + identity.session.access_token,
      },
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (caught) {
    if (caught instanceof DOMException && caught.name === "AbortError") {
      throw new AaosApiError(504, `aaos-api request to "${path}" timed out`);
    }
    throw caught;
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
    options.signal?.removeEventListener("abort", abortFromCaller);
  }

  const text = await response.text();
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
