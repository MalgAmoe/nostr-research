import type { Media } from './data';

const URL_PATTERN = /https?:\/\/[^\s<>"']+/giu;
const TRAILING = /[),.;!?]+$/u;

export function mediaFromText(content: string): Media | undefined {
  for (const raw of content.match(URL_PATTERN) ?? []) {
    const src = raw.replace(TRAILING, '');
    const pathname = safePathname(src).toLowerCase();
    if (/\.(?:png|jpe?g|gif|webp|avif)$/u.test(pathname)) {
      return { type: 'image', src, alt: 'Remote image declared in this note', remote: true };
    }
    if (/\.(?:mp4|webm|mov|m4v)$/u.test(pathname)) {
      return { type: 'video', src, alt: 'Remote video declared in this note', remote: true };
    }
  }
  return undefined;
}

function safePathname(value: string) {
  try { return new URL(value).pathname; } catch { return ''; }
}
