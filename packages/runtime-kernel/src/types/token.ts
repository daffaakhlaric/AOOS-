import type { Constructor } from "@aos/types";

/**
 * A Service Container resolution token. String/symbol tokens are the recommended form
 * (Interface First — resolving by a named contract, not a concrete class); a class
 * constructor may also be used directly as its own token for simple cases.
 */
export type Token<T = unknown> = string | symbol | Constructor<T>;

/** Renders a Token as a human-readable string, for error messages and diagnostics. */
export function tokenToString(token: Token): string {
  if (typeof token === "string") {
    return token;
  }
  if (typeof token === "symbol") {
    return token.toString();
  }
  return token.name || "AnonymousClass";
}
