import { describe, expect, it } from 'vitest';
import { mediaFromText } from './media';

describe('live media projection', () => {
  it('recognizes direct image and video URLs without inventing media for ordinary links', () => {
    expect(mediaFromText('look https://cdn.example/photo.webp')).toMatchObject({ type: 'image', remote: true });
    expect(mediaFromText('watch https://cdn.example/clip.mp4?x=1')).toMatchObject({ type: 'video', remote: true });
    expect(mediaFromText('read https://example.com/article')).toBeUndefined();
  });

  it('removes ordinary prose punctuation from a declared media URL', () => {
    expect(mediaFromText('image (https://example.com/picture.jpg).')?.src).toBe('https://example.com/picture.jpg');
  });
});
