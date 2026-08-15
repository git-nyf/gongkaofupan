import { useRef, type MouseEvent, type RefObject } from 'react';
import type { ShenlunAnnotation } from '../shenlun/draft';
import type { ShenlunMark, ShenlunSelection } from '../shenlun/editor';
import type { ShenlunCell, ShenlunLayout } from '../shenlun/layout';

interface ShenlunGridProps {
  layout: ShenlunLayout;
  annotations: ShenlunAnnotation[];
  marks: ShenlunMark[];
  selection: ShenlunSelection;
  textLength: number;
  gridRef: RefObject<HTMLDivElement>;
  onFocusEditor: (targetCell?: HTMLElement) => void;
  onPadToCell: (cellIndex: number) => void;
  onSelect: (selection: ShenlunSelection) => void;
}

export function ShenlunGrid({
  layout,
  annotations,
  marks,
  selection,
  textLength,
  gridRef,
  onFocusEditor,
  onPadToCell,
  onSelect,
}: ShenlunGridProps) {
  const markersByRow = new Map(layout.markers.map((marker) => [marker.rowIndex, marker.count]));
  const dragAnchorRef = useRef<{ start: number; end: number } | null>(null);
  const annotatedIndexes = new Set(
    annotations.flatMap((annotation) => (
      annotation.detached
        ? []
        : Array.from({ length: Math.max(0, annotation.end - annotation.start) }, (_, offset) => annotation.start + offset)
    )),
  );

  const beginSelection = (
    event: MouseEvent<HTMLDivElement>,
    cell: ShenlunCell | null,
    cellIndex: number,
  ) => {
    event.preventDefault();
    if (!cell) {
      dragAnchorRef.current = null;
      onPadToCell(cellIndex);
      onFocusEditor(event.currentTarget);
      return;
    }

    const range = cellSourceRange(cell);
    if (event.shiftKey) {
      const target = range.start < selection.start ? range.start : range.end;
      onSelect({ start: Math.min(selection.start, target), end: Math.max(selection.start, target) });
    } else {
      dragAnchorRef.current = range;
      onSelect({ start: range.start, end: range.start });
    }
    onFocusEditor(event.currentTarget);
  };

  const extendSelection = (event: MouseEvent<HTMLDivElement>, cell: ShenlunCell | null) => {
    const anchor = dragAnchorRef.current;
    if (anchor === null || event.buttons !== 1 || !cell) return;
    const range = cellSourceRange(cell);
    onSelect(range.start < anchor.start
      ? { start: range.start, end: anchor.end }
      : { start: anchor.start, end: range.end });
  };

  return (
    <div className="shenlun-grid-frame">
      <div aria-hidden="true" className="shenlun-markers">
        {layout.rows.map((_, rowIndex) => {
          const count = markersByRow.get(rowIndex);
          return count ? (
            <span
              className="shenlun-marker"
              key={count}
              style={{ top: `calc(${rowIndex} * var(--shenlun-cell-size))` }}
            >
              ({count}字)
            </span>
          ) : null;
        })}
      </div>
      <div
        aria-label="申论答题纸"
        className="shenlun-grid"
        ref={gridRef}
        role="grid"
        onMouseLeave={() => { dragAnchorRef.current = null; }}
        onMouseUp={() => { dragAnchorRef.current = null; }}
      >
        {layout.rows.map((row, rowIndex) => (
          <div className="shenlun-row" key={rowIndex} role="row">
            {row.cells.map((cell, columnIndex) => {
              const absoluteCellIndex = rowIndex * 25 + columnIndex;
              const range = cell ? cellSourceRange(cell) : null;
              const isTerminalCaret = Boolean(range
                && selection.start === selection.end
                && selection.start === range.end
                && absoluteCellIndex === layout.endCellIndex - 1
                && layout.endCellIndex === layout.rows.length * 25);
              const isCaret = selection.start === selection.end && (
                (range && selection.start >= range.start && selection.start < range.end)
                || (!cell
                  && selection.start === textLength
                  && absoluteCellIndex === layout.endCellIndex)
                || isTerminalCaret
              );
              const isSelected = Boolean(range && selection.start !== selection.end
                && range.end > selection.start && range.start < selection.end);
              const className = [
                'shenlun-cell',
                cell?.overflow ? 'shenlun-cell--overflow' : '',
                isCaret ? 'shenlun-cell--caret' : '',
                isTerminalCaret ? 'shenlun-cell--caret-end' : '',
                isSelected ? 'shenlun-cell--selected' : '',
              ].filter(Boolean).join(' ');

              return (
                <div
                  aria-label={`第${rowIndex + 1}行第${columnIndex + 1}格${cell?.text ?? ''}`}
                  className={className}
                  data-cell-index={absoluteCellIndex}
                  key={`${rowIndex}-${columnIndex}`}
                  onMouseDown={(event) => beginSelection(event, cell, absoluteCellIndex)}
                  onMouseEnter={(event) => extendSelection(event, cell)}
                  role="gridcell"
                >
                  {cell ? [...cell.text].map((character, offset) => {
                    const index = cell.sourceIndexes[offset] ?? cell.sourceIndexes[0];
                    const activeMarks = marks.filter((mark) => mark.start <= index && mark.end > index);
                    const characterMarks = activeMarks
                      .filter((mark) => mark.type !== 'color')
                      .map((mark) => `shenlun-cell__character--${mark.type}`);
                    const color = activeMarks.find((mark) => mark.type === 'color')?.color;
                    return (
                      <span
                        className={[
                          'shenlun-cell__character',
                          ...characterMarks,
                          color ? `shenlun-cell__character--color-${color}` : '',
                        ].filter(Boolean).join(' ')}
                        data-annotated={annotatedIndexes.has(index) ? 'true' : undefined}
                        data-source-index={index}
                        key={`${index}-${offset}`}
                      >
                        {character}
                      </span>
                    );
                  }) : null}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function cellSourceRange(cell: ShenlunCell) {
  const start = Math.min(...cell.sourceIndexes);
  const characters = [...cell.text];
  const lastIndex = cell.sourceIndexes[cell.sourceIndexes.length - 1];
  const lastLength = characters[characters.length - 1]?.length ?? 1;
  return { start, end: lastIndex + lastLength };
}
