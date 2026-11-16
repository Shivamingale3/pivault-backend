/** An opaque AES-GCM blob. The server never reads what is inside. */
export interface VaultEnvelope {
  version: number;
  algorithm: string;
  /** Base64 of the 12 byte IV. */
  iv: string;
  /** Base64 of the ciphertext + GCM tag. */
  ciphertext: string;
}

/** What a device sends and receives for one entry. */
export interface VaultState {
  id: string;
  /** Epoch ms on the device that made the last change. */
  updatedAt: number;
  deleted: boolean;
  envelope: VaultEnvelope;
}

/** A stored entry: the state plus its position in the user's change log. */
export interface VaultRecord extends VaultState {
  seq: number;
}

export interface PullCheckpoint {
  seq: number;
}

export interface PullResult {
  documents: VaultRecord[];
  checkpoint: PullCheckpoint;
  /** Changes still waiting after this page, so a new device can show real progress. */
  remaining: number;
}

export interface PushRow {
  /** What the device believes the server holds, or null when it believes nothing. */
  assumedMasterState: VaultState | null;
  newDocumentState: VaultState;
}

export interface PushCounts {
  created: number;
  updated: number;
  deleted: number;
}

export interface PushResult {
  /** The server's current version of every entry whose push lost a conflict. */
  conflicts: VaultRecord[];
  counts: PushCounts;
}
