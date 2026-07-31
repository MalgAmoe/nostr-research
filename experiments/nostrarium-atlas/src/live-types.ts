export type RelaySource = { url: string; label: string; selected: boolean; custom?: boolean };

export type QueryDraft = {
  limit: number;
  hours: number;
  search: string;
  eventId: string;
  author: string;
  hashtag: string;
  excludeContentWarnings: boolean;
};

export type AcquisitionMode = 'replace' | 'newer' | 'older';

export type FieldSourceKind = 'query' | 'authored-notes';

export type AcquiredPhase = {
  type: 'acquired';
  sourceKind: FieldSourceKind;
  mode: AcquisitionMode;
  handleId: string;
  count: number;
  command: Record<string, unknown>;
  coverage: Record<string, unknown> | null;
  relays: string[];
  draft: QueryDraft;
  fieldId?: string;
  fieldHandleId?: string;
};

export type ActiveLiveField = {
  fieldId: string;
  sourceKind: FieldSourceKind;
  handleId: string;
  pageHandleId: string;
  total: number;
  nextOffset: number;
  mode: AcquisitionMode;
  prependCount: number;
  handleAddedCount: number;
  olderExhausted: boolean;
  relays: string[];
  draft: QueryDraft;
  newestTimestamp: number;
  oldestTimestamp: number;
};

export type LivePhase =
  | { type: 'idle' }
  | { type: 'acquiring'; mode: AcquisitionMode; command: Record<string, unknown> }
  | AcquiredPhase
  | { type: 'observing'; acquired: AcquiredPhase; command: Record<string, unknown> }
  | { type: 'paging'; command: Record<string, unknown> }
  | { type: 'failure'; stage: 'acquire' | 'observe' | 'page'; message: string; command?: Record<string, unknown> };
