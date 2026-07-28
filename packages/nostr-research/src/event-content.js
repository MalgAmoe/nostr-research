import { deriveEventRelationships } from './protocol-relationships.js';
import { RESEARCH_CONSTRAINTS } from './configuration.js';

const ATTACHMENT_LIMIT = 20;
const ATTACHMENT_ARRAY_LIMIT = RESEARCH_CONSTRAINTS.derivedValues.arrayLength.maximum;
const DERIVED_STRING_LIMIT = RESEARCH_CONSTRAINTS.derivedValues.stringLength.maximum;
const PICTURE_KINDS = new Set([20]);
const VIDEO_KINDS = new Set([21, 22, 34235, 34236]);
const VOICE_KINDS = new Set([1222, 1244]);
const MEDIA_EXTENSIONS = new Map([
  ['avif', 'image'], ['gif', 'image'], ['jpeg', 'image'], ['jpg', 'image'],
  ['png', 'image'], ['svg', 'image'], ['webp', 'image'],
  ['m4v', 'video'], ['mov', 'video'], ['mp4', 'video'], ['webm', 'video'],
  ['m4a', 'audio'], ['mp3', 'audio'], ['ogg', 'audio'], ['opus', 'audio'],
  ['wav', 'audio'],
]);
const MEDIA_HOSTS = new Map([
  ['imgur.com', 'image'], ['nostr.build', 'unknown'], ['void.cat', 'unknown'],
  ['youtube.com', 'video'], ['youtu.be', 'video'], ['vimeo.com', 'video'],
  ['soundcloud.com', 'audio'],
]);

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
  const attachmentFacts = describeAttachments(event);
  if (!facts) {
    return {
      role: 'unknown', format: 'unknown', conversationRole: 'unknown', ...attachmentFacts,
    };
  }
  const [role, format, defaultConversationRole] = facts;
  return {
    role,
    format,
    conversationRole: defaultConversationRole ?? kindOneConversationRole(event),
    ...attachmentFacts,
  };
}

function describeAttachments(event) {
  const attachments = new Map();
  const add = (urlValue, evidence) => {
    const url = normalizedHttpUrl(urlValue);
    if (!url) return;
    let attachment = attachments.get(url);
    if (!attachment) {
      attachment = attachmentDraft(url);
      attachments.set(url, attachment);
    }
    mergeEvidence(attachment, evidence);
  };

  for (const tag of event.tags) {
    if (tag[0] === 'imeta') {
      const metadata = parseImeta(tag);
      if (metadata.url) add(metadata.url, { ...metadata, source: 'imeta', declared: true });
    } else if (event.kind === 54 && tag[0] === 'audio') {
      add(tag[1], {
        source: 'podcast-audio-tag', declared: true, impliedFamily: 'audio',
        mimeTypes: tag[2] ? [tag[2]] : [],
      });
    }
  }
  if (event.kind === 1063) {
    const metadata = parseTopLevelMetadata(event.tags);
    if (metadata.url) add(metadata.url, { ...metadata, source: 'file-metadata', declared: true });
  }
  if (VOICE_KINDS.has(event.kind)) {
    add(event.content.trim(), {
      source: 'voice-kind', declared: true, impliedFamily: 'audio',
    });
  }
  const dedicated = PICTURE_KINDS.has(event.kind)
    ? { source: 'picture-kind', family: 'image' }
    : VIDEO_KINDS.has(event.kind)
      ? { source: 'video-kind', family: 'video' }
      : null;
  const dedicatedMetadata = dedicated ? parseTopLevelMetadata(event.tags) : null;
  const dedicatedEvidence = dedicated ? {
    source: dedicated.source,
    declared: true,
    impliedFamily: dedicated.family,
    durationSeconds: dedicatedMetadata.durationSeconds,
    alt: dedicatedMetadata.alt,
  } : null;
  if (dedicatedEvidence) {
    for (const attachment of attachments.values()) {
      mergeEvidence(attachment, dedicatedEvidence);
    }
  }
  for (const rawUrl of contentUrls(event.content)) {
    const url = normalizedHttpUrl(rawUrl);
    if (!url) continue;
    const hints = inferredUrlHints(url);
    if (dedicatedEvidence && hints.length > 0) add(url, dedicatedEvidence);
    for (const hint of hints) add(url, hint);
  }

  const complete = [...attachments.values()].map(finalizeAttachment);
  const returned = complete.slice(0, ATTACHMENT_LIMIT);
  return {
    mediaFamilies: orderedSet(complete.flatMap(({ families }) => families)),
    mediaSources: orderedSet(complete.flatMap(({ sources }) => sources)),
    attachmentCount: complete.length,
    attachments: returned,
    attachmentsOmitted: complete.length - returned.length,
    hasMedia: complete.length > 0,
  };
}

function attachmentDraft(url) {
  return {
    url, families: [], mimeTypes: [], sources: [], hashes: [], fallbackUrls: [],
    declaredFamilies: [], hasDeclaredEvidence: false, hasInferredEvidence: false,
    width: null, height: null, durationSeconds: null, alt: null,
  };
}

function mergeEvidence(attachment, evidence) {
  addOrdered(attachment.sources, evidence.source);
  attachment.hasDeclaredEvidence ||= evidence.declared === true;
  attachment.hasInferredEvidence ||= evidence.declared === false;
  for (const mime of evidence.mimeTypes ?? []) {
    if (typeof mime !== 'string' || mime.length === 0) continue;
    addOrdered(attachment.mimeTypes, mime);
    const family = mimeFamily(mime);
    addOrdered(attachment.families, family);
    if (evidence.declared) addOrdered(attachment.declaredFamilies, family);
  }
  if (evidence.impliedFamily) {
    addOrdered(attachment.families, evidence.impliedFamily);
    if (evidence.declared) addOrdered(attachment.declaredFamilies, evidence.impliedFamily);
  }
  for (const hash of evidence.hashes ?? []) addOrdered(attachment.hashes, hash);
  for (const fallback of evidence.fallbackUrls ?? []) {
    const normalized = normalizedHttpUrl(fallback);
    if (normalized) addOrdered(attachment.fallbackUrls, normalized);
  }
  for (const field of ['width', 'height', 'durationSeconds', 'alt']) {
    if (attachment[field] === null && evidence[field] !== null && evidence[field] !== undefined) {
      attachment[field] = evidence[field];
    }
  }
}

function finalizeAttachment(draft) {
  if (draft.families.length === 0) draft.families.push('unknown');
  const conflicting = new Set(
    draft.declaredFamilies.filter((family) => family !== 'unknown'),
  ).size > 1;
  return {
    url: draft.url,
    families: draft.families.slice(0, ATTACHMENT_ARRAY_LIMIT),
    mimeTypes: draft.mimeTypes.slice(0, ATTACHMENT_ARRAY_LIMIT),
    classification: conflicting ? 'conflicting'
      : draft.hasDeclaredEvidence ? 'declared'
        : draft.hasInferredEvidence ? 'inferred' : 'unknown',
    sources: draft.sources.slice(0, ATTACHMENT_ARRAY_LIMIT),
    width: draft.width,
    height: draft.height,
    durationSeconds: draft.durationSeconds,
    alt: typeof draft.alt === 'string' ? draft.alt.slice(0, DERIVED_STRING_LIMIT) : null,
    hashes: draft.hashes.slice(0, ATTACHMENT_ARRAY_LIMIT),
    fallbackUrls: draft.fallbackUrls.slice(0, ATTACHMENT_ARRAY_LIMIT),
  };
}

function parseImeta(tag) {
  const values = tag.slice(1).reduce((result, item) => {
    if (typeof item !== 'string') return result;
    const separator = item.indexOf(' ');
    const name = separator < 0 ? item : item.slice(0, separator);
    const value = separator < 0 ? '' : item.slice(separator + 1);
    if (value) (result[name] ??= []).push(value);
    return result;
  }, {});
  return metadataFromValues(values);
}

function parseTopLevelMetadata(tags) {
  const values = {};
  for (const tag of tags) {
    if (typeof tag[0] === 'string' && typeof tag[1] === 'string') {
      (values[tag[0]] ??= []).push(tag[1]);
    }
  }
  return metadataFromValues(values);
}

function metadataFromValues(values) {
  const dimensions = dimensionsValue(values.dim?.[0]);
  return {
    url: values.url?.[0],
    mimeTypes: values.m ?? [],
    width: dimensions?.width ?? null,
    height: dimensions?.height ?? null,
    durationSeconds: nonNegativeNumber(values.duration?.[0]),
    alt: values.alt?.[0] ?? null,
    hashes: [...(values.x ?? []), ...(values.ox ?? [])],
    fallbackUrls: values.fallback ?? [],
  };
}

function dimensionsValue(value) {
  const match = /^(\d+)x(\d+)$/u.exec(value ?? '');
  if (!match) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  return Number.isSafeInteger(width) && width > 0 && Number.isSafeInteger(height) && height > 0
    ? { width, height } : null;
}

function nonNegativeNumber(value) {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function mimeFamily(value) {
  const match = /^([!#$%&'*+.^_`|~0-9A-Za-z-]+)\/[!#$%&'*+.^_`|~0-9A-Za-z-]+(?:\s*;.*)?$/u
    .exec(value);
  if (!match) return 'unknown';
  const type = match[1].toLocaleLowerCase();
  return ['image', 'video', 'audio'].includes(type) ? type : 'file';
}

function inferredUrlHints(url) {
  const parsed = new URL(url);
  const extension = /\.([A-Za-z0-9]+)$/u.exec(parsed.pathname)?.[1]?.toLocaleLowerCase();
  const hints = [];
  if (MEDIA_EXTENSIONS.has(extension)) {
    hints.push({
      source: 'url-extension', declared: false, impliedFamily: MEDIA_EXTENSIONS.get(extension),
    });
  }
  const host = parsed.hostname.toLocaleLowerCase();
  const known = [...MEDIA_HOSTS].find(([domain]) => host === domain || host.endsWith(`.${domain}`));
  if (known) {
    hints.push({ source: 'known-host', declared: false, impliedFamily: known[1] });
  }
  return hints;
}

function normalizedHttpUrl(value) {
  if (typeof value !== 'string' || value.trim() === '') return null;
  try {
    const url = new URL(value.trim());
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function contentUrls(content) {
  return [...String(content).matchAll(/https?:\/\/[^\s<>"')\]]+/giu)]
    .map(([url]) => url);
}

function addOrdered(values, value) {
  if (value !== undefined && value !== null && !values.includes(value)
      && values.length < ATTACHMENT_ARRAY_LIMIT) values.push(value);
}

function orderedSet(values) {
  return [...new Set(values)].slice(0, ATTACHMENT_ARRAY_LIMIT);
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
