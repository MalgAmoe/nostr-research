import { deriveEventRelationships } from './protocol-relationships.js';

const KIND_FACTS = new Map([
  [0, ['profile-metadata', 'none', 'none']],
  [1, ['content', 'plain-text', null]],
  [3, ['relationship', 'none', 'none']],
  [5, ['moderation', 'none', 'none']],
  [6, ['interaction', 'none', 'repost']],
  [7, ['interaction', 'none', 'reaction']],
  [9, ['content', 'plain-text', 'chat-message']],
  [11, ['content', 'plain-text', 'original']],
  [13, ['encrypted', 'unknown', 'none']],
  [14, ['encrypted', 'unknown', 'none']],
  [15, ['encrypted', 'unknown', 'none']],
  [16, ['interaction', 'none', 'repost']],
  [17, ['interaction', 'none', 'reaction']],
  [20, ['content', 'picture-first', 'original']],
  [21, ['content', 'video', 'original']],
  [22, ['content', 'short-video', 'original']],
  [24, ['content', 'plain-text', 'chat-message']],
  [42, ['content', 'plain-text', 'chat-message']],
  [54, ['content', 'podcast-episode', 'original']],
  [1059, ['encrypted', 'unknown', 'none']],
  [1063, ['content', 'file-metadata', 'original']],
  [1068, ['content', 'poll', 'original']],
  [1111, ['content', 'plain-text', 'comment']],
  [1222, ['content', 'voice-message', 'original']],
  [1244, ['content', 'voice-message', 'comment']],
  [1311, ['content', 'plain-text', 'chat-message']],
  [1337, ['content', 'code', 'original']],
  [1984, ['moderation', 'none', 'none']],
  [1985, ['moderation', 'none', 'none']],
  [30023, ['content', 'long-form-markdown', 'original']],
  [30311, ['content', 'live-activity', 'original']],
  [30402, ['content', 'listing', 'original']],
  [34235, ['content', 'video', 'original']],
  [34236, ['content', 'short-video', 'original']],
]);

/**
 * Returns sparse, replaceable factual interpretations of one immutable event.
 * Unknown kinds are deliberately not inferred from content or kind ranges.
 */
export function describeEventContent(event) {
  const facts = KIND_FACTS.get(event.kind);
  if (!facts) {
    return { role: 'unknown', format: 'unknown', conversationRole: 'unknown' };
  }
  const [role, format, defaultConversationRole] = facts;
  return {
    role,
    format,
    conversationRole: defaultConversationRole ?? kindOneConversationRole(event),
  };
}

function kindOneConversationRole(event) {
  const relationships = deriveEventRelationships(event);
  const replies = relationships.filter(({ type }) => (
    type === 'reply-root' || type === 'reply-parent'
  ));
  if (replies.length > 0) {
    const targets = new Set(replies.map(({ targetId }) => targetId));
    const isKnown = replies.some(({ evidence }) => evidence.interpretation === 'known');
    return isKnown || targets.size === 1 ? 'reply' : 'unknown';
  }
  if (relationships.some(({ type }) => type === 'quoted-event')) return 'quote';
  if (relationships.some(({ type, evidence }) => (
    type === 'other-tag' && evidence.tag?.[0] === 'e'
  ))) return 'unknown';
  return 'original';
}
