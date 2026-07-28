import { isCanonicalNostrEvent } from './protocol.js';

const EVENT_ID = /^[a-f0-9]{64}$/;

export const CONVERSATION_RELATIONSHIP_TYPES = Object.freeze([
  'reply-root',
  'reply-parent',
]);

export const EVENT_REFERENCE_RELATIONSHIP_TYPES = Object.freeze([
  ...CONVERSATION_RELATIONSHIP_TYPES,
  'mentioned-event',
  'quoted-event',
  'referenced-event',
  'repost-target',
  'reaction-target',
  'deletion-target',
]);

export const ACCOUNT_REFERENCE_RELATIONSHIP_TYPES = Object.freeze([
  'mentioned-account',
  'referenced-account',
  'comment-root-author',
  'comment-parent-author',
  'repost-author',
  'reaction-author',
]);

export const NAVIGATION_RELATIONSHIP_TYPES = Object.freeze([
  'author',
  ...EVENT_REFERENCE_RELATIONSHIP_TYPES,
  ...ACCOUNT_REFERENCE_RELATIONSHIP_TYPES,
  'follow',
  'topic',
  'other-tag',
]);

/**
 * Derives replaceable navigation facts from one canonical event.
 * Unknown tags remain mechanically visible without being assigned thread
 * semantics that belong to a different event kind.
 */
export function deriveEventRelationships(event) {
  const relationships = [{
    type: 'author',
    targetType: 'account',
    targetId: event.pubkey,
    evidence: { interpretation: 'known', protocol: 'NIP-01', field: 'pubkey' },
  }];
  const handled = new Set();
  const tags = event.tags.map((tag, index) => ({ tag, index }));

  if (event.kind === 1) {
    deriveTextNoteRelationships(tags, relationships, handled);
  } else if (event.kind === 1111) {
    deriveCommentRelationships(tags, relationships, handled);
  } else if (event.kind === 3) {
    deriveFollowRelationships(tags, relationships, handled);
  } else if (event.kind === 6 || event.kind === 16) {
    deriveRepostRelationships(tags, relationships, handled, event);
  } else if (event.kind === 7 || event.kind === 17) {
    deriveReactionRelationships(tags, relationships, handled, event.kind);
  } else if (event.kind === 5) {
    deriveDeletionRelationships(tags, relationships, handled);
  }

  deriveCommonRelationships(tags, relationships, handled);
  return relationships;
}

function deriveTextNoteRelationships(tags, relationships, handled) {
  const eTags = tags.filter(({ tag }) => tag[0] === 'e' && EVENT_ID.test(tag[1]));
  const marked = eTags.filter(({ tag }) => ['root', 'reply', 'mention'].includes(tag[3]));

  for (const { tag, index } of eTags) {
    let type;
    let interpretation = 'known';
    if (tag[3] === 'root') type = 'reply-root';
    else if (tag[3] === 'reply') type = 'reply-parent';
    else if (tag[3] === 'mention') {
      type = 'mentioned-event';
      interpretation = 'best-effort-fallback';
    } else if (marked.length === 0) {
      if (eTags.length === 1 || index === eTags[0].index) type = 'reply-root';
      else if (index === eTags.at(-1).index) type = 'reply-parent';
      else type = 'mentioned-event';
      interpretation = 'best-effort-fallback';
    } else {
      type = 'mentioned-event';
      interpretation = 'best-effort-fallback';
    }
    addTagRelationship(
      relationships, handled, type, 'event', tag[1], tag, index,
      'NIP-10', interpretation,
    );
    if (eTags.length === 1 && marked.length === 0) {
      relationships.push(tagRelationship(
        'reply-parent', 'event', tag[1], tag, index, 'NIP-10', interpretation,
      ));
    }
  }

  for (const { tag, index } of tags) {
    if (tag[0] === 'p' && EVENT_ID.test(tag[1])) {
      addTagRelationship(
        relationships, handled, 'mentioned-account', 'account', tag[1],
        tag, index, 'NIP-10', 'known',
      );
    }
  }
}

function deriveCommentRelationships(tags, relationships, handled) {
  for (const { tag, index } of tags) {
    if (tag[0] === 'E' && EVENT_ID.test(tag[1])) {
      addTagRelationship(
        relationships, handled, 'reply-root', 'event', tag[1],
        tag, index, 'NIP-22', 'known',
      );
    } else if (tag[0] === 'e' && EVENT_ID.test(tag[1])) {
      addTagRelationship(
        relationships, handled, 'reply-parent', 'event', tag[1],
        tag, index, 'NIP-22', 'known',
      );
    } else if (tag[0] === 'P' && EVENT_ID.test(tag[1])) {
      addTagRelationship(
        relationships, handled, 'comment-root-author', 'account', tag[1],
        tag, index, 'NIP-22', 'known',
      );
    } else if (tag[0] === 'p' && EVENT_ID.test(tag[1])) {
      addTagRelationship(
        relationships, handled, 'comment-parent-author', 'account', tag[1],
        tag, index, 'NIP-22', 'best-effort-fallback',
      );
    }
  }
}

function deriveFollowRelationships(tags, relationships, handled) {
  for (const { tag, index } of tags) {
    if (tag[0] === 'p' && EVENT_ID.test(tag[1])) {
      addTagRelationship(
        relationships, handled, 'follow', 'account', tag[1],
        tag, index, 'NIP-02', 'known',
      );
    }
  }
}

function deriveRepostRelationships(tags, relationships, handled, event) {
  if (event.kind === 16) {
    const embedded = embeddedCanonicalEvent(event.content);
    if (embedded) {
      relationships.push({
        type: 'repost-target',
        targetType: 'event',
        targetId: embedded.id,
        evidence: { interpretation: 'known', protocol: 'NIP-18', field: 'content' },
      });
      const matchingTag = tags.findLast(
        ({ tag }) => tag[0] === 'e' && tag[1] === embedded.id,
      );
      if (matchingTag) handled.add(matchingTag.index);
    }
    return;
  }

  const eTags = tags.filter(({ tag }) => tag[0] === 'e' && EVENT_ID.test(tag[1]));
  const target = eTags.at(-1);
  if (target) {
    addTagRelationship(
      relationships, handled, 'repost-target', 'event', target.tag[1],
      target.tag, target.index, 'NIP-18',
      eTags.length === 1 ? 'known' : 'best-effort-fallback',
    );
  }
  for (const { tag, index } of eTags.slice(0, -1)) {
    addTagRelationship(
      relationships, handled, 'referenced-event', 'event', tag[1],
      tag, index, 'NIP-18', 'best-effort-fallback',
    );
  }
  const pTags = tags.filter(({ tag }) => tag[0] === 'p' && EVENT_ID.test(tag[1]));
  const author = pTags.at(-1);
  if (author) {
    addTagRelationship(
      relationships, handled, 'repost-author', 'account', author.tag[1],
      author.tag, author.index, 'NIP-18',
      pTags.length === 1 ? 'known' : 'best-effort-fallback',
    );
  }
  for (const { tag, index } of pTags.slice(0, -1)) {
    addTagRelationship(
      relationships, handled, 'referenced-account', 'account', tag[1],
      tag, index, 'NIP-18', 'best-effort-fallback',
    );
  }
}

function deriveReactionRelationships(tags, relationships, handled, kind) {
  if (kind === 17) {
    for (const { tag, index } of tags) {
      if (tag[0] === 'i' && typeof tag[1] === 'string' && tag[1].length > 0) {
        addTagRelationship(
          relationships, handled, 'reaction-target', 'tag', `i:${tag[1]}`,
          tag, index, 'NIP-25/NIP-73', 'known',
        );
      }
    }
    return;
  }

  const eTags = tags.filter(({ tag }) => tag[0] === 'e' && EVENT_ID.test(tag[1]));
  const target = eTags.at(-1);
  if (target) {
    addTagRelationship(
      relationships, handled, 'reaction-target', 'event', target.tag[1],
      target.tag, target.index, 'NIP-25', 'known',
    );
  }
  for (const { tag, index } of eTags.slice(0, -1)) {
    addTagRelationship(
      relationships, handled, 'referenced-event', 'event', tag[1],
      tag, index, 'NIP-25', 'best-effort-fallback',
    );
  }

  const pTags = tags.filter(({ tag }) => tag[0] === 'p' && EVENT_ID.test(tag[1]));
  const author = pTags.at(-1);
  if (author) {
    addTagRelationship(
      relationships, handled, 'reaction-author', 'account', author.tag[1],
      author.tag, author.index, 'NIP-25', 'known',
    );
  }
  for (const { tag, index } of pTags.slice(0, -1)) {
    addTagRelationship(
      relationships, handled, 'referenced-account', 'account', tag[1],
      tag, index, 'NIP-25', 'best-effort-fallback',
    );
  }
}

function deriveDeletionRelationships(tags, relationships, handled) {
  for (const { tag, index } of tags) {
    if (tag[0] === 'e' && EVENT_ID.test(tag[1])) {
      addTagRelationship(
        relationships, handled, 'deletion-target', 'event', tag[1],
        tag, index, 'NIP-09', 'known',
      );
    }
  }
}

function deriveCommonRelationships(tags, relationships, handled) {
  for (const { tag, index } of tags) {
    if (handled.has(index)) continue;
    if (tag[0] === 'q' && EVENT_ID.test(tag[1])) {
      addTagRelationship(
        relationships, handled, 'quoted-event', 'event', tag[1],
        tag, index, 'NIP-18', 'known',
      );
    } else if (['e', 'E'].includes(tag[0]) && EVENT_ID.test(tag[1])) {
      addTagRelationship(
        relationships, handled, 'referenced-event', 'event', tag[1],
        tag, index, 'NIP-01', 'mechanical-reference',
      );
    } else if (['p', 'P'].includes(tag[0]) && EVENT_ID.test(tag[1])) {
      addTagRelationship(
        relationships, handled, 'referenced-account', 'account', tag[1],
        tag, index, 'NIP-01', 'mechanical-reference',
      );
    } else if (tag[0] === 't' && typeof tag[1] === 'string') {
      addTagRelationship(
        relationships, handled, 'topic', 'tag', tag[1],
        tag, index, 'NIP-01', 'known',
      );
    } else if (typeof tag[1] === 'string') {
      addTagRelationship(
        relationships, handled, 'other-tag', 'tag', `${tag[0]}:${tag[1]}`,
        tag, index, 'NIP-01', 'mechanical-reference',
      );
    }
  }
}

function addTagRelationship(
  relationships,
  handled,
  type,
  targetType,
  targetId,
  tag,
  tagIndex,
  protocol,
  interpretation,
) {
  relationships.push(tagRelationship(
    type, targetType, targetId, tag, tagIndex, protocol, interpretation,
  ));
  handled.add(tagIndex);
}

function tagRelationship(type, targetType, targetId, tag, tagIndex, protocol, interpretation) {
  return {
    type,
    targetType,
    targetId,
    evidence: { interpretation, protocol, tag, tagIndex },
  };
}

function embeddedCanonicalEvent(content) {
  if (typeof content !== 'string' || content.length === 0) return null;
  try {
    const event = JSON.parse(content);
    return isCanonicalNostrEvent(event) ? event : null;
  } catch {
    return null;
  }
}
