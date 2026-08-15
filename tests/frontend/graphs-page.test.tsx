// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  CardDetail,
  CardSearchResult,
  KnowledgeMapDetail,
} from '../../shared/contracts';
import App from '../../src/App';

const graphMock = vi.hoisted(() => {
  const controlListeners = new Set<() => void>();
  return {
    cameraDistance: 900,
    cameraX: 0,
    cameraY: 0,
    cameraZ: 900,
    camera: vi.fn(() => ({
      position: {
        x: graphMock.cameraX,
        y: graphMock.cameraY,
        z: graphMock.cameraZ,
        length: () => graphMock.cameraDistance,
      },
    })),
    cameraPosition: vi.fn(),
    controlListeners,
    controls: {
      addEventListener: vi.fn((type: string, listener: () => void) => {
        if (type === 'change') controlListeners.add(listener);
      }),
      removeEventListener: vi.fn((type: string, listener: () => void) => {
        if (type === 'change') controlListeners.delete(listener);
      }),
    },
    screen2GraphCoords: vi.fn(() => ({ x: 1, y: 1, z: 1 })),
    zoomToFit: vi.fn(),
  };
});

vi.mock('react-force-graph-3d', async () => {
  const React = await vi.importActual<typeof import('react')>('react');
  const ForceGraph3D = React.forwardRef((props: Record<string, any>, ref) => {
    React.useImperativeHandle(ref, () => ({
      camera: graphMock.camera,
      cameraPosition: graphMock.cameraPosition,
      controls: () => graphMock.controls,
      screen2GraphCoords: graphMock.screen2GraphCoords,
      zoomToFit: graphMock.zoomToFit,
    }));
    const nodes = props.graphData?.nodes ?? [];
    const links = props.graphData?.links ?? [];
    return React.createElement(
      'div',
      { 'data-testid': 'force-graph', role: 'img', 'aria-label': '模拟 3D 图谱' },
      React.createElement('span', null, `球状节点 ${nodes.length}`),
      nodes
        .filter((node: { placeholder?: boolean }) => !node.placeholder)
        .map((node: {
          derived?: boolean;
          id: string;
          level?: number;
          name: string;
          parentId?: string;
          x?: number;
          y?: number;
          z?: number;
        }) => {
          const summaryObject = props.nodeThreeObject?.(node);
          const orbitRadius = Math.hypot(node.x ?? 0, node.y ?? 0, node.z ?? 0);
          return React.createElement(
            'button',
            {
              'data-color': props.nodeColor?.(node),
              'data-kind': node.derived ? 'derived' : 'knowledge',
              'data-level': node.level,
              'data-orbit-radius': orbitRadius,
              'data-parent-id': node.parentId,
              'data-summary': summaryObject?.userData?.summary,
              'data-summary-height': summaryObject?.userData?.summaryHeight,
              'data-summary-scale-x': summaryObject?.scale?.x,
              'data-summary-scale-y': summaryObject?.scale?.y,
              'data-summary-screen-fixed': String(summaryObject?.material?.sizeAttenuation === false),
              'data-summary-visible': String(summaryObject?.visible ?? false),
              'data-summary-width': summaryObject?.userData?.summaryWidth,
              'data-value': props.nodeVal?.(node),
              'data-x': node.x,
              'data-y': node.y,
              'data-z': node.z,
              key: node.id,
              onClick: (event: MouseEvent) => props.onNodeClick?.(node, event),
              onContextMenu: (event: MouseEvent) => props.onNodeRightClick?.(node, event),
              onMouseEnter: () => props.onNodeHover?.(node),
              onMouseLeave: () => props.onNodeHover?.(null),
              type: 'button',
            },
            `节点 ${node.name}`,
          );
        }),
      links
        .filter((link: { placeholder?: boolean }) => !link.placeholder)
        .map((link: { id: string; label: string }) => React.createElement(
          'span',
          {
            'data-color': props.linkColor?.(link),
            'data-label': props.linkLabel?.(link),
            'data-width': props.linkWidth?.(link),
            key: link.id,
            onMouseEnter: () => props.onLinkHover?.(link),
            onMouseLeave: () => props.onLinkHover?.(null),
          },
          link.label,
        )),
    );
  });
  return { default: ForceGraph3D };
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function card(overrides: Partial<CardDetail> = {}): CardDetail {
  return {
    id: 'card-a',
    entryMode: 'knowledge',
    rawInput: '宪法原文',
    rawContentJson: null,
    template: '常识判断',
    normalizedStatement: '宪法整理稿',
    wrongPoint: '',
    analysis: '宪法解析',
    mnemonic: '宪法速记',
    extension: '',
    notes: '',
    aiStatus: 'ready',
    sourceType: 'manual',
    sourceDetail: '',
    wrongCount: 1,
    archived: false,
    createdAt: '2026-08-01T09:00:00.000Z',
    updatedAt: '2026-08-01T09:00:00.000Z',
    categories: [
      { id: '常识判断', name: '常识判断', parentId: null },
      { id: '常识判断/法律', name: '法律', parentId: '常识判断' },
    ],
    tags: [{ id: 'tag-law', name: '法律', origin: 'user' }],
    attachments: [],
    quizItems: [],
    ...overrides,
  };
}

function emptyDetail(): KnowledgeMapDetail {
  return {
    map: {
      id: 'map-1',
      name: '法律图谱',
      nodeCount: 0,
      edgeCount: 0,
      createdAt: '2026-08-01T09:00:00.000Z',
      updatedAt: '2026-08-01T09:00:00.000Z',
    },
    nodes: [],
    edges: [],
  };
}

function searchResult(
  items: CardDetail[],
  overrides: Partial<Pick<CardSearchResult, 'page' | 'pageSize' | 'total'>> = {},
): CardSearchResult {
  return {
    items,
    total: overrides.total ?? items.length,
    page: overrides.page ?? 1,
    pageSize: overrides.pageSize ?? 100,
  };
}

function renderAtGraphs() {
  window.history.pushState({}, '', '/graphs');
  return render(<App />);
}

function dragCardToCanvas(label: string, container: HTMLElement) {
  const store = new Map<string, string>();
  const dataTransfer = {
    dropEffect: '',
    effectAllowed: '',
    getData: vi.fn((type: string) => store.get(type) ?? ''),
    setData: vi.fn((type: string, value: string) => {
      store.set(type, value);
    }),
  };
  const cardNode = screen.getByText(label).closest('article');
  expect(cardNode).not.toBeNull();
  fireEvent.dragStart(cardNode!, { dataTransfer });
  const canvas = container.querySelector('.graphs-canvas');
  expect(canvas).not.toBeNull();
  fireEvent.drop(canvas!, { dataTransfer, clientX: 240, clientY: 260 });
}

async function openChildCardSearch(parentTitle: string) {
  await userEvent.click(screen.getByRole('button', { name: `为“${parentTitle}”添加子节点` }));
  const composer = screen.getByRole('form', { name: `为“${parentTitle}”添加子节点` });
  await userEvent.click(within(composer).getByRole('button', { name: '搜索卡片' }));
  return composer;
}

describe('图谱页面', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal('confirm', vi.fn(() => true));
    graphMock.cameraPosition.mockReset();
    graphMock.cameraDistance = 900;
    graphMock.cameraX = 0;
    graphMock.cameraY = 0;
    graphMock.cameraZ = 900;
    graphMock.camera.mockClear();
    graphMock.controlListeners.clear();
    graphMock.controls.addEventListener.mockClear();
    graphMock.controls.removeEventListener.mockClear();
    graphMock.screen2GraphCoords.mockReset();
    graphMock.screen2GraphCoords.mockReturnValue({ x: 1, y: 1, z: 1 });
    graphMock.zoomToFit.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('空输入点击添加图谱会创建默认图谱', async () => {
    const createdDetail: KnowledgeMapDetail = {
      ...emptyDetail(),
      map: {
        ...emptyDetail().map,
        id: 'map-created',
        name: '知识图谱 1',
      },
    };
    const requests: unknown[] = [];
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = new URL(String(input), 'http://localhost');
      if (url.pathname === '/api/knowledge-maps' && !init?.method) return jsonResponse([]);
      if (url.pathname === '/api/cards') return jsonResponse(searchResult([]));
      if (url.pathname === '/api/knowledge-maps' && init?.method === 'POST') {
        const body = JSON.parse(String(init.body));
        requests.push(body);
        return jsonResponse(createdDetail, 201);
      }
      if (url.pathname === '/api/knowledge-maps/map-created' && !init?.method) {
        return jsonResponse(createdDetail);
      }
      throw new Error(`未模拟的请求：${String(input)}`);
    });

    renderAtGraphs();

    expect(await screen.findByText('先创建一张专题图谱')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '添加图谱' }));

    await waitFor(() => expect(requests).toEqual([{}]));
    expect(await screen.findByRole('heading', { name: '知识图谱 1' })).toBeInTheDocument();
  });

  it('支持重命名当前图谱', async () => {
    let detail = emptyDetail();
    const requests: unknown[] = [];
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = new URL(String(input), 'http://localhost');
      if (url.pathname === '/api/knowledge-maps' && !init?.method) return jsonResponse([detail.map]);
      if (url.pathname === '/api/knowledge-maps/map-1' && !init?.method) return jsonResponse(detail);
      if (url.pathname === '/api/cards') return jsonResponse(searchResult([]));
      if (url.pathname === '/api/knowledge-maps/map-1' && init?.method === 'PATCH') {
        const body = JSON.parse(String(init.body));
        requests.push(body);
        detail = {
          ...detail,
          map: { ...detail.map, name: body.name },
        };
        return jsonResponse(detail);
      }
      throw new Error(`未模拟的请求：${String(input)}`);
    });

    renderAtGraphs();

    expect(await screen.findByRole('heading', { name: '法律图谱' })).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText('当前图谱名称'));
    await userEvent.type(screen.getByLabelText('当前图谱名称'), '数量关系图谱');
    await userEvent.click(screen.getByRole('button', { name: '重命名' }));

    await waitFor(() => expect(requests).toEqual([{ name: '数量关系图谱' }]));
    expect(await screen.findByRole('heading', { name: '数量关系图谱' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /数量关系图谱/ })).toBeInTheDocument();
  });

  it('进入图谱页后显示球状预览，并支持切换编辑和添加卡片子节点', async () => {
    let detail: KnowledgeMapDetail = {
      ...emptyDetail(),
      map: { ...emptyDetail().map, nodeCount: 1 },
      nodes: [{
        id: 'node-root', mapId: 'map-1', cardId: null, title: '法律总论', content: '', level: 1,
        x: 0, y: 0, z: 0,
        createdAt: '2026-08-01T09:00:00.000Z', updatedAt: '2026-08-01T09:00:00.000Z', card: null,
      } as unknown as KnowledgeMapDetail['nodes'][number]],
    };
    const sourceCard = card();
    const requests: unknown[] = [];
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = new URL(String(input), 'http://localhost');
      if (url.pathname === '/api/knowledge-maps' && !init?.method) return jsonResponse([detail.map]);
      if (url.pathname === '/api/knowledge-maps/map-1' && !init?.method) return jsonResponse(detail);
      if (url.pathname === '/api/cards') return jsonResponse(searchResult([sourceCard]));
      if (url.pathname === '/api/knowledge-maps/map-1/nodes' && init?.method === 'POST') {
        const body = JSON.parse(String(init.body));
        requests.push(body);
        detail = {
          map: { ...detail.map, nodeCount: 2 },
          nodes: [...detail.nodes, {
            id: 'node-a',
            mapId: 'map-1',
            cardId: body.cardId,
            title: '',
            content: '',
            level: body.level,
            x: body.x,
            y: body.y,
            z: body.z,
            createdAt: '2026-08-01T10:00:00.000Z',
            updatedAt: '2026-08-01T10:00:00.000Z',
            card: sourceCard,
          }],
          edges: [],
        };
        return jsonResponse(detail, 201);
      }
      if (url.pathname === '/api/knowledge-maps/map-1/edges' && init?.method === 'POST') {
        const body = JSON.parse(String(init.body));
        requests.push(body);
        detail = {
          ...detail,
          map: { ...detail.map, edgeCount: 1 },
          edges: [{
            id: 'edge-a', mapId: 'map-1', sourceNodeId: body.sourceNodeId,
            targetNodeId: body.targetNodeId, label: body.label,
            createdAt: '2026-08-01T10:01:00.000Z', updatedAt: '2026-08-01T10:01:00.000Z',
          }],
        };
        return jsonResponse(detail, 201);
      }
      throw new Error(`未模拟的请求：${String(input)}`);
    });

    const { container } = renderAtGraphs();

    expect(await screen.findByRole('heading', { name: '法律图谱' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '3D 预览' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/球状节点/)).toBeInTheDocument();
    expect(screen.getByText('1 个知识点')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: '图谱模式' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '层级' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '关系' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '掌握' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '居中' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '横向编辑' }));
    expect(screen.getByRole('button', { name: '横向编辑' })).toHaveAttribute('aria-pressed', 'true');
    const composer = await openChildCardSearch('法律总论');
    expect(await within(composer).findByText('宪法原文')).toBeInTheDocument();
    await userEvent.click(within(composer).getByRole('button', { name: '添加卡片：宪法原文' }));

    expect(await screen.findByText('已保存')).toBeInTheDocument();
    expect(requests[0]).toMatchObject({ cardId: 'card-a', level: 2 });
    expect(requests[1]).toMatchObject({
      sourceNodeId: 'node-root', targetNodeId: 'node-a', label: '分支',
    });
    await userEvent.click(screen.getByRole('button', { name: '2D 预览' }));
    const mindMapWorld = container.querySelector('.graphs-plane__world') as HTMLElement | null;
    expect(Number.parseFloat(mindMapWorld?.style.width ?? '0')).toBeGreaterThan(920);
    expect(Number.parseFloat(mindMapWorld?.style.height ?? '0')).toBeGreaterThan(680);
    const planeNode = screen.getByRole('button', { name: '节点 宪法原文' });
    expect(planeNode).toBeInTheDocument();
    expect(planeNode).not.toHaveClass('liquid-pressable');
    expect(screen.queryByText('宪法整理稿')).not.toBeInTheDocument();
    expect(screen.queryByText('宪法解析')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '3D 预览' }));
    expect(screen.getByRole('button', { name: '3D 预览' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('3D 预览悬浮或选中节点时不会被自动自转拉回默认视角', async () => {
    const animationCallbacks: FrameRequestCallback[] = [];
    const requestAnimationFrameSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      animationCallbacks.push(callback);
      return animationCallbacks.length;
    });
    const cancelAnimationFrameSpy = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    const sourceCard = card();
    const detail: KnowledgeMapDetail = {
      ...emptyDetail(),
      map: { ...emptyDetail().map, nodeCount: 1 },
      nodes: [{
        id: 'node-a',
        mapId: 'map-1',
        cardId: 'card-a',
        title: '',
        content: '',
        level: 1,
        x: 260,
        y: 0,
        z: 0,
        createdAt: '2026-08-01T10:00:00.000Z',
        updatedAt: '2026-08-01T10:00:00.000Z',
        card: sourceCard,
      } as KnowledgeMapDetail['nodes'][number] & { level: number }],
      edges: [],
    };
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = new URL(String(input), 'http://localhost');
      if (url.pathname === '/api/knowledge-maps' && !init?.method) return jsonResponse([detail.map]);
      if (url.pathname === '/api/knowledge-maps/map-1' && !init?.method) return jsonResponse(detail);
      if (url.pathname === '/api/cards') return jsonResponse(searchResult([sourceCard]));
      throw new Error(`未模拟的请求：${String(input)}`);
    });

    try {
      renderAtGraphs();

      const node = await screen.findByRole('button', { name: '节点 宪法原文' });
      await waitFor(() => expect(animationCallbacks.length).toBeGreaterThan(0));

      fireEvent.mouseEnter(node);
      expect(await screen.findByText('子树：宪法原文 · 0 子点')).toBeInTheDocument();
      graphMock.cameraPosition.mockClear();
      animationCallbacks[animationCallbacks.length - 1](window.performance.now() + 5000);
      expect(graphMock.cameraPosition).not.toHaveBeenCalled();

      fireEvent.mouseLeave(node);
      fireEvent.click(node);
      expect(await screen.findByText('用户初始稿')).toBeInTheDocument();
      graphMock.cameraPosition.mockClear();
      animationCallbacks[animationCallbacks.length - 1](window.performance.now() + 5000);
      expect(graphMock.cameraPosition).not.toHaveBeenCalled();
    } finally {
      requestAnimationFrameSpy.mockRestore();
      cancelAnimationFrameSpy.mockRestore();
    }
  });

  it('3D 悬停结束恢复自转时沿用用户当前相机轨道', async () => {
    const animationCallbacks: FrameRequestCallback[] = [];
    const requestAnimationFrameSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      animationCallbacks.push(callback);
      return animationCallbacks.length;
    });
    const cancelAnimationFrameSpy = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    const sourceCard = card();
    const detail: KnowledgeMapDetail = {
      ...emptyDetail(),
      map: { ...emptyDetail().map, nodeCount: 1 },
      nodes: [{
        id: 'node-a', mapId: 'map-1', cardId: 'card-a', level: 1, x: 260, y: 0, z: 0,
        createdAt: '2026-08-01T10:00:00.000Z', updatedAt: '2026-08-01T10:00:00.000Z', card: sourceCard,
      } as KnowledgeMapDetail['nodes'][number] & { level: number }],
      edges: [],
    };
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = new URL(String(input), 'http://localhost');
      if (url.pathname === '/api/knowledge-maps' && !init?.method) return jsonResponse([detail.map]);
      if (url.pathname === '/api/knowledge-maps/map-1' && !init?.method) return jsonResponse(detail);
      if (url.pathname === '/api/cards') return jsonResponse(searchResult([sourceCard]));
      throw new Error(`未模拟的请求：${String(input)}`);
    });

    try {
      renderAtGraphs();
      const node = await screen.findByRole('button', { name: '节点 宪法原文' });
      await waitFor(() => expect(animationCallbacks.length).toBeGreaterThan(0));
      graphMock.cameraDistance = Math.hypot(120, 70, 360);
      graphMock.cameraX = 120;
      graphMock.cameraY = 70;
      graphMock.cameraZ = 360;
      act(() => graphMock.controlListeners.forEach((listener) => listener()));

      fireEvent.mouseEnter(node);
      fireEvent.mouseLeave(node);
      graphMock.cameraPosition.mockClear();
      animationCallbacks[animationCallbacks.length - 1](window.performance.now() + 5000);

      const [position] = graphMock.cameraPosition.mock.calls[0] as [{ x: number; y: number; z: number }];
      expect(Math.hypot(position.x, position.z)).toBeCloseTo(Math.hypot(120, 360), 0);
      expect(position.y).toBe(70);
    } finally {
      requestAnimationFrameSpy.mockRestore();
      cancelAnimationFrameSpy.mockRestore();
    }
  });

  it('横向编辑模式下可以直接添加中心知识点并在 3D 中按类型显示节点', async () => {
    let detail = emptyDetail();
    const requests: unknown[] = [];
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = new URL(String(input), 'http://localhost');
      if (url.pathname === '/api/knowledge-maps' && !init?.method) return jsonResponse([detail.map]);
      if (url.pathname === '/api/knowledge-maps/map-1' && !init?.method) return jsonResponse(detail);
      if (url.pathname === '/api/cards') return jsonResponse(searchResult([]));
      if (url.pathname === '/api/knowledge-maps/map-1/nodes' && init?.method === 'POST') {
        const body = JSON.parse(String(init.body));
        requests.push(body);
        detail = {
          map: { ...detail.map, nodeCount: 1 },
          nodes: [...detail.nodes, {
            id: 'custom-node',
            mapId: 'map-1',
            cardId: null,
            title: body.title,
            content: body.content,
            level: body.level,
            x: body.x,
            y: body.y,
            z: body.z,
            createdAt: '2026-08-01T10:00:00.000Z',
            updatedAt: '2026-08-01T10:00:00.000Z',
            card: null,
          }],
          edges: [],
        };
        return jsonResponse(detail, 201);
      }
      throw new Error(`未模拟的请求：${String(input)}`);
    });

    renderAtGraphs();

    expect(await screen.findByRole('heading', { name: '法律图谱' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '横向编辑' }));
    await userEvent.type(screen.getByLabelText('中心主题'), '行政行为');
    await userEvent.click(screen.getByRole('button', { name: '创建中心主题' }));

    expect(await screen.findByRole('button', { name: '节点 行政行为' })).toHaveAttribute('data-level', '1');
    expect(requests[0]).toMatchObject({ title: '行政行为', content: '', level: 1 });

    await userEvent.click(screen.getByRole('button', { name: '3D 预览' }));
    expect(screen.getByRole('button', { name: '节点 行政行为' })).toHaveAttribute(
      'data-color',
      '#9d2822',
    );
  });

  it('编辑模式下正文为空也可以添加自定义知识点', async () => {
    let detail = emptyDetail();
    const requests: unknown[] = [];
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = new URL(String(input), 'http://localhost');
      if (url.pathname === '/api/knowledge-maps' && !init?.method) return jsonResponse([detail.map]);
      if (url.pathname === '/api/knowledge-maps/map-1' && !init?.method) return jsonResponse(detail);
      if (url.pathname === '/api/cards') return jsonResponse(searchResult([]));
      if (url.pathname === '/api/knowledge-maps/map-1/nodes' && init?.method === 'POST') {
        const body = JSON.parse(String(init.body));
        requests.push(body);
        detail = {
          map: { ...detail.map, nodeCount: 1 },
          nodes: [{
            id: 'custom-empty-content',
            mapId: 'map-1',
            cardId: null,
            title: body.title,
            content: body.content,
            level: body.level,
            x: body.x,
            y: body.y,
            z: body.z,
            createdAt: '2026-08-01T10:00:00.000Z',
            updatedAt: '2026-08-01T10:00:00.000Z',
            card: null,
          }],
          edges: [],
        };
        return jsonResponse(detail, 201);
      }
      throw new Error(`未模拟的请求：${String(input)}`);
    });

    renderAtGraphs();

    expect(await screen.findByRole('heading', { name: '法律图谱' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '横向编辑' }));
    await userEvent.type(screen.getByLabelText('中心主题'), '数量关系');
    await userEvent.click(screen.getByRole('button', { name: '创建中心主题' }));

    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0]).toMatchObject({ title: '数量关系', content: '', level: 1 });
    expect(await screen.findByRole('button', { name: '节点 数量关系' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('选中其他节点后新建知识点仍只创建独立节点，不自动生成连线', async () => {
    const sourceCard = card();
    let detail: KnowledgeMapDetail = {
      ...emptyDetail(),
      map: { ...emptyDetail().map, nodeCount: 1 },
      nodes: [{
        id: 'node-a',
        mapId: 'map-1',
        cardId: 'card-a',
        title: '',
        content: '',
        level: 1,
        x: 260,
        y: 0,
        z: 0,
        createdAt: '2026-08-01T10:00:00.000Z',
        updatedAt: '2026-08-01T10:00:00.000Z',
        card: sourceCard,
      }],
      edges: [],
    };
    const requests: Array<{ path: string; body: unknown }> = [];
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = new URL(String(input), 'http://localhost');
      if (url.pathname === '/api/knowledge-maps' && !init?.method) return jsonResponse([detail.map]);
      if (url.pathname === '/api/knowledge-maps/map-1' && !init?.method) return jsonResponse(detail);
      if (url.pathname === '/api/cards') return jsonResponse(searchResult([]));
      if (url.pathname === '/api/knowledge-maps/map-1/nodes' && init?.method === 'POST') {
        const body = JSON.parse(String(init.body));
        requests.push({ path: url.pathname, body });
        detail = {
          map: { ...detail.map, nodeCount: 2 },
          nodes: [
            detail.nodes[0],
            {
              id: 'custom-child',
              mapId: 'map-1',
              cardId: null,
              title: body.title,
              content: body.content,
              level: body.level,
              x: body.x,
              y: body.y,
              z: body.z,
              createdAt: '2026-08-01T10:01:00.000Z',
              updatedAt: '2026-08-01T10:01:00.000Z',
              card: null,
            },
          ],
          edges: [],
        };
        return jsonResponse(detail, 201);
      }
      if (url.pathname === '/api/knowledge-maps/map-1/edges' && init?.method === 'POST') {
        const body = JSON.parse(String(init.body));
        requests.push({ path: url.pathname, body });
        detail = {
          ...detail,
          map: { ...detail.map, edgeCount: 1 },
          edges: [{
            id: 'edge-branch',
            mapId: 'map-1',
            sourceNodeId: body.sourceNodeId,
            targetNodeId: body.targetNodeId,
            label: body.label,
            createdAt: '2026-08-01T10:02:00.000Z',
            updatedAt: '2026-08-01T10:02:00.000Z',
          }],
        };
        return jsonResponse(detail, 201);
      }
      throw new Error(`未模拟的请求：${String(input)}`);
    });

    renderAtGraphs();

    expect(await screen.findByRole('heading', { name: '法律图谱' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '横向编辑' }));
    await userEvent.click(screen.getByRole('button', { name: '节点 宪法原文' }));
    await userEvent.type(screen.getByLabelText('中心主题'), '行政许可');
    fireEvent.submit(screen.getByLabelText('中心主题').closest('form')!);

    await waitFor(() => expect(requests.some(({ path }) => path.endsWith('/nodes'))).toBe(true));
    expect(requests.filter(({ path }) => path.endsWith('/edges'))).toHaveLength(0);
    expect(requests.find(({ path }) => path.endsWith('/nodes'))?.body).toEqual(expect.objectContaining({
      title: '行政许可',
      content: '',
      level: 1,
    }));
    expect(await screen.findByRole('button', { name: '节点 行政许可' })).toHaveAttribute('data-level', '1');
    expect(document.querySelectorAll('.graphs-plane-link-label')).toHaveLength(0);
  });

  it('从节点添加入口导入卡片会创建下一层子节点和分支连线', async () => {
    const sourceCard = card();
    const branchCard = card({
      id: 'card-b',
      rawInput: '法律原文',
      normalizedStatement: '法律整理稿',
    });
    let detail: KnowledgeMapDetail = {
      ...emptyDetail(),
      map: { ...emptyDetail().map, nodeCount: 1 },
      nodes: [{
        id: 'node-a',
        mapId: 'map-1',
        cardId: 'card-a',
        title: '',
        content: '',
        level: 1,
        x: 260,
        y: 0,
        z: 0,
        createdAt: '2026-08-01T10:00:00.000Z',
        updatedAt: '2026-08-01T10:00:00.000Z',
        card: sourceCard,
      }],
      edges: [],
    };
    const requests: Array<{ path: string; body: unknown }> = [];
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = new URL(String(input), 'http://localhost');
      if (url.pathname === '/api/knowledge-maps' && !init?.method) return jsonResponse([detail.map]);
      if (url.pathname === '/api/knowledge-maps/map-1' && !init?.method) return jsonResponse(detail);
      if (url.pathname === '/api/cards') return jsonResponse(searchResult([branchCard]));
      if (url.pathname === '/api/knowledge-maps/map-1/nodes' && init?.method === 'POST') {
        const body = JSON.parse(String(init.body));
        requests.push({ path: url.pathname, body });
        detail = {
          map: { ...detail.map, nodeCount: 2 },
          nodes: [
            detail.nodes[0],
            {
              id: 'node-b',
              mapId: 'map-1',
              cardId: body.cardId,
              title: '',
              content: '',
              level: body.level,
              x: body.x,
              y: body.y,
              z: body.z,
              createdAt: '2026-08-01T10:01:00.000Z',
              updatedAt: '2026-08-01T10:01:00.000Z',
              card: branchCard,
            },
          ],
          edges: [],
        };
        return jsonResponse(detail, 201);
      }
      if (url.pathname === '/api/knowledge-maps/map-1/edges' && init?.method === 'POST') {
        const body = JSON.parse(String(init.body));
        requests.push({ path: url.pathname, body });
        detail = {
          ...detail,
          map: { ...detail.map, edgeCount: 1 },
          edges: [{
            id: 'edge-branch',
            mapId: 'map-1',
            sourceNodeId: body.sourceNodeId,
            targetNodeId: body.targetNodeId,
            label: body.label,
            createdAt: '2026-08-01T10:02:00.000Z',
            updatedAt: '2026-08-01T10:02:00.000Z',
          }],
        };
        return jsonResponse(detail, 201);
      }
      throw new Error(`未模拟的请求：${String(input)}`);
    });

    renderAtGraphs();

    expect(await screen.findByRole('heading', { name: '法律图谱' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '横向编辑' }));
    const composer = await openChildCardSearch('宪法原文');
    expect(await within(composer).findByText('法律原文')).toBeInTheDocument();

    await userEvent.click(within(composer).getByRole('button', { name: '添加卡片：法律原文' }));

    await waitFor(() => expect(requests).toHaveLength(2));
    expect(requests.filter(({ path }) => path.endsWith('/edges'))).toHaveLength(1);
    expect(requests.find(({ path }) => path.endsWith('/nodes'))?.body).toEqual(expect.objectContaining({
      cardId: 'card-b',
      level: 2,
    }));
    expect(requests.find(({ path }) => path.endsWith('/edges'))?.body).toEqual(expect.objectContaining({
      sourceNodeId: 'node-a',
      targetNodeId: 'node-b',
      label: '分支',
    }));
    expect(await screen.findByRole('button', { name: '节点 法律原文' })).toHaveAttribute('data-level', '2');
  });

  it('横向紧凑搜索结果完整显示用户初始稿内容', async () => {
    const rawInput = '第一行：数量关系中的工程问题，需要完整阅读条件。\n第二行：不要只看 AI 整理稿。';
    const sourceCard = card({
      rawInput,
      normalizedStatement: '这是 AI 整理稿，不应该作为右侧卡片结果正文展示',
    });
    const detail: KnowledgeMapDetail = {
      ...emptyDetail(),
      map: { ...emptyDetail().map, nodeCount: 1 },
      nodes: [{
        id: 'search-parent', mapId: 'map-1', cardId: null, title: '数量关系', content: '', level: 1,
        x: 0, y: 0, z: 0,
        createdAt: '2026-08-01T09:00:00.000Z', updatedAt: '2026-08-01T09:00:00.000Z', card: null,
      } as unknown as KnowledgeMapDetail['nodes'][number]],
    };
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = new URL(String(input), 'http://localhost');
      if (url.pathname === '/api/knowledge-maps' && !init?.method) return jsonResponse([detail.map]);
      if (url.pathname === '/api/knowledge-maps/map-1' && !init?.method) return jsonResponse(detail);
      if (url.pathname === '/api/cards') return jsonResponse(searchResult([sourceCard]));
      throw new Error(`未模拟的请求：${String(input)}`);
    });

    renderAtGraphs();

    expect(await screen.findByRole('heading', { name: '法律图谱' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '横向编辑' }));
    const composer = await openChildCardSearch('数量关系');
    expect(await within(composer).findByText(rawInput.replace(/\s+/g, ' '))).toBeInTheDocument();
  });

  it('横向紧凑搜索按原始来源去重且每次搜索只拉取受限的首屏分页', async () => {
    const firstCard = card({ id: 'card-page-1', rawInput: '第一页初始稿' });
    const sameSourceCard = card({
      id: 'card-page-1-sibling',
      rawInput: '第一页初始稿',
      normalizedStatement: '同一初始稿第二张卡片',
    });
    const secondCard = card({ id: 'card-page-2', rawInput: '第二页初始稿' });
    const queryFirstCard = card({ id: 'card-query-page-1', rawInput: '查询第一页初始稿' });
    const querySecondCard = card({ id: 'card-query-page-2', rawInput: '查询第二页初始稿' });
    const requests: Array<{
      contentVersion: string | null;
      page: string | null;
      pageSize: string | null;
      query: string | null;
    }> = [];
    const detail: KnowledgeMapDetail = {
      ...emptyDetail(),
      map: { ...emptyDetail().map, nodeCount: 1 },
      nodes: [{
        id: 'pagination-parent', mapId: 'map-1', cardId: null, title: '分页根节点', content: '', level: 1,
        x: 0, y: 0, z: 0,
        createdAt: '2026-08-01T09:00:00.000Z', updatedAt: '2026-08-01T09:00:00.000Z', card: null,
      } as unknown as KnowledgeMapDetail['nodes'][number]],
    };
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = new URL(String(input), 'http://localhost');
      if (url.pathname === '/api/knowledge-maps' && !init?.method) return jsonResponse([detail.map]);
      if (url.pathname === '/api/knowledge-maps/map-1' && !init?.method) return jsonResponse(detail);
      if (url.pathname === '/api/cards') {
        requests.push({
          contentVersion: url.searchParams.get('contentVersion'),
          page: url.searchParams.get('page'),
          pageSize: url.searchParams.get('pageSize'),
          query: url.searchParams.get('query'),
        });
        const query = url.searchParams.get('query') ?? '';
        const pageSize = Number(url.searchParams.get('pageSize'));
        if (url.searchParams.get('page') === '1') {
          return jsonResponse(searchResult(
            query ? [queryFirstCard] : [firstCard, sameSourceCard],
            { page: 1, pageSize, total: pageSize + 1 },
          ));
        }
        return jsonResponse(searchResult(
          query ? [querySecondCard] : [secondCard],
          { page: 2, pageSize, total: pageSize + 1 },
        ));
      }
      throw new Error(`未模拟的请求：${String(input)}`);
    });

    renderAtGraphs();

    expect(await screen.findByRole('heading', { name: '法律图谱' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '横向编辑' }));
    const composer = await openChildCardSearch('分页根节点');
    expect(await within(composer).findAllByText('第一页初始稿')).toHaveLength(1);
    expect(within(composer).queryByText('第二页初始稿')).not.toBeInTheDocument();
    expect(within(composer).queryByText('同一初始稿第二张卡片')).not.toBeInTheDocument();
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ contentVersion: 'original', page: '1', query: '' });
    expect(Number(requests[0].pageSize)).toBeLessThanOrEqual(30);

    requests.length = 0;
    await userEvent.type(within(composer).getByRole('searchbox', { name: '搜索卡片库内容' }), '宪法');
    expect(await within(composer).findByText('查询第一页初始稿')).toBeInTheDocument();
    expect(within(composer).queryByText('查询第二页初始稿')).not.toBeInTheDocument();
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ contentVersion: 'original', page: '1', query: '宪法' });
    expect(Number(requests[0].pageSize)).toBeLessThanOrEqual(30);
  });

  it('右键节点不会提供自动创建分支入口', async () => {
    const sourceCard = card();
    const detail: KnowledgeMapDetail = {
      ...emptyDetail(),
      map: { ...emptyDetail().map, nodeCount: 1 },
      nodes: [{
        id: 'node-a',
        mapId: 'map-1',
        cardId: 'card-a',
        title: '',
        content: '',
        level: 1,
        x: 260,
        y: 0,
        z: 0,
        createdAt: '2026-08-01T10:00:00.000Z',
        updatedAt: '2026-08-01T10:00:00.000Z',
        card: sourceCard,
      }],
    };
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = new URL(String(input), 'http://localhost');
      if (url.pathname === '/api/knowledge-maps' && !init?.method) return jsonResponse([detail.map]);
      if (url.pathname === '/api/knowledge-maps/map-1' && !init?.method) return jsonResponse(detail);
      if (url.pathname === '/api/cards') return jsonResponse(searchResult([sourceCard]));
      throw new Error(`未模拟的请求：${String(input)}`);
    });

    renderAtGraphs();

    expect(await screen.findByRole('heading', { name: '法律图谱' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '2D 预览' }));
    const node = screen.getByRole('button', { name: '节点 宪法原文' });
    fireEvent.contextMenu(node, { clientX: 420, clientY: 280 });
    expect(screen.queryByRole('menuitem', { name: '添加分支' })).not.toBeInTheDocument();
  });

  it('保留已有节点层级但编辑模式不再暴露层级选择', async () => {
    const sourceCard = card();
    const detail: KnowledgeMapDetail = {
      ...emptyDetail(),
      map: { ...emptyDetail().map, nodeCount: 1 },
      nodes: [{
        id: 'node-a',
        mapId: 'map-1',
        cardId: 'card-a',
        level: 3,
        x: 0,
        y: 0,
        z: 0,
        createdAt: '2026-08-01T10:00:00.000Z',
        updatedAt: '2026-08-01T10:00:00.000Z',
        card: sourceCard,
      } as KnowledgeMapDetail['nodes'][number] & { level: number }],
      edges: [],
    };
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = new URL(String(input), 'http://localhost');
      if (url.pathname === '/api/knowledge-maps' && !init?.method) return jsonResponse([detail.map]);
      if (url.pathname === '/api/knowledge-maps/map-1' && !init?.method) return jsonResponse(detail);
      if (url.pathname === '/api/cards') return jsonResponse(searchResult([sourceCard]));
      throw new Error(`未模拟的请求：${String(input)}`);
    });

    renderAtGraphs();

    expect(await screen.findByRole('heading', { name: '法律图谱' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '横向编辑' }));
    const node = screen.getByRole('button', { name: '节点 宪法原文' });
    expect(node).toHaveAttribute('data-level', '3');

    await userEvent.click(node);
    expect(await screen.findByLabelText('节点详情')).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: '节点层级' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '节点 宪法原文' })).toHaveAttribute('data-level', '3');
  });

  it('双击节点会选中并完整回显详情，标题编辑实时同步画布，点击空白后清空表单', async () => {
    const relatedCard = card({ id: 'card-b', rawInput: '行政法关联知识点' });
    let detail: KnowledgeMapDetail = {
      ...emptyDetail(),
      map: { ...emptyDetail().map, nodeCount: 2, edgeCount: 1 },
      nodes: [
        {
          id: 'node-custom', mapId: 'map-1', cardId: null, title: '行政处罚', content: '当事人享有陈述申辩权',
          level: 2, x: 0, y: 0, z: 260,
          createdAt: '2026-08-01T10:00:00.000Z', updatedAt: '2026-08-01T10:00:00.000Z', card: null,
        },
        {
          id: 'node-related', mapId: 'map-1', cardId: 'card-b', title: '', content: '', level: 1,
          x: 0, y: 0, z: 0,
          createdAt: '2026-08-01T10:01:00.000Z', updatedAt: '2026-08-01T10:01:00.000Z', card: relatedCard,
        },
      ] as KnowledgeMapDetail['nodes'],
      edges: [{
        id: 'edge-related', mapId: 'map-1', sourceNodeId: 'node-related', targetNodeId: 'node-custom', label: '补充',
        createdAt: '2026-08-01T10:02:00.000Z', updatedAt: '2026-08-01T10:02:00.000Z',
      }],
    };
    const patches: unknown[] = [];
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = new URL(String(input), 'http://localhost');
      if (url.pathname === '/api/knowledge-maps' && !init?.method) return jsonResponse([detail.map]);
      if (url.pathname === '/api/knowledge-maps/map-1' && !init?.method) return jsonResponse(detail);
      if (url.pathname === '/api/cards') return jsonResponse(searchResult([relatedCard]));
      if (url.pathname === '/api/knowledge-maps/map-1/nodes/node-custom' && init?.method === 'PATCH') {
        const body = JSON.parse(String(init.body));
        patches.push(body);
        detail = {
          ...detail,
          nodes: detail.nodes.map((node) => node.id === 'node-custom' ? { ...node, ...body } : node),
        };
        return jsonResponse(detail);
      }
      throw new Error(`未模拟的请求：${String(input)}`);
    });

    renderAtGraphs();

    expect(await screen.findByRole('heading', { name: '法律图谱' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '横向编辑' }));
    expect(screen.queryByLabelText('节点详情')).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('行政处罚')).not.toBeInTheDocument();

    fireEvent.doubleClick(screen.getByRole('button', { name: '节点 行政处罚' }));

    expect(await screen.findByLabelText('节点详情')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: '行政处罚' })).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: '节点层级' })).not.toBeInTheDocument();
    const titleInput = screen.getByRole('textbox', { name: '标题' });
    const contentInput = screen.getByRole('textbox', { name: '正文' });
    expect(titleInput).toHaveValue('行政处罚');
    expect(contentInput).toHaveValue('当事人享有陈述申辩权');
    expect(screen.getByRole('button', { name: '删除连线：行政法关联知识点 到 行政处罚' })).toBeInTheDocument();

    fireEvent.change(titleInput, { target: { value: '行政处罚决定' } });
    expect(screen.getByRole('button', { name: '节点 行政处罚决定' })).toBeInTheDocument();
    await waitFor(() => expect(patches).toContainEqual({ title: '行政处罚决定' }));

    fireEvent.click(document.querySelector('.graphs-horizontal__viewport')!);
    expect(screen.queryByLabelText('节点详情')).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('行政处罚决定')).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('当事人享有陈述申辩权')).not.toBeInTheDocument();

    fireEvent.doubleClick(screen.getByRole('button', { name: '节点 行政法关联知识点' }));
    expect(await screen.findByRole('heading', { name: '行政法关联知识点' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '标题' })).toHaveValue('行政法关联知识点');
    expect(screen.getByRole('textbox', { name: '正文' })).toHaveValue('行政法关联知识点');
  });

  it('2D 预览长按节点不会创建或修改关系', async () => {
    vi.stubGlobal('PointerEvent', undefined);
    const firstCard = card();
    const secondCard = card({ id: 'card-b', rawInput: '法律原文', normalizedStatement: '法律整理稿' });
    let detail: KnowledgeMapDetail = {
      ...emptyDetail(),
      map: { ...emptyDetail().map, nodeCount: 2 },
      nodes: [
        {
          id: 'node-a', mapId: 'map-1', cardId: 'card-a', level: 1, x: 0, y: 0, z: 0,
          createdAt: '2026-08-01T10:00:00.000Z', updatedAt: '2026-08-01T10:00:00.000Z', card: firstCard,
        },
        {
          id: 'node-b', mapId: 'map-1', cardId: 'card-b', level: 2, x: 0, y: 0, z: 0,
          createdAt: '2026-08-01T10:01:00.000Z', updatedAt: '2026-08-01T10:01:00.000Z', card: secondCard,
        },
      ] as KnowledgeMapDetail['nodes'],
      edges: [],
    };
    const requests: unknown[] = [];
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = new URL(String(input), 'http://localhost');
      if (url.pathname === '/api/knowledge-maps' && !init?.method) return jsonResponse([detail.map]);
      if (url.pathname === '/api/knowledge-maps/map-1' && !init?.method) return jsonResponse(detail);
      if (url.pathname === '/api/cards') return jsonResponse(searchResult([firstCard, secondCard]));
      if (url.pathname === '/api/knowledge-maps/map-1/edges' && init?.method === 'POST') {
        const body = JSON.parse(String(init.body));
        requests.push(body);
        detail = {
          ...detail,
          map: { ...detail.map, edgeCount: 1 },
          edges: [{
            id: 'edge-long-press', mapId: 'map-1', ...body,
            createdAt: '2026-08-01T10:02:00.000Z', updatedAt: '2026-08-01T10:02:00.000Z',
          }],
        };
        return jsonResponse(detail, 201);
      }
      throw new Error(`未模拟的请求：${String(input)}`);
    });

    renderAtGraphs();

    expect(await screen.findByRole('heading', { name: '法律图谱' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '2D 预览' }));
    const source = screen.getByRole('button', { name: '节点 宪法原文' });
    const target = screen.getByRole('button', { name: '节点 法律原文' });
    const initialTargetPosition = `${target.style.left}:${target.style.top}`;
    expect(screen.queryByRole('button', { name: '连接节点' })).not.toBeInTheDocument();

    fireEvent.mouseDown(source, { button: 0, clientX: 300, clientY: 300 });
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 520));
    });
    fireEvent.mouseMove(target, { clientX: 560, clientY: 360 });
    fireEvent.mouseUp(target, { clientX: 560, clientY: 360 });

    expect(requests).toHaveLength(0);
    expect(`${target.style.left}:${target.style.top}`).toBe(initialTargetPosition);
    expect(document.querySelectorAll('.graphs-plane-link-label')).toHaveLength(0);
  });

  it('长按节点拖到空白区域不创建连线，也不会改变节点位置', async () => {
    vi.stubGlobal('PointerEvent', undefined);
    const sourceCard = card();
    const detail: KnowledgeMapDetail = {
      ...emptyDetail(),
      map: { ...emptyDetail().map, nodeCount: 1 },
      nodes: [{
        id: 'node-a',
        mapId: 'map-1',
        cardId: 'card-a',
        title: '',
        content: '',
        level: 2,
        x: 0,
        y: 0,
        z: 260,
        createdAt: '2026-08-01T10:00:00.000Z',
        updatedAt: '2026-08-01T10:00:00.000Z',
        card: sourceCard,
      }],
      edges: [],
    };
    const requests: Array<{ path: string; body: unknown }> = [];
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = new URL(String(input), 'http://localhost');
      if (url.pathname === '/api/knowledge-maps' && !init?.method) return jsonResponse([detail.map]);
      if (url.pathname === '/api/knowledge-maps/map-1' && !init?.method) return jsonResponse(detail);
      if (url.pathname === '/api/cards') return jsonResponse(searchResult([sourceCard]));
      if (url.pathname === '/api/knowledge-maps/map-1/nodes/node-a' && init?.method === 'PATCH') {
        const body = JSON.parse(String(init.body));
        requests.push({ path: url.pathname, body });
        return jsonResponse(detail);
      }
      if (url.pathname === '/api/knowledge-maps/map-1/edges' && init?.method === 'POST') {
        const body = JSON.parse(String(init.body));
        requests.push({ path: url.pathname, body });
        return jsonResponse(detail, 201);
      }
      throw new Error(`未模拟的请求：${String(input)}`);
    });

    renderAtGraphs();

    expect(await screen.findByRole('heading', { name: '法律图谱' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '2D 预览' }));
    const node = screen.getByRole('button', { name: '节点 宪法原文' });
    const planeElement = document.querySelector('.graphs-plane') as HTMLDivElement;
    const initialPosition = { left: node.style.left, top: node.style.top };

    fireEvent.mouseDown(node, { button: 0, clientX: 320, clientY: 300 });
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 520));
    });
    fireEvent.mouseMove(node, { clientX: 680, clientY: 560 });
    expect(node.style.left).toBe(initialPosition.left);
    expect(node.style.top).toBe(initialPosition.top);
    fireEvent.mouseUp(planeElement, { clientX: 680, clientY: 560 });

    await act(async () => Promise.resolve());
    expect(requests).toHaveLength(0);
  });

  it('Ctrl+Z 可以撤销刚创建的自定义节点', async () => {
    let detail = emptyDetail();
    const deletedNodes: string[] = [];
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = new URL(String(input), 'http://localhost');
      if (url.pathname === '/api/knowledge-maps' && !init?.method) return jsonResponse([detail.map]);
      if (url.pathname === '/api/knowledge-maps/map-1' && !init?.method) return jsonResponse(detail);
      if (url.pathname === '/api/cards') return jsonResponse(searchResult([]));
      if (url.pathname === '/api/knowledge-maps/map-1/nodes' && init?.method === 'POST') {
        const body = JSON.parse(String(init.body));
        detail = {
          ...detail,
          map: { ...detail.map, nodeCount: 1 },
          nodes: [{
            id: 'node-undo', mapId: 'map-1', cardId: null, title: body.title, content: body.content,
            level: body.level, x: body.x, y: body.y, z: body.z,
            createdAt: '2026-08-01T10:00:00.000Z', updatedAt: '2026-08-01T10:00:00.000Z', card: null,
          }] as KnowledgeMapDetail['nodes'],
        };
        return jsonResponse(detail, 201);
      }
      if (url.pathname === '/api/knowledge-maps/map-1/nodes/node-undo' && init?.method === 'DELETE') {
        deletedNodes.push('node-undo');
        detail = { ...detail, map: { ...detail.map, nodeCount: 0 }, nodes: [] };
        return jsonResponse(detail);
      }
      throw new Error(`未模拟的请求：${String(input)}`);
    });

    renderAtGraphs();

    expect(await screen.findByRole('heading', { name: '法律图谱' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '横向编辑' }));
    expect(screen.getByRole('button', { name: '撤销上一步' })).toBeDisabled();
    await userEvent.type(screen.getByLabelText('中心主题'), '待撤销节点');
    await userEvent.click(screen.getByRole('button', { name: '创建中心主题' }));

    expect(await screen.findByRole('button', { name: '节点 待撤销节点' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '撤销上一步' })).toBeEnabled();
    fireEvent.keyDown(window, { ctrlKey: true, key: 'z' });

    await waitFor(() => expect(deletedNodes).toEqual(['node-undo']));
    expect(screen.queryByRole('button', { name: '节点 待撤销节点' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '撤销上一步' })).toBeDisabled();
  });

  it('Ctrl+Z 可以撤销刚创建的手动连线', async () => {
    vi.stubGlobal('PointerEvent', undefined);
    const firstCard = card();
    const secondCard = card({ id: 'card-b', rawInput: '法律原文', normalizedStatement: '法律整理稿' });
    let detail: KnowledgeMapDetail = {
      ...emptyDetail(),
      map: { ...emptyDetail().map, nodeCount: 2 },
      nodes: [
        { id: 'node-a', mapId: 'map-1', cardId: 'card-a', level: 1, x: 0, y: 0, z: 0,
          createdAt: '2026-08-01T10:00:00.000Z', updatedAt: '2026-08-01T10:00:00.000Z', card: firstCard },
        { id: 'node-b', mapId: 'map-1', cardId: 'card-b', level: 2, x: 0, y: 0, z: 0,
          createdAt: '2026-08-01T10:01:00.000Z', updatedAt: '2026-08-01T10:01:00.000Z', card: secondCard },
      ] as KnowledgeMapDetail['nodes'],
      edges: [],
    };
    const deletedEdges: string[] = [];
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = new URL(String(input), 'http://localhost');
      if (url.pathname === '/api/knowledge-maps' && !init?.method) return jsonResponse([detail.map]);
      if (url.pathname === '/api/knowledge-maps/map-1' && !init?.method) return jsonResponse(detail);
      if (url.pathname === '/api/cards') return jsonResponse(searchResult([firstCard, secondCard]));
      if (url.pathname === '/api/knowledge-maps/map-1/nodes' && init?.method === 'POST') {
        const body = JSON.parse(String(init.body));
        detail = {
          ...detail,
          map: { ...detail.map, nodeCount: 3 },
          nodes: [...detail.nodes, {
            id: 'node-c', mapId: 'map-1', cardId: null, title: body.title, content: body.content,
            level: body.level, x: body.x, y: body.y, z: body.z,
            createdAt: '2026-08-01T10:02:00.000Z', updatedAt: '2026-08-01T10:02:00.000Z', card: null,
          } as unknown as KnowledgeMapDetail['nodes'][number]],
        };
        return jsonResponse(detail, 201);
      }
      if (url.pathname === '/api/knowledge-maps/map-1/edges' && init?.method === 'POST') {
        const body = JSON.parse(String(init.body));
        detail = {
          ...detail,
          map: { ...detail.map, edgeCount: 1 },
          edges: [{
            id: 'edge-undo', mapId: 'map-1', ...body,
            createdAt: '2026-08-01T10:02:00.000Z', updatedAt: '2026-08-01T10:02:00.000Z',
          }],
        };
        return jsonResponse(detail, 201);
      }
      if (url.pathname === '/api/knowledge-maps/map-1/edges/edge-undo' && init?.method === 'DELETE') {
        deletedEdges.push('edge-undo');
        detail = { ...detail, map: { ...detail.map, edgeCount: 0 }, edges: [] };
        return jsonResponse(detail);
      }
      throw new Error(`未模拟的请求：${String(input)}`);
    });

    renderAtGraphs();
    expect(await screen.findByRole('heading', { name: '法律图谱' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '横向编辑' }));
    await userEvent.click(screen.getByRole('button', { name: '为“宪法原文”添加子节点' }));
    await userEvent.type(screen.getByRole('textbox', { name: '新子节点标题' }), '新分支');
    await userEvent.click(screen.getByRole('button', { name: '保存子节点' }));
    expect(await screen.findByText('已保存')).toBeInTheDocument();

    fireEvent.keyDown(window, { ctrlKey: true, key: 'z' });

    await waitFor(() => expect(deletedEdges).toEqual(['edge-undo']));
    expect(screen.getByText('0 条分支')).toBeInTheDocument();
  });

  it('已有分支线支持高亮并可从节点详情单独删除', async () => {
    const firstCard = card();
    const secondCard = card({
      id: 'card-b',
      rawInput: '法律原文',
      normalizedStatement: '法律整理稿',
    });
    let detail: KnowledgeMapDetail = {
      ...emptyDetail(),
      map: { ...emptyDetail().map, nodeCount: 3, edgeCount: 2 },
      nodes: [
        {
          id: 'node-a',
          mapId: 'map-1',
          cardId: 'card-a',
          level: 1,
          x: 260,
          y: 0,
          z: 0,
          createdAt: '2026-08-01T10:00:00.000Z',
          updatedAt: '2026-08-01T10:00:00.000Z',
          card: firstCard,
        } as KnowledgeMapDetail['nodes'][number] & { level: number },
        {
          id: 'node-b',
          mapId: 'map-1',
          cardId: 'card-b',
          level: 2,
          x: 0,
          y: 260,
          z: 0,
          createdAt: '2026-08-01T10:00:00.000Z',
          updatedAt: '2026-08-01T10:00:00.000Z',
          card: secondCard,
        } as KnowledgeMapDetail['nodes'][number] & { level: number },
        {
          id: 'node-c',
          mapId: 'map-1',
          cardId: null,
          title: '孙级分点',
          content: '',
          level: 3,
          x: 0,
          y: 0,
          z: 260,
          createdAt: '2026-08-01T10:01:00.000Z',
          updatedAt: '2026-08-01T10:01:00.000Z',
          card: null,
        } as KnowledgeMapDetail['nodes'][number] & { level: number },
      ],
      edges: [
        {
          id: 'edge-a',
          mapId: 'map-1',
          sourceNodeId: 'node-a',
          targetNodeId: 'node-b',
          label: '易混',
          createdAt: '2026-08-01T10:00:00.000Z',
          updatedAt: '2026-08-01T10:00:00.000Z',
        },
        {
          id: 'edge-b',
          mapId: 'map-1',
          sourceNodeId: 'node-b',
          targetNodeId: 'node-c',
          label: '分支',
          createdAt: '2026-08-01T10:01:00.000Z',
          updatedAt: '2026-08-01T10:01:00.000Z',
        },
      ],
    };
    const deletedEdges: string[] = [];
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = new URL(String(input), 'http://localhost');
      if (url.pathname === '/api/knowledge-maps' && !init?.method) return jsonResponse([detail.map]);
      if (url.pathname === '/api/knowledge-maps/map-1' && !init?.method) return jsonResponse(detail);
      if (url.pathname === '/api/cards') return jsonResponse(searchResult([firstCard, secondCard]));
      if (url.pathname === '/api/knowledge-maps/map-1/edges/edge-a' && init?.method === 'DELETE') {
        deletedEdges.push('edge-a');
        detail = {
          ...detail,
          map: { ...detail.map, edgeCount: 1 },
          edges: detail.edges.filter(({ id }) => id !== 'edge-a'),
        };
        return jsonResponse(detail);
      }
      throw new Error(`未模拟的请求：${String(input)}`);
    });

    renderAtGraphs();

    expect(await screen.findByRole('heading', { name: '法律图谱' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '2D 预览' }));
    expect(screen.getByRole('img', { name: '2D 圈层预览' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '连接节点' })).not.toBeInTheDocument();
    const relatedNode = screen.getByRole('button', { name: '节点 法律原文' });
    const positionBeforeDelete = `${relatedNode.style.left}:${relatedNode.style.top}`;

    const branchLabel = screen.getByText('易混');
    expect(branchLabel).toHaveAttribute('data-label', '易混 · 强度 2.8');
    fireEvent.mouseEnter(branchLabel);
    expect(await screen.findByText('分支：宪法原文 → 法律原文')).toBeInTheDocument();
    fireEvent.mouseEnter(screen.getByRole('button', { name: '节点 宪法原文' }));
    expect(await screen.findByText('子树：宪法原文 · 2 子点')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '节点 宪法原文' })).toHaveAttribute('data-highlighted', 'true');
    expect(screen.getByRole('button', { name: '节点 法律原文' })).toHaveAttribute('data-highlighted', 'true');
    expect(screen.getByRole('button', { name: '节点 孙级分点' })).toHaveAttribute('data-highlighted', 'true');

    await userEvent.click(screen.getByRole('button', { name: '横向编辑' }));
    await userEvent.click(screen.getByRole('button', { name: '节点 宪法原文' }));
    const deleteRelation = await screen.findByRole('button', { name: '删除连线：宪法原文 到 法律原文' });
    await userEvent.click(deleteRelation);
    await waitFor(() => expect(deletedEdges).toEqual(['edge-a']));
    expect(screen.queryByRole('button', { name: '删除连线：宪法原文 到 法律原文' })).not.toBeInTheDocument();
    await waitFor(() => {
      const arrangedNode = screen.getByRole('button', { name: '节点 法律原文' });
      expect(`${arrangedNode.style.left}:${arrangedNode.style.top}`).not.toBe(positionBeforeDelete);
    });
  });

  it('横向编辑模式下可以添加不绑定卡片的中心知识点', async () => {
    let detail = emptyDetail();
    const requests: unknown[] = [];
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = new URL(String(input), 'http://localhost');
      if (url.pathname === '/api/knowledge-maps' && !init?.method) return jsonResponse([detail.map]);
      if (url.pathname === '/api/knowledge-maps/map-1' && !init?.method) return jsonResponse(detail);
      if (url.pathname === '/api/cards') return jsonResponse(searchResult([]));
      if (url.pathname === '/api/knowledge-maps/map-1/nodes' && init?.method === 'POST') {
        const body = JSON.parse(String(init.body));
        requests.push(body);
        detail = {
          map: { ...detail.map, nodeCount: 1 },
          nodes: [{
            id: 'node-custom',
            mapId: 'map-1',
            cardId: null,
            title: body.title,
            content: body.content,
            level: body.level,
            x: body.x,
            y: body.y,
            z: body.z,
            createdAt: '2026-08-01T10:00:00.000Z',
            updatedAt: '2026-08-01T10:00:00.000Z',
            card: null,
          } as unknown as KnowledgeMapDetail['nodes'][number]],
          edges: [],
        };
        return jsonResponse(detail, 201);
      }
      throw new Error(`未模拟的请求：${String(input)}`);
    });

    renderAtGraphs();

    expect(await screen.findByRole('heading', { name: '法律图谱' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '横向编辑' }));
    await userEvent.type(screen.getByLabelText('中心主题'), '行政处罚');
    await userEvent.click(screen.getByRole('button', { name: '创建中心主题' }));

    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0]).toMatchObject({ title: '行政处罚', content: '', level: 1 });
    expect(typeof (requests[0] as { x: unknown }).x).toBe('number');
    expect(await screen.findByRole('button', { name: '节点 行政处罚' })).toBeInTheDocument();
  });

  it('横向模式负责编辑，2D 与 3D 模式仅保留预览能力', async () => {
    const sourceCard = card();
    const detail: KnowledgeMapDetail = {
      ...emptyDetail(),
      map: { ...emptyDetail().map, nodeCount: 1 },
      nodes: [{
        id: 'node-a',
        mapId: 'map-1',
        cardId: 'card-a',
        level: 2,
        x: 0,
        y: 0,
        z: 260,
        createdAt: '2026-08-01T10:00:00.000Z',
        updatedAt: '2026-08-01T10:00:00.000Z',
        card: sourceCard,
      } as KnowledgeMapDetail['nodes'][number] & { level: number }],
      edges: [],
    };
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = new URL(String(input), 'http://localhost');
      if (url.pathname === '/api/knowledge-maps' && !init?.method) return jsonResponse([detail.map]);
      if (url.pathname === '/api/knowledge-maps/map-1' && !init?.method) return jsonResponse(detail);
      if (url.pathname === '/api/cards') return jsonResponse(searchResult([sourceCard]));
      throw new Error(`未模拟的请求：${String(input)}`);
    });

    renderAtGraphs();

    expect(await screen.findByRole('heading', { name: '法律图谱' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '3D 预览' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('force-graph')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '重新排布' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('自定义知识点标题')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '2D 预览' }));
    expect(screen.getByRole('button', { name: '2D 预览' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByTestId('force-graph')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重新排布' })).toBeInTheDocument();
    expect(screen.queryByLabelText('自定义知识点标题')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '节点 宪法原文' })).toBeInTheDocument();

    const nodeBeforeArrange = screen.getByRole('button', { name: '节点 宪法原文' });
    const positionBeforeArrange = `${nodeBeforeArrange.style.left}:${nodeBeforeArrange.style.top}`;
    await userEvent.click(screen.getByRole('button', { name: '重新排布' }));
    const nodeAfterArrange = screen.getByRole('button', { name: '节点 宪法原文' });
    expect(`${nodeAfterArrange.style.left}:${nodeAfterArrange.style.top}`).not.toBe(positionBeforeArrange);

    await userEvent.click(screen.getByRole('button', { name: '横向编辑' }));
    expect(screen.getByRole('button', { name: '横向编辑' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('中心主题')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '为“宪法原文”添加子节点' })).toBeInTheDocument();
    expect(screen.queryByLabelText('横向卡片搜索')).not.toBeInTheDocument();
    const composer = await openChildCardSearch('宪法原文');
    expect(within(composer).getByRole('searchbox', { name: '搜索卡片库内容' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '重新排布' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '3D 预览' }));
    expect(screen.getByRole('button', { name: '3D 预览' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('force-graph')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '重新排布' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('自定义知识点标题')).not.toBeInTheDocument();
  });

  it('2D 思维导图空白处拖动会平移画布且不保存节点位置', async () => {
    vi.stubGlobal('PointerEvent', undefined);
    const sourceCard = card();
    const detail: KnowledgeMapDetail = {
      ...emptyDetail(),
      map: { ...emptyDetail().map, nodeCount: 1 },
      nodes: [{
        id: 'node-a',
        mapId: 'map-1',
        cardId: 'card-a',
        level: 2,
        x: 0,
        y: 0,
        z: 260,
        createdAt: '2026-08-01T10:00:00.000Z',
        updatedAt: '2026-08-01T10:00:00.000Z',
        card: sourceCard,
      } as KnowledgeMapDetail['nodes'][number] & { level: number }],
      edges: [],
    };
    const patches: unknown[] = [];
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = new URL(String(input), 'http://localhost');
      if (url.pathname === '/api/knowledge-maps' && !init?.method) return jsonResponse([detail.map]);
      if (url.pathname === '/api/knowledge-maps/map-1' && !init?.method) return jsonResponse(detail);
      if (url.pathname === '/api/cards') return jsonResponse(searchResult([sourceCard]));
      if (url.pathname === '/api/knowledge-maps/map-1/nodes/node-a' && init?.method === 'PATCH') {
        patches.push(JSON.parse(String(init.body)));
        return jsonResponse(detail);
      }
      throw new Error(`未模拟的请求：${String(input)}`);
    });

    renderAtGraphs();

    expect(await screen.findByRole('heading', { name: '法律图谱' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '2D 预览' }));
    const plane = document.querySelector('.graphs-plane') as HTMLDivElement | null;
    expect(plane).not.toBeNull();
    plane!.scrollLeft = 520;
    plane!.scrollTop = 440;

    fireEvent.mouseDown(plane!, { button: 0, clientX: 420, clientY: 320 });
    expect(plane).toHaveClass('is-panning');
    fireEvent.mouseMove(plane!, { clientX: 360, clientY: 260 });
    expect(plane!.scrollLeft).toBe(580);
    expect(plane!.scrollTop).toBe(500);
    fireEvent.mouseUp(plane!, { clientX: 360, clientY: 260 });

    expect(plane).not.toHaveClass('is-panning');
    expect(patches).toHaveLength(0);
  });

  it('2D 思维导图只在按住 Ctrl 滚动时缩放', async () => {
    const addEventListenerSpy = vi.spyOn(HTMLElement.prototype, 'addEventListener');
    const sourceCard = card();
    const detail: KnowledgeMapDetail = {
      ...emptyDetail(),
      map: { ...emptyDetail().map, nodeCount: 1 },
      nodes: [{
        id: 'node-a',
        mapId: 'map-1',
        cardId: 'card-a',
        level: 1,
        x: 0,
        y: 0,
        z: 0,
        createdAt: '2026-08-01T10:00:00.000Z',
        updatedAt: '2026-08-01T10:00:00.000Z',
        card: sourceCard,
      } as KnowledgeMapDetail['nodes'][number] & { level: number }],
      edges: [],
    };
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = new URL(String(input), 'http://localhost');
      if (url.pathname === '/api/knowledge-maps' && !init?.method) return jsonResponse([detail.map]);
      if (url.pathname === '/api/knowledge-maps/map-1' && !init?.method) return jsonResponse(detail);
      if (url.pathname === '/api/cards') return jsonResponse(searchResult([sourceCard]));
      throw new Error(`未模拟的请求：${String(input)}`);
    });

    renderAtGraphs();

    expect(await screen.findByRole('heading', { name: '法律图谱' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '2D 预览' }));
    const plane = document.querySelector('.graphs-plane') as HTMLDivElement;
    expect(plane).toHaveClass('graphs-plane--white');
    expect(plane).toHaveAttribute('data-zoom', '1');
    expect(addEventListenerSpy).toHaveBeenCalledWith('wheel', expect.any(Function), { passive: false });

    fireEvent.wheel(plane, { ctrlKey: false, deltaY: -100 });
    expect(plane).toHaveAttribute('data-zoom', '1');

    fireEvent.wheel(plane, { ctrlKey: true, deltaY: -100 });
    expect(plane).toHaveAttribute('data-zoom', '1.1');
  });

  it('3D 预览只生成可点击的 AI 优化稿小球并在拉近后显示摘要', async () => {
    const firstCard = card();
    const firstDerivedCard = card({
      id: 'card-a-derived',
      rawInput: '宪法原文',
      normalizedStatement: '第二个 AI 衍生知识点',
      analysis: '第二个 AI 衍生知识点解析',
    });
    const pendingDerivedCard = card({
      aiStatus: 'processing',
      id: 'card-a-processing',
      rawInput: '宪法原文',
      normalizedStatement: '不应显示的待处理衍生',
    });
    const secondCard = card({
      analysis: '法律解析',
      id: 'card-b',
      rawInput: '法律原文',
      normalizedStatement: '法律整理稿',
    });
    const detail: KnowledgeMapDetail = {
      ...emptyDetail(),
      map: { ...emptyDetail().map, nodeCount: 2, edgeCount: 1 },
      nodes: [
        {
          id: 'node-a',
          mapId: 'map-1',
          cardId: 'card-a',
          level: 1,
          x: 260,
          y: 0,
          z: 0,
          createdAt: '2026-08-01T10:00:00.000Z',
          updatedAt: '2026-08-01T10:00:00.000Z',
          card: firstCard,
        } as KnowledgeMapDetail['nodes'][number] & { level: number },
        {
          id: 'node-b',
          mapId: 'map-1',
          cardId: 'card-b',
          level: 3,
          x: 0,
          y: 260,
          z: 0,
          createdAt: '2026-08-01T10:00:00.000Z',
          updatedAt: '2026-08-01T10:00:00.000Z',
          card: secondCard,
        } as KnowledgeMapDetail['nodes'][number] & { level: number },
      ],
      edges: [{
        id: 'edge-a',
        mapId: 'map-1',
        sourceNodeId: 'node-a',
        targetNodeId: 'node-b',
        label: '属于',
        createdAt: '2026-08-01T10:00:00.000Z',
        updatedAt: '2026-08-01T10:00:00.000Z',
      }],
    };
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = new URL(String(input), 'http://localhost');
      if (url.pathname === '/api/knowledge-maps' && !init?.method) return jsonResponse([detail.map]);
      if (url.pathname === '/api/knowledge-maps/map-1' && !init?.method) return jsonResponse(detail);
      if (url.pathname === '/api/cards') return jsonResponse(searchResult([
        firstCard,
        firstDerivedCard,
        pendingDerivedCard,
        secondCard,
      ]));
      throw new Error(`未模拟的请求：${String(input)}`);
    });

    renderAtGraphs();

    const firstNode = await screen.findByRole('button', { name: '节点 宪法原文' });
    const secondNode = screen.getByRole('button', { name: '节点 法律原文' });
    const firstDerivedNode = await screen.findByRole('button', { name: '节点 AI 优化 1：宪法整理稿' });
    const secondDerivedNode = await screen.findByRole('button', { name: '节点 AI 优化 2：第二个 AI 衍生知识点' });
    const singleDerivedNode = await screen.findByRole('button', { name: '节点 AI 优化 1：法律整理稿' });
    expect(screen.getByText('球状节点 5')).toBeInTheDocument();
    expect(document.querySelector('.graphs-canvas')).toHaveClass('is-preview');
    expect(document.querySelector('.graphs-orbit')).not.toBeInTheDocument();
    const previewControls = screen.getByRole('group', { name: '3D 图谱控制' });
    expect(within(previewControls).getByRole('button', { name: '放大图谱' })).toBeInTheDocument();
    expect(within(previewControls).getByRole('button', { name: '缩小图谱' })).toBeInTheDocument();
    expect(within(previewControls).getByRole('button', { name: '适配视图' })).toBeInTheDocument();
    expect(within(previewControls).getByRole('button', { name: '关闭自动旋转' })).toBeInTheDocument();
    expect(screen.getByText('卡片知识点')).toBeInTheDocument();
    expect(screen.getByText('AI 优化稿')).toBeInTheDocument();
    expect(screen.getByText('自定义知识点')).toBeInTheDocument();
    expect(firstNode).toHaveAttribute('data-color', '#9d2822');
    expect(secondNode).toHaveAttribute('data-color', '#cc5a4f');
    expect(firstDerivedNode).toHaveAttribute('data-color', '#b63c32');
    expect(secondDerivedNode).toHaveAttribute('data-color', '#b63c32');
    expect(singleDerivedNode).toHaveAttribute('data-color', '#df8178');
    expect(screen.queryByRole('button', { name: '节点 解析 1：宪法解析' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '节点 解析 2：第二个 AI 衍生知识点解析' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '节点 解析 1：法律解析' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '节点 AI 优化 3：不应显示的待处理衍生' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '节点 AI 优化 2：法律整理稿' })).not.toBeInTheDocument();
    expect(Number(firstDerivedNode.getAttribute('data-value'))).toBeLessThan(Number(secondNode.getAttribute('data-value')));
    expect(Number(firstNode.getAttribute('data-value'))).toBeGreaterThan(Number(secondNode.getAttribute('data-value')));
    const firstRadius = Math.hypot(
      Number(firstNode.getAttribute('data-x')),
      Number(firstNode.getAttribute('data-y')),
      Number(firstNode.getAttribute('data-z')),
    );
    const secondRadius = Math.hypot(
      Number(secondNode.getAttribute('data-x')),
      Number(secondNode.getAttribute('data-y')),
      Number(secondNode.getAttribute('data-z')),
    );
    expect(firstRadius).toBeLessThan(1);
    expect(secondRadius).toBeGreaterThan(140);
    expect(screen.getByText('属于')).toHaveAttribute('data-label', '属于 · 强度 1.6');
    expect(screen.getByText('属于')).toHaveAttribute('data-color', 'rgba(181, 62, 51, 0.34)');
    expect(screen.getByText('属于')).toHaveAttribute('data-width', '0.66');
    expect(firstDerivedNode).toHaveAttribute('data-summary', '宪法整理稿');
    expect(firstDerivedNode).toHaveAttribute('data-summary-visible', 'false');
    const farScale = Number(firstDerivedNode.getAttribute('data-summary-scale-x'));

    graphMock.cameraDistance = 480;
    act(() => graphMock.controlListeners.forEach((listener) => listener()));
    expect(firstDerivedNode).toHaveAttribute('data-summary-visible', 'true');
    expect(firstDerivedNode).toHaveAttribute('data-summary-width');
    expect(firstDerivedNode).toHaveAttribute('data-summary-height');
    expect(firstDerivedNode).toHaveAttribute('data-summary-screen-fixed', 'true');
    expect(Number(firstDerivedNode.getAttribute('data-summary-width'))).toBeLessThanOrEqual(0.28);
    expect(Number(firstDerivedNode.getAttribute('data-summary-height'))).toBeLessThanOrEqual(0.06);
    const nearScale = Number(firstDerivedNode.getAttribute('data-summary-scale-x'));
    expect(nearScale).toBeGreaterThan(farScale);

    graphMock.cameraDistance = 40;
    act(() => graphMock.controlListeners.forEach((listener) => listener()));
    const closeScale = Number(firstDerivedNode.getAttribute('data-summary-scale-x'));
    expect(closeScale).toBeGreaterThanOrEqual(nearScale);

    graphMock.cameraDistance = 2600;
    act(() => graphMock.controlListeners.forEach((listener) => listener()));
    const distantScale = Number(firstDerivedNode.getAttribute('data-summary-scale-x'));
    expect(firstDerivedNode).toHaveAttribute('data-summary-visible', 'false');
    expect(distantScale).toBeLessThanOrEqual(farScale);

    await userEvent.click(within(previewControls).getByRole('button', { name: '关闭自动旋转' }));
    expect(within(previewControls).getByRole('button', { name: '开启自动旋转' })).toBeInTheDocument();

    await userEvent.click(firstDerivedNode);
    expect(await screen.findByRole('heading', { name: 'AI 优化 1：宪法整理稿' })).toBeInTheDocument();
    expect(screen.getByText('宪法整理稿')).toBeInTheDocument();

    await userEvent.click(secondNode);
    expect(firstNode).toHaveAttribute('data-color', '#9d2822');

    graphMock.cameraPosition.mockClear();
    await userEvent.click(within(previewControls).getByRole('button', { name: '放大图谱' }));
    expect(graphMock.cameraPosition).toHaveBeenCalled();
    graphMock.zoomToFit.mockClear();
    await userEvent.click(within(previewControls).getByRole('button', { name: '适配视图' }));
    expect(graphMock.zoomToFit).toHaveBeenCalled();
  });

  it('3D 镜头拉近后普通节点文字明显放大且不超过合理上限', async () => {
    const sourceCard = card();
    const detail: KnowledgeMapDetail = {
      ...emptyDetail(),
      map: { ...emptyDetail().map, nodeCount: 1 },
      nodes: [{
        id: 'node-a',
        mapId: 'map-1',
        cardId: 'card-a',
        level: 1,
        x: 0,
        y: 0,
        z: 0,
        createdAt: '2026-08-01T10:00:00.000Z',
        updatedAt: '2026-08-01T10:00:00.000Z',
        card: sourceCard,
      } as KnowledgeMapDetail['nodes'][number] & { level: number }],
      edges: [],
    };
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = new URL(String(input), 'http://localhost');
      if (url.pathname === '/api/knowledge-maps' && !init?.method) return jsonResponse([detail.map]);
      if (url.pathname === '/api/knowledge-maps/map-1' && !init?.method) return jsonResponse(detail);
      if (url.pathname === '/api/cards') return jsonResponse(searchResult([sourceCard]));
      throw new Error(`未模拟的请求：${String(input)}`);
    });

    renderAtGraphs();

    const node = await screen.findByRole('button', { name: '节点 宪法原文' });
    await waitFor(() => expect(graphMock.controlListeners.size).toBeGreaterThan(0));
    const summaryWidth = Number(node.getAttribute('data-summary-width'));
    const initialScale = Number(node.getAttribute('data-summary-scale-x'));

    await userEvent.click(screen.getByRole('button', { name: '放大图谱' }));
    expect(graphMock.cameraPosition).toHaveBeenCalled();
    graphMock.cameraDistance = 360;
    act(() => graphMock.controlListeners.forEach((listener) => listener()));

    const zoomedScale = Number(node.getAttribute('data-summary-scale-x'));
    expect(zoomedScale).toBeGreaterThan(initialScale * 1.2);
    expect(zoomedScale).toBeLessThanOrEqual(summaryWidth * 2.5);
  });

  it('2D 父子分支按各自子树扇区连续向外排布', async () => {
    const node = (id: string, title: string, level: number, minute: number) => ({
      id,
      mapId: 'map-1',
      cardId: null,
      title,
      content: '',
      level,
      x: 0,
      y: 0,
      z: 0,
      createdAt: `2026-08-01T10:${String(minute).padStart(2, '0')}:00.000Z`,
      updatedAt: `2026-08-01T10:${String(minute).padStart(2, '0')}:00.000Z`,
      card: null,
    }) as unknown as KnowledgeMapDetail['nodes'][number];
    const edge = (id: string, sourceNodeId: string, targetNodeId: string, minute: number) => ({
      id,
      mapId: 'map-1',
      sourceNodeId,
      targetNodeId,
      label: '分支',
      createdAt: `2026-08-01T11:${String(minute).padStart(2, '0')}:00.000Z`,
      updatedAt: `2026-08-01T11:${String(minute).padStart(2, '0')}:00.000Z`,
    });
    const detail: KnowledgeMapDetail = {
      ...emptyDetail(),
      map: { ...emptyDetail().map, nodeCount: 7, edgeCount: 6 },
      nodes: [
        node('root', '总论', 1, 0),
        node('branch-a', '行政法分支', 2, 1),
        node('branch-b', '民法分支', 2, 2),
        node('branch-a-1', '行政许可', 3, 3),
        node('branch-a-2', '行政处罚', 3, 4),
        node('branch-a-3', '行政强制', 3, 5),
        node('branch-b-1', '民事主体', 3, 6),
      ],
      edges: [
        edge('edge-root-a', 'root', 'branch-a', 0),
        edge('edge-root-b', 'root', 'branch-b', 1),
        edge('edge-a-1', 'branch-a', 'branch-a-1', 2),
        edge('edge-a-2', 'branch-a', 'branch-a-2', 3),
        edge('edge-a-3', 'branch-a', 'branch-a-3', 4),
        edge('edge-b-1', 'branch-b', 'branch-b-1', 5),
      ],
    };
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = new URL(String(input), 'http://localhost');
      if (url.pathname === '/api/knowledge-maps' && !init?.method) return jsonResponse([detail.map]);
      if (url.pathname === '/api/knowledge-maps/map-1' && !init?.method) return jsonResponse(detail);
      if (url.pathname === '/api/cards') return jsonResponse(searchResult([]));
      throw new Error(`未模拟的请求：${String(input)}`);
    });

    renderAtGraphs();
    expect(await screen.findByRole('heading', { name: '法律图谱' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '2D 预览' }));

    const position = (name: string) => {
      const element = screen.getByRole('button', { name: `节点 ${name}` });
      return {
        left: Number.parseFloat(element.style.left),
        top: Number.parseFloat(element.style.top),
      };
    };
    const root = position('总论');
    const branchA = position('行政法分支');
    const branchB = position('民法分支');
    const angle = (point: { left: number; top: number }) => Math.atan2(
      point.top - root.top,
      point.left - root.left,
    );
    const angleDistance = (first: number, second: number) => Math.abs(Math.atan2(
      Math.sin(first - second),
      Math.cos(first - second),
    ));
    const radius = (point: { left: number; top: number }) => Math.hypot(
      point.left - root.left,
      point.top - root.top,
    );

    for (const childName of ['行政许可', '行政处罚', '行政强制']) {
      const child = position(childName);
      expect(radius(child)).toBeGreaterThan(radius(branchA));
      expect(angleDistance(angle(child), angle(branchA))).toBeLessThan(
        angleDistance(angle(child), angle(branchB)),
      );
    }
    const branchBChild = position('民事主体');
    expect(radius(branchBChild)).toBeGreaterThan(radius(branchB));
    expect(angleDistance(angle(branchBChild), angle(branchB))).toBeLessThan(
      angleDistance(angle(branchBChild), angle(branchA)),
    );
  });

  it('选中末级节点会高亮祖先链且其他分支线仍保持可见', async () => {
    const node = (id: string, title: string, level: number, minute: number) => ({
      id,
      mapId: 'map-1',
      cardId: null,
      title,
      content: '',
      level,
      x: 0,
      y: 0,
      z: 0,
      createdAt: `2026-08-01T10:${String(minute).padStart(2, '0')}:00.000Z`,
      updatedAt: `2026-08-01T10:${String(minute).padStart(2, '0')}:00.000Z`,
      card: null,
    }) as unknown as KnowledgeMapDetail['nodes'][number];
    const detail: KnowledgeMapDetail = {
      ...emptyDetail(),
      map: { ...emptyDetail().map, nodeCount: 4, edgeCount: 3 },
      nodes: [
        node('root', '法律总论', 1, 0),
        node('parent', '行政法', 2, 1),
        node('leaf', '行政许可', 3, 2),
        node('other', '民法', 2, 3),
      ],
      edges: [
        {
          id: 'edge-root-parent', mapId: 'map-1', sourceNodeId: 'root', targetNodeId: 'parent', label: '分支',
          createdAt: '2026-08-01T11:00:00.000Z', updatedAt: '2026-08-01T11:00:00.000Z',
        },
        {
          id: 'edge-parent-leaf', mapId: 'map-1', sourceNodeId: 'parent', targetNodeId: 'leaf', label: '分支',
          createdAt: '2026-08-01T11:01:00.000Z', updatedAt: '2026-08-01T11:01:00.000Z',
        },
        {
          id: 'edge-root-other', mapId: 'map-1', sourceNodeId: 'root', targetNodeId: 'other', label: '分支',
          createdAt: '2026-08-01T11:02:00.000Z', updatedAt: '2026-08-01T11:02:00.000Z',
        },
      ],
    };
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = new URL(String(input), 'http://localhost');
      if (url.pathname === '/api/knowledge-maps' && !init?.method) return jsonResponse([detail.map]);
      if (url.pathname === '/api/knowledge-maps/map-1' && !init?.method) return jsonResponse(detail);
      if (url.pathname === '/api/cards') return jsonResponse(searchResult([]));
      throw new Error(`未模拟的请求：${String(input)}`);
    });

    renderAtGraphs();
    expect(await screen.findByRole('heading', { name: '法律图谱' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '2D 预览' }));
    await userEvent.click(screen.getByRole('button', { name: '节点 行政许可' }));

    const paths = Array.from(document.querySelectorAll<SVGPathElement>('.graphs-plane__links path'));
    expect(paths).toHaveLength(3);
    paths.forEach((path) => {
      expect(path).not.toHaveAttribute('display', 'none');
      expect(Number(path.getAttribute('stroke-width'))).toBeGreaterThan(0);
      expect(path.getAttribute('stroke')).not.toMatch(/rgba\([^)]*,\s*0\)$/);
    });
    expect(screen.getByRole('button', { name: '节点 法律总论' })).toHaveAttribute('data-highlighted', 'true');
    expect(screen.getByRole('button', { name: '节点 行政法' })).toHaveAttribute('data-highlighted', 'true');
    expect(screen.getByRole('button', { name: '节点 行政许可' })).toHaveAttribute('data-highlighted', 'true');
    expect(paths[0]).not.toHaveClass('is-dimmed');
    expect(paths[1]).not.toHaveClass('is-dimmed');
    expect(paths[2]).toBeInTheDocument();
  });

  it('横向编辑器内可以搜索添加卡片且页面不再保留常驻右侧面板和新增层级选择', async () => {
    const sourceCard = card();
    let detail: KnowledgeMapDetail = {
      ...emptyDetail(),
      map: { ...emptyDetail().map, nodeCount: 1 },
      nodes: [{
        id: 'search-root', mapId: 'map-1', cardId: null, title: '搜索根节点', content: '', level: 1,
        x: 0, y: 0, z: 0,
        createdAt: '2026-08-01T09:00:00.000Z', updatedAt: '2026-08-01T09:00:00.000Z', card: null,
      } as unknown as KnowledgeMapDetail['nodes'][number]],
    };
    const requests: Array<Record<string, unknown>> = [];
    const edgeRequests: Array<Record<string, unknown>> = [];
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = new URL(String(input), 'http://localhost');
      if (url.pathname === '/api/knowledge-maps' && !init?.method) return jsonResponse([detail.map]);
      if (url.pathname === '/api/knowledge-maps/map-1' && !init?.method) return jsonResponse(detail);
      if (url.pathname === '/api/cards') return jsonResponse(searchResult([sourceCard]));
      if (url.pathname === '/api/knowledge-maps/map-1/nodes' && init?.method === 'POST') {
        const body = JSON.parse(String(init.body));
        requests.push(body);
        detail = {
          ...detail,
          map: { ...detail.map, nodeCount: 2 },
          nodes: [...detail.nodes, {
            id: 'card-from-search', mapId: 'map-1', cardId: body.cardId, title: '', content: '',
            level: body.level, x: body.x, y: body.y, z: body.z,
            createdAt: '2026-08-01T10:00:00.000Z', updatedAt: '2026-08-01T10:00:00.000Z', card: sourceCard,
          } as unknown as KnowledgeMapDetail['nodes'][number]],
        };
        return jsonResponse(detail, 201);
      }
      if (url.pathname === '/api/knowledge-maps/map-1/edges' && init?.method === 'POST') {
        const body = JSON.parse(String(init.body));
        edgeRequests.push(body);
        detail = {
          ...detail,
          map: { ...detail.map, edgeCount: 1 },
          edges: [{
            id: 'search-edge', mapId: 'map-1', sourceNodeId: body.sourceNodeId,
            targetNodeId: body.targetNodeId, label: body.label,
            createdAt: '2026-08-01T10:01:00.000Z', updatedAt: '2026-08-01T10:01:00.000Z',
          }],
        };
        return jsonResponse(detail, 201);
      }
      throw new Error(`未模拟的请求：${String(input)}`);
    });

    renderAtGraphs();
    expect(await screen.findByRole('heading', { name: '法律图谱' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '横向编辑' }));

    const horizontalCanvas = screen.getByRole('img', { name: '横向思维导图录入' });
    expect(screen.queryByLabelText('卡片搜索与详情')).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: '右侧面板' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: '新增节点层级' })).not.toBeInTheDocument();

    expect(within(horizontalCanvas).queryByLabelText('横向卡片搜索')).not.toBeInTheDocument();
    const composer = await openChildCardSearch('搜索根节点');
    await userEvent.clear(within(composer).getByRole('searchbox', { name: '搜索卡片库内容' }));
    await userEvent.type(within(composer).getByRole('searchbox', { name: '搜索卡片库内容' }), '宪法');
    expect(await within(composer).findByText('宪法原文')).toBeInTheDocument();
    await userEvent.click(within(composer).getByRole('button', { name: '添加卡片：宪法原文' }));

    await waitFor(() => expect(requests).toHaveLength(1));
    await waitFor(() => expect(edgeRequests).toHaveLength(1));
    expect(requests[0]).toMatchObject({ cardId: 'card-a', level: 2 });
    expect(edgeRequests[0]).toMatchObject({
      sourceNodeId: 'search-root', targetNodeId: 'card-from-search', label: '分支',
    });
    expect(await within(horizontalCanvas).findByRole('button', { name: '节点 宪法原文' })).toBeInTheDocument();
  });

  it('3D 文字摘要与 AI 衍生球体可以独立关闭和开启', async () => {
    const sourceCard = card();
    const derivedCard = card({
      id: 'card-derived',
      rawInput: '宪法原文',
      normalizedStatement: '宪法衍生稿',
    });
    const detail: KnowledgeMapDetail = {
      ...emptyDetail(),
      map: { ...emptyDetail().map, nodeCount: 1 },
      nodes: [{
        id: 'node-a', mapId: 'map-1', cardId: 'card-a', title: '', content: '', level: 1,
        x: 0, y: 0, z: 0,
        createdAt: '2026-08-01T10:00:00.000Z', updatedAt: '2026-08-01T10:00:00.000Z', card: sourceCard,
      } as KnowledgeMapDetail['nodes'][number] & { level: number }],
      edges: [],
    };
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = new URL(String(input), 'http://localhost');
      if (url.pathname === '/api/knowledge-maps' && !init?.method) return jsonResponse([detail.map]);
      if (url.pathname === '/api/knowledge-maps/map-1' && !init?.method) return jsonResponse(detail);
      if (url.pathname === '/api/cards') return jsonResponse(searchResult([sourceCard, derivedCard]));
      throw new Error(`未模拟的请求：${String(input)}`);
    });

    graphMock.cameraDistance = 480;
    renderAtGraphs();
    const sourceNode = await screen.findByRole('button', { name: '节点 宪法原文' });
    const derivedNodeName = '节点 AI 优化 1：宪法整理稿';
    expect(await screen.findByRole('button', { name: derivedNodeName })).toHaveAttribute('data-summary-visible', 'true');
    const previewControls = screen.getByRole('group', { name: '3D 图谱控制' });
    const summaryToggle = within(previewControls).getByRole('button', { name: '关闭文字摘要' });
    const derivedToggle = within(previewControls).getByRole('button', { name: '关闭 AI 衍生球体' });
    expect(summaryToggle).toHaveAttribute('aria-pressed', 'true');
    expect(derivedToggle).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(summaryToggle);
    expect(within(previewControls).getByRole('button', { name: '开启文字摘要' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: '节点 宪法原文' })).toHaveAttribute('data-summary-visible', 'false');
    expect(screen.getByRole('button', { name: derivedNodeName })).toHaveAttribute('data-summary-visible', 'false');

    await userEvent.click(derivedToggle);
    expect(within(previewControls).getByRole('button', { name: '开启 AI 衍生球体' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('button', { name: derivedNodeName })).not.toBeInTheDocument();
    expect(sourceNode).toBeInTheDocument();

    await userEvent.click(within(previewControls).getByRole('button', { name: '开启文字摘要' }));
    expect(screen.getByRole('button', { name: '节点 宪法原文' })).toHaveAttribute('data-summary-visible', 'true');
    expect(screen.queryByRole('button', { name: derivedNodeName })).not.toBeInTheDocument();

    await userEvent.click(within(previewControls).getByRole('button', { name: '开启 AI 衍生球体' }));
    expect(await screen.findByRole('button', { name: derivedNodeName })).toHaveAttribute('data-summary-visible', 'true');
  });

  it('图谱页面提供 Markdown 导出按钮并触发文件下载', async () => {
    const sourceCard = card();
    const detail: KnowledgeMapDetail = {
      ...emptyDetail(),
      map: { ...emptyDetail().map, nodeCount: 1 },
      nodes: [{
        id: 'node-a', mapId: 'map-1', cardId: 'card-a', title: '', content: '', level: 1,
        x: 0, y: 0, z: 0,
        createdAt: '2026-08-01T10:00:00.000Z', updatedAt: '2026-08-01T10:00:00.000Z', card: sourceCard,
      } as KnowledgeMapDetail['nodes'][number] & { level: number }],
      edges: [],
    };
    const createObjectURL = vi.fn((_blob: Blob) => 'blob:knowledge-map-markdown');
    const revokeObjectURL = vi.fn();
    const NativeURL = URL;
    class DownloadURL extends NativeURL {}
    Object.defineProperties(DownloadURL, {
      createObjectURL: { value: createObjectURL },
      revokeObjectURL: { value: revokeObjectURL },
    });
    vi.stubGlobal('URL', DownloadURL);
    const downloads: Array<{ download: string; href: string }> = [];
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function downloadClick(this: HTMLAnchorElement) {
      downloads.push({ download: this.download, href: this.href });
    });
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = new URL(String(input), 'http://localhost');
      if (url.pathname === '/api/knowledge-maps' && !init?.method) return jsonResponse([detail.map]);
      if (url.pathname === '/api/knowledge-maps/map-1' && !init?.method) return jsonResponse(detail);
      if (url.pathname === '/api/cards') return jsonResponse(searchResult([sourceCard]));
      throw new Error(`未模拟的请求：${String(input)}`);
    });

    try {
      renderAtGraphs();
      expect(await screen.findByRole('heading', { name: '法律图谱' })).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: '导出 Markdown' }));

      expect(createObjectURL).toHaveBeenCalledTimes(1);
      const exportedBlob = createObjectURL.mock.calls[0][0];
      expect(exportedBlob).toBeInstanceOf(Blob);
      expect(exportedBlob.type).toContain('text/markdown');
      expect(downloads).toEqual([{
        download: expect.stringMatching(/^法律图谱.*\.md$/),
        href: 'blob:knowledge-map-markdown',
      }]);
    } finally {
      clickSpy.mockRestore();
    }
  });

  it('工具栏可进入横向思维导图并用回车创建第1层中心主题', async () => {
    let detail = emptyDetail();
    const nodeRequests: Array<Record<string, unknown>> = [];
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = new URL(String(input), 'http://localhost');
      if (url.pathname === '/api/knowledge-maps' && !init?.method) return jsonResponse([detail.map]);
      if (url.pathname === '/api/knowledge-maps/map-1' && !init?.method) return jsonResponse(detail);
      if (url.pathname === '/api/cards') return jsonResponse(searchResult([]));
      if (url.pathname === '/api/knowledge-maps/map-1/nodes' && init?.method === 'POST') {
        const body = JSON.parse(String(init.body));
        nodeRequests.push(body);
        detail = {
          ...detail,
          map: { ...detail.map, nodeCount: 1 },
          nodes: [{
            id: 'horizontal-root', mapId: 'map-1', cardId: null,
            title: body.title, content: body.content, level: body.level,
            x: body.x, y: body.y, z: body.z,
            createdAt: '2026-08-03T10:00:00.000Z', updatedAt: '2026-08-03T10:00:00.000Z', card: null,
          } as unknown as KnowledgeMapDetail['nodes'][number]],
        };
        return jsonResponse(detail, 201);
      }
      throw new Error(`未模拟的请求：${String(input)}`);
    });

    renderAtGraphs();
    expect(await screen.findByRole('heading', { name: '法律图谱' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '横向编辑' }));

    const canvas = screen.getByRole('img', { name: '横向思维导图录入' });
    expect(canvas).toBeInTheDocument();
    const centerTopicInput = screen.getByLabelText('中心主题');
    expect(screen.getByRole('button', { name: '创建中心主题' })).toBeInTheDocument();
    await userEvent.type(centerTopicInput, '法律总论{Enter}');

    await waitFor(() => expect(nodeRequests).toHaveLength(1));
    expect(nodeRequests[0]).toMatchObject({ title: '法律总论', content: '', level: 1 });
    expect(within(canvas).getByText('法律总论')).toBeInTheDocument();
  });

  it('横向思维导图从父节点创建子节点时依次保存下一层节点与分支连线', async () => {
    const rootNode = {
      id: 'horizontal-root', mapId: 'map-1', cardId: null, title: '法律总论', content: '', level: 1,
      x: 0, y: 0, z: 0,
      createdAt: '2026-08-03T10:00:00.000Z', updatedAt: '2026-08-03T10:00:00.000Z', card: null,
    } as unknown as KnowledgeMapDetail['nodes'][number];
    let detail: KnowledgeMapDetail = {
      ...emptyDetail(),
      map: { ...emptyDetail().map, nodeCount: 1 },
      nodes: [rootNode],
    };
    const requests: Array<{ path: string; body: Record<string, unknown> }> = [];
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = new URL(String(input), 'http://localhost');
      if (url.pathname === '/api/knowledge-maps' && !init?.method) return jsonResponse([detail.map]);
      if (url.pathname === '/api/knowledge-maps/map-1' && !init?.method) return jsonResponse(detail);
      if (url.pathname === '/api/cards') return jsonResponse(searchResult([]));
      if (url.pathname === '/api/knowledge-maps/map-1/nodes' && init?.method === 'POST') {
        const body = JSON.parse(String(init.body));
        requests.push({ path: url.pathname, body });
        detail = {
          ...detail,
          map: { ...detail.map, nodeCount: 2 },
          nodes: [...detail.nodes, {
            id: 'horizontal-child', mapId: 'map-1', cardId: null,
            title: body.title, content: body.content, level: body.level,
            x: body.x, y: body.y, z: body.z,
            createdAt: '2026-08-03T10:01:00.000Z', updatedAt: '2026-08-03T10:01:00.000Z', card: null,
          } as unknown as KnowledgeMapDetail['nodes'][number]],
        };
        return jsonResponse(detail, 201);
      }
      if (url.pathname === '/api/knowledge-maps/map-1/edges' && init?.method === 'POST') {
        const body = JSON.parse(String(init.body));
        requests.push({ path: url.pathname, body });
        detail = {
          ...detail,
          map: { ...detail.map, edgeCount: 1 },
          edges: [{
            id: 'horizontal-edge', mapId: 'map-1',
            sourceNodeId: String(body.sourceNodeId), targetNodeId: String(body.targetNodeId),
            label: String(body.label),
            createdAt: '2026-08-03T10:02:00.000Z', updatedAt: '2026-08-03T10:02:00.000Z',
          }],
        };
        return jsonResponse(detail, 201);
      }
      throw new Error(`未模拟的请求：${String(input)}`);
    });

    renderAtGraphs();
    expect(await screen.findByRole('heading', { name: '法律图谱' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '横向编辑' }));
    const canvas = screen.getByRole('img', { name: '横向思维导图录入' });
    await userEvent.click(screen.getByRole('button', { name: '为“法律总论”添加子节点' }));
    await userEvent.type(screen.getByLabelText('新子节点标题'), '行政法{Enter}');

    await waitFor(() => expect(requests).toHaveLength(2));
    expect(requests[0]).toEqual({
      path: '/api/knowledge-maps/map-1/nodes',
      body: expect.objectContaining({ title: '行政法', content: '', level: 2 }),
    });
    expect(requests[1]).toEqual({
      path: '/api/knowledge-maps/map-1/edges',
      body: expect.objectContaining({
        sourceNodeId: 'horizontal-root', targetNodeId: 'horizontal-child', label: '分支',
      }),
    });

    const positionedNode = (title: string) => {
      const textNode = within(canvas).getByText(title);
      const positioned = textNode.closest<HTMLElement>('[style*="left"]');
      expect(positioned).not.toBeNull();
      return Number.parseFloat(positioned!.style.left);
    };
    expect(positionedNode('法律总论')).toBeLessThan(positionedNode('行政法'));
  });

  it('横向思维导图可在添加子节点浮层搜索卡片并按父层级建立分支', async () => {
    const parentNode = {
      id: 'horizontal-parent', mapId: 'map-1', cardId: null, title: '行程问题', content: '', level: 2,
      x: 0, y: 0, z: 0,
      createdAt: '2026-08-03T10:00:00.000Z', updatedAt: '2026-08-03T10:00:00.000Z', card: null,
    } as unknown as KnowledgeMapDetail['nodes'][number];
    const matchingCards = [
      card({ id: 'card-trip-a', rawInput: '流水行船问题：顺流速度计算' }),
      card({ id: 'card-trip-b', rawInput: '火车过桥问题：车长与桥长关系' }),
      card({ id: 'card-trip-c', rawInput: '相遇追及问题：速度差计算' }),
    ];
    let detail: KnowledgeMapDetail = {
      ...emptyDetail(),
      map: { ...emptyDetail().map, nodeCount: 1 },
      nodes: [parentNode],
    };
    const requests: Array<{ path: string; body: Record<string, unknown> }> = [];
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = new URL(String(input), 'http://localhost');
      if (url.pathname === '/api/knowledge-maps' && !init?.method) return jsonResponse([detail.map]);
      if (url.pathname === '/api/knowledge-maps/map-1' && !init?.method) return jsonResponse(detail);
      if (url.pathname === '/api/cards') return jsonResponse(searchResult(matchingCards));
      if (url.pathname === '/api/knowledge-maps/map-1/nodes' && init?.method === 'POST') {
        const body = JSON.parse(String(init.body));
        requests.push({ path: url.pathname, body });
        detail = {
          ...detail,
          map: { ...detail.map, nodeCount: 2 },
          nodes: [...detail.nodes, {
            id: 'horizontal-card-child', mapId: 'map-1', cardId: body.cardId,
            title: '', content: '', level: body.level, x: body.x, y: body.y, z: body.z,
            createdAt: '2026-08-03T10:01:00.000Z', updatedAt: '2026-08-03T10:01:00.000Z',
            card: matchingCards[1],
          } as unknown as KnowledgeMapDetail['nodes'][number]],
        };
        return jsonResponse(detail, 201);
      }
      if (url.pathname === '/api/knowledge-maps/map-1/edges' && init?.method === 'POST') {
        const body = JSON.parse(String(init.body));
        requests.push({ path: url.pathname, body });
        detail = {
          ...detail,
          map: { ...detail.map, edgeCount: 1 },
          edges: [{
            id: 'horizontal-card-edge', mapId: 'map-1',
            sourceNodeId: String(body.sourceNodeId), targetNodeId: String(body.targetNodeId),
            label: String(body.label),
            createdAt: '2026-08-03T10:02:00.000Z', updatedAt: '2026-08-03T10:02:00.000Z',
          }],
        };
        return jsonResponse(detail, 201);
      }
      throw new Error(`未模拟的请求：${String(input)}`);
    });

    renderAtGraphs();
    expect(await screen.findByRole('heading', { name: '法律图谱' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '横向编辑' }));
    await userEvent.click(screen.getByRole('button', { name: '为“行程问题”添加子节点' }));

    const composer = screen.getByRole('form', { name: '为“行程问题”添加子节点' });
    await userEvent.click(within(composer).getByRole('button', { name: '搜索卡片' }));
    await userEvent.type(within(composer).getByRole('searchbox', { name: '搜索卡片库内容' }), '火车');

    const results = await within(composer).findByRole('list', { name: '用户初始稿搜索结果' });
    expect(results).toHaveClass('graphs-horizontal-card-search__results');
    expect(within(results).getAllByRole('listitem')).toHaveLength(3);
    await userEvent.click(within(results).getByRole('button', { name: '添加卡片：火车过桥问题：车长与桥长关系' }));

    await waitFor(() => expect(requests).toHaveLength(2));
    expect(requests[0]).toEqual({
      path: '/api/knowledge-maps/map-1/nodes',
      body: expect.objectContaining({ cardId: 'card-trip-b', level: 3 }),
    });
    expect(requests[1]).toEqual({
      path: '/api/knowledge-maps/map-1/edges',
      body: expect.objectContaining({
        sourceNodeId: 'horizontal-parent', targetNodeId: 'horizontal-card-child', label: '分支',
      }),
    });
  });

  it('横向编辑保存的节点与关系会同步出现在 2D 预览和 3D 预览', async () => {
    const detail: KnowledgeMapDetail = {
      ...emptyDetail(),
      map: { ...emptyDetail().map, nodeCount: 2, edgeCount: 1 },
      nodes: [
        {
          id: 'horizontal-root', mapId: 'map-1', cardId: null, title: '法律总论', content: '', level: 1,
          x: 0, y: 0, z: 0,
          createdAt: '2026-08-03T10:00:00.000Z', updatedAt: '2026-08-03T10:00:00.000Z', card: null,
        },
        {
          id: 'horizontal-child', mapId: 'map-1', cardId: null, title: '行政法', content: '', level: 2,
          x: 0, y: 0, z: 0,
          createdAt: '2026-08-03T10:01:00.000Z', updatedAt: '2026-08-03T10:01:00.000Z', card: null,
        },
      ] as unknown as KnowledgeMapDetail['nodes'],
      edges: [{
        id: 'horizontal-edge', mapId: 'map-1',
        sourceNodeId: 'horizontal-root', targetNodeId: 'horizontal-child', label: '分支',
        createdAt: '2026-08-03T10:02:00.000Z', updatedAt: '2026-08-03T10:02:00.000Z',
      }],
    };
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = new URL(String(input), 'http://localhost');
      if (url.pathname === '/api/knowledge-maps' && !init?.method) return jsonResponse([detail.map]);
      if (url.pathname === '/api/knowledge-maps/map-1' && !init?.method) return jsonResponse(detail);
      if (url.pathname === '/api/cards') return jsonResponse(searchResult([]));
      throw new Error(`未模拟的请求：${String(input)}`);
    });

    renderAtGraphs();
    expect(await screen.findByRole('heading', { name: '法律图谱' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '横向编辑' }));
    const horizontalCanvas = screen.getByRole('img', { name: '横向思维导图录入' });
    expect(within(horizontalCanvas).getByText('法律总论')).toBeInTheDocument();
    expect(within(horizontalCanvas).getByText('行政法')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '2D 预览' }));
    const radialCanvas = screen.getByRole('img', { name: '2D 圈层预览' });
    expect(within(radialCanvas).getByRole('button', { name: '节点 法律总论' })).toBeInTheDocument();
    expect(within(radialCanvas).getByRole('button', { name: '节点 行政法' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '3D 预览' }));
    const preview = screen.getByTestId('force-graph');
    expect(within(preview).getByRole('button', { name: '节点 法律总论' })).toBeInTheDocument();
    expect(within(preview).getByRole('button', { name: '节点 行政法' })).toBeInTheDocument();
    expect(within(preview).getByText('分支')).toBeInTheDocument();
  });

  it('横向思维导图只在按住 Ctrl 滚动时缩放，并可拖动空白处平移画布', async () => {
    vi.stubGlobal('PointerEvent', undefined);
    const addEventListenerSpy = vi.spyOn(HTMLElement.prototype, 'addEventListener');
    const sourceCard = card();
    const detail: KnowledgeMapDetail = {
      ...emptyDetail(),
      map: { ...emptyDetail().map, nodeCount: 1 },
      nodes: [{
        id: 'node-a', mapId: 'map-1', cardId: 'card-a', title: '', content: '', level: 1,
        x: 0, y: 0, z: 0,
        createdAt: '2026-08-03T10:00:00.000Z', updatedAt: '2026-08-03T10:00:00.000Z', card: sourceCard,
      } as KnowledgeMapDetail['nodes'][number] & { level: number }],
      edges: [],
    };
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = new URL(String(input), 'http://localhost');
      if (url.pathname === '/api/knowledge-maps' && !init?.method) return jsonResponse([detail.map]);
      if (url.pathname === '/api/knowledge-maps/map-1' && !init?.method) return jsonResponse(detail);
      if (url.pathname === '/api/cards') return jsonResponse(searchResult([sourceCard]));
      throw new Error(`未模拟的请求：${String(input)}`);
    });

    renderAtGraphs();
    expect(await screen.findByRole('heading', { name: '法律图谱' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '横向编辑' }));
    const viewport = document.querySelector('.graphs-horizontal__viewport') as HTMLDivElement | null;
    expect(viewport).not.toBeNull();
    expect(viewport).toHaveAttribute('data-zoom', '1');
    expect(addEventListenerSpy.mock.calls.some(([type, , options]) => (
      type === 'wheel' && (options as AddEventListenerOptions | undefined)?.passive === false
    ))).toBe(true);

    fireEvent.wheel(viewport!, { ctrlKey: false, deltaY: -100 });
    expect(viewport).toHaveAttribute('data-zoom', '1');
    fireEvent.wheel(viewport!, { ctrlKey: true, deltaY: -100, clientX: 420, clientY: 300 });
    expect(viewport).toHaveAttribute('data-zoom', '1.1');

    viewport!.scrollLeft = 420;
    viewport!.scrollTop = 360;
    fireEvent.mouseDown(viewport!, { button: 0, clientX: 420, clientY: 320 });
    expect(viewport).toHaveClass('is-panning');
    fireEvent.mouseMove(viewport!, { clientX: 360, clientY: 260 });
    expect(viewport!.scrollLeft).toBe(480);
    expect(viewport!.scrollTop).toBe(420);
    fireEvent.mouseUp(viewport!, { clientX: 360, clientY: 260 });
    expect(viewport).not.toHaveClass('is-panning');
  });

  it('横向和 2D 节点悬浮时显示完整卡片内容预览', async () => {
    const rawInput = '第一行：工程问题总量保持不变。\n第二行：完整条件不能省略。';
    const sourceCard = card({ rawInput });
    const detail: KnowledgeMapDetail = {
      ...emptyDetail(),
      map: { ...emptyDetail().map, nodeCount: 1 },
      nodes: [{
        id: 'node-a', mapId: 'map-1', cardId: 'card-a', title: '', content: '', level: 1,
        x: 0, y: 0, z: 0,
        createdAt: '2026-08-03T10:00:00.000Z', updatedAt: '2026-08-03T10:00:00.000Z', card: sourceCard,
      } as KnowledgeMapDetail['nodes'][number] & { level: number }],
      edges: [],
    };
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = new URL(String(input), 'http://localhost');
      if (url.pathname === '/api/knowledge-maps' && !init?.method) return jsonResponse([detail.map]);
      if (url.pathname === '/api/knowledge-maps/map-1' && !init?.method) return jsonResponse(detail);
      if (url.pathname === '/api/cards') return jsonResponse(searchResult([sourceCard]));
      throw new Error(`未模拟的请求：${String(input)}`);
    });

    renderAtGraphs();
    expect(await screen.findByRole('heading', { name: '法律图谱' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '横向编辑' }));
    const horizontalNode = screen.getByRole('button', { name: '节点 第一行：工程问题总量保持不变。\n第二行：完整条件不能省略。' });
    fireEvent.mouseEnter(horizontalNode);
    fireEvent.mouseMove(horizontalNode, { clientX: window.innerWidth - 2, clientY: window.innerHeight - 2 });
    const horizontalPreview = await screen.findByRole('tooltip', { name: '节点卡片预览' });
    expect(horizontalPreview).toHaveTextContent('第一行：工程问题总量保持不变。 第二行：完整条件不能省略。');
    expect(Number.parseFloat(horizontalPreview.style.left)).toBeLessThanOrEqual(window.innerWidth - 396);
    expect(Number.parseFloat(horizontalPreview.style.top)).toBeLessThanOrEqual(window.innerHeight - 376);
    fireEvent.mouseLeave(screen.getByRole('button', { name: '节点 第一行：工程问题总量保持不变。\n第二行：完整条件不能省略。' }));

    await userEvent.click(screen.getByRole('button', { name: '2D 预览' }));
    const radialNode = screen.getByRole('button', { name: '节点 第一行：工程问题总量保持不变。\n第二行：完整条件不能省略。' });
    fireEvent.mouseEnter(radialNode);
    const radialPreview = await screen.findByRole('tooltip', { name: '节点卡片预览' });
    expect(radialPreview).toHaveTextContent('第一行：工程问题总量保持不变。 第二行：完整条件不能省略。');
  });

  it('3D 星系按同心轨道排布层级，子节点沿父节点方向延伸且 AI 衍生节点贴近父星球', async () => {
    const rootCard = card({ id: 'root-card', rawInput: '核心主题', normalizedStatement: '' });
    const branchCard = card({ id: 'branch-card', rawInput: '行政法', normalizedStatement: '行政法 AI 要点' });
    const node = (id: string, title: string, level: number, cardValue: CardDetail | null = null) => ({
      id, mapId: 'map-1', cardId: cardValue?.id ?? null, title: cardValue ? '' : title, content: '', level,
      x: 0, y: 0, z: 0,
      createdAt: '2026-08-03T10:00:00.000Z', updatedAt: '2026-08-03T10:00:00.000Z', card: cardValue,
    });
    const detail: KnowledgeMapDetail = {
      ...emptyDetail(),
      map: { ...emptyDetail().map, nodeCount: 5, edgeCount: 4 },
      nodes: [
        node('root', '核心主题', 1, rootCard),
        node('branch-a', '行政法', 2, branchCard),
        node('branch-b', '民法', 2),
        node('leaf-a', '行政许可', 3),
        node('leaf-b', '民事行为', 3),
      ] as unknown as KnowledgeMapDetail['nodes'],
      edges: [
        { id: 'edge-a', mapId: 'map-1', sourceNodeId: 'root', targetNodeId: 'branch-a', label: '分支', createdAt: '2026-08-03T10:00:00.000Z', updatedAt: '2026-08-03T10:00:00.000Z' },
        { id: 'edge-b', mapId: 'map-1', sourceNodeId: 'root', targetNodeId: 'branch-b', label: '分支', createdAt: '2026-08-03T10:00:00.000Z', updatedAt: '2026-08-03T10:00:00.000Z' },
        { id: 'edge-c', mapId: 'map-1', sourceNodeId: 'branch-a', targetNodeId: 'leaf-a', label: '分支', createdAt: '2026-08-03T10:00:00.000Z', updatedAt: '2026-08-03T10:00:00.000Z' },
        { id: 'edge-d', mapId: 'map-1', sourceNodeId: 'branch-b', targetNodeId: 'leaf-b', label: '分支', createdAt: '2026-08-03T10:00:00.000Z', updatedAt: '2026-08-03T10:00:00.000Z' },
      ],
    };
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = new URL(String(input), 'http://localhost');
      if (url.pathname === '/api/knowledge-maps' && !init?.method) return jsonResponse([detail.map]);
      if (url.pathname === '/api/knowledge-maps/map-1' && !init?.method) return jsonResponse(detail);
      if (url.pathname === '/api/cards') return jsonResponse(searchResult([rootCard, branchCard]));
      throw new Error(`未模拟的请求：${String(input)}`);
    });

    renderAtGraphs();
    expect(await screen.findByRole('heading', { name: '法律图谱' })).toBeInTheDocument();
    const root = screen.getByRole('button', { name: '节点 核心主题' });
    const branchA = screen.getByRole('button', { name: '节点 行政法' });
    const branchB = screen.getByRole('button', { name: '节点 民法' });
    const leafA = screen.getByRole('button', { name: '节点 行政许可' });
    const leafB = screen.getByRole('button', { name: '节点 民事行为' });
    const asteroid = await screen.findByRole('button', { name: '节点 AI 优化 1：行政法 AI 要点' });
    const position = (element: HTMLElement) => ({
      x: Number(element.getAttribute('data-x')),
      y: Number(element.getAttribute('data-y')),
      z: Number(element.getAttribute('data-z')),
    });
    const radius = (element: HTMLElement) => Number(element.getAttribute('data-orbit-radius'));
    const planarDirectionScore = (parent: HTMLElement, child: HTMLElement) => {
      const a = position(parent);
      const b = position(child);
      return ((a.x * b.x) + (a.y * b.y))
        / ((Math.hypot(a.x, a.y) || 1) * (Math.hypot(b.x, b.y) || 1));
    };

    expect(radius(root)).toBeLessThan(1);
    expect(radius(branchA)).toBeGreaterThan(100);
    expect(Math.abs(radius(branchA) - radius(branchB))).toBeLessThan(8);
    expect(radius(leafA)).toBeGreaterThan(radius(branchA));
    expect(radius(leafB)).toBeGreaterThan(radius(branchB));
    expect(Math.abs(position(branchA).z)).toBeLessThan(radius(branchA) * 0.24);
    expect(Math.abs(position(branchB).z)).toBeLessThan(radius(branchB) * 0.24);
    expect(planarDirectionScore(branchA, leafA)).toBeGreaterThan(0.8);
    expect(planarDirectionScore(branchB, leafB)).toBeGreaterThan(0.8);
    expect(asteroid).toHaveAttribute('data-kind', 'derived');
    expect(asteroid).toHaveAttribute('data-parent-id', 'branch-a');
    const parentPosition = position(branchA);
    const asteroidPosition = position(asteroid);
    expect(Math.hypot(
      asteroidPosition.x - parentPosition.x,
      asteroidPosition.y - parentPosition.y,
      asteroidPosition.z - parentPosition.z,
    )).toBeLessThan(90);
    expect(Number(asteroid.getAttribute('data-value'))).toBeLessThan(Number(branchA.getAttribute('data-value')));
  });
});
