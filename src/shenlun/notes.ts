export type ShenlunNotePart =
  | { type: 'text'; text: string }
  | { type: 'link'; text: string; href: string };

const reviewLinkPattern = /\[([^\]\r\n]+)\]\((\/review#review-item-[A-Za-z0-9_-]+)\)/g;

export function parseShenlunNotes(notes: string): ShenlunNotePart[] {
  const parts: ShenlunNotePart[] = [];
  let cursor = 0;

  for (const match of notes.matchAll(reviewLinkPattern)) {
    const index = match.index ?? 0;
    if (index > cursor) {
      parts.push({ type: 'text', text: notes.slice(cursor, index) });
    }

    parts.push({ type: 'link', text: match[1], href: match[2] });
    cursor = index + match[0].length;
  }

  if (cursor < notes.length) {
    parts.push({ type: 'text', text: notes.slice(cursor) });
  }

  return parts;
}
