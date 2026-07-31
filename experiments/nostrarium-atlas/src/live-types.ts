export type RelaySource = { url: string; label: string; selected: boolean; custom?: boolean };

export type QueryDraft = {
  limit: number;
  hours: number;
  search: string;
  eventId: string;
  author: string;
  hashtag: string;
  excludeContentWarnings: boolean;
  includeFilterLimit: boolean;
  timeoutMs: number;
  observationLimit: number;
  distinctEventLimit: number;
  concurrency: number;
};

export type ExternalActionDraft = {
  relays: string[];
  timeoutMs: number;
  observationLimit: number;
  distinctEventLimit: number;
  concurrency: number;
  excludeContentWarnings: boolean;
};

export type AuthoredActionDraft = ExternalActionDraft & { eventLimit: number };

export type NoteRelationship = 'ancestors' | 'replies' | 'quotes' | 'mentions' | 'referenced-events';

export type RelationshipActionDraft = ExternalActionDraft & {
  relationship: NoteRelationship;
  eventLimit: number;
};

export type AuthorResolutionDraft = ExternalActionDraft & { authorLimit: number };

export type FieldSourceKind = 'query' | 'authored-notes' | 'local-account-notes' | 'local-note-relationship' | 'note-relationship';

export type AcquiredPhase = {
  type: 'acquired';
  sourceKind: Exclude<FieldSourceKind, 'local-account-notes'>;
  handleId: string;
  installRevision: number;
  count: number;
  command: Record<string, unknown>;
  receipt: Record<string, unknown>;
  coverage: Record<string, unknown> | null;
  relays: string[];
  draft: QueryDraft;
};

export type ActiveLiveField = {
  fieldId: string;
  sourceKind: FieldSourceKind;
  handleId: string;
  pageHandleId: string;
  total: number;
  nextOffset: number;
  handleAddedCount: number;
  relays: string[];
  draft: QueryDraft;
  newestTimestamp: number;
  oldestTimestamp: number;
};

export type LivePhase =
  | { type: 'idle' }
  | { type: 'working'; stage: 'acquire' | 'page' | 'projection' | 'facet' | 'branch' | 'profile' | 'authored' | 'relationship' | 'authors'; command: Record<string, unknown> | Record<string, unknown>[] }
  | { type: 'failure'; stage: 'acquire' | 'page' | 'projection' | 'facet' | 'branch' | 'profile' | 'authored' | 'relationship' | 'authors'; message: string; command?: Record<string, unknown> | Record<string, unknown>[] };
