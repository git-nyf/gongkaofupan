import { useEffect, useState, type RefObject } from 'react';
import type { ShenlunAnnotation } from '../shenlun/draft';

interface ShenlunConnectorsProps {
  rootRef: RefObject<HTMLElement>;
  annotations: ShenlunAnnotation[];
}

interface ConnectorPath {
  id: string;
  d: string;
}

interface ConnectorSize {
  width: number;
  height: number;
}

function connectorPath(root: HTMLElement, annotation: ShenlunAnnotation): ConnectorPath | null {
  if (annotation.detached) return null;
  const source = root.querySelector<HTMLElement>(`[data-source-index="${annotation.end - 1}"]`);
  const target = document.getElementById(`shenlun-annotation-${annotation.id}`);
  if (!source || !target) return null;
  const rootRect = root.getBoundingClientRect();
  const sourceRect = source.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  if (sourceRect.width === 0 && sourceRect.height === 0 && targetRect.width === 0 && targetRect.height === 0) {
    return { id: annotation.id, d: 'M 0 0 C 16 0 16 0 32 0' };
  }
  const startX = sourceRect.right - rootRect.left;
  const startY = sourceRect.top - rootRect.top + sourceRect.height / 2;
  const endX = targetRect.left - rootRect.left;
  const endY = targetRect.top - rootRect.top + targetRect.height / 2;
  const distance = Math.max(24, Math.abs(endX - startX) * 0.45);
  return {
    id: annotation.id,
    d: `M ${startX} ${startY} C ${startX + distance} ${startY}, ${endX - distance} ${endY}, ${endX} ${endY}`,
  };
}

export function ShenlunConnectors({ rootRef, annotations }: ShenlunConnectorsProps) {
  const [paths, setPaths] = useState<ConnectorPath[]>([]);
  const [size, setSize] = useState<ConnectorSize>({ width: 1, height: 1 });

  useEffect(() => {
    let frame: number | null = null;
    const update = () => {
      frame = null;
      const root = rootRef.current;
      if (!root) return;
      const rootRect = root.getBoundingClientRect();
      setSize({ width: Math.max(1, rootRect.width), height: Math.max(1, rootRect.height) });
      setPaths(annotations.map((annotation) => connectorPath(root, annotation)).filter(
        (path): path is ConnectorPath => path !== null,
      ));
    };
    const schedule = () => {
      if (frame === null) frame = window.requestAnimationFrame(update);
    };
    schedule();
    window.addEventListener('resize', schedule);
    const root = rootRef.current;
    root?.addEventListener('scroll', schedule, { passive: true });
    const rail = root?.querySelector('.shenlun-notes-rail');
    const sheetScroll = root?.querySelector('.shenlun-sheet-scroll');
    rail?.addEventListener('scroll', schedule, { passive: true });
    sheetScroll?.addEventListener('scroll', schedule, { passive: true });
    return () => {
      window.removeEventListener('resize', schedule);
      root?.removeEventListener('scroll', schedule);
      rail?.removeEventListener('scroll', schedule);
      sheetScroll?.removeEventListener('scroll', schedule);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [annotations, rootRef]);

  if (paths.length === 0) return null;
  return (
    <svg
      aria-hidden="true"
      className="shenlun-connectors"
      preserveAspectRatio="none"
      viewBox={`0 0 ${size.width} ${size.height}`}
      width="100%"
      height="100%"
    >
      <defs>
        <marker id="shenlun-arrowhead" markerHeight="6" markerWidth="6" orient="auto" refX="5" refY="3">
          <path d="M 0 0 L 6 3 L 0 6 z" fill="currentColor" />
        </marker>
      </defs>
      {paths.map((path) => (
        <path
          d={path.d}
          fill="none"
          key={path.id}
          markerEnd="url(#shenlun-arrowhead)"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      ))}
    </svg>
  );
}
