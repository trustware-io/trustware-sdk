/**
 * Readers for API response bodies. A response crosses into the SDK once, here
 * or in a module built on these, and comes out typed: a field the contract
 * requires that is missing, or present with the wrong type, throws
 * `ResponseShapeError` naming the endpoint, the field and what arrived. Nothing
 * is repaired and no other spelling of a field is read.
 */

export type WireObject = Record<string, unknown>;

/** A response body that breaks the API contract. */
export class ResponseShapeError extends Error {
  /** What was being read, e.g. `GET /route-intent/{id}/status`. */
  readonly source: string;
  /** The offending field's path, e.g. `steps[1].stepKind`. */
  readonly field: string;
  /** What arrived in its place. */
  readonly received: unknown;

  constructor(
    source: string,
    field: string,
    expected: string,
    received: unknown
  ) {
    super(
      `${source}: field "${field}" must be ${expected}, received ${describe(received)}`
    );
    this.name = "ResponseShapeError";
    this.source = source;
    this.field = field;
    this.received = received;
  }
}

function describe(value: unknown): string {
  if (value === undefined) return "nothing (missing)";
  const json = JSON.stringify(value);
  return json.length > 120 ? `${json.slice(0, 117)}...` : json;
}

export function isWireObject(value: unknown): value is WireObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function readObject(
  value: unknown,
  source: string,
  field: string
): WireObject {
  if (!isWireObject(value)) {
    throw new ResponseShapeError(source, field, "an object", value);
  }
  return value;
}

export function readArray(
  value: unknown,
  source: string,
  field: string
): unknown[] {
  if (!Array.isArray(value)) {
    throw new ResponseShapeError(source, field, "an array", value);
  }
  return value;
}

export function requireString(
  wire: WireObject,
  key: string,
  source: string,
  path = key
): string {
  const value = wire[key];
  if (typeof value !== "string" || value === "") {
    throw new ResponseShapeError(source, path, "a non-empty string", value);
  }
  return value;
}

/** A string the API sends even when it has nothing to say (a chain error's `source`). */
export function requireText(
  wire: WireObject,
  key: string,
  source: string,
  path = key
): string {
  const value = wire[key];
  if (typeof value !== "string") {
    throw new ResponseShapeError(source, path, "a string", value);
  }
  return value;
}

export function requireNumber(
  wire: WireObject,
  key: string,
  source: string,
  path = key
): number {
  const value = wire[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ResponseShapeError(source, path, "a finite number", value);
  }
  return value;
}

export function requireBoolean(
  wire: WireObject,
  key: string,
  source: string,
  path = key
): boolean {
  const value = wire[key];
  if (typeof value !== "boolean") {
    throw new ResponseShapeError(source, path, "a boolean", value);
  }
  return value;
}

/** A string that must be one of a closed set of values. */
export function requireOneOf<T extends string>(
  wire: WireObject,
  key: string,
  allowed: readonly T[],
  source: string,
  path = key
): T {
  const value = wire[key];
  const match = allowed.find((candidate) => candidate === value);
  if (match === undefined) {
    throw new ResponseShapeError(
      source,
      path,
      `one of ${allowed.join(", ")}`,
      value
    );
  }
  return match;
}

/** Absent is fine; present with the wrong type is not. */
export function optionalString(
  wire: WireObject,
  key: string,
  source: string,
  path = key
): string | undefined {
  if (!(key in wire)) return undefined;
  return requireString(wire, key, source, path);
}

export function optionalNumber(
  wire: WireObject,
  key: string,
  source: string,
  path = key
): number | undefined {
  if (!(key in wire)) return undefined;
  return requireNumber(wire, key, source, path);
}

export function optionalBoolean(
  wire: WireObject,
  key: string,
  source: string,
  path = key
): boolean | undefined {
  if (!(key in wire)) return undefined;
  return requireBoolean(wire, key, source, path);
}

/** A chain id or amount the API sends as a string and older payloads as a number. */
export function optionalStringOrNumber(
  wire: WireObject,
  key: string,
  source: string,
  path = key
): string | number | undefined {
  if (!(key in wire)) return undefined;
  const value = wire[key];
  if (typeof value === "string" && value !== "") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  throw new ResponseShapeError(
    source,
    path,
    "a non-empty string or a finite number",
    value
  );
}
