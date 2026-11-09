/**
 * Database lifecycle contract. `TClient` is the query client handed to
 * repositories; lifecycle consumers (e.g. `HttpServer`) only need the methods.
 */
export interface IDatabase<TClient = unknown> {
  readonly client: TClient;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  /** Cheap round-trip used by readiness checks. Never throws. */
  ping(): Promise<boolean>;
}
