/**
 * One place that decides where Temporal is.
 *
 *   unset                       localhost:7233, namespace default   (temporal server start-dev)
 *   TEMPORAL_ADDRESS            any self-hosted or Cloud gRPC endpoint
 *   TEMPORAL_NAMESPACE          namespace (Cloud: "<ns>.<account>")
 *   TEMPORAL_API_KEY            Temporal Cloud API key → TLS on, key in metadata
 *   TEMPORAL_TLS_CERT/KEY       mTLS PEM paths (self-hosted / Cloud certs)
 */
import { readFileSync } from "node:fs";

export interface TemporalTarget {
  address: string;
  namespace: string;
  apiKey?: string;
  tls?: boolean | { clientCertPair: { crt: Buffer; key: Buffer } };
}

export function temporalTarget(env: NodeJS.ProcessEnv = process.env): TemporalTarget {
  const address = env.TEMPORAL_ADDRESS ?? "localhost:7233";
  const namespace = env.TEMPORAL_NAMESPACE ?? "default";
  const t: TemporalTarget = { address, namespace };
  if (env.TEMPORAL_API_KEY) {
    t.apiKey = env.TEMPORAL_API_KEY;
    t.tls = true;
  } else if (env.TEMPORAL_TLS_CERT && env.TEMPORAL_TLS_KEY) {
    t.tls = { clientCertPair: { crt: readFileSync(env.TEMPORAL_TLS_CERT), key: readFileSync(env.TEMPORAL_TLS_KEY) } };
  }
  return t;
}

export function uiUrl(env: NodeJS.ProcessEnv = process.env): string {
  return env.TEMPORAL_UI ?? "http://localhost:8233";
}
