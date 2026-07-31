import { create } from 'zustand';
import { accounts, fields, notes, type Account, type Field, type Note } from './data';
import { liveController } from './live-session';
import type { AcquiredPhase, AcquisitionMode, ActiveLiveField, LivePhase, QueryDraft, RelaySource } from './live-types';
import { mediaFromText } from './media';
import { useAtlasStore } from './store';

const DEFAULT_RELAYS: RelaySource[] = [
  { url: 'wss://nos.lol', label: 'nos.lol', selected: true },
  { url: 'wss://relay.primal.net', label: 'Primal', selected: false },
  { url: 'wss://relay.snort.social', label: 'Snort', selected: false },
  { url: 'wss://search.nos.today', label: 'Searchnos · NIP-50', selected: false },
];

const DEFAULT_DRAFT: QueryDraft = {
  limit: 20,
  hours: 24,
  search: '',
  eventId: '',
  author: '',
  hashtag: '',
  excludeContentWarnings: true,
};

type LiveStore = {
  panelOpen: boolean;
  relays: RelaySource[];
  relaySearch: string;
  customRelay: string;
  customRelayError: string | null;
  draft: QueryDraft;
  phase: LivePhase;
  active: ActiveLiveField | null;
  setPanelOpen: (open: boolean) => void;
  setRelaySearch: (value: string) => void;
  setCustomRelay: (value: string) => void;
  addRelay: () => void;
  removeRelay: (url: string) => void;
  toggleRelay: (url: string) => void;
  setDraft: (draft: Partial<QueryDraft>) => void;
  setAuthorQuery: (author: string) => void;
  acquire: () => Promise<void>;
  acquireAround: (mode: 'newer' | 'older') => Promise<void>;
  observe: () => Promise<void>;
  showMore: () => Promise<void>;
  resetPhase: () => void;
};

let nextQuery = 0;

export const useLiveStore = create<LiveStore>((set, get) => {
  async function runAcquire(mode: AcquisitionMode, draftInput: QueryDraft, relays: string[], fieldId?: string) {
    if (['acquiring', 'observing', 'paging'].includes(get().phase.type)) return;
    const draft = normalizeDraft(draftInput);
    const validation = validateDraft(draft) ?? validateSearchRelayCount(draft, relays);
    if (validation) {
      set({ phase: { type: 'failure', stage: 'acquire', message: validation } });
      return;
    }
    const active = get().active;
    const filter = applyCursorBounds(queryFilter(draft), mode, active);
    if (number(filter.since) && number(filter.until) && number(filter.since) > number(filter.until)) {
      set({ phase: { type: 'failure', stage: 'acquire', message: 'No time remains inside the original bounded window.' }, panelOpen: true });
      return;
    }
    const sequence = ++nextQuery;
    const handleId = `atlas-live-${sequence}`;
    const overallBudget = Math.min(500, Math.max(draft.limit, draft.limit * relays.length));
    const command = {
      command: 'plan',
      plan: [
        {
          id: 'acquired', operation: 'acquire', parameters: {
            relays, filter, timeoutMs: 10000,
            observationLimit: Math.min(700, overallBudget + 30),
            distinctEventLimit: overallBudget,
            concurrency: Math.min(3, relays.length),
            excludeContentWarnings: draft.excludeContentWarnings,
          },
        },
        { id: 'selected', operation: 'select', input: 'acquired', parameters: { limit: overallBudget, order: 'newest' } },
      ],
      outputs: { selected: handleId },
    };
    set({ phase: { type: 'acquiring', mode, command }, draft });
    try {
      const controller = await liveController();
      const outcome = await controller.execute(command);
      const response = outcome.response as unknown as Record<string, unknown>;
      if (response.ok !== true) throw new Error(responseError(response));
      const result = object(response.result);
      const stages = Array.isArray(result.stages) ? result.stages.map(object) : [];
      const acquisition = stages.find((stage) => stage.id === 'acquired') ?? null;
      const selectedStage = stages.find((stage) => stage.id === 'selected');
      const count = number(object(selectedStage?.handle).count);
      useAtlasStore.getState().recordActivity(
        mode === 'replace' ? `Searched ${relays.length} selected relay${relays.length === 1 ? '' : 's'}` : mode === 'newer' ? 'Checked relays for newer notes' : 'Acquired an older bounded page',
        JSON.stringify(command),
        `${count} selected event identities · buffer updated by bounded attempt`,
      );
      if (mode === 'older' && count === 0 && active && active.fieldId === fieldId) {
        set({ active: { ...active, olderExhausted: true } });
      }
      set({ phase: { type: 'acquired', mode, handleId, count, command, coverage: acquisition, relays, draft, fieldId } });
    } catch (error) {
      set({ phase: { type: 'failure', stage: 'acquire', message: errorMessage(error), command }, panelOpen: true });
    }
  }

  return {
    panelOpen: true,
    relays: DEFAULT_RELAYS,
    relaySearch: '',
    customRelay: '',
    customRelayError: null,
    draft: DEFAULT_DRAFT,
    phase: { type: 'idle' },
    active: null,
    setPanelOpen: (panelOpen) => set({ panelOpen }),
    setRelaySearch: (relaySearch) => set({ relaySearch }),
    setCustomRelay: (customRelay) => set({ customRelay, customRelayError: null }),
    addRelay: () => {
      const value = get().customRelay.trim();
      let url;
      try {
        const parsed = new URL(value);
        if (parsed.protocol !== 'wss:') throw new Error('Relay URL must use wss://.');
        parsed.hash = '';
        parsed.search = '';
        url = parsed.href.replace(/\/$/u, '');
      } catch (error) {
        set({ customRelayError: error instanceof Error ? error.message : 'Enter a valid wss:// relay URL.' });
        return;
      }
      if (get().relays.some((relay) => relay.url === url)) {
        set({ customRelayError: 'That relay is already listed.' });
        return;
      }
      set((state) => ({ relays: [...state.relays, { url, label: new URL(url).hostname, selected: true, custom: true }], customRelay: '', customRelayError: null }));
    },
    removeRelay: (url) => set((state) => ({ relays: state.relays.filter((relay) => !(relay.custom && relay.url === url)) })),
    toggleRelay: (url) => set((state) => ({ relays: state.relays.map((relay) => relay.url === url ? { ...relay, selected: !relay.selected } : relay) })),
    setDraft: (patch) => set((state) => ({ draft: { ...state.draft, ...patch } })),
    setAuthorQuery: (author) => set((state) => ({ panelOpen: true, phase: { type: 'idle' }, draft: { ...state.draft, author, eventId: '', hashtag: '', search: '' } })),
    acquire: async () => {
      const active = get().active;
      if (active && active.nextOffset < active.total) {
        set({ phase: { type: 'failure', stage: 'acquire', message: 'Display or drain the current buffer before starting a replacement search.' }, panelOpen: true });
        return;
      }
      const selected = get().relays.filter(({ selected }) => selected).map(({ url }) => url);
      if (!selected.length) {
        set({ phase: { type: 'failure', stage: 'acquire', message: 'Select at least one relay.' } });
        return;
      }
      await runAcquire('replace', get().draft, selected);
    },
    acquireAround: async (mode) => {
      const active = get().active;
      if (!active || active.draft.eventId || active.draft.search || active.nextOffset < active.total || (mode === 'older' && active.olderExhausted)) return;
      set({ panelOpen: true });
      await runAcquire(mode, active.draft, active.relays, active.fieldId);
    },
    observe: async () => {
      const acquired = get().phase;
      if (acquired.type !== 'acquired') return;
      const command = showCommand(acquired.handleId, 0, acquired.count);
      set({ phase: { type: 'observing', acquired, command } });
      try {
        const shown = await executeShow(command);
        const priorActive = get().active;
        const priorForMerge = acquired.mode !== 'replace' && priorActive && priorActive.fieldId === acquired.fieldId
          ? priorActive
          : undefined;
        const installed = installRows({
          acquired,
          shown,
          active: acquired.mode === 'newer' && priorForMerge
            ? { ...priorForMerge, prependCount: 0 }
            : priorForMerge,
        });
        useAtlasStore.getState().recordActivity(
          acquired.mode === 'replace' ? 'Displayed live search results' : acquired.mode === 'newer' ? 'Displayed newer buffered notes' : 'Displayed older buffered notes',
          JSON.stringify(command),
          `${installed.added} new notes displayed · ${installed.nextOffset} of ${acquired.count} from this buffer handle shown`,
        );
        if (acquired.mode === 'replace' && !installed.added) throw new Error('The explicit preview returned no displayable notes. No field was opened.');
        if (acquired.mode === 'replace') useAtlasStore.getState().openInstalledField(installed.fieldId);
        set({ active: installed.active, phase: { type: 'idle' }, panelOpen: false });
      } catch (error) {
        set({ phase: { type: 'failure', stage: 'observe', message: errorMessage(error), command } });
      }
    },
    showMore: async () => {
      const active = get().active;
      if (!active || active.nextOffset >= active.total || get().phase.type !== 'idle') return;
      const command = showCommand(active.handleId, active.nextOffset, active.total - active.nextOffset);
      set({ phase: { type: 'paging', command } });
      try {
        const shown = await executeShow(command);
        const acquired: AcquiredPhase = { type: 'acquired', mode: active.mode, handleId: active.handleId, count: active.total, command, coverage: null, relays: active.relays, draft: active.draft, fieldId: active.fieldId };
        const installed = installRows({ acquired, shown, active });
        useAtlasStore.getState().recordActivity('Loaded more from the live buffer', JSON.stringify(command), `${installed.added} additional notes displayed · ${installed.nextOffset} of ${active.total} shown`);
        set({ active: installed.active, phase: { type: 'idle' } });
      } catch (error) {
        set({ phase: { type: 'failure', stage: 'page', message: errorMessage(error), command } });
      }
    },
    resetPhase: () => set({ phase: { type: 'idle' } }),
  };
});

export function validateSearchRelayCount(draft: QueryDraft, relays: string[]) {
  if (draft.search.trim() && relays.length !== 1) {
    return 'Experimental NIP-50 text search requires exactly one selected relay.';
  }
  return null;
}

export function applyCursorBounds(
  filterInput: Record<string, unknown>,
  mode: AcquisitionMode,
  active: ActiveLiveField | null,
) {
  const filter = { ...filterInput };
  if (mode === 'newer' && active?.newestTimestamp) {
    filter.since = Math.max(number(filter.since), active.newestTimestamp);
  }
  if (mode === 'older' && active?.oldestTimestamp) {
    filter.until = active.oldestTimestamp;
  }
  return filter;
}

export function mergeFieldNoteIds(
  existing: string[],
  incoming: string[],
  mode: AcquisitionMode,
  prependCount: number,
) {
  if (mode !== 'newer') return { noteIds: [...existing, ...incoming], prependCount: 0 };
  const insertionPoint = Math.min(Math.max(0, prependCount), existing.length);
  return {
    noteIds: [...existing.slice(0, insertionPoint), ...incoming, ...existing.slice(insertionPoint)],
    prependCount: insertionPoint + incoming.length,
  };
}

function normalizeDraft(draft: QueryDraft): QueryDraft {
  return {
    limit: Math.min(100, Math.max(5, Math.round(draft.limit))),
    hours: [0, 1, 6, 24, 72, 168, 720].includes(draft.hours) ? draft.hours : 24,
    search: draft.search.trim(),
    eventId: draft.eventId.trim().toLowerCase(),
    author: draft.author.trim().toLowerCase(),
    hashtag: draft.hashtag.trim().replace(/^#/u, ''),
    excludeContentWarnings: draft.excludeContentWarnings,
  };
}

function validateDraft(draft: QueryDraft) {
  if (draft.eventId && !/^[0-9a-f]{64}$/u.test(draft.eventId)) return 'Event ID must be a full 64-character hexadecimal identifier.';
  if (draft.author && !/^[0-9a-f]{64}$/u.test(draft.author)) return 'Author must be a full 64-character hexadecimal public key.';
  if (draft.search.length > 200) return 'Relay search text must be 200 characters or fewer.';
  return null;
}

function queryFilter(draft: QueryDraft): Record<string, unknown> {
  const filter: Record<string, unknown> = { kinds: [1], limit: draft.limit };
  if (draft.hours > 0) filter.since = Math.floor(Date.now() / 1000) - draft.hours * 3600;
  if (draft.search) filter.search = draft.search;
  if (draft.eventId) filter.ids = [draft.eventId];
  if (draft.author) filter.authors = [draft.author];
  if (draft.hashtag) filter['#t'] = [draft.hashtag];
  return filter;
}

function showCommand(handleId: string, offset: number, remaining: number) {
  return {
    command: 'show', input: handleId,
    parameters: { mode: 'preview', offset, previewLimit: Math.min(20, Math.max(1, remaining)), excerptLimit: 1000, sizeLimit: 50000 },
  };
}

async function executeShow(command: Record<string, unknown>) {
  const controller = await liveController();
  const outcome = await controller.execute(command);
  const response = outcome.response as unknown as Record<string, unknown>;
  if (response.ok !== true) throw new Error(responseError(response));
  return object(response.result);
}

function installRows({ acquired, shown, active }: { acquired: AcquiredPhase; shown: Record<string, unknown>; active?: ActiveLiveField }) {
  const preview = Array.isArray(shown.preview) ? shown.preview.map(object) : [];
  const incoming = materializeNotes(preview);
  const fieldId = acquired.fieldId ?? `live:${acquired.handleId}`;
  const existing = fields[fieldId]?.noteIds ?? [];
  const newIds = incoming.filter((id) => !existing.includes(id));
  const merged = mergeFieldNoteIds(existing, newIds, acquired.mode, active?.prependCount ?? 0);
  const noteIds = acquired.mode === 'replace' ? incoming : merged.noteIds;
  const external = object(acquired.coverage?.external);
  const completeness = object(external.completeness);
  const prior = fields[fieldId];
  const field: Field = {
    id: fieldId,
    label: acquired.draft.search ? `Search: ${acquired.draft.search}` : acquired.draft.author ? `${accounts[acquired.draft.author]?.name ?? shortKey(acquired.draft.author)}’s live notes` : acquired.draft.eventId ? 'Exact event result' : 'Live relay field',
    description: `${noteIds.length} displayed notes from explicit bounded relay requests.`,
    noteIds,
    commandLabel: `show ${acquired.handleId} · offset ${number(shown.offset)} · limit ${number(shown.limit)}`,
    conditions: acquired.coverage ? {
      source: acquired.relays.join(' · '),
      terminal: string(external.status).toUpperCase() || 'BOUNDED',
      excludedWarnings: number(completeness.excludedContentWarnings),
      uncertainty: acquired.draft.search ? 'Relay-side NIP-50 matching varies by relay; completeness and ranking are not implied.' : 'A bounded attempt was made; relay completeness is not implied.',
    } : prior?.conditions ?? {
      source: acquired.relays.join(' · '), terminal: 'BOUNDED', excludedWarnings: 0,
      uncertainty: 'A bounded attempt was made; relay completeness is not implied.',
    },
  };
  fields[fieldId] = field;
  useAtlasStore.getState().fieldUpdated();
  const timestamps = noteIds.map((id) => notes[id]?.timestamp ?? 0).filter((value) => value > 0);
  const nextOffset = number(shown.nextOffset) || number(shown.offset) + incoming.length;
  const newestTimestamp = timestamps.length ? Math.max(...timestamps) : 0;
  const oldestTimestamp = timestamps.length ? Math.min(...timestamps) : 0;
  return {
    fieldId,
    added: newIds.length,
    nextOffset,
    active: {
      fieldId, handleId: acquired.handleId, total: acquired.count, nextOffset,
      mode: acquired.mode,
      prependCount: acquired.mode === 'newer' ? merged.prependCount : 0,
      olderExhausted: acquired.mode === 'older' && active
        ? active.olderExhausted || !newIds.length
        : active?.olderExhausted ?? false,
      relays: acquired.relays, draft: acquired.draft,
      newestTimestamp,
      oldestTimestamp,
    } satisfies ActiveLiveField,
  };
}

function materializeNotes(rows: Record<string, unknown>[]) {
  const noteIds: string[] = [];
  for (const row of rows) {
    const id = string(row.id) || string(object(row.subject).id);
    const nestedPreview = object(row.preview);
    const preview = Object.keys(nestedPreview).length ? nestedPreview : row;
    const authorId = string(object(preview.author).publicKey);
    if (!id || !authorId) continue;
    if (!accounts[authorId]) accounts[authorId] = liveAccount(authorId);
    const content = string(preview.contentExcerpt) || '[Content unavailable in this preview]';
    const createdAt = number(preview.createdAt);
    const current = notes[id];
    const relayUrls = Array.isArray(preview.relays) ? preview.relays.filter((relay): relay is string => typeof relay === 'string') : [];
    notes[id] = {
      id, authorId, content,
      createdAt: createdAt ? relativeTime(createdAt) : 'time unavailable',
      timestamp: createdAt,
      relayCount: number(preview.relayCount) || relayUrls.length || current?.relayCount || 0,
      relayUrls: relayUrls.length ? relayUrls : current?.relayUrls,
      media: mediaFromText(content),
      live: true,
    } satisfies Note;
    noteIds.push(id);
  }
  return [...new Set(noteIds)];
}

function liveAccount(publicKey: string): Account {
  return {
    id: publicKey, name: shortKey(publicKey), handle: `@${publicKey.slice(0, 8)}`, publicKey,
    about: 'Profile metadata has not been requested.', color: colorFor(publicKey), live: true,
  };
}

function relativeTime(timestamp: number) {
  const difference = timestamp - Math.floor(Date.now() / 1000);
  const absolute = Math.abs(difference);
  if (absolute < 60) return 'just now';
  if (absolute < 3600) return `${Math.round(absolute / 60)} min ${difference < 0 ? 'ago' : 'from now'}`;
  if (absolute < 86400) return `${Math.round(absolute / 3600)} hr ${difference < 0 ? 'ago' : 'from now'}`;
  return new Date(timestamp * 1000).toLocaleDateString();
}

function shortKey(value: string) { return `${value.slice(0, 8)}…${value.slice(-4)}`; }
function colorFor(value: string) { const hue = [...value.slice(0, 8)].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 360; return `hsl(${hue} 32% 43%)`; }
function object(value: unknown): Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function string(value: unknown) { return typeof value === 'string' ? value : ''; }
function number(value: unknown) { return Number.isSafeInteger(value) ? value as number : 0; }
function responseError(response: Record<string, unknown>) { const error = object(response.error); return string(error.message) || string(error.code) || 'The research command failed.'; }
function errorMessage(error: unknown) { return error instanceof Error ? error.message : String(error); }
