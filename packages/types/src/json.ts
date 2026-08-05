/** A JSON-serializable primitive value. */
export type JsonPrimitive = string | number | boolean | null;

/** A JSON-serializable value of any shape. */
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

/** A JSON-serializable object (the most common shape for Contract payloads). */
export type JsonObject = { [key: string]: JsonValue };
