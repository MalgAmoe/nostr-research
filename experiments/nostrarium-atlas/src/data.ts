export type Account = {
  id: string;
  name: string;
  handle: string;
  publicKey: string;
  about: string;
  color: string;
  live: true;
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
  live: true;
};

export type Field = {
  id: string;
  label: string;
  description: string;
  noteIds: string[];
  commandLabel: string;
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
