/**
 * Thin wrapper over the one TypeSafe client, `.jev/jev-core.ts` `systemOne`.
 * jev-core owns the pin, the fail-closed key rule and the response-model check.
 * This file only keeps the tape's TypesafeError shape (status + nonRetryable).
 */
import { JevError, systemOne as coreSystemOne, type CallOptions } from "../../.jev/jev-core.ts";
import type { SystemOneRequest, SystemOneResponse } from "./contract.ts";

export class TypesafeError extends Error {
  status: number;
  nonRetryable: boolean;
  code: string;
  constructor(message: string, status: number, nonRetryable: boolean, code = "http") {
    super(message);
    this.name = "TypesafeError";
    this.status = status;
    this.nonRetryable = nonRetryable;
    this.code = code;
  }
}

function toTypesafeError(e: JevError): TypesafeError {
  switch (e.code) {
    case "no-key":
      return new TypesafeError(e.message, 401, true, e.code);
    case "unpinned":
    case "invalid-request":
    case "wrong-model":
      return new TypesafeError(e.message, 422, true, e.code);
    case "bad-response":
      return new TypesafeError(e.message, e.status || 502, true, e.code);
    default:
      return new TypesafeError(e.message, e.status, !e.retryable, e.code);
  }
}

export async function systemOne(
  req: SystemOneRequest,
  opts: { apiKey?: string; signal?: AbortSignal; fetch?: CallOptions["fetch"] } = {},
): Promise<SystemOneResponse> {
  try {
    return (await coreSystemOne(req, opts)) as SystemOneResponse;
  } catch (e) {
    throw e instanceof JevError ? toTypesafeError(e) : e;
  }
}
