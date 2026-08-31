export type RelaySource = { url: string; label: string; selected: boolean; custom?: boolean };

export const DEFAULT_RELAYS: RelaySource[] = [
  { url: 'wss://nos.lol', label: 'nos.lol', selected: true },
  { url: 'wss://relay.primal.net', label: 'Primal', selected: false },
  { url: 'wss://relay.snort.social', label: 'Snort', selected: false },
  { url: 'wss://search.nos.today', label: 'Searchnos · NIP-50', selected: false },
];

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

export const DEFAULT_DRAFT: QueryDraft = {
  limit: 20,
  hours: 24,
  search: '',
  eventId: '',
  author: '',
  hashtag: '',
  excludeContentWarnings: true,
  includeFilterLimit: true,
  timeoutMs: 10000,
  observationLimit: 100,
  distinctEventLimit: 100,
  concurrency: 4,
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
