export interface SolarLayoutNode {
  id: string;
  level: number;
  createdAt?: string;
  parentId?: string;
  derived?: boolean;
}

export interface SolarLayoutEdge {
  sourceNodeId: string;
  targetNodeId: string;
  createdAt?: string;
}

export interface SolarLayoutPoint {
  x: number;
  y: number;
  z: number;
  angle: number;
  orbitRadius: number;
  kind: 'sun' | 'planet' | 'asteroid';
}

const FIRST_ORBIT_RADIUS = 150;
const ORBIT_GAP = 110;
const CHILD_BRANCH_SPREAD = Math.PI / 3;
const ASTEROID_DISTANCE = 28;
const FULL_CIRCLE = Math.PI * 2;

export function solarOrbitRadius(level: number) {
  return FIRST_ORBIT_RADIUS + Math.max(0, level - 2) * ORBIT_GAP;
}

export function buildSolarOrbitLayout(
  nodes: readonly SolarLayoutNode[],
  edges: readonly SolarLayoutEdge[],
) {
  const sortedNodes = [...nodes].sort(compareNodes);
  const nodesById = new Map(sortedNodes.map((node) => [node.id, node]));
  const parentById = buildParentIndex(sortedNodes, edges, nodesById);
  const ordinaryNodes = sortedNodes.filter((node) => !node.derived);
  const sun = ordinaryNodes.find((node) => !parentById.has(node.id));
  const points = new Map<string, SolarLayoutPoint>();

  if (!sun) return points;

  points.set(sun.id, {
    x: 0,
    y: 0,
    z: 0,
    angle: 0,
    orbitRadius: 0,
    kind: 'sun',
  });

  const childrenById = new Map<string, SolarLayoutNode[]>();
  for (const node of ordinaryNodes) {
    const parentId = parentById.get(node.id);
    if (!parentId || node.id === sun.id) continue;
    childrenById.set(parentId, [...(childrenById.get(parentId) ?? []), node]);
  }

  const primaryBranches = ordinaryNodes.filter((node) => (
    node.id !== sun.id
    && (parentById.get(node.id) === sun.id || !parentById.has(node.id))
  ));

  primaryBranches.forEach((node, index) => {
    const angle = -Math.PI / 2 + (FULL_CIRCLE * index) / primaryBranches.length;
    placeBranch(node, angle, sun.level, childrenById, points, new Set([sun.id]));
  });

  for (const node of ordinaryNodes) {
    if (points.has(node.id)) continue;
    const index = points.size - 1;
    const angle = -Math.PI / 2 + (FULL_CIRCLE * index) / Math.max(1, ordinaryNodes.length - 1);
    placePlanet(node, angle, Math.max(sun.level + 1, node.level), points);
  }

  const derivedByParent = new Map<string, SolarLayoutNode[]>();
  for (const node of sortedNodes.filter((candidate) => candidate.derived)) {
    const parentId = parentById.get(node.id);
    if (!parentId || !points.has(parentId)) continue;
    derivedByParent.set(parentId, [...(derivedByParent.get(parentId) ?? []), node]);
  }

  for (const [parentId, derivedNodes] of derivedByParent) {
    const parent = points.get(parentId)!;
    derivedNodes.forEach((node, index) => {
      const localAngle = parent.angle + (FULL_CIRCLE * index) / derivedNodes.length + Math.PI / 4;
      const x = parent.x + Math.cos(localAngle) * ASTEROID_DISTANCE;
      const y = parent.y + Math.sin(localAngle) * ASTEROID_DISTANCE;
      const z = parent.z + Math.sin(localAngle * 2) * ASTEROID_DISTANCE * 0.24;
      points.set(node.id, {
        x,
        y,
        z,
        angle: Math.atan2(y, x),
        orbitRadius: Math.hypot(x, y),
        kind: 'asteroid',
      });
    });
  }

  return points;
}

function placeBranch(
  node: SolarLayoutNode,
  angle: number,
  parentLevel: number,
  childrenById: ReadonlyMap<string, SolarLayoutNode[]>,
  points: Map<string, SolarLayoutPoint>,
  ancestry: Set<string>,
) {
  if (ancestry.has(node.id) || points.has(node.id)) return;
  placePlanet(node, angle, Math.max(parentLevel + 1, node.level), points);

  const children = childrenById.get(node.id) ?? [];
  const nextAncestry = new Set(ancestry).add(node.id);
  children.forEach((child, index) => {
    const offset = children.length === 1
      ? 0
      : CHILD_BRANCH_SPREAD * (index / (children.length - 1) - 0.5);
    placeBranch(child, angle + offset, Math.max(parentLevel + 1, node.level), childrenById, points, nextAncestry);
  });
}

function placePlanet(
  node: SolarLayoutNode,
  angle: number,
  effectiveLevel: number,
  points: Map<string, SolarLayoutPoint>,
) {
  const orbitRadius = solarOrbitRadius(effectiveLevel);
  points.set(node.id, {
    x: Math.cos(angle) * orbitRadius,
    y: Math.sin(angle) * orbitRadius,
    z: Math.sin((angle * 2) + effectiveLevel) * Math.min(32, orbitRadius * 0.07),
    angle,
    orbitRadius,
    kind: 'planet',
  });
}

function buildParentIndex(
  nodes: readonly SolarLayoutNode[],
  edges: readonly SolarLayoutEdge[],
  nodesById: ReadonlyMap<string, SolarLayoutNode>,
) {
  const parentById = new Map<string, string>();
  for (const node of nodes) {
    if (node.parentId && nodesById.has(node.parentId) && node.parentId !== node.id) {
      parentById.set(node.id, node.parentId);
    }
  }

  const sortedEdges = [...edges].sort(compareEdges);
  for (const edge of sortedEdges) {
    if (
      parentById.has(edge.targetNodeId)
      || edge.sourceNodeId === edge.targetNodeId
      || !nodesById.has(edge.sourceNodeId)
      || !nodesById.has(edge.targetNodeId)
    ) continue;
    parentById.set(edge.targetNodeId, edge.sourceNodeId);
  }
  return parentById;
}

function compareNodes(first: SolarLayoutNode, second: SolarLayoutNode) {
  return first.level - second.level
    || (first.createdAt ?? '').localeCompare(second.createdAt ?? '')
    || first.id.localeCompare(second.id);
}

function compareEdges(first: SolarLayoutEdge, second: SolarLayoutEdge) {
  return (first.createdAt ?? '').localeCompare(second.createdAt ?? '')
    || first.sourceNodeId.localeCompare(second.sourceNodeId)
    || first.targetNodeId.localeCompare(second.targetNodeId);
}
