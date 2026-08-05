/**
 * Invokes an optional async/sync function, normalizing both "not provided" and "threw" into
 * a single awaited call — used by the lifecycle/hook/loader subsystems so every optional
 * callback site doesn't need to repeat undefined-guarding and sync/async normalization.
 */
export async function safeInvoke<T>(
  fn: (() => T | Promise<T>) | undefined,
): Promise<T | undefined> {
  if (!fn) {
    return undefined;
  }
  return await fn();
}
