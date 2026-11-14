/**
 * Anything with a connect/disconnect lifecycle (e.g. the database).
 * Entry points hand a list of these to `ResourceGroup`, which owns the ordering.
 */
export interface IManagedResource {
  /** Human-readable name for logs and readiness checks, e.g. `database`. */
  readonly name: string;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  /** Cheap round-trip used by readiness checks. Never throws. */
  ping(): Promise<boolean>;
}
