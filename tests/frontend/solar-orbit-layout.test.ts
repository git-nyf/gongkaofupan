import { describe, expect, it } from 'vitest';
import {
  buildSolarOrbitLayout,
  solarOrbitRadius,
  type SolarLayoutEdge,
  type SolarLayoutNode,
} from '../../src/graphs/solarOrbitLayout';

const fullCircle = Math.PI * 2;

function angularDistance(first: number, second: number) {
  const difference = Math.abs(first - second) % fullCircle;
  return Math.min(difference, fullCircle - difference);
}

function pointDistance(
  first: { x: number; y: number; z: number },
  second: { x: number; y: number; z: number },
) {
  return Math.hypot(first.x - second.x, first.y - second.y, first.z - second.z);
}

describe('太阳系轨道布局', () => {
  it('把最低层且最早创建的无父普通节点放在中心作为太阳', () => {
    const nodes: SolarLayoutNode[] = [
      { id: 'later-root', level: 1, createdAt: '2026-08-02T00:00:00.000Z' },
      { id: 'derived-root', level: 0, derived: true },
      { id: 'sun', level: 1, createdAt: '2026-08-01T00:00:00.000Z' },
    ];

    const layout = buildSolarOrbitLayout(nodes, []);

    expect(layout.get('sun')).toEqual({
      x: 0,
      y: 0,
      z: 0,
      angle: 0,
      orbitRadius: 0,
      kind: 'sun',
    });
    expect(layout.get('later-root')?.kind).toBe('planet');
  });

  it('让二级及更深普通节点落在逐层递增的主轨道上', () => {
    const nodes: SolarLayoutNode[] = [
      { id: 'sun', level: 1 },
      { id: 'level-2', level: 2, parentId: 'sun' },
      { id: 'level-3', level: 3, parentId: 'level-2' },
    ];

    const layout = buildSolarOrbitLayout(nodes, []);

    expect(solarOrbitRadius(2)).toBe(150);
    expect(solarOrbitRadius(3)).toBe(260);
    expect(layout.get('level-2')?.orbitRadius).toBe(solarOrbitRadius(2));
    expect(layout.get('level-3')?.orbitRadius).toBe(solarOrbitRadius(3));
  });

  it('让主轨道默认正对相机展开，同时保留轻微纵深', () => {
    const nodes: SolarLayoutNode[] = [
      { id: 'sun', level: 1 },
      { id: 'north', level: 2, parentId: 'sun' },
      { id: 'east', level: 2, parentId: 'sun' },
      { id: 'south', level: 2, parentId: 'sun' },
      { id: 'west', level: 2, parentId: 'sun' },
    ];

    const layout = buildSolarOrbitLayout(nodes, []);
    const planets = ['north', 'east', 'south', 'west'].map((id) => layout.get(id)!);

    expect(Math.max(...planets.map(({ x }) => x)) - Math.min(...planets.map(({ x }) => x))).toBeGreaterThan(250);
    expect(Math.max(...planets.map(({ y }) => y)) - Math.min(...planets.map(({ y }) => y))).toBeGreaterThan(250);
    expect(Math.max(...planets.map(({ z }) => Math.abs(z)))).toBeLessThan(40);
  });

  it('让深层子节点继承父分支方向并保持角度接近', () => {
    const nodes: SolarLayoutNode[] = [
      { id: 'sun', level: 1 },
      { id: 'branch-a', level: 2 },
      { id: 'branch-b', level: 2 },
      { id: 'child-a', level: 3 },
    ];
    const edges: SolarLayoutEdge[] = [
      { sourceNodeId: 'sun', targetNodeId: 'branch-a' },
      { sourceNodeId: 'sun', targetNodeId: 'branch-b' },
      { sourceNodeId: 'branch-a', targetNodeId: 'child-a' },
    ];

    const layout = buildSolarOrbitLayout(nodes, edges);
    const parent = layout.get('branch-a')!;
    const child = layout.get('child-a')!;

    expect(angularDistance(parent.angle, child.angle)).toBeLessThanOrEqual(Math.PI / 6);
  });

  it('让同父普通兄弟在父分支附近分散开', () => {
    const nodes: SolarLayoutNode[] = [
      { id: 'sun', level: 1 },
      { id: 'parent', level: 2, parentId: 'sun' },
      { id: 'child-a', level: 3, parentId: 'parent' },
      { id: 'child-b', level: 3, parentId: 'parent' },
      { id: 'child-c', level: 3, parentId: 'parent' },
    ];

    const layout = buildSolarOrbitLayout(nodes, []);
    const parentAngle = layout.get('parent')!.angle;
    const childAngles = ['child-a', 'child-b', 'child-c']
      .map((id) => layout.get(id)!.angle);

    expect(new Set(childAngles).size).toBe(3);
    expect(angularDistance(childAngles[0], childAngles[2])).toBeGreaterThan(0.2);
    for (const angle of childAngles) {
      expect(angularDistance(parentAngle, angle)).toBeLessThanOrEqual(Math.PI / 6);
    }
  });

  it('把派生节点作为贴近父行星的小陨石而不分配新主轨道', () => {
    const nodes: SolarLayoutNode[] = [
      { id: 'sun', level: 1 },
      { id: 'planet', level: 2, parentId: 'sun' },
      { id: 'ai-derived', level: 4, parentId: 'planet', derived: true },
    ];

    const layout = buildSolarOrbitLayout(nodes, []);
    const parent = layout.get('planet')!;
    const asteroid = layout.get('ai-derived')!;

    expect(asteroid.kind).toBe('asteroid');
    expect(pointDistance(parent, asteroid)).toBeGreaterThan(0);
    expect(pointDistance(parent, asteroid)).toBeLessThan(50);
    expect(asteroid.orbitRadius).not.toBe(solarOrbitRadius(4));
  });

  it('输入节点和边的顺序变化时仍返回完全相同的坐标', () => {
    const nodes: SolarLayoutNode[] = [
      { id: 'root-b', level: 1, createdAt: '2026-08-02T00:00:00.000Z' },
      { id: 'asteroid', level: 3, parentId: 'planet-a', derived: true },
      { id: 'planet-b', level: 2 },
      { id: 'sun', level: 1, createdAt: '2026-08-01T00:00:00.000Z' },
      { id: 'planet-a', level: 2 },
      { id: 'moon-a', level: 3 },
    ];
    const edges: SolarLayoutEdge[] = [
      { sourceNodeId: 'planet-a', targetNodeId: 'moon-a', createdAt: '2026-08-02' },
      { sourceNodeId: 'sun', targetNodeId: 'planet-b', createdAt: '2026-08-01' },
      { sourceNodeId: 'sun', targetNodeId: 'planet-a', createdAt: '2026-08-01' },
    ];

    const first = buildSolarOrbitLayout(nodes, edges);
    const reordered = buildSolarOrbitLayout([...nodes].reverse(), [...edges].reverse());

    expect(reordered).toEqual(first);
    expect(first.get('root-b')).toBeDefined();
    expect(first.get('root-b')?.kind).toBe('planet');
  });
});
