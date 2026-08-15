import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import ForceGraph3D, {
  type ForceGraphMethods,
  type GraphData,
  type LinkObject,
  type NodeObject,
} from 'react-force-graph-3d';
import {
  BufferGeometry,
  CanvasTexture,
  Group,
  LinearFilter,
  LineBasicMaterial,
  LineLoop,
  Sprite,
  SpriteMaterial,
  Vector3,
} from 'three';
import {
  Captions,
  FileDown,
  Eye,
  ListTree,
  LoaderCircle,
  Maximize2,
  Network,
  Pause,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Save,
  Search,
  Sparkles,
  Trash2,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type {
  CardDetail,
  CardSearchResult,
  KnowledgeMapDetail,
  KnowledgeMapEdge,
  KnowledgeMapNode,
  KnowledgeMapSummary,
} from '../../shared/contracts';
import { api, ApiError } from '../api/client';
import { RichTextPreview } from '../components/RichTextPreview';
import { StatusNotice } from '../components/StatusNotice';
import { buildSolarOrbitLayout } from '../graphs/solarOrbitLayout';
import { shouldReduceMotion } from '../theme/experienceSettings';
import '../styles/graphs.css';

const CARD_DRAG_TYPE = 'application/x-knowledge-card';
const SPHERE_RADIUS = 260;
const EMPTY_NODE_COUNT = 56;
const MIND_MAP_MAX_LEVEL = 6;
const MIND_MAP_RING_GAP = 210;
const MIND_MAP_ZOOM_MIN = 0.6;
const MIND_MAP_ZOOM_MAX = 1.6;
const MIND_MAP_ZOOM_STEP = 0.1;
const HORIZONTAL_COLUMN_GAP = 270;
const HORIZONTAL_ROW_GAP = 112;
const HORIZONTAL_PADDING_X = 150;
const HORIZONTAL_PADDING_Y = 118;
const NODE_LINK_HOLD_MS = 420;
const GRAPH_LABEL_REFERENCE_DISTANCE = 900;
const GRAPH_LABEL_SCALE_MIN = 0.78;
const GRAPH_LABEL_SCALE_MAX = 2.2;
const GRAPH_DERIVED_LABEL_DISTANCE_MAX = 680;
const DEFAULT_CARD_LEVEL = 2;
const BRANCH_RELATION_LABEL = '分支';
const AI_NODE_COLOR = '#b63c32';
const CUSTOM_NODE_COLOR = '#cc5a4f';
const CARD_NODE_COLOR = '#9d2822';
const PREVIEW_LINK_COLOR = 'rgba(181, 62, 51, 0.34)';
const GRAPH_SEARCH_PAGE_SIZE = 12;

type SaveState = 'idle' | 'saving' | 'saved' | 'error';
type LoadState = 'loading' | 'ready' | 'error';
type GraphViewMode = 'horizontal' | 'radial' | 'preview';

interface GraphStats {
  nodeCount: number;
  edgeCount: number;
}

interface GraphHighlight {
  nodeIds: Set<string>;
  edgeIds: Set<string>;
  hasFocus: boolean;
}

interface SpherePosition {
  x: number;
  y: number;
  z: number;
}

interface PlanePoint {
  left: number;
  top: number;
}

interface MindMapWorldSize {
  width: number;
  height: number;
}

interface CustomNodeDraft {
  title: string;
  content: string;
  level: number;
}

interface CardDerivedGraphItem {
  color: string;
  kind: string;
  label: string;
  value: string;
  card: CardDetail;
}

type CompatibleKnowledgeMapNode = Omit<KnowledgeMapNode, 'cardId' | 'card'> & {
  cardId?: string | null;
  card?: CardDetail | null;
  title?: string | null;
  content?: string | null;
  level?: number | null;
};

interface GraphNode extends NodeObject {
  id: string;
  name: string;
  cardId?: string | null;
  category: string;
  color: string;
  linkCount: number;
  archived: boolean;
  level: number;
  content?: string;
  card?: CardDetail | null;
  placeholder?: boolean;
  derived?: boolean;
  parentId?: string;
  kind?: 'sun' | 'planet' | 'asteroid' | 'orbit';
  orbitRadius?: number;
}

interface GraphLink extends LinkObject {
  id: string;
  source: string;
  target: string;
  label: string;
  color: string;
  weight: number;
  levelDelta: number;
  placeholder?: boolean;
  derived?: boolean;
}

interface DetailRelation {
  id: string;
  label: string;
  sourceTitle: string;
  targetTitle: string;
}

type NodePatch = { title?: string; content?: string; level?: number };

type UndoAction =
  | { kind: 'delete-node'; mapId: string; nodeId: string }
  | { kind: 'restore-node'; mapId: string; node: KnowledgeMapNode; edges: KnowledgeMapEdge[] }
  | { kind: 'delete-edge'; mapId: string; edgeId: string }
  | { kind: 'restore-edge'; mapId: string; edge: KnowledgeMapEdge }
  | { kind: 'update-node'; mapId: string; nodeId: string; previous: NodePatch };

const relationColors = new Map([
  [BRANCH_RELATION_LABEL, '#28735e'],
  ['属于', '#28735e'],
  ['对比', '#4d6fb8'],
  ['易混', '#c64232'],
  ['因果', '#b54f1d'],
  ['时间', '#8a6314'],
  ['例子', '#0f766e'],
  ['补充', '#5d6470'],
]);

export function GraphsPage() {
  const graphRef = useRef<ForceGraphMethods<GraphNode, GraphLink>>();
  const frameRef = useRef<HTMLDivElement | null>(null);
  const clickMemoryRef = useRef<{ id: string; time: number } | null>(null);
  const searchRequestRef = useRef(0);
  const nodeUpdateTimersRef = useRef(new Map<string, number>());
  const pendingNodeUpdatesRef = useRef(new Map<string, NodePatch>());
  const nodeEditUndoSnapshotsRef = useRef(new Map<string, NodePatch>());
  const undoStackRef = useRef<UndoAction[]>([]);
  const autoRotateRef = useRef({
    angle: 0.35,
    lastTime: 0,
    pausedUntil: 0,
    radius: SPHERE_RADIUS * 3.1,
    y: SPHERE_RADIUS * 0.42,
  });
  const previewFocusRef = useRef(false);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [maps, setMaps] = useState<KnowledgeMapSummary[]>([]);
  const [activeMapId, setActiveMapId] = useState<string>();
  const [detail, setDetail] = useState<KnowledgeMapDetail | null>(null);
  const [detailState, setDetailState] = useState<LoadState>('loading');
  const [createName, setCreateName] = useState('');
  const [createError, setCreateError] = useState('');
  const [renameName, setRenameName] = useState('');
  const [renameError, setRenameError] = useState('');
  const [viewMode, setViewMode] = useState<GraphViewMode>('preview');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [query, setQuery] = useState('');
  const [searchResult, setSearchResult] = useState<CardDetail[]>([]);
  const [cardLibraryCards, setCardLibraryCards] = useState<CardDetail[]>([]);
  const [searchState, setSearchState] = useState<LoadState>('ready');
  const [selectedNodeId, setSelectedNodeId] = useState<string>();
  const [hoverNodeId, setHoverNodeId] = useState<string>();
  const [hoverEdgeId, setHoverEdgeId] = useState<string>();
  const [reducedMotion] = useState(() => shouldReduceMotion());
  const [autoRotateEnabled, setAutoRotateEnabled] = useState(() => !shouldReduceMotion());
  const [showPreviewLabels, setShowPreviewLabels] = useState(true);
  const [showDerivedNodes, setShowDerivedNodes] = useState(true);
  const [cameraDistance, setCameraDistance] = useState(SPHERE_RADIUS * 3.1);
  const [frameSize, setFrameSize] = useState({ width: 920, height: 680 });
  const [undoCount, setUndoCount] = useState(0);
  const [undoing, setUndoing] = useState(false);
  const editing = viewMode === 'horizontal';

  const pushUndo = useCallback((action: UndoAction) => {
    undoStackRef.current.push(action);
    setUndoCount(undoStackRef.current.length);
  }, []);

  const activeMap = maps.find(({ id }) => id === activeMapId);
  const selectedMapNode = detail?.nodes.find(({ id }) => id === selectedNodeId);
  const selectedRelations = useMemo<DetailRelation[]>(() => {
    if (!detail || !selectedMapNode) return [];
    const nodesById = new Map(detail.nodes.map((node) => [node.id, node]));
    return detail.edges
      .filter((edge) => edge.sourceNodeId === selectedMapNode.id || edge.targetNodeId === selectedMapNode.id)
      .map((edge) => ({
        id: edge.id,
        label: edge.label || BRANCH_RELATION_LABEL,
        sourceTitle: knowledgeNodeTitle(nodesById.get(edge.sourceNodeId)!),
        targetTitle: knowledgeNodeTitle(nodesById.get(edge.targetNodeId)!),
      }));
  }, [detail, selectedMapNode]);
  const existingCardIds = useMemo(
    () => new Set((detail?.nodes ?? []).flatMap((node) => {
      const cardId = knowledgeNodeCardId(node);
      return cardId ? [cardId] : [];
    })),
    [detail?.nodes],
  );
  const graphData = useMemo<GraphData<GraphNode, GraphLink>>(
    () => toGraphData(
      detail,
      groupCardsByOriginalSource(mergeCardsById(
        cardLibraryCards,
        (detail?.nodes ?? []).flatMap((node) => {
          const card = knowledgeNodeCard(node);
          return card ? [card] : [];
        }),
      )),
      showDerivedNodes,
    ),
    [cardLibraryCards, detail, showDerivedNodes],
  );
  const selectedGraphNode = graphData.nodes.find(({ id }) => id === selectedNodeId) as GraphNode | undefined;
  const graphStats = useMemo(() => getGraphStats(detail), [detail]);
  const graphHighlight = useMemo(
    () => buildGraphHighlight(
      detail,
      hoverNodeId,
      hoverEdgeId,
      selectedNodeId,
    ),
    [detail, hoverEdgeId, hoverNodeId, selectedNodeId],
  );
  const hoverSummary = useMemo(
    () => getHoverSummary(detail, hoverNodeId, hoverEdgeId, graphHighlight),
    [detail, graphHighlight, hoverEdgeId, hoverNodeId],
  );
  const hasPreviewFocus = Boolean(hoverNodeId || hoverEdgeId || selectedNodeId);

  const syncAutoRotateOrbit = useCallback(() => {
    const camera = graphRef.current?.camera() as {
      position?: { x?: number; y?: number; z?: number };
    } | undefined;
    const x = camera?.position?.x;
    const y = camera?.position?.y;
    const z = camera?.position?.z;
    if (![x, y, z].every((value) => typeof value === 'number' && Number.isFinite(value))) return;
    const radius = Math.hypot(x as number, z as number);
    if (radius <= 0) return;
    autoRotateRef.current.angle = Math.atan2(z as number, x as number);
    autoRotateRef.current.radius = radius;
    autoRotateRef.current.y = y as number;
  }, []);

  const pauseAutoRotate = useCallback((duration = 2600) => {
    syncAutoRotateOrbit();
    autoRotateRef.current.pausedUntil = window.performance.now() + duration;
  }, [syncAutoRotateOrbit]);

  const centerGraph = useCallback((duration = 650) => {
    pauseAutoRotate(duration + 1800);
    const transition = reducedMotion ? 0 : duration;
    if ((detail?.nodes.length ?? 0) > 0) {
      graphRef.current?.zoomToFit(
        transition,
        Math.max(28, Math.min(72, frameSize.width * 0.1)),
        (node) => !(node as GraphNode).placeholder,
      );
      return;
    }
    graphRef.current?.cameraPosition(
      { x: 0, y: SPHERE_RADIUS * 0.34, z: SPHERE_RADIUS * 3.05 },
      { x: 0, y: 0, z: 0 },
      transition,
    );
  }, [detail?.nodes.length, frameSize.width, pauseAutoRotate, reducedMotion]);

  const zoomGraph = useCallback((factor: number) => {
    pauseAutoRotate(1800);
    const camera = graphRef.current?.camera() as {
      position?: { x?: number; y?: number; z?: number };
    } | undefined;
    const x = camera?.position?.x;
    const y = camera?.position?.y;
    const z = camera?.position?.z;
    if (![x, y, z].every((value) => typeof value === 'number' && Number.isFinite(value))) return;
    graphRef.current?.cameraPosition(
      { x: (x as number) * factor, y: (y as number) * factor, z: (z as number) * factor },
      { x: 0, y: 0, z: 0 },
      reducedMotion ? 0 : 280,
    );
  }, [pauseAutoRotate, reducedMotion]);

  const loadMaps = useCallback(async () => {
    setLoadState('loading');
    try {
      const nextMaps = await api<KnowledgeMapSummary[]>('/api/knowledge-maps');
      setMaps(nextMaps);
      setLoadState('ready');
      setActiveMapId((current) => (
        current && nextMaps.some(({ id }) => id === current) ? current : nextMaps[0]?.id
      ));
    } catch {
      setLoadState('error');
    }
  }, []);

  const loadDetail = useCallback(async (mapId: string) => {
    setDetailState('loading');
    try {
      const nextDetail = await api<KnowledgeMapDetail>(`/api/knowledge-maps/${mapId}`);
      setDetail(nextDetail);
      setDetailState('ready');
      setSaveState('idle');
    } catch {
      setDetailState('error');
    }
  }, []);

  useEffect(() => {
    void loadMaps();
  }, [loadMaps]);

  useEffect(() => () => {
    for (const timeoutId of nodeUpdateTimersRef.current.values()) window.clearTimeout(timeoutId);
    nodeUpdateTimersRef.current.clear();
    pendingNodeUpdatesRef.current.clear();
    nodeEditUndoSnapshotsRef.current.clear();
  }, []);

  useEffect(() => {
    if (!activeMapId) {
      setDetail(null);
      return;
    }
    setSelectedNodeId(undefined);
    setHoverNodeId(undefined);
    setHoverEdgeId(undefined);
    undoStackRef.current = [];
    setUndoCount(0);
    nodeEditUndoSnapshotsRef.current.clear();
    void loadDetail(activeMapId);
  }, [activeMapId, loadDetail]);

  useEffect(() => {
    setRenameName(activeMap?.name ?? '');
    setRenameError('');
  }, [activeMap?.id, activeMap?.name]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const syncFrameSize = () => {
      setFrameSize((current) => ({
        width: frame.clientWidth > 0 ? Math.round(frame.clientWidth) : current.width,
        height: frame.clientHeight > 0 ? Math.round(frame.clientHeight) : current.height,
      }));
    };
    syncFrameSize();
    if (!('ResizeObserver' in window)) return;
    const observer = new ResizeObserver(syncFrameSize);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const controls = graphRef.current?.controls() as { autoRotate?: boolean; autoRotateSpeed?: number } | undefined;
    if (!controls) return;
    controls.autoRotate = false;
    controls.autoRotateSpeed = 0;
  }, [detail]);

  useEffect(() => {
    if (editing || detailState !== 'ready') {
      return;
    }
    const graph = graphRef.current;
    const controls = graph?.controls() as {
      addEventListener?: (type: string, listener: () => void) => void;
      removeEventListener?: (type: string, listener: () => void) => void;
    } | undefined;
    const syncCameraDistance = () => {
      const distance = graph?.camera().position.length();
      syncAutoRotateOrbit();
      if (typeof distance === 'number' && Number.isFinite(distance)) {
        setCameraDistance((current) => Math.abs(current - distance) >= 1 ? distance : current);
      }
    };
    syncCameraDistance();
    controls?.addEventListener?.('change', syncCameraDistance);
    return () => controls?.removeEventListener?.('change', syncCameraDistance);
  }, [detailState, editing, graphData.nodes.length, syncAutoRotateOrbit]);

  useEffect(() => {
    if (viewMode !== 'preview' || detailState !== 'ready') return undefined;
    const scene = (graphRef.current as (ForceGraphMethods<GraphNode, GraphLink> & {
      scene?: () => { add: (object: Group) => void; remove: (object: Group) => void };
    }) | undefined)?.scene?.();
    if (!scene) return undefined;
    const radii = [...new Set(graphData.nodes.flatMap((node) => {
      const graphNode = node as GraphNode;
      return graphNode.kind === 'planet' && graphNode.orbitRadius ? [graphNode.orbitRadius] : [];
    }))].sort((first, second) => first - second);
    const orbitGroup = new Group();
    orbitGroup.name = 'knowledge-map-solar-orbits';
    for (const radius of radii) {
      const points = Array.from({ length: 128 }, (_, index) => {
        const angle = (Math.PI * 2 * index) / 128;
        return new Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
      });
      const geometry = new BufferGeometry().setFromPoints(points);
      const material = new LineBasicMaterial({
        color: '#d66c63',
        opacity: 0.34,
        transparent: true,
      });
      orbitGroup.add(new LineLoop(geometry, material));
    }
    scene.add(orbitGroup);
    return () => {
      scene.remove(orbitGroup);
      orbitGroup.children.forEach((child) => {
        child.geometry?.dispose?.();
        child.material?.dispose?.();
      });
    };
  }, [detailState, graphData.nodes, viewMode]);

  useEffect(() => {
    previewFocusRef.current = hasPreviewFocus;
  }, [hasPreviewFocus]);

  useEffect(() => {
    if (!activeMapId || detailState !== 'ready') return;
    const timeoutId = window.setTimeout(() => {
      if (!previewFocusRef.current) centerGraph(0);
    }, 120);
    return () => window.clearTimeout(timeoutId);
  }, [activeMapId, centerGraph, detailState, frameSize.height, frameSize.width]);

  useEffect(() => {
    let animationId = 0;
    const tick = (time: number) => {
      const state = autoRotateRef.current;
      const delta = state.lastTime > 0 ? Math.min(time - state.lastTime, 64) : 16;
      state.lastTime = time;

      if (!editing && autoRotateEnabled && !reducedMotion && detail && !previewFocusRef.current && time >= state.pausedUntil) {
        state.angle += delta * 0.00016;
        graphRef.current?.cameraPosition(
          {
            x: Math.cos(state.angle) * state.radius,
            y: state.y,
            z: Math.sin(state.angle) * state.radius,
          },
          { x: 0, y: 0, z: 0 },
          0,
        );
      }

      animationId = window.requestAnimationFrame(tick);
    };
    animationId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(animationId);
  }, [autoRotateEnabled, detail, editing, reducedMotion]);

  useEffect(() => {
    const requestId = searchRequestRef.current + 1;
    searchRequestRef.current = requestId;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      setSearchState('loading');
      fetchOriginalCardSearchPage(query, controller.signal)
        .then((items) => {
          if (requestId !== searchRequestRef.current) return;
          setSearchResult(uniqueOriginalCards(items));
          setCardLibraryCards((current) => mergeCardsById(current, items));
          setSearchState('ready');
        })
        .catch((error: unknown) => {
          if (requestId !== searchRequestRef.current || isAbortError(error)) return;
          setSearchState('error');
        });
    }, 180);
    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [query]);

  const refreshAfterMutation = async (nextDetail: KnowledgeMapDetail) => {
    setDetail(nextDetail);
    setMaps((current) => current.map((item) => (item.id === nextDetail.map.id ? nextDetail.map : item)));
  };

  const runMutation = async (operation: () => Promise<KnowledgeMapDetail>) => {
    setSaveState('saving');
    try {
      const nextDetail = await operation();
      await refreshAfterMutation(nextDetail);
      setSaveState('saved');
      return nextDetail;
    } catch {
      setSaveState('error');
      return undefined;
    }
  };

  const createMap = async () => {
    const name = createName.trim();
    setSaveState('saving');
    setCreateError('');
    try {
      const created = await api<KnowledgeMapDetail>('/api/knowledge-maps', {
        method: 'POST',
        body: JSON.stringify(name ? { name } : {}),
      });
      setMaps((current) => [created.map, ...current]);
      setActiveMapId(created.map.id);
      setDetail(created);
      setCreateName('');
      setSaveState('saved');
    } catch (error) {
      setCreateError(createMapErrorText(error));
      setSaveState('error');
    }
  };

  const deleteActiveMap = async () => {
    if (!activeMap || !window.confirm(`确认删除图谱“${activeMap.name}”？只删除图谱，不删除卡片。`)) return;
    setSaveState('saving');
    try {
      await api<void>(`/api/knowledge-maps/${activeMap.id}`, { method: 'DELETE' });
      const remaining = maps.filter(({ id }) => id !== activeMap.id);
      setMaps(remaining);
      setActiveMapId(remaining[0]?.id);
      setSaveState('saved');
    } catch {
      setSaveState('error');
    }
  };

  const renameActiveMap = async () => {
    if (!activeMap) return;
    const name = renameName.trim();
    if (!name) {
      setRenameError('图谱名称不能为空');
      return;
    }
    if (name === activeMap.name) return;
    setSaveState('saving');
    setRenameError('');
    try {
      const renamed = await api<KnowledgeMapDetail>(`/api/knowledge-maps/${activeMap.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name }),
      });
      await refreshAfterMutation(renamed);
      setRenameName(renamed.map.name);
      setSaveState('saved');
    } catch (error) {
      setRenameError(mapNameErrorText(error));
      setSaveState('error');
    }
  };

  const createManualRelation = async (sourceNodeId: string, targetNodeId: string) => {
    if (!activeMapId || !editing || sourceNodeId === targetNodeId) return false;
    if (detail?.edges.some((edge) => (
      edge.sourceNodeId === sourceNodeId && edge.targetNodeId === targetNodeId
    ))) return false;
    const currentEdgeIds = new Set(detail?.edges.map(({ id }) => id) ?? []);
    const nextDetail = await runMutation(() => api<KnowledgeMapDetail>(`/api/knowledge-maps/${activeMapId}/edges`, {
      method: 'POST',
      body: JSON.stringify({
        sourceNodeId,
        targetNodeId,
        label: BRANCH_RELATION_LABEL,
      }),
    }));
    const createdEdge = nextDetail?.edges.find(({ id }) => !currentEdgeIds.has(id));
    if (createdEdge) pushUndo({ kind: 'delete-edge', mapId: activeMapId, edgeId: createdEdge.id });
    return Boolean(nextDetail);
  };

  const addNode = async (cardId: string, level = 1) => {
    if (!activeMapId || !editing || existingCardIds.has(cardId)) {
      const existingNode = detail?.nodes.find((node) => knowledgeNodeCardId(node) === cardId);
      if (existingNode) focusNode(existingNode);
      return false;
    }
    const nextDetail = await runMutation(() => api<KnowledgeMapDetail>(`/api/knowledge-maps/${activeMapId}/nodes`, {
      method: 'POST',
      body: JSON.stringify({ cardId, level: normalizeLevel(level), x: 0, y: 0, z: 0 }),
    }));
    const createdNode = nextDetail?.nodes.find((node) => knowledgeNodeCardId(node) === cardId);
    if (createdNode) {
      setSelectedNodeId(createdNode.id);
      pushUndo({ kind: 'delete-node', mapId: activeMapId, nodeId: createdNode.id });
    }
    return createdNode ?? false;
  };

  const addCustomNode = async ({ title, content, level }: CustomNodeDraft) => {
    if (!activeMapId || !editing) return false;
    const currentNodeIds = new Set(detail?.nodes.map(({ id }) => id) ?? []);
    const nextDetail = await runMutation(() => api<KnowledgeMapDetail>(`/api/knowledge-maps/${activeMapId}/nodes`, {
      method: 'POST',
      body: JSON.stringify({
        title,
        content,
        level: normalizeLevel(level),
        x: 0,
        y: 0,
        z: 0,
      }),
    }));
    const createdNode = nextDetail?.nodes.find((node) => !currentNodeIds.has(node.id))
      ?? nextDetail?.nodes.find((node) => knowledgeNodeTitle(node) === title);
    if (createdNode) {
      setSelectedNodeId(createdNode.id);
      pushUndo({ kind: 'delete-node', mapId: activeMapId, nodeId: createdNode.id });
    }
    return createdNode ?? false;
  };

  const addHorizontalNode = async (title: string, parentNodeId?: string) => {
    const parentNode = parentNodeId
      ? detail?.nodes.find(({ id }) => id === parentNodeId)
      : undefined;
    if (parentNodeId && !parentNode) return false;
    const createdNode = await addCustomNode({
      title,
      content: '',
      level: parentNode ? normalizeLevel(knowledgeNodeLevel(parentNode) + 1) : 1,
    });
    if (!createdNode) return false;
    if (!parentNode) return true;
    return createManualRelation(parentNode.id, createdNode.id);
  };

  const addHorizontalCard = async (cardId: string, parentNodeId: string) => {
    const parentNode = detail?.nodes.find(({ id }) => id === parentNodeId);
    if (!parentNode) return false;
    const createdNode = await addNode(cardId, knowledgeNodeLevel(parentNode) + 1);
    if (!createdNode) return false;
    return createManualRelation(parentNode.id, createdNode.id);
  };

  const deleteNode = async (nodeId: string) => {
    if (!activeMapId) return;
    const removedNode = detail?.nodes.find(({ id }) => id === nodeId);
    const removedEdges = detail?.edges.filter((edge) => edge.sourceNodeId === nodeId || edge.targetNodeId === nodeId) ?? [];
    const nextDetail = await runMutation(() => api<KnowledgeMapDetail>(`/api/knowledge-maps/${activeMapId}/nodes/${nodeId}`, {
      method: 'DELETE',
    }));
    if (nextDetail) {
      setSelectedNodeId(undefined);
      if (removedNode) pushUndo({ kind: 'restore-node', mapId: activeMapId, node: removedNode, edges: removedEdges });
    }
  };

  const deleteRelation = async (edgeId: string) => {
    if (!activeMapId) return;
    const removedEdge = detail?.edges.find(({ id }) => id === edgeId);
    const nextDetail = await runMutation(() => api<KnowledgeMapDetail>(`/api/knowledge-maps/${activeMapId}/edges/${edgeId}`, {
      method: 'DELETE',
    }));
    if (nextDetail && removedEdge) pushUndo({ kind: 'restore-edge', mapId: activeMapId, edge: removedEdge });
  };

  const handleNodeClick = (node: NodeObject<GraphNode>) => {
    if (node.placeholder) return;
    pauseAutoRotate();
    const graphNode = node as GraphNode;
    const now = Date.now();
    const memory = clickMemoryRef.current;
    setSelectedNodeId(graphNode.id);
    if (memory?.id === graphNode.id && now - memory.time < 320) {
      const source = detail?.nodes.find((item) => item.id === graphNode.id) ?? graphNode;
      focusNode(source);
    }
    clickMemoryRef.current = { id: graphNode.id, time: now };
  };

  const handleNodeHover = (node: NodeObject<GraphNode> | null) => {
    const graphNode = node as GraphNode | null;
    if (!graphNode || graphNode.placeholder) {
      setHoverNodeId(undefined);
      return;
    }
    pauseAutoRotate(1200);
    setHoverEdgeId(undefined);
    setHoverNodeId(graphNode.derived ? graphNode.parentId : graphNode.id);
  };

  const handleLinkHover = (link: LinkObject<GraphNode, GraphLink> | null) => {
    const graphLink = link as GraphLink | null;
    if (!graphLink || graphLink.placeholder) {
      setHoverEdgeId(undefined);
      return;
    }
    pauseAutoRotate(1200);
    setHoverNodeId(undefined);
    setHoverEdgeId(graphLink.id);
  };

  const focusNode = (node: { id: string; x?: number; y?: number; z?: number }) => {
    pauseAutoRotate(4200);
    const graphNode = graphData.nodes.find(({ id }) => id === node.id) as GraphNode | undefined;
    const position = graphNode
      ? {
          x: finiteNumber(graphNode.x) ?? 0,
          y: finiteNumber(graphNode.y) ?? 0,
          z: finiteNumber(graphNode.z) ?? 0,
        }
      : readSpherePosition(node, spherePoint(0, 1));
    const distance = Math.hypot(position.x, position.y, position.z);
    const direction = distance > 0.001
      ? { x: position.x / distance, y: position.y / distance, z: position.z / distance }
      : { x: 0, y: 0.15, z: 1 };
    autoRotateRef.current.angle = Math.atan2(position.z, position.x);
    graphRef.current?.cameraPosition(
      {
        x: position.x + direction.x * 210,
        y: position.y + direction.y * 210 + 32,
        z: position.z + direction.z * 210,
      },
      position,
      reducedMotion ? 0 : 700,
    );
  };

  const updateNodeDetails = (
    nodeId: string,
    input: NodePatch,
  ) => {
    if (!activeMapId) return;
    const currentNode = detail?.nodes.find(({ id }) => id === nodeId);
    if (currentNode) {
      let previous = nodeEditUndoSnapshotsRef.current.get(nodeId);
      if (!previous) {
        previous = {};
        nodeEditUndoSnapshotsRef.current.set(nodeId, previous);
        pushUndo({ kind: 'update-node', mapId: activeMapId, nodeId, previous });
      }
      if (input.title !== undefined && !Object.hasOwn(previous, 'title')) previous.title = currentNode.title;
      if (input.content !== undefined && !Object.hasOwn(previous, 'content')) previous.content = currentNode.content;
      if (input.level !== undefined && !Object.hasOwn(previous, 'level')) previous.level = currentNode.level;
    }
    setDetail((current) => current ? {
      ...current,
      nodes: current.nodes.map((node) => node.id === nodeId ? { ...node, ...input } : node),
    } : current);
    pendingNodeUpdatesRef.current.set(nodeId, {
      ...(pendingNodeUpdatesRef.current.get(nodeId) ?? {}),
      ...input,
    });
    const previousTimer = nodeUpdateTimersRef.current.get(nodeId);
    if (previousTimer !== undefined) window.clearTimeout(previousTimer);
    setSaveState('saving');
    const timeoutId = window.setTimeout(async () => {
      nodeUpdateTimersRef.current.delete(nodeId);
      const payload = pendingNodeUpdatesRef.current.get(nodeId);
      pendingNodeUpdatesRef.current.delete(nodeId);
      nodeEditUndoSnapshotsRef.current.delete(nodeId);
      if (!payload) return;
      try {
        const nextDetail = await api<KnowledgeMapDetail>(`/api/knowledge-maps/${activeMapId}/nodes/${nodeId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        await refreshAfterMutation(nextDetail);
        setSaveState('saved');
      } catch {
        setSaveState('error');
      }
    }, 180);
    nodeUpdateTimersRef.current.set(nodeId, timeoutId);
  };

  const performUndo = async () => {
    if (undoing) return;
    const action = undoStackRef.current.pop();
    if (!action || action.mapId !== activeMapId) return;
    setUndoCount(undoStackRef.current.length);
    setUndoing(true);
    setSaveState('saving');
    try {
      let nextDetail: KnowledgeMapDetail;
      if (action.kind === 'delete-node') {
        nextDetail = await api<KnowledgeMapDetail>(`/api/knowledge-maps/${action.mapId}/nodes/${action.nodeId}`, {
          method: 'DELETE',
        });
        setSelectedNodeId(undefined);
      } else if (action.kind === 'delete-edge') {
        nextDetail = await api<KnowledgeMapDetail>(`/api/knowledge-maps/${action.mapId}/edges/${action.edgeId}`, {
          method: 'DELETE',
        });
      } else if (action.kind === 'restore-edge') {
        nextDetail = await api<KnowledgeMapDetail>(`/api/knowledge-maps/${action.mapId}/edges`, {
          method: 'POST',
          body: JSON.stringify({
            sourceNodeId: action.edge.sourceNodeId,
            targetNodeId: action.edge.targetNodeId,
            label: action.edge.label,
          }),
        });
      } else if (action.kind === 'update-node') {
        const timer = nodeUpdateTimersRef.current.get(action.nodeId);
        if (timer !== undefined) window.clearTimeout(timer);
        nodeUpdateTimersRef.current.delete(action.nodeId);
        pendingNodeUpdatesRef.current.delete(action.nodeId);
        nodeEditUndoSnapshotsRef.current.delete(action.nodeId);
        nextDetail = await api<KnowledgeMapDetail>(`/api/knowledge-maps/${action.mapId}/nodes/${action.nodeId}`, {
          method: 'PATCH',
          body: JSON.stringify(action.previous),
        });
      } else {
        const currentNodeIds = new Set(detail?.nodes.map(({ id }) => id) ?? []);
        nextDetail = await api<KnowledgeMapDetail>(`/api/knowledge-maps/${action.mapId}/nodes`, {
          method: 'POST',
          body: JSON.stringify({
            ...(action.node.cardId ? { cardId: action.node.cardId } : {}),
            title: action.node.title,
            content: action.node.content,
            level: action.node.level,
            x: 0,
            y: 0,
            z: 0,
          }),
        });
        const restoredNode = nextDetail.nodes.find(({ id }) => !currentNodeIds.has(id));
        if (restoredNode) {
          for (const edge of action.edges) {
            nextDetail = await api<KnowledgeMapDetail>(`/api/knowledge-maps/${action.mapId}/edges`, {
              method: 'POST',
              body: JSON.stringify({
                sourceNodeId: edge.sourceNodeId === action.node.id ? restoredNode.id : edge.sourceNodeId,
                targetNodeId: edge.targetNodeId === action.node.id ? restoredNode.id : edge.targetNodeId,
                label: edge.label,
              }),
            });
          }
          setSelectedNodeId(restoredNode.id);
        }
      }
      await refreshAfterMutation(nextDetail);
      setSaveState('saved');
    } catch {
      undoStackRef.current.push(action);
      setUndoCount(undoStackRef.current.length);
      setSaveState('error');
    } finally {
      setUndoing(false);
    }
  };

  useEffect(() => {
    if (!editing) return undefined;
    const handleUndoShortcut = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.shiftKey || event.key.toLowerCase() !== 'z') return;
      const target = event.target;
      if (target instanceof HTMLElement && (
        target.isContentEditable || target.matches('input, textarea, select')
      )) return;
      event.preventDefault();
      void performUndo();
    };
    window.addEventListener('keydown', handleUndoShortcut);
    return () => window.removeEventListener('keydown', handleUndoShortcut);
  });

  const exportMarkdown = () => {
    if (!detail) return;
    const blob = new Blob([knowledgeMapToMarkdown(detail)], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${safeDownloadName(detail.map.name)}-知识图谱.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const saveStatusText = saveState === 'saving'
    ? '保存中'
    : saveState === 'saved'
      ? '已保存'
      : saveState === 'error'
        ? '保存失败'
        : '自动保存';

  return (
    <div className="graphs-page">
      <aside className="graphs-sidebar liquid-glass liquid-glass--regular" aria-label="图谱列表">
        <div className="graphs-sidebar__header">
          <span>知识图谱</span>
          <strong>{maps.length}</strong>
        </div>
        <div className="graphs-create">
          <input
            aria-label="新图谱名称"
            onChange={(event) => {
              setCreateName(event.target.value);
              setCreateError('');
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void createMap();
            }}
            placeholder="新建专题图谱"
            value={createName}
          />
          <button
            aria-label="添加图谱"
            className="button button--primary liquid-pressable"
            onClick={() => void createMap()}
            title="添加图谱"
            type="button"
          >
            <Plus aria-hidden="true" size={16} />
          </button>
          {createError ? <p className="graphs-create__error" role="alert">{createError}</p> : null}
        </div>
        {loadState === 'loading' ? <StatusNotice state="loading" message="正在加载图谱" /> : null}
        {loadState === 'error' ? <StatusNotice state="error" message="图谱加载失败" /> : null}
        {activeMap ? (
          <form
            className="graphs-rename"
            onSubmit={(event) => {
              event.preventDefault();
              void renameActiveMap();
            }}
          >
            <label>
              <span>当前图谱名称</span>
              <input
                aria-label="当前图谱名称"
                maxLength={40}
                onChange={(event) => {
                  setRenameName(event.target.value);
                  setRenameError('');
                }}
                value={renameName}
              />
            </label>
            <button
              className="button button--secondary liquid-pressable"
              disabled={!renameName.trim() || renameName.trim() === activeMap.name}
              type="submit"
            >
              <Pencil aria-hidden="true" size={15} />
              重命名
            </button>
            {renameError ? <p className="graphs-create__error" role="alert">{renameError}</p> : null}
          </form>
        ) : null}
        <div className="graphs-map-list">
          {maps.map((map) => (
            <button
              className={`graphs-map-item liquid-pressable${map.id === activeMapId ? ' is-active' : ''}`}
              key={map.id}
              onClick={() => setActiveMapId(map.id)}
              type="button"
            >
              <span>{map.name}</span>
              <small>{map.nodeCount} 点 / {map.edgeCount} 线</small>
            </button>
          ))}
        </div>
      </aside>

      <section className="graphs-stage liquid-glass liquid-glass--regular" aria-label="球状 3D 图谱">
        <header className="graphs-toolbar">
          <div>
            <span>{viewMode === 'horizontal' ? '横向编辑' : viewMode === 'radial' ? '2D 预览' : '3D 预览'}</span>
            <h1>{activeMap?.name ?? '球状知识图谱'}</h1>
          </div>
          <div className="graphs-toolbar__actions">
            <span className={`graphs-save graphs-save--${saveState}`} aria-live="polite">
              <Save aria-hidden="true" size={15} />
              {saveStatusText}
            </span>
            {activeMap && editing ? (
              <button
                aria-label="撤销上一步"
                className="button button--secondary liquid-pressable"
                disabled={undoCount === 0 || undoing}
                onClick={() => void performUndo()}
                title="撤销上一步（Ctrl+Z）"
                type="button"
              >
                <Undo2 aria-hidden="true" size={16} />
              </button>
            ) : null}
            {activeMap ? (
              <button
                aria-label="导出 Markdown"
                className="button button--secondary liquid-pressable"
                onClick={exportMarkdown}
                title="导出 2D 图谱为 Markdown"
                type="button"
              >
                <FileDown aria-hidden="true" size={16} />
                导出 Markdown
              </button>
            ) : null}
            {activeMap ? (
              <div aria-label="图谱模式" className="graphs-mode-switch" role="group">
                <button
                  aria-pressed={viewMode === 'horizontal'}
                  className={viewMode === 'horizontal' ? 'is-active' : ''}
                  onClick={() => setViewMode('horizontal')}
                  type="button"
                >
                  <ListTree aria-hidden="true" size={16} />
                  横向编辑
                </button>
                <button
                  aria-pressed={viewMode === 'radial'}
                  className={viewMode === 'radial' ? 'is-active' : ''}
                  onClick={() => setViewMode('radial')}
                  type="button"
                >
                  <Network aria-hidden="true" size={16} />
                  2D 预览
                </button>
                <button
                  aria-pressed={viewMode === 'preview'}
                  className={viewMode === 'preview' ? 'is-active' : ''}
                  onClick={() => setViewMode('preview')}
                  type="button"
                >
                  <Eye aria-hidden="true" size={16} />
                  3D 预览
                </button>
              </div>
            ) : null}
            {activeMap ? (
              <button
                aria-label="删除当前图谱"
                className="button button--secondary liquid-pressable"
                onClick={() => void deleteActiveMap()}
                type="button"
              >
                <Trash2 aria-hidden="true" size={16} />
              </button>
            ) : null}
          </div>
        </header>

        <div
          className={`graphs-canvas${viewMode === 'horizontal' ? ' is-editing is-horizontal' : viewMode === 'radial' ? ' is-preview is-plane' : ' is-preview'}`}
          onDragOver={(event) => {
            if (!editing) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = 'copy';
          }}
          onDrop={(event) => {
            if (!editing) return;
            event.preventDefault();
            const cardId = event.dataTransfer.getData(CARD_DRAG_TYPE);
            if (cardId) void addNode(cardId);
          }}
          onPointerDown={() => pauseAutoRotate()}
          onWheel={() => pauseAutoRotate()}
          ref={frameRef}
        >
          <div className="graphs-graph-status" aria-live="polite">
            <span>{graphStats.nodeCount} 个知识点</span>
            <span>{graphStats.edgeCount} 条分支</span>
            {hoverSummary ? <strong>{hoverSummary}</strong> : null}
          </div>
          {detailState === 'loading' && activeMapId ? (
            <div className="graphs-canvas__status">
              <LoaderCircle aria-hidden="true" className="is-spinning" size={20} />
              正在生成球状图谱
            </div>
          ) : null}
          {detailState === 'error' ? (
            <div className="graphs-canvas__status">图谱加载失败，请重新进入</div>
          ) : null}
          {!activeMapId ? (
            <div className="graphs-canvas__empty">
              <Network aria-hidden="true" size={42} />
              <strong>先创建一张专题图谱</strong>
              <span>创建后可在横向编辑器内输入知识点或搜索卡片。</span>
            </div>
          ) : viewMode === 'horizontal' && detailState === 'ready' && detail ? (
            <HorizontalGraphEditor
              detail={detail}
              existingCardIds={existingCardIds}
              frameSize={frameSize}
              graphHighlight={graphHighlight}
              onAddCard={addHorizontalCard}
              onCreateChild={(parentNodeId, title) => addHorizontalNode(title, parentNodeId)}
              onCreateRoot={(title) => addHorizontalNode(title)}
              onDeselect={() => {
                setSelectedNodeId(undefined);
              }}
              onNodeClick={(node) => handleNodeClick({
                id: node.id,
                name: knowledgeNodeTitle(node),
                cardId: knowledgeNodeCardId(node),
                category: knowledgeNodeCategory(node),
                color: levelColor(knowledgeNodeLevel(node)),
                linkCount: 0,
                archived: knowledgeNodeArchived(node),
                level: knowledgeNodeLevel(node),
                content: knowledgeNodeContent(node),
                card: knowledgeNodeCard(node),
              } as GraphNode)}
              selectedNodeId={selectedNodeId}
              query={query}
              searchResult={searchResult}
              searchState={searchState}
              setQuery={setQuery}
            />
          ) : viewMode === 'radial' && detailState === 'ready' && detail ? (
            <PlaneGraphEditor
              detail={detail}
              frameSize={frameSize}
              graphHighlight={graphHighlight}
              readOnly
              selectedNodeId={selectedNodeId}
              onEdgeHover={(edgeId) => {
                if (!edgeId) setHoverEdgeId(undefined);
                else {
                  pauseAutoRotate(1200);
                  setHoverNodeId(undefined);
                  setHoverEdgeId(edgeId);
                }
              }}
              onNodeClick={(node) => handleNodeClick({
                id: node.id,
                name: knowledgeNodeTitle(node),
                cardId: knowledgeNodeCardId(node),
                category: knowledgeNodeCategory(node),
                color: levelColor(knowledgeNodeLevel(node)),
                linkCount: 0,
                archived: knowledgeNodeArchived(node),
                level: knowledgeNodeLevel(node),
                content: knowledgeNodeContent(node),
                card: knowledgeNodeCard(node),
              } as GraphNode)}
              onNodeDoubleClick={(node) => {
                setSelectedNodeId(node.id);
              }}
              onCreateRelation={(sourceNodeId, targetNodeId) => {
                void createManualRelation(sourceNodeId, targetNodeId);
              }}
              onDeselect={() => {
                setSelectedNodeId(undefined);
              }}
              onNodeHover={(nodeId) => {
                if (!nodeId) setHoverNodeId(undefined);
                else {
                  pauseAutoRotate(1200);
                  setHoverEdgeId(undefined);
                  setHoverNodeId(nodeId);
                }
              }}
            />
          ) : (
            <ForceGraph3D
              backgroundColor="rgba(0,0,0,0)"
              cooldownTicks={0}
              enableNodeDrag={false}
              graphData={graphData}
              height={frameSize.height}
              linkColor={(link) => previewLinkColor(link as GraphLink, graphHighlight)}
              linkDirectionalArrowLength={0}
              linkLabel={(link) => linkTooltip(link as GraphLink)}
              linkOpacity={0.72}
              linkWidth={(link) => previewLinkWidth(link as GraphLink, graphHighlight)}
              nodeColor={(node) => visualNodeColor(
                node as GraphNode,
                graphHighlight,
              )}
              nodeLabel={(node) => (node as GraphNode).name}
              nodeOpacity={0.96}
              nodeRelSize={7.2}
              nodeThreeObject={(node: GraphNode) => createGraphNodeSummarySprite(
                node,
                cameraDistance,
                showPreviewLabels,
                graphHighlight.nodeIds.has(node.id),
                frameSize.width < 520,
              )}
              nodeThreeObjectExtend={(node: GraphNode) => !node.placeholder}
              nodeVal={(node) => visualNodeValue(node as GraphNode, graphHighlight)}
              onBackgroundClick={() => {
                pauseAutoRotate();
                setHoverNodeId(undefined);
                setHoverEdgeId(undefined);
                setSelectedNodeId(undefined);
              }}
              onLinkHover={handleLinkHover}
              onNodeClick={handleNodeClick}
              onNodeHover={handleNodeHover}
              ref={graphRef}
              showNavInfo={false}
              width={frameSize.width}
            />
          )}
          {viewMode === 'preview' && activeMapId && detailState === 'ready' ? (
            <>
              <div aria-label="3D 图谱控制" className="graphs-preview-controls" role="group">
                <button aria-label="放大图谱" onClick={() => zoomGraph(0.78)} title="放大图谱" type="button">
                  <ZoomIn aria-hidden="true" size={17} />
                </button>
                <button aria-label="缩小图谱" onClick={() => zoomGraph(1.28)} title="缩小图谱" type="button">
                  <ZoomOut aria-hidden="true" size={17} />
                </button>
                <button aria-label="适配视图" onClick={() => centerGraph()} title="适配视图" type="button">
                  <Maximize2 aria-hidden="true" size={16} />
                </button>
                <button
                  aria-label={autoRotateEnabled ? '关闭自动旋转' : '开启自动旋转'}
                  aria-pressed={autoRotateEnabled}
                  onClick={() => {
                    syncAutoRotateOrbit();
                    setAutoRotateEnabled((current) => !current);
                  }}
                  title={autoRotateEnabled ? '关闭自动旋转' : '开启自动旋转'}
                  type="button"
                >
                  {autoRotateEnabled ? <Pause aria-hidden="true" size={16} /> : <Play aria-hidden="true" size={16} />}
                </button>
                <button
                  aria-label={showPreviewLabels ? '关闭文字摘要' : '开启文字摘要'}
                  aria-pressed={showPreviewLabels}
                  onClick={() => setShowPreviewLabels((current) => !current)}
                  title={showPreviewLabels ? '关闭文字摘要' : '开启文字摘要'}
                  type="button"
                >
                  <Captions aria-hidden="true" size={16} />
                </button>
                <button
                  aria-label={showDerivedNodes ? '关闭 AI 衍生球体' : '开启 AI 衍生球体'}
                  aria-pressed={showDerivedNodes}
                  onClick={() => setShowDerivedNodes((current) => !current)}
                  title={showDerivedNodes ? '关闭 AI 衍生球体' : '开启 AI 衍生球体'}
                  type="button"
                >
                  <Sparkles aria-hidden="true" size={16} />
                </button>
              </div>
              <div className="graphs-preview-legend" aria-label="节点图例">
                <span><i style={{ background: CARD_NODE_COLOR }} />卡片知识点</span>
                <span><i style={{ background: AI_NODE_COLOR }} />AI 优化稿</span>
                <span><i style={{ background: CUSTOM_NODE_COLOR }} />自定义知识点</span>
              </div>
            </>
          ) : null}
        </div>
      </section>

      {selectedGraphNode || selectedMapNode ? (
        <aside aria-label="节点详情" className="graphs-detail-sheet liquid-glass liquid-glass--regular">
          <button
            aria-label="关闭节点详情"
            className="graphs-detail-sheet__close liquid-pressable"
            onClick={() => setSelectedNodeId(undefined)}
            title="关闭"
            type="button"
          >
            <X aria-hidden="true" size={18} />
          </button>
          <DetailPanel
            editing={editing}
            node={selectedGraphNode?.derived ? selectedGraphNode : selectedMapNode}
            onDelete={editing && selectedMapNode ? () => void deleteNode(selectedMapNode.id) : undefined}
            onDeleteRelation={editing && selectedMapNode ? (edgeId) => void deleteRelation(edgeId) : undefined}
            onFocus={viewMode === 'preview' && selectedGraphNode ? () => focusNode(selectedGraphNode) : undefined}
            onUpdate={editing && selectedMapNode ? (input) => void updateNodeDetails(selectedMapNode.id, input) : undefined}
            relations={selectedRelations}
          />
        </aside>
      ) : null}
    </div>
  );
}

function HorizontalGraphEditor({
  detail,
  existingCardIds,
  frameSize,
  graphHighlight,
  onAddCard,
  onCreateChild,
  onCreateRoot,
  onDeselect,
  onNodeClick,
  query,
  searchResult,
  searchState,
  selectedNodeId,
  setQuery,
}: {
  detail: KnowledgeMapDetail;
  existingCardIds: Set<string>;
  frameSize: { width: number; height: number };
  graphHighlight: GraphHighlight;
  onAddCard: (cardId: string, parentNodeId: string) => Promise<boolean>;
  onCreateChild: (parentNodeId: string, title: string) => Promise<boolean>;
  onCreateRoot: (title: string) => Promise<boolean>;
  onDeselect: () => void;
  onNodeClick: (node: CompatibleKnowledgeMapNode) => void;
  query: string;
  searchResult: CardDetail[];
  searchState: LoadState;
  selectedNodeId: string | undefined;
  setQuery: (query: string) => void;
}) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const zoomRef = useRef(1);
  const centeredMapRef = useRef('');
  const panRef = useRef<{
    pointerId: number;
    clientX: number;
    clientY: number;
    scrollLeft: number;
    scrollTop: number;
  }>();
  const [rootTitle, setRootTitle] = useState('');
  const [rootError, setRootError] = useState('');
  const [childParentId, setChildParentId] = useState<string>();
  const [childTitle, setChildTitle] = useState('');
  const [childError, setChildError] = useState('');
  const [hoverPreview, setHoverPreview] = useState<{
    node: CompatibleKnowledgeMapNode;
    left: number;
    top: number;
  }>();
  const [isPanning, setIsPanning] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [zoom, setZoom] = useState(1);
  const worldSize = useMemo(
    () => getHorizontalMindMapWorldSize(detail, frameSize),
    [detail, frameSize.height, frameSize.width],
  );
  const points = useMemo(
    () => buildHorizontalMindMapPoints(detail, worldSize),
    [detail, worldSize.height, worldSize.width],
  );
  const nodesById = useMemo(
    () => new Map(detail.nodes.map((node) => [node.id, node])),
    [detail.nodes],
  );
  const composerPoint = childParentId ? points.get(childParentId) : undefined;

  useEffect(() => {
    const viewport = viewportRef.current;
    const centerSignature = `${detail.map.id}:${frameSize.width}:${frameSize.height}:${zoom}`;
    if (!viewport || detail.nodes.length === 0 || centeredMapRef.current === centerSignature) return;
    const targetNode = detail.nodes.find((node) => (
      !detail.edges.some((edge) => edge.targetNodeId === node.id)
    )) ?? detail.nodes[0];
    const target = points.get(targetNode.id);
    if (!target) return;
    centeredMapRef.current = centerSignature;
    window.requestAnimationFrame(() => {
      viewport.scrollLeft = Math.max(0, (target.left * zoom) - Math.round(viewport.clientWidth * 0.24));
      viewport.scrollTop = Math.max(0, (target.top * zoom) - Math.round(viewport.clientHeight / 2));
    });
  }, [detail, frameSize.height, frameSize.width, points, zoom]);

  const canStartPan = (target: EventTarget | null) => {
    const element = target instanceof Element ? target : null;
    return !element?.closest('button, input, form, .graphs-horizontal-card-search, .graphs-node-preview');
  };

  const startPan = (clientX: number, clientY: number, pointerId = -1) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    panRef.current = {
      pointerId,
      clientX,
      clientY,
      scrollLeft: viewport.scrollLeft,
      scrollTop: viewport.scrollTop,
    };
    setIsPanning(true);
  };

  const updatePan = (clientX: number, clientY: number, pointerId = -1) => {
    const viewport = viewportRef.current;
    const current = panRef.current;
    if (!viewport || !current || !isSamePointer(current.pointerId, pointerId)) return;
    viewport.scrollLeft = current.scrollLeft - (clientX - current.clientX);
    viewport.scrollTop = current.scrollTop - (clientY - current.clientY);
  };

  const finishPan = (pointerId = -1) => {
    const current = panRef.current;
    if (!current || !isSamePointer(current.pointerId, pointerId)) return;
    panRef.current = undefined;
    setIsPanning(false);
  };

  const zoomFromWheel = useCallback((deltaY: number, clientX: number, clientY: number) => {
    const viewport = viewportRef.current;
    if (!viewport || deltaY === 0) return;
    const current = zoomRef.current;
    const next = clampMindMapZoom(current + (deltaY < 0 ? MIND_MAP_ZOOM_STEP : -MIND_MAP_ZOOM_STEP));
    if (next === current) return;
    const rect = viewport.getBoundingClientRect();
    const anchorX = clientX - rect.left;
    const anchorY = clientY - rect.top;
    const worldX = (viewport.scrollLeft + anchorX) / current;
    const worldY = (viewport.scrollTop + anchorY) / current;
    zoomRef.current = next;
    setZoom(next);
    window.requestAnimationFrame(() => {
      viewport.scrollLeft = Math.max(0, (worldX * next) - anchorX);
      viewport.scrollTop = Math.max(0, (worldY * next) - anchorY);
    });
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;
    const handleWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      zoomFromWheel(event.deltaY, event.clientX, event.clientY);
    };
    viewport.addEventListener('wheel', handleWheel, { passive: false });
    return () => viewport.removeEventListener('wheel', handleWheel);
  }, [zoomFromWheel]);

  const createRoot = async () => {
    const title = rootTitle.trim();
    if (!title || submitting) return;
    setSubmitting(true);
    setRootError('');
    const created = await onCreateRoot(title);
    setSubmitting(false);
    if (!created) {
      setRootError('中心主题创建失败');
      return;
    }
    setRootTitle('');
  };

  const createChild = async () => {
    const title = childTitle.trim();
    if (!title || !childParentId || submitting) return;
    setSubmitting(true);
    setChildError('');
    const created = await onCreateChild(childParentId, title);
    setSubmitting(false);
    if (!created) {
      setChildError('子节点创建失败');
      return;
    }
    setChildTitle('');
  };

  const addCardChild = async (cardId: string) => {
    if (!childParentId || submitting) return;
    setSubmitting(true);
    setChildError('');
    const created = await onAddCard(cardId, childParentId);
    setSubmitting(false);
    if (!created) setChildError('卡片添加失败');
  };

  return (
    <section
      aria-label="横向思维导图录入"
      className={`graphs-horizontal${isPanning ? ' is-panning' : ''}`}
      onClick={(event) => {
        if (event.target instanceof Element && event.target.closest('button, input, form')) return;
        onDeselect();
      }}
      role="img"
    >
      <form
        className="graphs-horizontal__tools graphs-horizontal__root-form"
        onSubmit={(event) => {
          event.preventDefault();
          void createRoot();
        }}
      >
          <input
            aria-label="中心主题"
            maxLength={60}
            onChange={(event) => {
              setRootTitle(event.target.value);
              setRootError('');
            }}
            placeholder="输入中心主题"
            value={rootTitle}
          />
          <button
            aria-label="创建中心主题"
            className="button button--primary liquid-pressable"
            disabled={!rootTitle.trim() || submitting}
            title="创建中心主题"
            type="submit"
          >
            <Plus aria-hidden="true" size={16} />
          </button>
          {rootError ? <small role="alert">{rootError}</small> : null}
      </form>
      <div
        className={`graphs-horizontal__viewport${isPanning ? ' is-panning' : ''}`}
        data-zoom={formatMindMapZoom(zoom)}
        onMouseDown={(event) => {
          if (supportsPointerEvents() || event.button !== 0 || !canStartPan(event.target)) return;
          event.preventDefault();
          startPan(event.clientX, event.clientY);
        }}
        onMouseLeave={() => {
          setHoverPreview(undefined);
          if (!supportsPointerEvents()) finishPan();
        }}
        onMouseMove={(event) => {
          if (!supportsPointerEvents()) updatePan(event.clientX, event.clientY);
        }}
        onMouseUp={() => {
          if (!supportsPointerEvents()) finishPan();
        }}
        onPointerCancel={(event) => finishPan(readPointerId(event.pointerId))}
        onPointerDown={(event) => {
          if (event.button !== 0 || !canStartPan(event.target)) return;
          const pointerId = readPointerId(event.pointerId);
          if (pointerId >= 0) event.currentTarget.setPointerCapture?.(pointerId);
          event.preventDefault();
          startPan(event.clientX, event.clientY, pointerId);
        }}
        onPointerMove={(event) => updatePan(event.clientX, event.clientY, readPointerId(event.pointerId))}
        onPointerUp={(event) => {
          const pointerId = readPointerId(event.pointerId);
          finishPan(pointerId);
          if (pointerId >= 0) event.currentTarget.releasePointerCapture?.(pointerId);
        }}
        ref={viewportRef}
      >
        <div
          className="graphs-horizontal__world-frame"
          style={{ height: `${worldSize.height * zoom}px`, width: `${worldSize.width * zoom}px` }}
        >
        <div
          className="graphs-horizontal__world"
          style={{
            height: `${worldSize.height}px`,
            transform: `scale(${zoom})`,
            transformOrigin: '0 0',
            width: `${worldSize.width}px`,
          }}
        >
          <svg
            aria-hidden="true"
            className="graphs-horizontal__links"
            height={worldSize.height}
            width={worldSize.width}
          >
            {detail.edges.map((edge) => {
              const source = points.get(edge.sourceNodeId);
              const target = points.get(edge.targetNodeId);
              if (!source || !target) return null;
              return (
                <path
                  className={graphHighlight.edgeIds.has(edge.id) ? 'is-highlighted' : ''}
                  d={horizontalMindMapLinkPath(source, target)}
                  fill="none"
                  key={edge.id}
                />
              );
            })}
          </svg>
          {detail.nodes.map((node) => {
            const point = points.get(node.id);
            if (!point) return null;
            const level = knowledgeNodeLevel(node);
            const title = knowledgeNodeTitle(node);
            return (
              <div
                className={`graphs-horizontal-node${selectedNodeId === node.id ? ' is-active' : ''}${graphHighlight.nodeIds.has(node.id) ? ' is-highlighted' : ''}`}
                data-level={level}
                key={node.id}
                style={{
                  '--node-color': graphNodeColor(node),
                  left: `${point.left}px`,
                  top: `${point.top}px`,
                } as CSSProperties}
              >
                <button
                  aria-label={`节点 ${title}`}
                  className="graphs-horizontal-node__body"
                  data-level={level}
                  data-node-id={node.id}
                  onClick={() => onNodeClick(node)}
                  onDoubleClick={() => onNodeClick(node)}
                  onMouseEnter={(event) => setHoverPreview({
                    node,
                    left: event.clientX,
                    top: event.clientY,
                  })}
                  onMouseLeave={() => setHoverPreview(undefined)}
                  onMouseMove={(event) => setHoverPreview({
                    node,
                    left: event.clientX,
                    top: event.clientY,
                  })}
                  type="button"
                >
                  <span>{compactTitle(title)}</span>
                </button>
                <button
                  aria-label={`为“${title}”添加子节点`}
                  className="graphs-horizontal-node__add liquid-pressable"
                  disabled={level >= MIND_MAP_MAX_LEVEL}
                  onClick={() => {
                    setChildParentId(node.id);
                    setChildTitle('');
                    setChildError('');
                    setSearchOpen(false);
                  }}
                  title={level >= MIND_MAP_MAX_LEVEL ? '已到第6层' : '添加子节点'}
                  type="button"
                >
                  <Plus aria-hidden="true" size={15} />
                </button>
              </div>
            );
          })}
          {childParentId && composerPoint && nodesById.has(childParentId) ? (
            <form
              aria-label={`为“${knowledgeNodeTitle(nodesById.get(childParentId)!)}”添加子节点`}
              className="graphs-horizontal-composer"
              onSubmit={(event) => {
                event.preventDefault();
                void createChild();
              }}
              style={{ left: `${composerPoint.left + 224}px`, top: `${composerPoint.top + 54}px` }}
            >
              <input
                aria-label="新子节点标题"
                autoFocus
                maxLength={60}
                onChange={(event) => {
                  setChildTitle(event.target.value);
                  setChildError('');
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'Escape') return;
                  setChildParentId(undefined);
                  setChildTitle('');
                  setChildError('');
                }}
                placeholder="输入子节点"
                value={childTitle}
              />
              <div className="graphs-horizontal-composer__actions">
                <button
                  aria-expanded={searchOpen}
                  aria-label="搜索卡片"
                  className="button button--secondary liquid-pressable"
                  onClick={() => setSearchOpen((current) => !current)}
                  type="button"
                >
                  <Search aria-hidden="true" size={15} />
                  搜索卡片
                </button>
                <button
                  aria-label="保存子节点"
                  className="button button--primary liquid-pressable"
                  disabled={!childTitle.trim() || submitting}
                  title="保存子节点"
                  type="submit"
                >
                  <Plus aria-hidden="true" size={15} />
                </button>
                <button
                  aria-label="取消添加子节点"
                  className="button button--secondary liquid-pressable"
                  onClick={() => {
                    setChildParentId(undefined);
                    setChildTitle('');
                    setChildError('');
                    setSearchOpen(false);
                  }}
                  title="取消"
                  type="button"
                >
                  <X aria-hidden="true" size={15} />
                </button>
              </div>
              {searchOpen ? (
                <section className="graphs-horizontal-composer__search graphs-horizontal-card-search">
                  <label className="graphs-search">
                    <Search aria-hidden="true" size={17} />
                    <input
                      aria-label="搜索卡片库内容"
                      autoFocus
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="搜索用户初始稿"
                      type="search"
                      value={query}
                    />
                  </label>
                  {searchState === 'loading' ? <StatusNotice state="loading" message="正在搜索卡片" /> : null}
                  {searchState === 'error' ? <StatusNotice state="error" message="卡片搜索失败" /> : null}
                  <div
                    aria-label="用户初始稿搜索结果"
                    className="graphs-horizontal-card-search__results"
                    role="list"
                  >
                    {searchResult.map((card) => {
                      const exists = existingCardIds.has(card.id);
                      const rawInput = cardRawInput(card);
                      return (
                        <article className={exists ? 'is-added' : ''} key={card.id} role="listitem">
                          <span>{primaryCategory(card)}</span>
                          <p>{rawInput.replace(/\s+/g, ' ')}</p>
                          <button
                            aria-label={`添加卡片：${rawInput}`}
                            className="button button--secondary liquid-pressable"
                            disabled={exists || submitting}
                            onClick={() => void addCardChild(card.id)}
                            type="button"
                          >
                            <Plus aria-hidden="true" size={15} />
                            {exists ? '已添加' : '添加'}
                          </button>
                        </article>
                      );
                    })}
                  </div>
                </section>
              ) : null}
              {childError ? <small role="alert">{childError}</small> : null}
            </form>
          ) : null}
        </div>
        </div>
      </div>
      {hoverPreview ? (
        <GraphNodeHoverPreview
          left={hoverPreview.left}
          node={hoverPreview.node}
          top={hoverPreview.top}
        />
      ) : null}
    </section>
  );
}

function GraphNodeHoverPreview({
  left,
  node,
  top,
}: {
  left: number;
  node: CompatibleKnowledgeMapNode;
  top: number;
}) {
  const card = knowledgeNodeCard(node);
  const content = knowledgeNodeContent(node);
  const viewportWidth = typeof window === 'undefined' ? 1024 : window.innerWidth;
  const viewportHeight = typeof window === 'undefined' ? 768 : window.innerHeight;
  const previewWidth = Math.min(380, Math.max(0, viewportWidth - 32));
  const previewHeight = Math.min(360, Math.max(0, viewportHeight - 36));
  const previewLeft = Math.min(
    Math.max(16, left + 18),
    Math.max(16, viewportWidth - previewWidth - 16),
  );
  const preferredTop = Math.max(16, top + 18);
  const previewTop = preferredTop + previewHeight + 16 <= viewportHeight
    ? preferredTop
    : Math.max(16, top - previewHeight - 18);
  const preview = (
    <aside
      aria-label="节点卡片预览"
      className="graphs-node-preview liquid-glass liquid-glass--regular"
      role="tooltip"
      style={{
        left: `${previewLeft}px`,
        top: `${previewTop}px`,
      }}
    >
      <span>{knowledgeNodeCategory(node)}</span>
      <strong>{card ? '用户初始稿' : knowledgeNodeTitle(node)}</strong>
      {card ? (
        <RichTextPreview contentJson={card.rawContentJson} fallback={card.rawInput || content || '未填写内容'} />
      ) : (
        <p>{content || '未填写正文'}</p>
      )}
    </aside>
  );
  return typeof document === 'undefined' ? preview : createPortal(preview, document.body);
}

function PlaneGraphEditor({
  detail,
  frameSize,
  graphHighlight,
  readOnly = false,
  selectedNodeId,
  onCreateRelation,
  onDeselect,
  onEdgeHover,
  onNodeClick,
  onNodeDoubleClick,
  onNodeHover,
}: {
  detail: KnowledgeMapDetail;
  frameSize: { width: number; height: number };
  graphHighlight: GraphHighlight;
  readOnly?: boolean;
  selectedNodeId: string | undefined;
  onCreateRelation: (sourceNodeId: string, targetNodeId: string) => void;
  onDeselect: () => void;
  onEdgeHover: (edgeId: string | undefined) => void;
  onNodeClick: (node: CompatibleKnowledgeMapNode) => void;
  onNodeDoubleClick: (node: CompatibleKnowledgeMapNode) => void;
  onNodeHover: (nodeId: string | undefined) => void;
}) {
  const planeRef = useRef<HTMLDivElement | null>(null);
  const zoomRef = useRef(1);
  const lastCenteredSignatureRef = useRef('');
  const linkHoldTimerRef = useRef<number>();
  const linkGestureConsumedRef = useRef(false);
  type LinkGestureState = {
    sourceNodeId: string;
    pointerId: number;
    active: boolean;
    point: PlanePoint;
  };
  type PanState = {
    pointerId: number;
    clientX: number;
    clientY: number;
    scrollLeft: number;
    scrollTop: number;
  };
  const linkGestureRef = useRef<LinkGestureState>();
  const panRef = useRef<PanState>();
  const [linkGesture, setLinkGesture] = useState<LinkGestureState>();
  const [hoverPreview, setHoverPreview] = useState<{
    node: CompatibleKnowledgeMapNode;
    left: number;
    top: number;
  }>();
  const [isPanning, setIsPanning] = useState(false);
  const [layoutRevision, setLayoutRevision] = useState(0);
  const [zoom, setZoom] = useState(1);
  const worldSize = useMemo(() => getMindMapWorldSize(detail, frameSize), [detail, frameSize.height, frameSize.width]);
  const plane = getPlaneGeometry(worldSize.width, worldSize.height);
  const linkCounts = useMemo(() => getLinkCounts(detail), [detail]);
  const nodesById = useMemo(() => {
    const next = new Map<string, CompatibleKnowledgeMapNode>();
    for (const node of detail.nodes) next.set(node.id, node);
    return next;
  }, [detail.nodes]);
  const points = useMemo(() => {
    return buildMindMapTreePoints(detail, plane, layoutRevision);
  }, [detail, layoutRevision, plane.centerX, plane.centerY, plane.ringGap, plane.maxX, plane.maxY, plane.minX, plane.minY]);

  useEffect(() => {
    const planeElement = planeRef.current;
    if (!planeElement || detail.nodes.length === 0) return;
    const signature = [
      detail.map.id,
      detail.nodes.map((node) => `${node.id}:${knowledgeNodeLevel(node)}`).join(','),
      detail.edges.map((edge) => `${edge.sourceNodeId}>${edge.targetNodeId}`).join(','),
      layoutRevision,
      worldSize.width,
      worldSize.height,
    ].join(':');
    if (lastCenteredSignatureRef.current === signature) return;
    lastCenteredSignatureRef.current = signature;
    const nextLeft = Math.max(0, plane.centerX - (planeElement.clientWidth / 2));
    const nextTop = Math.max(0, plane.centerY - (planeElement.clientHeight / 2));
    window.requestAnimationFrame(() => {
      planeElement.scrollLeft = nextLeft;
      planeElement.scrollTop = nextTop;
    });
  }, [detail, layoutRevision, plane.centerX, plane.centerY, worldSize.height, worldSize.width]);

  useEffect(() => {
    const cancelLinkGesture = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (linkHoldTimerRef.current !== undefined) window.clearTimeout(linkHoldTimerRef.current);
      linkHoldTimerRef.current = undefined;
      linkGestureRef.current = undefined;
      setLinkGesture(undefined);
    };
    window.addEventListener('keydown', cancelLinkGesture);
    return () => {
      window.removeEventListener('keydown', cancelLinkGesture);
      if (linkHoldTimerRef.current !== undefined) window.clearTimeout(linkHoldTimerRef.current);
    };
  }, []);

  const pointFor = (nodeId: string) => points.get(nodeId);

  const setLinkGestureState = (next: LinkGestureState | undefined) => {
    linkGestureRef.current = next;
    setLinkGesture(next);
  };

  const startLinkGesture = (nodeId: string, clientX: number, clientY: number, pointerId = -1) => {
    if (readOnly) return;
    if (linkHoldTimerRef.current !== undefined) window.clearTimeout(linkHoldTimerRef.current);
    const initial: LinkGestureState = {
      sourceNodeId: nodeId,
      pointerId,
      active: false,
      point: clientPointToPlane(clientX, clientY, planeRef.current, plane, zoomRef.current),
    };
    linkGestureConsumedRef.current = false;
    setLinkGestureState(initial);
    linkHoldTimerRef.current = window.setTimeout(() => {
      const current = linkGestureRef.current;
      if (!current || current.sourceNodeId !== nodeId || !isSamePointer(current.pointerId, pointerId)) return;
      linkGestureConsumedRef.current = true;
      setLinkGestureState({ ...current, active: true });
    }, NODE_LINK_HOLD_MS);
  };

  const updateLinkGesture = (clientX: number, clientY: number, pointerId = -1) => {
    const current = linkGestureRef.current;
    if (!current || !isSamePointer(current.pointerId, pointerId)) return;
    const point = clientPointToPlane(clientX, clientY, planeRef.current, plane, zoomRef.current);
    setLinkGestureState({ ...current, point });
  };

  const finishLinkGesture = (targetNodeId?: string, pointerId = -1) => {
    if (linkHoldTimerRef.current !== undefined) window.clearTimeout(linkHoldTimerRef.current);
    linkHoldTimerRef.current = undefined;
    const current = linkGestureRef.current;
    if (!current || !isSamePointer(current.pointerId, pointerId)) return;
    setLinkGestureState(undefined);
    if (!readOnly && current.active && targetNodeId && targetNodeId !== current.sourceNodeId) {
      onCreateRelation(current.sourceNodeId, targetNodeId);
    }
  };

  const canStartPan = (target: EventTarget | null) => {
    const element = target instanceof Element ? target : null;
    return !element?.closest('.graphs-plane-node, .graphs-plane-link-label, .graphs-plane__tools');
  };

  const startPan = (clientX: number, clientY: number, pointerId = -1) => {
    const planeElement = planeRef.current;
    if (!planeElement) return;
    panRef.current = {
      pointerId,
      clientX,
      clientY,
      scrollLeft: planeElement.scrollLeft,
      scrollTop: planeElement.scrollTop,
    };
    setIsPanning(true);
  };

  const updatePan = (clientX: number, clientY: number, pointerId = -1) => {
    const current = panRef.current;
    const planeElement = planeRef.current;
    if (!current || !planeElement || !isSamePointer(current.pointerId, pointerId)) return;
    planeElement.scrollLeft = current.scrollLeft - (clientX - current.clientX);
    planeElement.scrollTop = current.scrollTop - (clientY - current.clientY);
  };

  const finishPan = (pointerId = -1) => {
    const current = panRef.current;
    if (!current || !isSamePointer(current.pointerId, pointerId)) return;
    panRef.current = undefined;
    setIsPanning(false);
  };

  const zoomFromWheel = useCallback((deltaY: number, clientX: number, clientY: number) => {
    const planeElement = planeRef.current;
    if (!planeElement || deltaY === 0) return;
    const current = zoomRef.current;
    const direction = deltaY < 0 ? 1 : -1;
    const next = clampMindMapZoom(current + (direction * MIND_MAP_ZOOM_STEP));
    if (next === current) return;
    const rect = planeElement.getBoundingClientRect();
    const anchorX = clientX - rect.left;
    const anchorY = clientY - rect.top;
    const worldX = (planeElement.scrollLeft + anchorX) / current;
    const worldY = (planeElement.scrollTop + anchorY) / current;
    zoomRef.current = next;
    setZoom(next);
    window.requestAnimationFrame(() => {
      planeElement.scrollLeft = Math.max(0, (worldX * next) - anchorX);
      planeElement.scrollTop = Math.max(0, (worldY * next) - anchorY);
    });
  }, []);

  useEffect(() => {
    const planeElement = planeRef.current;
    if (!planeElement) return undefined;
    const handleWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      zoomFromWheel(event.deltaY, event.clientX, event.clientY);
    };
    planeElement.addEventListener('wheel', handleWheel, { passive: false });
    return () => planeElement.removeEventListener('wheel', handleWheel);
  }, [zoomFromWheel]);

  const nodeIdAtClientPoint = (clientX: number, clientY: number) => {
    const directTarget = typeof document.elementFromPoint === 'function'
      ? document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>('[data-node-id]')
      : null;
    if (directTarget?.dataset.nodeId) return directTarget.dataset.nodeId;
    for (const element of document.querySelectorAll<HTMLElement>('.graphs-plane-node[data-node-id]')) {
      const rect = element.getBoundingClientRect();
      if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
        return element.dataset.nodeId;
      }
    }
    return undefined;
  };

  return (
    <div
      aria-label={readOnly ? '2D 圈层预览' : '2D 树形思维导图编辑平面'}
      className={`graphs-plane graphs-plane--white${isPanning ? ' is-panning' : ''}`}
      data-zoom={formatMindMapZoom(zoom)}
      onClick={(event) => {
        if (event.target instanceof Element && event.target.closest('.graphs-plane-node, .graphs-plane__tools')) return;
        onDeselect();
      }}
      onMouseDown={(event) => {
        if (supportsPointerEvents() || event.button !== 0 || !canStartPan(event.target)) return;
        event.preventDefault();
        startPan(event.clientX, event.clientY);
      }}
      onMouseLeave={() => {
        setHoverPreview(undefined);
        if (supportsPointerEvents()) return;
        finishPan();
      }}
      onMouseMove={(event) => {
        if (supportsPointerEvents()) return;
        updateLinkGesture(event.clientX, event.clientY);
        updatePan(event.clientX, event.clientY);
      }}
      onMouseUp={() => {
        if (supportsPointerEvents()) return;
        finishLinkGesture();
        finishPan();
      }}
      onPointerCancel={(event) => {
        finishLinkGesture(undefined, readPointerId(event.pointerId));
        finishPan(readPointerId(event.pointerId));
      }}
      onPointerDown={(event) => {
        if (event.button !== 0 || !canStartPan(event.target)) return;
        const pointerId = readPointerId(event.pointerId);
        if (pointerId >= 0) event.currentTarget.setPointerCapture?.(pointerId);
        event.preventDefault();
        startPan(event.clientX, event.clientY, pointerId);
      }}
      onPointerMove={(event) => {
        updateLinkGesture(event.clientX, event.clientY, readPointerId(event.pointerId));
        updatePan(event.clientX, event.clientY, readPointerId(event.pointerId));
      }}
      onPointerUp={(event) => {
        const pointerId = readPointerId(event.pointerId);
        finishLinkGesture(nodeIdAtClientPoint(event.clientX, event.clientY), pointerId);
        finishPan(pointerId);
        if (pointerId >= 0) event.currentTarget.releasePointerCapture?.(pointerId);
      }}
      ref={planeRef}
      role="img"
    >
      <div className="graphs-plane__tools">
        <button
          aria-label="重新排布"
          className="button button--secondary liquid-pressable"
          onClick={() => {
            lastCenteredSignatureRef.current = '';
            setLayoutRevision((current) => current + 1);
          }}
          type="button"
        >
          <RefreshCw aria-hidden="true" size={15} />
          重新排布
        </button>
      </div>
      <div
        className="graphs-plane__world"
        style={{
          '--plane-radius': `${plane.radius}px`,
          height: `${plane.height * zoom}px`,
          width: `${plane.width * zoom}px`,
        } as CSSProperties}
      >
        <div
          style={{
            height: `${plane.height}px`,
            position: 'relative',
            transform: `scale(${zoom})`,
            transformOrigin: '0 0',
            width: `${plane.width}px`,
          }}
        >
        <div className="graphs-plane__surface" aria-hidden="true" />
        <div className="graphs-plane__levels" aria-hidden="true">
          {Array.from({ length: MIND_MAP_MAX_LEVEL }, (_, index) => {
            const level = index + 1;
            const radius = mindMapLevelRadius(level, plane);
            return (
              <span
                data-label={`第${level}层`}
                key={level}
                style={{
                  height: `${radius * 2}px`,
                  left: `${plane.centerX}px`,
                  top: `${plane.centerY}px`,
                  width: `${radius * 2}px`,
                }}
              >
                第{level}层
              </span>
            );
          })}
        </div>
        <svg aria-hidden="true" className="graphs-plane__links">
          {detail.edges.map((edge) => {
            const source = pointFor(edge.sourceNodeId);
            const target = pointFor(edge.targetNodeId);
            if (!source || !target) return null;
            const graphLink = graphLinkFromEdge(
              edge,
              nodesById.get(edge.sourceNodeId),
              nodesById.get(edge.targetNodeId),
            );
            return (
              <path
                className={graphHighlight.edgeIds.has(edge.id) ? 'is-highlighted' : ''}
                d={mindMapLinkPath(source, target)}
                fill="none"
                key={edge.id}
                stroke={visualLinkColor(graphLink, graphHighlight)}
                strokeLinecap="round"
                strokeWidth={visualLinkWidth(graphLink, graphHighlight)}
              />
            );
          })}
          {linkGesture?.active ? (() => {
            const source = pointFor(linkGesture.sourceNodeId);
            if (!source) return null;
            return (
              <path
                className="graphs-plane__link-draft"
                d={mindMapLinkPath(source, linkGesture.point)}
                fill="none"
                stroke="rgba(198, 66, 50, 0.62)"
                strokeDasharray="7 7"
                strokeLinecap="round"
                strokeWidth="2"
              />
            );
          })() : null}
        </svg>
        {detail.edges.map((edge) => {
          const source = pointFor(edge.sourceNodeId);
          const target = pointFor(edge.targetNodeId);
          if (!source || !target) return null;
          const graphLink = graphLinkFromEdge(
            edge,
            nodesById.get(edge.sourceNodeId),
            nodesById.get(edge.targetNodeId),
          );
          if (graphLink.label === BRANCH_RELATION_LABEL) return null;
          return (
            <span
              className="graphs-plane-link-label"
              data-label={linkTooltip(graphLink)}
              key={edge.id}
              onMouseEnter={() => onEdgeHover(edge.id)}
              onMouseLeave={() => onEdgeHover(undefined)}
              style={{
                left: `${(source.left + target.left) / 2}px`,
                top: `${(source.top + target.top) / 2}px`,
              }}
            >
              {graphLink.label || BRANCH_RELATION_LABEL}
            </span>
          );
        })}
        {detail.nodes.map((node) => {
          const point = pointFor(node.id);
          if (!point) return null;
          const level = knowledgeNodeLevel(node);
          const linkCount = linkCounts.get(node.id) ?? 0;
          const color = graphNodeColor(node);
          const graphNode: GraphNode = {
            id: node.id,
            name: knowledgeNodeTitle(node),
            cardId: knowledgeNodeCardId(node),
            category: knowledgeNodeCategory(node),
            color,
            linkCount,
            archived: knowledgeNodeArchived(node),
            level,
            content: knowledgeNodeContent(node),
            card: knowledgeNodeCard(node),
          };
          const isHighlighted = graphHighlight.nodeIds.has(node.id);
          return (
            <button
              aria-label={`节点 ${knowledgeNodeTitle(node)}`}
              className={`graphs-plane-node${selectedNodeId === node.id ? ' is-active' : ''}${linkGesture?.active && linkGesture.sourceNodeId === node.id ? ' is-link-source' : ''}`}
              data-highlighted={isHighlighted ? 'true' : undefined}
              data-level={level}
              data-node-id={node.id}
              key={node.id}
              onClick={(event) => {
                event.stopPropagation();
                if (linkGestureConsumedRef.current) {
                  linkGestureConsumedRef.current = false;
                  return;
                }
                onNodeClick(node);
              }}
              onDoubleClick={(event) => {
                event.stopPropagation();
                linkGestureConsumedRef.current = false;
                onNodeDoubleClick(node);
              }}
              onContextMenu={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onMouseEnter={(event) => {
                onNodeHover(node.id);
                setHoverPreview({ node, left: event.clientX, top: event.clientY });
              }}
              onMouseLeave={() => {
                onNodeHover(undefined);
                setHoverPreview(undefined);
              }}
              onPointerDown={(event) => {
                event.stopPropagation();
                const pointerId = readPointerId(event.pointerId);
                if (pointerId >= 0) event.currentTarget.setPointerCapture?.(pointerId);
                startLinkGesture(node.id, event.clientX, event.clientY, pointerId);
              }}
              onPointerMove={(event) => {
                updateLinkGesture(event.clientX, event.clientY, readPointerId(event.pointerId));
              }}
              onPointerUp={(event) => {
                const pointerId = readPointerId(event.pointerId);
                finishLinkGesture(nodeIdAtClientPoint(event.clientX, event.clientY), pointerId);
                if (pointerId >= 0) event.currentTarget.releasePointerCapture?.(pointerId);
              }}
              onPointerCancel={() => {
                finishLinkGesture();
              }}
              onMouseDown={(event) => {
                if (supportsPointerEvents()) return;
                event.stopPropagation();
                startLinkGesture(node.id, event.clientX, event.clientY);
              }}
              onMouseMove={(event) => {
                setHoverPreview({ node, left: event.clientX, top: event.clientY });
                if (supportsPointerEvents()) return;
                updateLinkGesture(event.clientX, event.clientY);
              }}
              onMouseUp={() => {
                if (supportsPointerEvents()) return;
                finishLinkGesture(node.id);
              }}
              style={{
                '--node-color': visualNodeColor(
                  graphNode,
                  graphHighlight,
                ),
                '--node-size': `${mindMapNodeSize(level, linkCount)}px`,
                left: `${point.left}px`,
                top: `${point.top}px`,
              } as CSSProperties}
              type="button"
            >
              <span>{compactTitle(knowledgeNodeTitle(node))}</span>
            </button>
          );
        })}
        {detail.nodes.length === 0 ? (
          <div className="graphs-plane__empty">
            <Network aria-hidden="true" size={34} />
            <strong>2D 树形思维导图</strong>
            <span>{readOnly ? '横向编辑完成后，2D 圈层会在这里自动生成。' : '添加独立知识点后，长按一个节点并拖至另一节点可建立关系。'}</span>
          </div>
        ) : null}
        </div>
      </div>
      {hoverPreview ? (
        <GraphNodeHoverPreview
          left={hoverPreview.left}
          node={hoverPreview.node}
          top={hoverPreview.top}
        />
      ) : null}
    </div>
  );
}

function DetailPanel({
  editing,
  node,
  onDelete,
  onDeleteRelation,
  onFocus,
  onUpdate,
  relations,
}: {
  editing: boolean;
  node: CompatibleKnowledgeMapNode | GraphNode | undefined;
  onDelete?: () => void;
  onDeleteRelation?: (edgeId: string) => void;
  onFocus?: () => void;
  onUpdate?: (input: { title?: string; content?: string; level?: number }) => void;
  relations: DetailRelation[];
}) {
  if (!node) {
    return <StatusNotice state="empty" message="双击或点击节点后查看知识点详情" />;
  }
  const derivedNode = isDerivedGraphNode(node) ? node : undefined;
  const mapNode = derivedNode ? undefined : node as CompatibleKnowledgeMapNode;
  const card = mapNode ? knowledgeNodeCard(mapNode) : undefined;
  const level = derivedNode?.level ?? knowledgeNodeLevel(mapNode!);
  const title = derivedNode?.name ?? knowledgeNodeTitle(mapNode!);
  const content = derivedNode?.content ?? knowledgeNodeContent(mapNode!);
  const category = derivedNode?.category ?? knowledgeNodeCategory(mapNode!);
  const archived = derivedNode?.archived ?? knowledgeNodeArchived(mapNode!);
  return (
    <section className="graphs-panel graphs-detail">
      <div className="graphs-detail__header">
        <div>
          <span>{category} / 第{level}层{archived ? ' / 已归档' : ''}</span>
          <h2>{title}</h2>
        </div>
        {onFocus ? (
          <button
            aria-label="聚焦当前节点"
            className="button button--secondary liquid-pressable"
            onClick={onFocus}
            type="button"
          >
            <Maximize2 aria-hidden="true" size={16} />
          </button>
        ) : null}
      </div>
      {editing ? (
        <div className="graphs-detail__editor">
          {mapNode && !derivedNode ? (
            <>
              <label>
                <span>标题</span>
                <input
                  aria-label="标题"
                  maxLength={80}
                  onChange={(event) => onUpdate?.({ title: event.target.value })}
                  value={title}
                />
              </label>
              <label>
                <span>正文</span>
                <textarea
                  aria-label="正文"
                  maxLength={4000}
                  onChange={(event) => onUpdate?.({ content: event.target.value })}
                  rows={4}
                  value={content}
                />
              </label>
            </>
          ) : null}
        </div>
      ) : null}
      <dl className="graphs-detail__meta">
        {derivedNode ? (
          <div><dt>类型</dt><dd>{derivedNode.category}</dd></div>
        ) : card ? (
          <div><dt>不会标注</dt><dd>{card.wrongCount} 次</dd></div>
        ) : (
          <div><dt>类型</dt><dd>自定义</dd></div>
        )}
      </dl>
      {derivedNode ? (
        <section>
          <h3>完整内容</h3>
          <p className="graphs-detail__content">{content || '未生成内容'}</p>
        </section>
      ) : card ? (
        <>
          <section>
            <h3>用户初始稿</h3>
            <RichTextPreview contentJson={card.rawContentJson} fallback={card.rawInput || '未填写'} />
          </section>
        </>
      ) : (
        <section>
          <h3>正文</h3>
          <p>{content || '未填写正文'}</p>
        </section>
      )}
      {mapNode && relations.length > 0 ? (
        <section className="graphs-detail__relations">
          <h3>连线关系</h3>
          <ul>
            {relations.map((relation) => (
              <li key={relation.id}>
                <span>
                  <strong>{relation.sourceTitle}</strong>
                  <small>{relation.label}</small>
                  <strong>{relation.targetTitle}</strong>
                </span>
                {onDeleteRelation ? (
                  <button
                    aria-label={`删除连线：${relation.sourceTitle} 到 ${relation.targetTitle}`}
                    className="button button--secondary liquid-pressable"
                    onClick={() => onDeleteRelation(relation.id)}
                    type="button"
                  >
                    <Trash2 aria-hidden="true" size={14} />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {onDelete ? (
        <button className="button button--secondary liquid-pressable graphs-delete" onClick={onDelete} type="button">
          <Trash2 aria-hidden="true" size={16} />
          从图谱移除
        </button>
      ) : null}
    </section>
  );
}

function toGraphData(
  detail: KnowledgeMapDetail | null,
  cardGroupsBySource: Map<string, CardDetail[]>,
  includeDerivedNodes = true,
): GraphData<GraphNode, GraphLink> {
  if (!detail || detail.nodes.length === 0) return emptySphereData();
  const linkCounts = getLinkCounts(detail);
  const derivedNodes: GraphNode[] = [];
  const derivedLinks: GraphLink[] = [];
  const nodes: GraphNode[] = detail.nodes.map((node): GraphNode => {
    const category = knowledgeNodeCategory(node);
    const linkCount = linkCounts.get(node.id) ?? 0;
    const level = knowledgeNodeLevel(node);
    const card = knowledgeNodeCard(node);
    const derivedItems = includeDerivedNodes && card ? cardDerivedGraphItems(card, cardGroupsBySource) : [];
    derivedItems.forEach((item) => {
      const derivedLevel = Math.min(MIND_MAP_MAX_LEVEL, level + 1);
      const derivedId = `${node.id}:derived:${item.kind}`;
      derivedNodes.push({
        id: derivedId,
        name: `${item.label}：${item.value}`,
        cardId: item.card.id,
        category: item.label.startsWith('解析') ? '解析' : 'AI 优化稿',
        color: previewLevelColor(derivedLevel, item.card.archived),
        linkCount: 1,
        archived: item.card.archived,
        level: derivedLevel,
        content: item.value,
        card: item.card,
        derived: true,
        parentId: node.id,
      });
      derivedLinks.push({
        id: `${node.id}:derived-link:${item.kind}`,
        source: node.id,
        target: derivedId,
        label: item.label,
        color: PREVIEW_LINK_COLOR,
        weight: 0.62,
        levelDelta: 0,
        derived: true,
      });
    });
    return {
      id: node.id,
      name: knowledgeNodeTitle(node),
      cardId: knowledgeNodeCardId(node),
      category,
      color: previewNodeColor(node),
      linkCount,
      archived: knowledgeNodeArchived(node),
      level,
      content: knowledgeNodeContent(node),
      card: knowledgeNodeCard(node),
    };
  });
  const links: GraphLink[] = detail.edges.map((edge) => {
    const source = detail.nodes.find(({ id }) => id === edge.sourceNodeId);
    const target = detail.nodes.find(({ id }) => id === edge.targetNodeId);
    return graphLinkFromEdge(edge, source, target);
  });
  const allNodes = nodes.concat(derivedNodes);
  const positions = buildSolarOrbitLayout(
    allNodes.map((node) => ({
      id: node.id,
      level: node.level,
      parentId: node.parentId,
      derived: node.derived,
      createdAt: detail.nodes.find(({ id }) => id === node.id)?.createdAt,
    })),
    detail.edges.map((edge) => ({
      sourceNodeId: edge.sourceNodeId,
      targetNodeId: edge.targetNodeId,
      createdAt: edge.createdAt,
    })),
  );
  const positionedNodes = allNodes.map((node) => {
    const position = positions.get(node.id) ?? { x: 0, y: 0, z: 0, orbitRadius: 0, kind: 'sun' as const };
    return {
      ...node,
      kind: position.kind,
      orbitRadius: position.orbitRadius,
      x: position.x,
      y: position.y,
      z: position.z,
      fx: position.x,
      fy: position.y,
      fz: position.z,
    };
  });
  return {
    nodes: positionedNodes,
    links: links.concat(derivedLinks),
  };
}

function emptySphereData(): GraphData<GraphNode, GraphLink> {
  const nodes = Array.from({ length: EMPTY_NODE_COUNT }, (_, index) => {
    const point = spherePoint(index, EMPTY_NODE_COUNT);
    return {
      id: `empty-${index}`,
      name: '空球体预览',
      cardId: '',
      category: '空球体',
      color: index % 5 === 0 ? CARD_NODE_COLOR : 'rgba(181, 62, 51, 0.38)',
      linkCount: 0,
      archived: false,
      level: 1,
      placeholder: true,
      x: point.x,
      y: point.y,
      z: point.z,
      fx: point.x,
      fy: point.y,
      fz: point.z,
    };
  });
  const links = nodes.map((node, index) => ({
    id: `empty-link-${index}`,
    source: node.id,
    target: nodes[(index + 7) % nodes.length].id,
    label: '空球体经纬线',
    color: 'rgba(181, 62, 51, 0.14)',
    weight: 0.7,
    levelDelta: 1,
    placeholder: true,
  }));
  return { nodes, links };
}

function buildGraphHighlight(
  detail: KnowledgeMapDetail | null,
  hoverNodeId: string | undefined,
  hoverEdgeId: string | undefined,
  selectedNodeId: string | undefined,
): GraphHighlight {
  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();
  if (!detail) return { nodeIds, edgeIds, hasFocus: false };

  const addEdge = (edge: KnowledgeMapEdge | undefined) => {
    if (!edge) return;
    edgeIds.add(edge.id);
    nodeIds.add(edge.sourceNodeId);
    nodeIds.add(edge.targetNodeId);
  };

  const addAncestorPath = (nodeId: string | undefined) => {
    if (!nodeId) return;
    const seen = new Set<string>();
    let currentId: string | undefined = nodeId;
    while (currentId && !seen.has(currentId)) {
      seen.add(currentId);
      nodeIds.add(currentId);
      const parentEdge = [...detail.edges]
        .sort((first, second) => first.createdAt.localeCompare(second.createdAt))
        .find((edge) => edge.targetNodeId === currentId && !seen.has(edge.sourceNodeId));
      if (!parentEdge) break;
      edgeIds.add(parentEdge.id);
      currentId = parentEdge.sourceNodeId;
    }
  };

  const addSubtree = (nodeId: string | undefined) => {
    if (!nodeId) return;
    const queue = [nodeId];
    const seen = new Set<string>();
    while (queue.length > 0) {
      const currentId = queue.shift();
      if (!currentId || seen.has(currentId)) continue;
      seen.add(currentId);
      nodeIds.add(currentId);
      for (const edge of detail.edges) {
        if (edge.sourceNodeId !== currentId) continue;
        edgeIds.add(edge.id);
        nodeIds.add(edge.targetNodeId);
        if (!seen.has(edge.targetNodeId)) queue.push(edge.targetNodeId);
      }
    }
  };

  if (selectedNodeId) addAncestorPath(selectedNodeId);
  else addSubtree(hoverNodeId);

  addEdge(detail.edges.find(({ id }) => id === hoverEdgeId));

  return { nodeIds, edgeIds, hasFocus: nodeIds.size > 0 || edgeIds.size > 0 };
}

function getGraphStats(detail: KnowledgeMapDetail | null): GraphStats {
  if (!detail) {
    return { nodeCount: 0, edgeCount: 0 };
  }
  return {
    nodeCount: detail.nodes.length,
    edgeCount: detail.edges.length,
  };
}

function getHoverSummary(
  detail: KnowledgeMapDetail | null,
  hoverNodeId: string | undefined,
  hoverEdgeId: string | undefined,
  graphHighlight: GraphHighlight,
) {
  if (!detail) return '';
  const hoverNode = detail.nodes.find(({ id }) => id === hoverNodeId);
  if (hoverNode) {
    return `子树：${compactTitle(knowledgeNodeTitle(hoverNode))} · ${Math.max(0, graphHighlight.nodeIds.size - 1)} 子点`;
  }
  const hoverEdge = detail.edges.find(({ id }) => id === hoverEdgeId);
  if (hoverEdge) {
    const source = detail.nodes.find(({ id }) => id === hoverEdge.sourceNodeId);
    const target = detail.nodes.find(({ id }) => id === hoverEdge.targetNodeId);
    if (source && target) {
      return `分支：${compactTitle(knowledgeNodeTitle(source))} → ${compactTitle(knowledgeNodeTitle(target))}`;
    }
  }
  return '';
}

function createGraphNodeSummarySprite(
  node: GraphNode,
  cameraDistance: number,
  labelsVisible = true,
  forceVisible = false,
  compact = false,
) {
  const summary = compactGraphSummary(node.content || node.name, compact ? 6 : 14);
  const summaryWidth = compact
    ? Math.min(0.18, Math.max(0.12, summary.length * 0.014))
    : Math.min(0.26, Math.max(0.15, summary.length * 0.012));
  const summaryHeight = compact ? 0.042 : 0.05;
  const scaleFactor = graphLabelScale(cameraDistance);
  const material = new SpriteMaterial({
    depthTest: false,
    depthWrite: false,
    sizeAttenuation: false,
    transparent: true,
  });
  const sprite = new Sprite(material);
  sprite.visible = labelsVisible
    && !node.placeholder
    && Boolean(summary)
    && (!node.derived || forceVisible || cameraDistance <= GRAPH_DERIVED_LABEL_DISTANCE_MAX);
  sprite.position.set(0, node.derived ? 7 : 10, 0);
  sprite.renderOrder = 20;
  sprite.userData.summary = summary;
  sprite.userData.summaryWidth = summaryWidth;
  sprite.userData.summaryHeight = summaryHeight;
  sprite.scale.set(summaryWidth * scaleFactor, summaryHeight * scaleFactor, 1);
  if (!sprite.visible || typeof document === 'undefined' || typeof CanvasRenderingContext2D === 'undefined') {
    return sprite;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 80;
  const context = canvas.getContext('2d');
  if (!context) return sprite;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.font = `700 ${compact ? 24 : 28}px "Microsoft YaHei", sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.lineJoin = 'round';
  context.lineWidth = 6;
  context.strokeStyle = 'rgba(255, 255, 255, 0.94)';
  context.strokeText(summary, canvas.width / 2, canvas.height / 2, canvas.width - 28);
  context.fillStyle = '#7f211c';
  context.fillText(summary, canvas.width / 2, canvas.height / 2, canvas.width - 28);

  const texture = new CanvasTexture(canvas);
  texture.minFilter = LinearFilter;
  material.map = texture;
  material.needsUpdate = true;
  return sprite;
}

function graphLabelScale(cameraDistance: number) {
  if (!Number.isFinite(cameraDistance) || cameraDistance <= 0) return 1;
  return Math.min(
    GRAPH_LABEL_SCALE_MAX,
    Math.max(GRAPH_LABEL_SCALE_MIN, GRAPH_LABEL_REFERENCE_DISTANCE / cameraDistance),
  );
}

function compactGraphSummary(value: string, maxLength = 14) {
  const text = value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

function visualNodeColor(
  node: GraphNode,
  _graphHighlight: GraphHighlight,
) {
  return node.color;
}

function visualNodeValue(node: GraphNode, graphHighlight: GraphHighlight) {
  if (node.placeholder) return 0.65;
  const hierarchyScale = Math.max(0.78, 2.2 - ((normalizeLevel(node.level) - 1) * 0.24));
  if (node.kind === 'asteroid' || node.derived) return hierarchyScale * 0.42;
  const base = (node.kind === 'sun' ? hierarchyScale * 1.82 : hierarchyScale)
    + Math.sqrt(node.linkCount + 1) * 0.18;
  if (!graphHighlight.hasFocus) return base;
  return graphHighlight.nodeIds.has(node.id) ? base * 1.28 : base;
}

function visualLinkColor(link: GraphLink, graphHighlight: GraphHighlight) {
  if (link.placeholder) return link.color;
  if (graphHighlight.edgeIds.has(link.id)) return withAlpha(link.color, 0.98);
  if (link.derived) return link.color;
  return withAlpha(link.color, Math.min(0.82, 0.36 + link.weight * 0.16));
}

function visualLinkWidth(link: GraphLink, graphHighlight: GraphHighlight) {
  if (link.placeholder) return 0.7;
  if (link.derived) return graphHighlight.edgeIds.has(link.id) ? 1.1 : 0.58;
  const width = 0.8 + link.weight * 0.58;
  return graphHighlight.edgeIds.has(link.id) ? width + 1.45 : width;
}

function previewLinkColor(link: GraphLink, graphHighlight: GraphHighlight) {
  if (link.placeholder) return 'rgba(181, 62, 51, 0.12)';
  if (graphHighlight.hasFocus && graphHighlight.edgeIds.has(link.id)) return 'rgba(142, 38, 31, 0.62)';
  return PREVIEW_LINK_COLOR;
}

function previewLinkWidth(link: GraphLink, graphHighlight: GraphHighlight) {
  if (link.placeholder) return 0.26;
  if (link.derived) return 0.44;
  const width = Number((0.3 + Math.sqrt(link.weight) * 0.28).toFixed(2));
  if (graphHighlight.hasFocus && graphHighlight.edgeIds.has(link.id)) return width + 0.38;
  return width;
}

function linkTooltip(link: GraphLink) {
  if (link.placeholder) return link.label;
  if (link.derived) return link.label;
  return `${link.label} · 强度 ${link.weight.toFixed(1)}`;
}

function graphLinkSourceId(link: GraphLink) {
  if (typeof link.source === 'object' && link.source !== null && 'id' in link.source) {
    return String((link.source as GraphNode).id);
  }
  return String(link.source);
}

function graphNodeColor(node: CompatibleKnowledgeMapNode) {
  if (knowledgeNodeArchived(node)) return '#a66963';
  return levelColor(knowledgeNodeLevel(node));
}

function previewNodeColor(node: CompatibleKnowledgeMapNode) {
  return previewLevelColor(knowledgeNodeLevel(node), knowledgeNodeArchived(node));
}

function previewLevelColor(level: number, archived = false) {
  if (archived) return '#b7847f';
  const palette = ['#9d2822', '#b63c32', '#cc5a4f', '#df8178', '#e9a39c', '#f0c0bb'];
  return palette[normalizeLevel(level) - 1] ?? palette[palette.length - 1];
}

function getLinkCounts(detail: KnowledgeMapDetail) {
  const counts = new Map<string, number>();
  for (const node of detail.nodes) counts.set(node.id, 0);
  for (const edge of detail.edges) {
    counts.set(edge.sourceNodeId, (counts.get(edge.sourceNodeId) ?? 0) + 1);
    counts.set(edge.targetNodeId, (counts.get(edge.targetNodeId) ?? 0) + 1);
  }
  return counts;
}

function relationColor(label: string) {
  return relationColors.get(label) ?? '#5d6470';
}

function relationWeight(label: string, sourceLevel?: number, targetLevel?: number) {
  const base = label === '易混' || label === '因果' || label === '对比'
    ? 2.35
    : label === BRANCH_RELATION_LABEL || label === '属于' || label === '时间'
      ? 1.85
      : label === '例子' || label === '补充'
        ? 1.45
        : 1.25;
  if (typeof sourceLevel !== 'number' || typeof targetLevel !== 'number') return base;
  const levelDelta = Math.abs(sourceLevel - targetLevel);
  const layerFactor = levelDelta === 1
    ? 1.2
    : levelDelta === 0
      ? 0.92
      : Math.max(0.66, 1 - ((levelDelta - 1) * 0.12));
  return base * layerFactor;
}

function graphLinkFromEdge(
  edge: KnowledgeMapEdge,
  sourceNode: CompatibleKnowledgeMapNode | undefined,
  targetNode: CompatibleKnowledgeMapNode | undefined,
): GraphLink {
  const label = edge.label || '关联';
  const sourceLevel = sourceNode ? knowledgeNodeLevel(sourceNode) : undefined;
  const targetLevel = targetNode ? knowledgeNodeLevel(targetNode) : undefined;
  return {
    id: edge.id,
    source: edge.sourceNodeId,
    target: edge.targetNodeId,
    label,
    color: relationColor(label),
    weight: relationWeight(label, sourceLevel, targetLevel),
    levelDelta: typeof sourceLevel === 'number' && typeof targetLevel === 'number'
      ? Math.abs(sourceLevel - targetLevel)
      : 0,
  };
}

function levelColor(level: number) {
  const palette = ['#e24a3b', '#d63d31', '#c64232', '#b7352c', '#a02d27', '#85251f'];
  return palette[normalizeLevel(level) - 1] ?? palette[palette.length - 1];
}

function mindMapNodeSize(level: number, linkCount: number) {
  const levelSize = 58 - ((normalizeLevel(level) - 1) * 4);
  return Math.round(levelSize + Math.sqrt(linkCount + 1) * 5);
}

function knowledgeNodeCard(node: CompatibleKnowledgeMapNode) {
  const card = node.card;
  return card && typeof card === 'object' ? card : undefined;
}

function isDerivedGraphNode(node: CompatibleKnowledgeMapNode | GraphNode): node is GraphNode {
  return 'derived' in node && node.derived === true;
}

function knowledgeNodeCardId(node: CompatibleKnowledgeMapNode) {
  return textValue(node.cardId);
}

function knowledgeNodeTitle(node: CompatibleKnowledgeMapNode) {
  return textValue(node.title) || (knowledgeNodeCard(node) ? cardTitle(knowledgeNodeCard(node)!) : '') || '未命名知识点';
}

function knowledgeNodeContent(node: CompatibleKnowledgeMapNode) {
  return textValue(node.content) || knowledgeNodeCard(node)?.rawInput || '';
}

function knowledgeNodeLevel(node: CompatibleKnowledgeMapNode) {
  if (typeof node.level === 'number' && Number.isFinite(node.level)) return normalizeLevel(node.level);
  return knowledgeNodeCard(node) ? DEFAULT_CARD_LEVEL : 1;
}

function knowledgeNodeArchived(node: CompatibleKnowledgeMapNode) {
  return Boolean(knowledgeNodeCard(node)?.archived);
}

function knowledgeNodeCategory(node: CompatibleKnowledgeMapNode) {
  const card = knowledgeNodeCard(node);
  return card ? primaryCategory(card) : '自定义知识点';
}

function readSpherePosition(node: { x?: unknown; y?: unknown; z?: unknown }, fallback: SpherePosition) {
  const x = finiteNumber(node.x);
  const y = finiteNumber(node.y);
  const z = finiteNumber(node.z);
  if (x === undefined || y === undefined || z === undefined || Math.hypot(x, y, z) < 0.001) return fallback;
  return normalizeToSphere(x, y, z);
}

function textValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function finiteNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function normalizeLevel(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_CARD_LEVEL;
  return Math.min(MIND_MAP_MAX_LEVEL, Math.max(1, Math.round(value)));
}

function withAlpha(color: string, alpha: number) {
  if (!color.startsWith('#') || color.length !== 7) return color;
  const red = Number.parseInt(color.slice(1, 3), 16);
  const green = Number.parseInt(color.slice(3, 5), 16);
  const blue = Number.parseInt(color.slice(5, 7), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function compactTitle(title: string) {
  return title.length > 12 ? `${title.slice(0, 12)}...` : title;
}

function spherePoint(index: number, total: number) {
  return spherePointAtRadius(index, total, SPHERE_RADIUS);
}

function spherePointAtRadius(index: number, total: number, sphereRadius: number) {
  const offset = 2 / total;
  const increment = Math.PI * (3 - Math.sqrt(5));
  const y = ((index * offset) - 1) + (offset / 2);
  const radius = Math.sqrt(1 - y * y);
  const phi = index * increment;
  const normalized = normalizeToSphere(Math.cos(phi) * radius, y, Math.sin(phi) * radius);
  const scale = sphereRadius / SPHERE_RADIUS;
  return { x: normalized.x * scale, y: normalized.y * scale, z: normalized.z * scale };
}

function normalizeToSphere(x: number, y: number, z: number) {
  const length = Math.sqrt((x * x) + (y * y) + (z * z)) || 1;
  return {
    x: (x / length) * SPHERE_RADIUS,
    y: (y / length) * SPHERE_RADIUS,
    z: (z / length) * SPHERE_RADIUS,
  };
}

function getHorizontalMindMapWorldSize(
  detail: KnowledgeMapDetail,
  frameSize: { width: number; height: number },
): MindMapWorldSize {
  const tree = buildMindMapTree(detail);
  const maxLevel = detail.nodes.reduce(
    (current, node) => Math.max(current, knowledgeNodeLevel(node)),
    1,
  );
  const leafCount = Math.max(
    1,
    detail.nodes.filter((node) => (tree.childrenById.get(node.id) ?? []).length === 0).length,
  );
  return {
    width: Math.max(
      frameSize.width,
      (HORIZONTAL_PADDING_X * 2) + ((maxLevel - 1) * HORIZONTAL_COLUMN_GAP) + 220,
    ),
    height: Math.max(
      frameSize.height,
      (HORIZONTAL_PADDING_Y * 2) + ((leafCount - 1) * HORIZONTAL_ROW_GAP) + 120,
    ),
  };
}

function buildHorizontalMindMapPoints(
  detail: KnowledgeMapDetail,
  worldSize: MindMapWorldSize,
) {
  const tree = buildMindMapTree(detail);
  const points = new Map<string, PlanePoint>();
  let nextLeafTop = HORIZONTAL_PADDING_Y;

  const placeNode = (nodeId: string, ancestry: Set<string>): number => {
    const existing = points.get(nodeId);
    if (existing) return existing.top;
    const node = tree.nodesById.get(nodeId);
    if (!node) return nextLeafTop;
    const nextAncestry = new Set(ancestry).add(nodeId);
    const childIds = (tree.childrenById.get(nodeId) ?? [])
      .filter((childId) => !nextAncestry.has(childId) && !points.has(childId));
    const childTops = childIds.map((childId) => placeNode(childId, nextAncestry));
    const top = childTops.length > 0
      ? (childTops[0] + childTops[childTops.length - 1]) / 2
      : nextLeafTop;
    if (childTops.length === 0) nextLeafTop += HORIZONTAL_ROW_GAP;
    const level = knowledgeNodeLevel(node);
    points.set(nodeId, {
      left: Math.min(
        worldSize.width - HORIZONTAL_PADDING_X,
        HORIZONTAL_PADDING_X + ((level - 1) * HORIZONTAL_COLUMN_GAP),
      ),
      top,
    });
    return top;
  };

  const roots = tree.roots.length > 0
    ? tree.roots
    : sortNodesForLayout(detail.nodes).map(({ id }) => id);
  for (const rootId of roots) placeNode(rootId, new Set());
  for (const node of sortNodesForLayout(detail.nodes)) placeNode(node.id, new Set());
  return points;
}

function horizontalMindMapLinkPath(source: PlanePoint, target: PlanePoint) {
  const sourceX = source.left + 184;
  const targetX = target.left;
  const distance = Math.max(84, Math.abs(targetX - sourceX));
  const bend = Math.min(132, distance * 0.52);
  return [
    `M ${sourceX.toFixed(1)} ${source.top.toFixed(1)}`,
    `C ${(sourceX + bend).toFixed(1)} ${source.top.toFixed(1)}`,
    `${(targetX - bend).toFixed(1)} ${target.top.toFixed(1)}`,
    `${targetX.toFixed(1)} ${target.top.toFixed(1)}`,
  ].join(' ');
}

function getMindMapWorldSize(
  detail: KnowledgeMapDetail,
  frameSize: { width: number; height: number },
): MindMapWorldSize {
  const fallbackWidth = frameSize.width > 0 ? frameSize.width : 920;
  const fallbackHeight = frameSize.height > 0 ? frameSize.height : 680;
  if (detail.nodes.length === 0) {
    return { width: fallbackWidth, height: fallbackHeight };
  }
  const maxDepth = getMindMapDepth(detail);
  const maxRadius = Math.max(MIND_MAP_MAX_LEVEL - 1, maxDepth - 1) * MIND_MAP_RING_GAP;
  const densityPadding = Math.min(3600, Math.max(0, detail.nodes.length - 12) * 28);
  const panBuffer = Math.max(920, fallbackWidth, fallbackHeight);
  const side = (maxRadius * 2) + 480 + densityPadding + panBuffer;
  return {
    width: Math.max(fallbackWidth * 2, side),
    height: Math.max(fallbackHeight * 2, side),
  };
}

function getMindMapDepth(detail: KnowledgeMapDetail) {
  if (detail.nodes.length === 0) return 1;
  const tree = buildMindMapTree(detail);
  let maxLevel = detail.nodes.reduce((current, node) => Math.max(current, knowledgeNodeLevel(node)), 1);
  const roots = tree.roots.length > 0 ? tree.roots : detail.nodes.map(({ id }) => id);
  const queue = roots.map((nodeId) => ({ nodeId, level: 1 }));
  const seen = new Set<string>();
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || seen.has(current.nodeId)) continue;
    seen.add(current.nodeId);
    maxLevel = Math.max(maxLevel, current.level);
    for (const childId of tree.childrenById.get(current.nodeId) ?? []) {
      queue.push({ nodeId: childId, level: current.level + 1 });
    }
  }
  return maxLevel;
}

function getPlaneGeometry(width: number, height: number) {
  const usableWidth = width > 0 ? width : 920;
  const usableHeight = height > 0 ? height : 680;
  const padding = Math.min(140, Math.max(86, Math.min(usableWidth, usableHeight) * 0.06));
  const minX = padding;
  const maxX = Math.max(minX + 1, usableWidth - padding);
  const minY = padding;
  const maxY = Math.max(minY + 1, usableHeight - padding);
  return {
    width: usableWidth,
    height: usableHeight,
    centerX: usableWidth / 2,
    centerY: usableHeight / 2,
    minX,
    maxX,
    minY,
    maxY,
    laneGap: MIND_MAP_RING_GAP,
    ringGap: MIND_MAP_RING_GAP,
    radius: (MIND_MAP_MAX_LEVEL - 1) * MIND_MAP_RING_GAP,
  };
}

function buildMindMapTreePoints(
  detail: KnowledgeMapDetail,
  plane: ReturnType<typeof getPlaneGeometry>,
  layoutRevision = 0,
) {
  const tree = buildMindMapTree(detail);
  const next = new Map<string, PlanePoint>();
  const fullCircle = Math.PI * 2;
  const layoutPhase = ((detail.edges.length + layoutRevision) % 12) * (Math.PI / 18);
  const roots = tree.roots.length > 0
    ? tree.roots
    : sortNodesForLayout(detail.nodes).map(({ id }) => id);
  const subtreeWeights = buildMindMapSubtreeWeights(tree);
  const totalRootWeight = roots.reduce((total, nodeId) => total + (subtreeWeights.get(nodeId) ?? 1), 0);
  const singleCenteredRootId = roots.length === 1
    && knowledgeNodeLevel(tree.nodesById.get(roots[0])!) === 1
      ? roots[0]
      : undefined;
  let rootCursor = layoutPhase;

  const placeBranch = (
    nodeId: string,
    sectorStart: number,
    sectorEnd: number,
    ancestry: Set<string>,
  ) => {
    if (next.has(nodeId) || ancestry.has(nodeId)) return;
    const node = tree.nodesById.get(nodeId);
    if (!node) return;
    const angle = (sectorStart + sectorEnd) / 2;
    const level = knowledgeNodeLevel(node);
    const centerOffset = level === 1 && nodeId !== singleCenteredRootId
      ? Math.min(58, plane.ringGap * 0.28)
      : 0;
    next.set(
      nodeId,
      nodeId === singleCenteredRootId
        ? { left: plane.centerX, top: plane.centerY }
        : radialMindMapPoint(plane, level, angle, centerOffset),
    );

    const children = (tree.childrenById.get(nodeId) ?? [])
      .filter((childId) => !ancestry.has(childId) && !next.has(childId));
    if (children.length === 0) return;
    const nextAncestry = new Set(ancestry).add(nodeId);
    const sectorWidth = sectorEnd - sectorStart;
    const childWidth = nodeId === singleCenteredRootId
      ? sectorWidth
      : Math.min(sectorWidth * 0.72, Math.PI * 0.92);
    const childStart = angle - (childWidth / 2);
    const totalChildWeight = children.reduce(
      (total, childId) => total + (subtreeWeights.get(childId) ?? 1),
      0,
    );
    let childCursor = childStart;
    for (const childId of children) {
      const span = childWidth * ((subtreeWeights.get(childId) ?? 1) / totalChildWeight);
      placeBranch(childId, childCursor, childCursor + span, nextAncestry);
      childCursor += span;
    }
  };

  for (const rootId of roots) {
    const span = fullCircle * ((subtreeWeights.get(rootId) ?? 1) / Math.max(1, totalRootWeight));
    placeBranch(rootId, rootCursor, rootCursor + span, new Set());
    rootCursor += span;
  }

  const unplaced = sortNodesForLayout(detail.nodes).filter(({ id }) => !next.has(id));
  unplaced.forEach((node, index) => {
    const angle = layoutPhase + (fullCircle * index) / Math.max(1, unplaced.length);
    next.set(node.id, radialMindMapPoint(plane, knowledgeNodeLevel(node), angle));
  });

  return next;
}

function buildMindMapSubtreeWeights(
  tree: ReturnType<typeof buildMindMapTree>,
) {
  const weights = new Map<string, number>();
  const measure = (nodeId: string, ancestry: Set<string>): number => {
    const cached = weights.get(nodeId);
    if (cached !== undefined) return cached;
    if (ancestry.has(nodeId)) return 1;
    const nextAncestry = new Set(ancestry).add(nodeId);
    const children = tree.childrenById.get(nodeId) ?? [];
    const weight = Math.max(1, children.reduce(
      (total, childId) => total + measure(childId, nextAncestry),
      0,
    ));
    weights.set(nodeId, weight);
    return weight;
  };
  for (const nodeId of tree.nodesById.keys()) measure(nodeId, new Set());
  return weights;
}

function buildMindMapTree(detail: KnowledgeMapDetail) {
  const nodesById = new Map(detail.nodes.map((node) => [node.id, node]));
  const childrenById = new Map<string, string[]>();
  const incomingById = new Map<string, string>();
  for (const node of detail.nodes) childrenById.set(node.id, []);

  [...detail.edges]
    .sort((first, second) => first.createdAt.localeCompare(second.createdAt))
    .forEach((edge) => {
      if (!nodesById.has(edge.sourceNodeId) || !nodesById.has(edge.targetNodeId)) return;
      if (edge.sourceNodeId === edge.targetNodeId || incomingById.has(edge.targetNodeId)) return;
      incomingById.set(edge.targetNodeId, edge.sourceNodeId);
      childrenById.get(edge.sourceNodeId)?.push(edge.targetNodeId);
    });

  for (const [nodeId, children] of childrenById.entries()) {
    childrenById.set(nodeId, sortNodesForLayout(children.map((childId) => nodesById.get(childId)).filter(Boolean) as CompatibleKnowledgeMapNode[]).map(({ id }) => id));
  }

  const roots = sortNodesForLayout(detail.nodes)
    .filter((node) => !incomingById.has(node.id))
    .map(({ id }) => id);
  return { childrenById, incomingById, nodesById, roots };
}

function sortNodesForLayout(nodes: CompatibleKnowledgeMapNode[]) {
  return [...nodes].sort((first, second) => (
    knowledgeNodeLevel(first) - knowledgeNodeLevel(second)
    || first.createdAt.localeCompare(second.createdAt)
    || knowledgeNodeTitle(first).localeCompare(knowledgeNodeTitle(second), 'zh-Hans-CN')
  ));
}

function clientPointToPlane(
  clientX: number,
  clientY: number,
  frame: HTMLDivElement | null,
  plane: ReturnType<typeof getPlaneGeometry>,
  zoom = 1,
): PlanePoint {
  if (!frame) return { left: plane.centerX, top: plane.centerY };
  const rect = frame.getBoundingClientRect();
  const scrollLeft = Number.isFinite(frame.scrollLeft) ? frame.scrollLeft : 0;
  const scrollTop = Number.isFinite(frame.scrollTop) ? frame.scrollTop : 0;
  return clampMindMapPoint(
    (clientX - rect.left + scrollLeft) / zoom,
    (clientY - rect.top + scrollTop) / zoom,
    plane,
  );
}

function clampMindMapZoom(value: number) {
  const clamped = Math.min(MIND_MAP_ZOOM_MAX, Math.max(MIND_MAP_ZOOM_MIN, value));
  return Number(clamped.toFixed(2));
}

function formatMindMapZoom(value: number) {
  return String(Number(value.toFixed(2)));
}

function clampMindMapPoint(
  left: number,
  top: number,
  plane: ReturnType<typeof getPlaneGeometry>,
): PlanePoint {
  return {
    left: Math.min(plane.maxX, Math.max(plane.minX, left)),
    top: Math.min(plane.maxY, Math.max(plane.minY, top)),
  };
}

function radialMindMapPoint(
  plane: ReturnType<typeof getPlaneGeometry>,
  level: number,
  angle: number,
  centerOffset = 0,
) {
  const radius = mindMapLevelRadius(level, plane) + centerOffset;
  return clampMindMapPoint(
    plane.centerX + Math.cos(angle) * radius,
    plane.centerY + Math.sin(angle) * radius,
    plane,
  );
}

function mindMapLevelRadius(level: number, plane: ReturnType<typeof getPlaneGeometry>) {
  return Math.max(0, normalizeLevel(level) - 1) * plane.ringGap;
}

function cardDerivedGraphItems(
  card: CardDetail,
  cardGroupsBySource: Map<string, CardDetail[]>,
): CardDerivedGraphItem[] {
  const group = cardGroupsBySource.get(originalSourceKey(card)) ?? [];
  return group
    .filter((item) => item.aiStatus === 'ready')
    .flatMap((item, index) => {
      const result: CardDerivedGraphItem[] = [];
      const optimized = textValue(item.normalizedStatement);
      if (optimized) {
        result.push({
          color: AI_NODE_COLOR,
          kind: `${item.id}:optimized`,
          label: `AI 优化 ${index + 1}`,
          value: optimized,
          card: item,
        });
      }
      return result;
    });
}

function mindMapLinkPath(source: PlanePoint, target: PlanePoint) {
  const dx = target.left - source.left;
  const dy = target.top - source.top;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const curve = Math.min(72, distance * 0.18);
  const controlX = (source.left + target.left) / 2 - (dy / distance) * curve;
  const controlY = (source.top + target.top) / 2 + (dx / distance) * curve;
  return [
    `M ${source.left.toFixed(1)} ${source.top.toFixed(1)}`,
    `Q ${controlX.toFixed(1)} ${controlY.toFixed(1)} ${target.left.toFixed(1)} ${target.top.toFixed(1)}`,
  ].join(' ');
}

function readPointerId(pointerId: number | undefined) {
  return typeof pointerId === 'number' && Number.isFinite(pointerId) ? pointerId : -1;
}

function isSamePointer(activePointerId: number, eventPointerId: number) {
  return activePointerId < 0 || eventPointerId < 0 || activePointerId === eventPointerId;
}

function supportsPointerEvents() {
  return typeof window !== 'undefined' && typeof window.PointerEvent === 'function';
}

function primaryCategory(card: CardDetail) {
  return card.categories.find(({ parentId }) => parentId === null)?.name
    ?? card.categories[0]?.name
    ?? '未分类';
}

async function fetchOriginalCardSearchPage(query: string, signal: AbortSignal) {
  const search = new URLSearchParams({
    contentVersion: 'original',
    query,
    archived: 'false',
    page: '1',
    pageSize: String(GRAPH_SEARCH_PAGE_SIZE),
  });
  const result = await api<CardSearchResult>(`/api/cards?${search.toString()}`, { signal });
  return result.items;
}

function mergeCardsById(current: CardDetail[], incoming: CardDetail[]) {
  const cardsById = new Map(current.map((card) => [card.id, card]));
  for (const card of incoming) cardsById.set(card.id, card);
  return [...cardsById.values()];
}

function knowledgeMapToMarkdown(detail: KnowledgeMapDetail) {
  const tree = buildMindMapTree(detail);
  const visited = new Set<string>();
  const edgesBySource = new Map<string, KnowledgeMapEdge[]>();
  for (const edge of detail.edges) {
    edgesBySource.set(edge.sourceNodeId, [...(edgesBySource.get(edge.sourceNodeId) ?? []), edge]);
  }
  const lines = [
    `# ${markdownHeading(detail.map.name)}`,
    '',
    `> 共 ${detail.nodes.length} 个知识点，${detail.edges.length} 条关系。`,
    '',
  ];

  const writeNode = (nodeId: string, depth: number) => {
    if (visited.has(nodeId)) return;
    const node = tree.nodesById.get(nodeId);
    if (!node) return;
    visited.add(nodeId);
    const title = knowledgeNodeTitle(node);
    const content = knowledgeNodeContent(node);
    const headingLevel = Math.min(6, depth + 2);
    lines.push(`${'#'.repeat(headingLevel)} ${markdownHeading(title)}`);
    lines.push('');
    lines.push(`- 层级：第 ${knowledgeNodeLevel(node)} 层`);
    lines.push(`- 类型：${knowledgeNodeCategory(node)}`);
    if (content) {
      lines.push('');
      lines.push(content);
    }
    const relations = (edgesBySource.get(nodeId) ?? [])
      .filter((edge) => tree.nodesById.has(edge.targetNodeId));
    if (relations.length > 0) {
      lines.push('');
      lines.push('关系：');
      for (const edge of relations) {
        const target = tree.nodesById.get(edge.targetNodeId)!;
        lines.push(`- ${edge.label || BRANCH_RELATION_LABEL} → ${knowledgeNodeTitle(target)}`);
      }
    }
    lines.push('');
    for (const childId of tree.childrenById.get(nodeId) ?? []) writeNode(childId, depth + 1);
  };

  const roots = tree.roots.length > 0
    ? tree.roots
    : sortNodesForLayout(detail.nodes).map(({ id }) => id);
  roots.forEach((nodeId) => writeNode(nodeId, 0));
  sortNodesForLayout(detail.nodes).forEach(({ id }) => writeNode(id, 0));
  return `${lines.join('\n').trim()}\n`;
}

function markdownHeading(value: string) {
  return value.replace(/\s+/g, ' ').replace(/^#+\s*/, '').trim() || '未命名图谱';
}

function safeDownloadName(value: string) {
  return value.replace(/[<>:\"/\\|?*\u0000-\u001f]/g, '_').trim() || '知识图谱';
}

function groupCardsByOriginalSource(cards: CardDetail[]) {
  const groups = new Map<string, CardDetail[]>();
  for (const card of cards) {
    const key = originalSourceKey(card);
    groups.set(key, [...(groups.get(key) ?? []), card]);
  }
  return groups;
}

function uniqueOriginalCards(cards: CardDetail[]) {
  const seen = new Set<string>();
  return cards.filter((card) => {
    const key = originalSourceKey(card);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function originalSourceKey(card: CardDetail) {
  const rawContentJson = textValue(card.rawContentJson);
  if (rawContentJson) {
    try {
      const parsed: unknown = JSON.parse(rawContentJson);
      if (parsed !== null && (Array.isArray(parsed) || typeof parsed === 'object')) {
        return `json:${JSON.stringify(parsed)}`;
      }
    } catch {
      // 与服务端一致：无效 JSON 回退到初始稿文本。
    }
  }
  const rawInput = textValue(card.rawInput);
  return rawInput ? `text:${rawInput}` : `card:${card.id}`;
}

function cardRawInput(card: CardDetail) {
  return card.rawInput || '未填写初始稿';
}

function cardTitle(card: CardDetail) {
  return card.rawInput || card.normalizedStatement || '未填写初始稿';
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError';
}

function createMapErrorText(error: unknown) {
  return mapNameErrorText(error);
}

function mapNameErrorText(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === 'map_name_conflict') return '已有同名图谱，请换一个名称。';
    if (error.code === 'invalid_request') return '图谱名称不能超过 40 个字。';
    return error.message || '图谱创建失败，请重试。';
  }
  return '图谱创建失败，请检查服务是否正在运行。';
}
