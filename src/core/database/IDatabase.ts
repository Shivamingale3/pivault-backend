import type { IManagedResource } from '../lifecycle/IManagedResource.js';

/**
 * Database lifecycle contract. `TClient` is the query client handed to
 * repositories; lifecycle consumers only need the `IManagedResource` methods.
 */
export interface IDatabase<TClient = unknown> extends IManagedResource {
  readonly client: TClient;
}
