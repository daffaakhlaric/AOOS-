import { DelayedQueue } from "./delayed-queue.js";

/** Retry Queue — the same fireAt-ordered structure as `DelayedQueue`, holding jobIds counting down to their next retry attempt. */
export class RetryQueue extends DelayedQueue {}
