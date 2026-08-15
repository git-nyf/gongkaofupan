export interface ShenlunTextSelection {
  start: number;
  end: number;
  quote: string;
  rect: DOMRect;
}

function elementFromNode(node: Node | null): HTMLElement | null {
  if (node instanceof HTMLElement) return node;
  return node?.parentElement ?? null;
}

function sourceIndex(element: Element): number | null {
  const value = element.getAttribute('data-source-index');
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

export function readShenlunSelection(
  selection: Selection | null,
  grid: HTMLElement,
): ShenlunTextSelection | null {
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;

  const range = selection.getRangeAt(0);
  const anchor = elementFromNode(range.startContainer);
  const focus = elementFromNode(range.endContainer);
  if (!anchor || !focus || (!grid.contains(anchor) && !grid.contains(focus))) return null;

  const characters = [...grid.querySelectorAll<HTMLElement>('[data-source-index]')]
    .filter((element) => {
      try {
        return range.intersectsNode(element);
      } catch {
        return false;
      }
    })
    .map((element) => ({ element, index: sourceIndex(element) }))
    .filter((item): item is { element: HTMLElement; index: number } => item.index !== null)
    .sort((left, right) => left.index - right.index);

  if (characters.length === 0) return null;

  const start = characters[0].index;
  const end = characters[characters.length - 1].index + characters[characters.length - 1].element.textContent!.length;
  const rangeRect = 'getBoundingClientRect' in range
    ? range.getBoundingClientRect()
    : undefined;
  const firstRect = characters[0].element.getBoundingClientRect();
  const lastRect = characters[characters.length - 1].element.getBoundingClientRect();
  const rect = rangeRect && (rangeRect.width > 0 || rangeRect.height > 0)
    ? rangeRect
    : DOMRect.fromRect({
        x: firstRect.x,
        y: firstRect.y,
        width: Math.max(1, lastRect.right - firstRect.left),
        height: Math.max(firstRect.height, lastRect.height, 1),
      });

  return {
    start,
    end,
    quote: characters.map(({ element }) => element.textContent ?? '').join(''),
    rect,
  };
}
