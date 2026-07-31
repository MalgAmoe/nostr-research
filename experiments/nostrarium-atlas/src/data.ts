import type {
  ActiveLiveField, AuthorResolutionDraft, AuthoredActionDraft, ExternalActionDraft,
  NoteRelationship, RelationshipActionDraft,
} from './live-types';

export type EvidenceStatus = 'idle' | 'loading' | 'available' | 'unresolved' | 'failure';

export type InspectorTarget =
  | { type: 'none'; id: '' }
  | { type: 'note'; id: string }
  | { type: 'account'; id: string }
  | { type: 'address'; id: string };

export type NoteObservation = {
  status: EvidenceStatus;
  eventHandleId?: string;
  authorHandleId?: string;
  resolution?: { resident: boolean; resolved: boolean; source?: string };
  content?: string;
  contentState?: 'returned' | 'boundary-sized' | 'unavailable';
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
  supportingHandleId?: string;
  claims?: Record<string, unknown>;
  resolution?: { resident: boolean; resolved: boolean; source?: string };
  provenance?: Record<string, unknown>;
};

export type AccountProfilePresentation = {
  name: string;
  about: string;
  picture?: string;
  attribution: string;
  state: 'not-requested' | 'loading' | 'observed' | 'unresolved' | 'failure';
};

export type AuthoredNotesRequest = ExternalAttempt & {
  handleId?: string;
  count?: number;
  eventLimit?: number;
};

export type ObservationExchange = {
  command: Record<string, unknown>;
  response: Record<string, unknown>;
  receipt: Record<string, unknown>;
};

export type ObservationSnapshot = {
  id: string;
  target: { type: 'place' | 'note' | 'account' | 'facet'; id: string };
  sourceHandleId: string;
  observedRevision: number;
  locality: 'local' | 'external';
  exchanges: ObservationExchange[];
  facts: Record<string, unknown>;
};

export type AccountResearchState = {
  engineHandleId?: string;
  localStatus: EvidenceStatus;
  localResolution?: Record<string, unknown>;
  localError?: string;
  profileDraft: ExternalActionDraft;
  authoredDraft: AuthoredActionDraft;
  profile?: ProfileObservation;
  authoredNotes?: AuthoredNotesRequest;
};

export type NoteRelationshipAttempt = ExternalAttempt & {
  relationship: NoteRelationship;
  source: 'local' | 'relays';
  handleId?: string;
  count?: number;
  installRevision?: number;
  completeness?: Record<string, unknown>;
};

export type NoteResearchState = {
  draftOpen: boolean;
  relationshipDraft: RelationshipActionDraft;
  attempts: Partial<Record<NoteRelationship, { local?: NoteRelationshipAttempt; relays?: NoteRelationshipAttempt }>>;
};

export type AuthorResolutionAttempt = ExternalAttempt & {
  status: 'idle' | 'loading' | 'available' | 'empty' | 'partial' | 'unresolved' | 'failure';
  authorHandleId?: string;
  supportingHandleId?: string;
  authorCount?: number;
  resolvedCount?: number;
  unresolvedCount?: number;
  failedCount?: number;
  commands?: Record<string, unknown>[];
  completeness?: Record<string, unknown>;
  authorBounds?: Record<string, unknown>;
  authorOmissions?: Record<string, unknown>;
  authorBoundarySized?: boolean;
};

export type AuthorResolutionState = {
  draftOpen: boolean;
  draft: AuthorResolutionDraft;
  attempt?: AuthorResolutionAttempt;
};

export type ObservedProfilePresence = {
  accountId: string;
  profile: ProfileObservation;
  sourcePlaceId: string;
  observedAtRevision: number;
};

export type AccountFacetRecord = {
  account: string;
  noteCount: number;
  sourcePlaceId: string;
  sourceHandleId: string;
  derivationHandles: { rows: string; aggregate: string; ranked: string };
  derivationCommands: Record<string, unknown>[];
  countUnit: string;
  lineage: Record<string, unknown>;
  bounds: Record<string, unknown>;
  truncated: boolean;
  omissions: Record<string, unknown>;
};

export type AccountFacetState = {
  status: 'idle' | 'loading' | 'available' | 'failure';
  sourcePlaceId: string;
  sourceHandleId: string;
  commands: Record<string, unknown>[];
  handles?: { rows: string; aggregate: string; ranked: string };
  records: AccountFacetRecord[];
  countUnit?: string;
  bounds?: Record<string, unknown>;
  truncated?: boolean;
  omissions?: Record<string, unknown>;
  error?: string;
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
};

export type Media = {
  type: 'image' | 'video' | 'audio' | 'file' | 'unknown';
  src?: string;
  alt: string;
  remote: true;
};

export type AttachmentFact = {
  url: string;
  families: Array<'image' | 'video' | 'audio' | 'file' | 'unknown'>;
  mimeTypes: string[];
  classification: string;
  sources: string[];
  width?: number;
  height?: number;
  durationSeconds?: number;
  alt?: string;
  hashes: string[];
  fallbackUrls: string[];
};

export type MediaLoadState = 'placeholder' | 'loading' | 'loaded' | 'failed';

/** Bounded presentation data returned by public observations; never canonical UI-owned evidence. */
export type Note = {
  id: string;
  authorId: string;
  content: string;
  createdAt: string;
  timestamp: number;
  relayCount: number;
  relayUrls?: string[];
  media?: Media;
  attachments?: AttachmentFact[];
  contentRole?: string;
  conversationRole?: string;
  parentId?: string;
  replyCount?: number;
  tags?: string[];
  live: true;
};

export type PlaceRole = 'ground' | 'branch' | 'start';
export type PlaceProjection = 'stream' | 'gallery' | 'accounts';

export type AccountProjectionState = {
  status: 'loading' | 'available' | 'failure';
  handleId: string;
  installRevision?: number;
  command: Record<string, unknown>;
  receipt?: Record<string, unknown>;
  accountIds: string[];
  countUnit?: string;
  bounds?: Record<string, unknown>;
  omissions?: Record<string, unknown>;
  error?: string;
};

export type Field = {
  id: string;
  label: string;
  description: string;
  noteIds: string[];
  handleId: string;
  installRevision: number;
  role: PlaceRole;
  resultKind: string;
  countingUnit: string;
  originCommand: Record<string, unknown> | Record<string, unknown>[];
  originReceipt: Record<string, unknown> | Record<string, unknown>[];
  navigatorReason: string;
  projection: PlaceProjection;
  localPageOffset: number;
  selected: InspectorTarget;
  selectedFacet: string | null;
  localConstraints: { text: string };
  observationSnapshots: ObservationSnapshot[];
  declaredBounds: Record<string, unknown>;
  declaredOmissions: Record<string, unknown>;
  evidenceResolution: Record<string, unknown>;
  accountFacet?: AccountFacetState;
  accountProjection?: AccountProjectionState;
  accountResearch: Record<string, AccountResearchState>;
  noteResearch?: Record<string, NoteResearchState>;
  authorResolution?: AuthorResolutionState;
  mediaLoads?: Record<string, Record<string, MediaLoadState>>;
  runtime?: ActiveLiveField;
  conditions: {
    source: string;
    terminal: string;
    excludedWarnings: number;
    uncertainty: string;
    partial: boolean;
  };
};

export const accounts: Record<string, Account> = {};
export const notes: Record<string, Note> = {};
export const fields: Record<string, Field> = {};
/** Process-local attributed presentation cache; canonical evidence remains in the engine. */
export const observedProfiles: Record<string, ObservedProfilePresence> = {};

export const emptyField: Field = {
  id: 'start',
  label: 'No live place',
  description: 'Choose relays and run an explicit bounded acquisition to establish Ground.',
  noteIds: [],
  handleId: '',
  installRevision: 0,
  role: 'start',
  resultKind: 'none',
  countingUnit: 'subjects',
  originCommand: {},
  originReceipt: {},
  navigatorReason: 'No acquisition has been requested.',
  projection: 'stream',
  localPageOffset: 0,
  selected: { type: 'none', id: '' },
  selectedFacet: null,
  localConstraints: { text: '' },
  observationSnapshots: [],
  declaredBounds: {},
  declaredOmissions: {},
  evidenceResolution: {},
  accountResearch: {},
  conditions: {
    source: 'No relay contacted',
    terminal: 'IDLE',
    excludedWarnings: 0,
    uncertainty: 'No acquisition has been requested in this session.',
    partial: false,
  },
};

export function fieldFor(fieldId: string): Field {
  return fields[fieldId] ?? emptyField;
}

export function notesFor(fieldId: string): Note[] {
  return fieldFor(fieldId).noteIds.map((id) => notes[id]).filter(Boolean);
}

export function observationFor<T extends Record<string, unknown>>(
  fieldId: string,
  type: ObservationSnapshot['target']['type'],
  id: string,
): T | undefined {
  const snapshot = [...fieldFor(fieldId).observationSnapshots]
    .reverse().find((candidate) => candidate.target.type === type && candidate.target.id === id);
  return snapshot?.facts as T | undefined;
}

export function profileForAccount(accountId: string, local?: ProfileObservation) {
  if (local) return local;
  return observedProfiles[accountId]?.profile;
}

export function retainObservedProfile(accountId: string, profile: ProfileObservation, sourcePlaceId: string, observedAtRevision: number) {
  if (!['available', 'partial'].includes(profile.status) || !Object.keys(profile.claims ?? {}).length) return;
  observedProfiles[accountId] = { accountId, profile, sourcePlaceId, observedAtRevision };
}

export function accountProfilePresentation(account: Account, profile?: ProfileObservation): AccountProfilePresentation {
  profile = profileForAccount(account.id, profile);
  if (!profile) return {
    name: account.name,
    about: 'Profile metadata has not been requested.',
    attribution: 'Public-key fallback · no profile request yet',
    state: 'not-requested',
  };
  if (profile.status === 'loading') return {
    name: account.name,
    about: 'The explicit bounded profile request is still in progress.',
    attribution: 'Profile request in progress · public-key fallback shown',
    state: 'loading',
  };
  if (profile.status === 'failure') return {
    name: account.name,
    about: `Profile request failed${profile.error ? `: ${profile.error}` : '.'}`,
    attribution: 'Profile request failed · public-key fallback shown',
    state: 'failure',
  };
  const claims = profile.claims ?? {};
  const displayName = claimString(claims.display_name) || claimString(claims.name);
  const about = claimString(claims.about);
  const picture = httpUrlClaim(claims.picture);
  if (['available', 'partial'].includes(profile.status) && (displayName || about || picture)) {
    return {
      name: displayName || account.name,
      about: about || 'The returned profile metadata contained no about claim.',
      ...(picture ? { picture } : {}),
      attribution: `Relay-observed profile claims · ${profile.status}`,
      state: 'observed',
    };
  }
  return {
    name: account.name,
    about: 'The bounded profile request returned no resolvable profile claim.',
    attribution: 'Profile unresolved · public-key fallback shown',
    state: 'unresolved',
  };
}

function claimString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function httpUrlClaim(value: unknown) {
  const claim = claimString(value);
  if (!claim) return '';
  try { return ['http:', 'https:'].includes(new URL(claim).protocol) ? claim : ''; } catch { return ''; }
}
