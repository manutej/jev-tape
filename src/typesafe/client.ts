import {
  TYPESAFE_ENDPOINT,
  TYPESAFE_PINNED_MODEL,
  validateRequest,
  validateResponse,
  type SystemOneRequest,
  type SystemOneResponse,
} from "./contract.ts";

export class TypesafeError extends Error {
  status: number;
  nonRetryable: boolean;
  constructor(message: string, status: number, nonRetryable: boolean) {
    super(message);
    this.name = "TypesafeError";
    this.status = status;
    this.nonRetryable = nonRetryable;
  }
}

export async function systemOne(
  req: SystemOneRequest,
  opts: { apiKey?: string; signal?: AbortSignal } = {},
): Promise<SystemOneResponse> {
  const apiKey = opts.apiKey ?? process.env.TYPESAFE_API_KEY;
  if (!apiKey) {
    throw new TypesafeError(
      "TYPESAFE_API_KEY is not set. No local fake.",
      401,
      true,
    );
  }
  const bad = validateRequest(req);
  if (bad) throw new TypesafeError(bad.message, 422, true);

  const res = await fetch(TYPESAFE_ENDPOINT, {
    method: "POST",
    signal: opts.signal,
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(req),
  });

  const text = await res.text();
  if (res.status === 401 || res.status === 422) {
    throw new TypesafeError(`TypeSafe ${res.status}: ${text.slice(0, 400)}`, res.status, true);
  }
  if (!res.ok) {
    throw new TypesafeError(`TypeSafe ${res.status}: ${text.slice(0, 400)}`, res.status, false);
  }
  const body = JSON.parse(text) as SystemOneResponse;
  const badBody = validateResponse(body, Object.keys(req.questions));
  if (badBody) throw new TypesafeError(`TypeSafe response: ${badBody.message}`, 422, true);
  if (body.model && body.model !== TYPESAFE_PINNED_MODEL) {
    throw new TypesafeError(
      `response.model must be ${TYPESAFE_PINNED_MODEL}, got ${body.model}`,
      422,
      true,
    );
  }
  return body;
}
