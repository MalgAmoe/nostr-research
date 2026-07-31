import type { ActiveLiveField } from './live-types';

export type EvidenceStatus = 'idle' | 'loading' | 'available' | 'unresolved' | 'failure';

export type NoteObservation = {
  status: EvidenceStatus;
  eventHandleId?: string;
  authorHandleId?: string;
  resolution?: { resident: boolean; resolved: boolean; source?: string };
  content?: string;
  contentState?: 'complete' | 'bounded' | 'unavailable';
  tags?: unknown[][];
  omittedTags?: number;
  role?: string;
  conversationRole?: string;
  attachments?: Record<string, unknown>[];
  attachmentsOmitted?: number;
  observedRelays?: string[];
  referencedEvents?: string[];
  referencedAccounts?: string[];
  referencedAddresses?: string[];
  relationshipsOmitted?: number;
  provenance?: Record<string, unknown>;
  bounds?: Record<string, unknown>;
  error?: string;
};

export type ExternalAttempt = {
  status: 'idle' | 'loading' | 'available' | 'empty' | 'partial' | 'unresolved' | 'failure';
  relays: string[];
  command?: Record<string, unknown>;
  external?: Record<string, unknown>;
  completeness?: Record<string, unknown>;
  error?: string;
};

export type ProfileObservation = ExternalAttempt & {
  claims?: Record<string, unknown>;
  resolution?: { resident: boolean; resolved: boolean; source?: string };
  provenance?: Record<string, unknown>;
};

export type AuthoredNotesRequest = ExternalAttempt & {
  handleId?: string;
  count?: number;
  eventLimit?: number;
};

export type Account = {
  id: string;
  name: string;
  handle: string;
  publicKey: string;
  about: string;
  color: string;
  live: true;
  sourceNoteId?: string;
  engineHandleId?: string;
  localObservation?: { status: EvidenceStatus; resolution?: Record<string, unknown>; error?: string };
  profile?: ProfileObservation;
  authoredNotes?: AuthoredNotesRequest;
};

export type Media = {
  type: 'image' | 'video';
  src?: string;
  alt: string;
  remote: true;
};

export type Note = {
  id: string;
  authorId: string;
  content: string;
  createdAt: string;
  timestamp: number;
  relayCount: number;
  relayUrls?: string[];
  media?: Media;
  parentId?: string;
  replyCount?: number;
  tags?: string[];
  observation?: NoteObservation;
  live: true;
};

export type Field = {
  id: string;
  label: string;
  description: string;
  noteIds: string[];
  commandLabel: string;
  runtime?: ActiveLiveField;
  conditions: {
    source: string;
    terminal: string;
    excludedWarnings: number;
    uncertainty: string;
  };
};

export const accounts: Record<string, Account> = {};
export const notes: Record<string, Note> = {};
export const fields: Record<string, Field> = {};

export const emptyField: Field = {
  id: 'start',
  label: 'No live field',
  description: 'Choose relays and run an explicit bounded query to begin.',
  noteIds: [],
  commandLabel: '',
  conditions: {
    source: 'No relay contacted',
    terminal: 'IDLE',
    excludedWarnings: 0,
    uncertainty: 'No acquisition has been requested in this session.',
  },
};

export function fieldFor(fieldId: string): Field {
  return fields[fieldId] ?? emptyField;
}

export function notesFor(fieldId: string): Note[] {
  return fieldFor(fieldId).noteIds.map((id) => notes[id]).filter(Boolean);
}
