// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CardDetail } from '../../shared/contracts';
import App from '../../src/App';
import { EntryPage } from '../../src/pages/EntryPage';

const templateExpectations = [
  {
    name: '言语理解',
    applicable: '逻辑填空、主旨概括、意图判断、细节理解、语句排序、语句填空、下文推断',
    core: '填写文段、设空句或待辨析成语',
    wrong: '填写误选词语、望文生义、感情色彩或语境搭配问题',
    analysis: '写明正确词语及语境、侧重点、搭配对象',
    mnemonic: '记录词义抓手或语境判断口诀',
    extension: '补充近义词、反义词、常见搭配和易混成语',
    tags: ['高频成语', '近义辨析', '语境陷阱', '主旨干扰项'],
  },
  {
    name: '政治理论',
    applicable: '马原、毛中特、新时代中国特色社会主义思想、时政会议、政策金句、党内法规',
    core: '填写会议、理论、政策表述或判断命题',
    wrong: '填写主体、时间、首次提出、根本保证等混淆项',
    analysis: '保留原文中的规范结论、主体、时间和层级关系',
    mnemonic: '记录关键词顺序或对照口诀',
    extension: '补充用户输入中已有的相关会议或相近表述',
    tags: ['时政会议', '政策表述', '党内法规', '时间线'],
  },
  {
    name: '常识判断',
    applicable: '法律、党史、文史、科技、地理、经济、生活常识',
    core: '填写人物、地名、制度、法律规则或事实对应关系',
    wrong: '填写混淆对象、条件遗漏或概念张冠李戴',
    analysis: '写明原文明确给出的正确对应或规则',
    mnemonic: '记录对照关系或关键词',
    extension: '补充用户已经输入的相关常识',
    tags: ['古今地名', '法律条件', '文史对应', '科技原理'],
  },
  {
    name: '图形推理',
    applicable: '位置规律、样式规律、数量规律、属性规律、空间重构、特殊图形特征',
    core: '插入图形截图并写明需要判断的规律',
    wrong: '记录误判规律、漏数对象或观察顺序错误',
    analysis: '按观察对象、变化方式、验证结果分段记录',
    mnemonic: '记录位置—样式—数量—属性的检查顺序',
    extension: '补充同类图形特征和识别条件',
    tags: ['移动旋转', '叠加运算', '元素计数', '空间重构'],
  },
  {
    name: '逻辑判断',
    applicable: '定义判断、类比推理、翻译推理、真假推理、削弱加强、前提假设、排列组合',
    core: '填写定义、论证、条件关系或类比词组',
    wrong: '填写偷换概念、强度不匹配、条件方向错误等陷阱',
    analysis: '写明关键词、论点论据、翻译式或排除过程',
    mnemonic: '记录充分必要条件、削弱加强或定义匹配口诀',
    extension: '补充用户已有的摩根定律、逆否命题或关系辨析',
    tags: ['翻译推理', '削弱加强', '关键词抓取', '二级辨析'],
  },
  {
    name: '资料分析',
    applicable: '基础公式、速算技巧、同比环比、比重、平均数、倍数、单位陷阱、时间陷阱、计算易错点',
    core: '填写材料、数据、问题和待求指标，可附图表截图',
    wrong: '记录误用公式、单位遗漏、基期现期混淆和时间口径错误',
    analysis: '按公式、代入、计算和单位写出过程',
    mnemonic: '记录公式关键词或速算判断',
    extension: '补充关联公式和同类陷阱',
    tags: ['基期现期', '比重变化', '平均数', '单位陷阱', '时间陷阱'],
  },
  {
    name: '申论素材',
    applicable: '规范词、人物素材、政策金句、作文分论点',
    core: '填写口语表达、材料原句、人物事例或主题观点',
    wrong: '填写不规范表达、空泛表述或适用场景误判',
    analysis: '写明规范词、可用场景和表达重点',
    mnemonic: '记录主题—主体—动作—效果结构',
    extension: '补充用户已有的同主题规范词或分论点',
    tags: ['规范词', '人物素材', '政策金句', '作文分论点'],
  },
] as const;

function card(overrides: Partial<CardDetail> = {}): CardDetail {
  return {
    id: 'card-1',
    entryMode: 'mistake',
    rawInput: '广陵=扬州',
    rawContentJson: null,
    template: '常识判断',
    normalizedStatement: '广陵与扬州为对应关系',
    wrongPoint: '',
    analysis: '广陵对应扬州',
    mnemonic: '',
    extension: '',
    notes: '',
    aiStatus: 'ready',
    sourceType: '历年真题',
    sourceDetail: '2025 国考',
    rating: 4,
    mastery: 'hard',
    wrongCount: 0,
    archived: false,
    createdAt: '2026-07-17T00:00:00.000Z',
    updatedAt: '2026-07-17T00:00:00.000Z',
    categories: [],
    tags: [],
    attachments: [],
    quizItems: [
      { id: 'quiz-1', direction: 'forward', question: '广陵对应哪里？', answer: '扬州', dueAt: '2026-07-17T00:00:00.000Z' },
      { id: 'quiz-2', direction: 'reverse', question: '扬州古称什么？', answer: '广陵', dueAt: '2026-07-17T00:00:00.000Z' },
    ],
    ...overrides,
  };
}

function jsonResponse(body: CardDetail, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function chooseRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('checkbox', { name: '常识判断' }));
  await user.click(screen.getByRole('checkbox', { name: '文史' }));
  await user.click(screen.getByRole('textbox', { name: '原始内容' }));
  await user.keyboard('广陵=扬州');
}

beforeEach(() => {
  Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
    configurable: true,
    value: () => new DOMRect(),
  });
  Object.defineProperty(Range.prototype, 'getClientRects', {
    configurable: true,
    value: () => [],
  });
  Object.defineProperty(document, 'elementFromPoint', {
    configurable: true,
    value: () => null,
  });
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('七套录入模板', () => {
  it('逐项呈现设计规定的名称、适用范围、字段提示和推荐标签', async () => {
    const user = userEvent.setup();
    render(<EntryPage />);
    const templateSelect = screen.getByRole('combobox', { name: '模板' });

    for (const template of templateExpectations) {
      expect(screen.getByRole('option', { name: template.name })).toBeInTheDocument();
      await user.selectOptions(templateSelect, template.name);
      expect(screen.getByText(`适用范围：${template.applicable}`)).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: '原始内容' })).toHaveAttribute('data-hint', template.core);
      expect(screen.getByRole('textbox', { name: '错误选项或易错点' })).toHaveAttribute('placeholder', template.wrong);
      expect(screen.getByRole('textbox', { name: '正确解析' })).toHaveAttribute('placeholder', template.analysis);
      expect(screen.getByRole('textbox', { name: '记忆速记口诀' })).toHaveAttribute('placeholder', template.mnemonic);
      expect(screen.getByRole('textbox', { name: '同类拓展知识点' })).toHaveAttribute('placeholder', template.extension);
      for (const tag of template.tags) {
        expect(screen.getByRole('button', { name: `添加推荐标签 ${tag}` })).toBeInTheDocument();
      }
    }
  });
});

describe('录入表单', () => {
  it('在应用外壳内只保留一个 main 地标', () => {
    window.history.pushState({}, '', '/entry');

    render(<App />);

    expect(screen.getAllByRole('main')).toHaveLength(1);
  });

  it('呈现两种模式、五个可选内容字段和录入所需属性字段', () => {
    render(<EntryPage />);

    expect(screen.getByRole('radio', { name: '错题录入' })).toBeChecked();
    expect(screen.getByRole('radio', { name: '知识点积累' })).toBeInTheDocument();
    for (const label of ['错误选项或易错点', '正确解析', '记忆速记口诀', '同类拓展知识点', '补充笔记']) {
      expect(screen.getByRole('textbox', { name: label })).toBeInTheDocument();
    }
    expect(screen.getByRole('group', { name: '所属板块' })).toBeInTheDocument();
    expect(screen.getByLabelText('题目来源类型')).toBeInTheDocument();
    expect(screen.getByLabelText('题目来源详情')).toBeInTheDocument();
    expect(screen.queryByLabelText('星级')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('掌握程度')).not.toBeInTheDocument();
    expect(screen.getByLabelText('标签')).toBeInTheDocument();
    expect(screen.getByLabelText('图片')).toBeInTheDocument();
  });

  it('保存前同时校验所属板块、细分考点和原始输入', async () => {
    const user = userEvent.setup();
    render(<EntryPage />);

    await user.click(screen.getByRole('button', { name: '保存并自动整理' }));

    expect(screen.getByText('请选择至少一个所属板块')).toBeInTheDocument();
    expect(screen.getByText('请选择至少一个细分考点')).toBeInTheDocument();
    expect(screen.getByText('请输入原始内容')).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('禁用编辑器历史记录，Ctrl+Z 不撤销已经输入的内容', async () => {
    const user = userEvent.setup();
    render(<EntryPage />);

    const editor = screen.getByRole('textbox', { name: '原始内容' });
    await user.click(editor);
    await user.keyboard('不可撤销内容');
    await user.keyboard('{Control>}z{/Control}');

    expect(editor).toHaveTextContent('不可撤销内容');
  });

  it('只启用加粗、颜色和公式文本工具，并将富 HTML 粘贴为纯文本节点', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.mocked(fetch).mockResolvedValue(jsonResponse(card(), 201));
    render(<EntryPage />);

    expect(screen.getByRole('button', { name: '加粗' })).toHaveAttribute('title', '加粗');
    expect(screen.getByRole('button', { name: '文字颜色 朱红' })).toHaveAttribute('title', '文字颜色 朱红');
    expect(screen.getByRole('button', { name: '插入公式文本' })).toHaveAttribute('title', '插入公式文本');
    expect(screen.queryByRole('button', { name: /斜体|标题|列表|代码|引用/ })).not.toBeInTheDocument();

    const editor = screen.getByRole('textbox', { name: '原始内容' });
    fireEvent.paste(editor, {
      clipboardData: {
        getData: (type: string) =>
          type === 'text/plain'
            ? '纯文本内容'
            : '<h1>恶意 HTML</h1><ul><li>列表</li></ul><pre><code>代码</code></pre>',
      },
    });

    await waitFor(() => expect(editor).toHaveTextContent('纯文本内容'));
    expect(editor).not.toHaveTextContent('恶意 HTML');

    await user.click(screen.getByRole('checkbox', { name: '常识判断' }));
    await user.click(screen.getByRole('checkbox', { name: '文史' }));
    await user.click(screen.getByRole('button', { name: '保存并自动整理' }));
    await screen.findByText('已生成 2 个背诵方向');

    const formData = fetchMock.mock.calls[0]?.[1]?.body as FormData;
    const payload = JSON.parse(String(formData.get('payload')));
    const rawContent = JSON.parse(payload.rawContentJson);
    expect(collectNodeTypes(rawContent)).toEqual(new Set(['doc', 'paragraph', 'text']));
    expect(payload.rawContentJson).not.toMatch(/heading|bulletList|orderedList|listItem|codeBlock|code/);
  });

  it('暂存并移除图片，首次保存只发送一次完整 FormData 创建请求', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.mocked(fetch).mockResolvedValue(jsonResponse(card(), 201));
    render(<EntryPage />);
    await chooseRequiredFields(user);

    await user.click(screen.getByRole('radio', { name: '知识点积累' }));
    await user.selectOptions(screen.getByRole('combobox', { name: '模板' }), '常识判断');
    await user.click(screen.getByRole('checkbox', { name: '言语理解' }));
    await user.click(screen.getByRole('checkbox', { name: '逻辑填空' }));
    await user.type(screen.getByRole('textbox', { name: '错误选项或易错点' }), '混淆古今地名');
    await user.type(screen.getByRole('textbox', { name: '正确解析' }), '广陵对应扬州');
    await user.type(screen.getByRole('textbox', { name: '记忆速记口诀' }), '广陵扬州');
    await user.type(screen.getByRole('textbox', { name: '同类拓展知识点' }), '金陵对应南京');
    await user.type(screen.getByRole('textbox', { name: '补充笔记' }), '复习地名');
    await user.selectOptions(screen.getByLabelText('题目来源类型'), '历年真题');
    await user.type(screen.getByLabelText('题目来源详情'), '2025 国考');
    await user.type(screen.getByLabelText('标签'), '古今地名， 高频');

    const kept = new File(['kept'], '保留.png', { type: 'image/png' });
    const removed = new File(['removed'], '移除.webp', { type: 'image/webp' });
    await user.upload(screen.getByLabelText('图片'), [kept, removed]);
    expect(screen.getByText('保留.png')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '移除图片 移除.webp' }));
    expect(screen.queryByText('移除.webp')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '保存并自动整理' }));

    expect(await screen.findByText('已生成 2 个背诵方向')).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: '确认 AI 结果' })).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [path, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(path).toBe('/api/cards');
    expect(init.method).toBe('POST');
    expect(init.body).toBeInstanceOf(FormData);
    const formData = init.body as FormData;
    expect(formData.getAll('image')).toEqual([kept]);
    const payload = JSON.parse(String(formData.get('payload')));
    expect(payload).toEqual({
      entryMode: 'knowledge',
      rawInput: '广陵=扬州',
      rawContentJson: expect.any(String),
      wrongPoint: '混淆古今地名',
      analysis: '广陵对应扬州',
      mnemonic: '广陵扬州',
      extension: '金陵对应南京',
      notes: '复习地名',
      categoryIds: ['常识判断', '言语理解', '常识判断/文史', '言语理解/逻辑填空'],
      userTags: ['古今地名', '高频'],
      template: '常识判断',
      sourceType: '历年真题',
      sourceDetail: '2025 国考',
      rating: 1,
      initialMastery: 'unseen',
      attachments: [],
    });
    expect(JSON.parse(payload.rawContentJson)).toMatchObject({ type: 'doc' });
  });

  it.each([
    { status: 'pending' as const, message: '已保存，等待重新整理' },
    { status: 'needs_input' as const, message: '已保存，需要补充关系后再整理' },
  ])('为 $status 返回明确状态且不弹确认框', async ({ status, message }) => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValue(jsonResponse(card({ aiStatus: status, quizItems: [] }), 201));
    render(<EntryPage />);
    await chooseRequiredFields(user);

    await user.click(screen.getByRole('button', { name: '保存并自动整理' }));

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: '确认 AI 结果' })).not.toBeInTheDocument();
  });

  it('待完善补充原文后 PATCH 同一卡片并由后端自动重整', async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(card({ id: 'needs-card', aiStatus: 'needs_input', quizItems: [] }), 201))
      .mockResolvedValueOnce(jsonResponse(card({ id: 'needs-card' })));
    render(<EntryPage />);
    await chooseRequiredFields(user);
    await user.click(screen.getByRole('button', { name: '保存并自动整理' }));
    expect(await screen.findByText('已保存，需要补充关系后再整理')).toBeInTheDocument();

    await user.click(screen.getByRole('textbox', { name: '原始内容' }));
    await user.keyboard('，两者明确对应');
    await user.click(screen.getByRole('button', { name: '保存并自动整理' }));

    expect(await screen.findByText('已生成 2 个背诵方向')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [path, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(path).toBe('/api/cards/needs-card');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(String(init.body))).toEqual({
      rawInput: '，两者明确对应广陵=扬州',
      rawContentJson: expect.any(String),
      wrongPoint: '',
      analysis: '',
      mnemonic: '',
      extension: '',
      notes: '',
      categoryIds: ['常识判断', '常识判断/文史'],
      userTags: [],
      template: '言语理解',
      sourceType: '',
      sourceDetail: '',
    });
    expect(fetchMock.mock.calls.filter(([requestPath]) => requestPath === '/api/cards')).toHaveLength(1);
  });

  it('同卡编辑不虚假追加图片，并保留服务端已有附件', async () => {
    const user = userEvent.setup();
    const existingAttachment = {
      id: 'attachment-1',
      url: '/uploads/existing.png',
      originalName: '既有图片.png',
      mimeType: 'image/png',
      byteSize: 6,
    };
    const fetchMock = vi.mocked(fetch).mockResolvedValue(
      jsonResponse(card({ aiStatus: 'needs_input', quizItems: [], attachments: [existingAttachment] }), 201),
    );
    render(<EntryPage />);
    await chooseRequiredFields(user);
    await user.click(screen.getByRole('button', { name: '保存并自动整理' }));
    expect(await screen.findByText('已保存附件：既有图片.png')).toBeInTheDocument();

    await user.upload(
      screen.getByLabelText('图片'),
      new File(['new'], '新增.png', { type: 'image/png' }),
    );
    await user.click(screen.getByRole('button', { name: '保存并自动整理' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('当前卡片暂不支持追加图片，请先移除待上传图片');
    expect(screen.getByText('已保存附件：既有图片.png')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('保存请求在同一批次内只发一次并在完成前禁用取消', async () => {
    const user = userEvent.setup();
    let resolveRequest: ((response: Response) => void) | undefined;
    const request = new Promise<Response>((resolve) => { resolveRequest = resolve; });
    const fetchMock = vi.mocked(fetch).mockReturnValue(request);
    render(<EntryPage />);
    await chooseRequiredFields(user);

    const saveButton = screen.getByRole('button', { name: '保存并自动整理' });
    const cancelButton = screen.getByRole('button', { name: '取消' });
    const form = saveButton.closest('form');
    expect(form).not.toBeNull();
    act(() => {
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(saveButton).toBeDisabled();
    expect(cancelButton).toBeDisabled();
    fireEvent.click(cancelButton);
    expect(screen.getByRole('textbox', { name: '原始内容' })).toHaveTextContent('广陵=扬州');

    resolveRequest?.(jsonResponse(card({ aiStatus: 'pending', quizItems: [] }), 201));

    expect(await screen.findByText('已保存，等待重新整理')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '原始内容' })).toHaveTextContent('广陵=扬州');
    expect(cancelButton).toBeEnabled();
  });

  it('ready 后清空新建表单和附件但保留成功文案', async () => {
    const user = userEvent.setup();
    const attachment = {
      id: 'ready-attachment',
      url: '/uploads/ready.png',
      originalName: '已保存.png',
      mimeType: 'image/png',
      byteSize: 5,
    };
    const fetchMock = vi.mocked(fetch).mockResolvedValue(
      jsonResponse(card({ attachments: [attachment] }), 201),
    );
    render(<EntryPage />);
    await chooseRequiredFields(user);
    await user.click(screen.getByRole('radio', { name: '知识点积累' }));
    await user.selectOptions(screen.getByRole('combobox', { name: '模板' }), '常识判断');
    await user.type(screen.getByRole('textbox', { name: '正确解析' }), '广陵对应扬州');
    await user.type(screen.getByLabelText('标签'), '古今地名');
    await user.upload(
      screen.getByLabelText('图片'),
      new File(['image'], '待上传.png', { type: 'image/png' }),
    );

    await user.click(screen.getByRole('button', { name: '保存并自动整理' }));

    expect(await screen.findByText('已生成 2 个背诵方向')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '错题录入' })).toBeChecked();
    expect(screen.getByRole('combobox', { name: '模板' })).toHaveValue('言语理解');
    expect(screen.getByRole('textbox', { name: '原始内容' })).toHaveTextContent('');
    expect(screen.getByRole('textbox', { name: '正确解析' })).toHaveValue('');
    expect(screen.getByRole('checkbox', { name: '常识判断' })).not.toBeChecked();
    expect(screen.queryByRole('checkbox', { name: '文史' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('标签')).toHaveValue('');
    expect(screen.getByLabelText('图片')).toHaveValue('');
    expect(screen.queryByText('待上传.png')).not.toBeInTheDocument();
    expect(screen.queryByText('已保存附件：已保存.png')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '保存并自动整理' }));

    expect(screen.getByText('请选择至少一个所属板块')).toBeInTheDocument();
    expect(screen.getByText('请选择至少一个细分考点')).toBeInTheDocument();
    expect(screen.getByText('请输入原始内容')).toBeInTheDocument();
    expect(screen.getByText('已生成 2 个背诵方向')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('保存期间固定禁用按钮避免重复请求，失败后显示稳定提示', async () => {
    const user = userEvent.setup();
    let rejectRequest: ((reason: Error) => void) | undefined;
    vi.mocked(fetch).mockImplementation(
      () => new Promise<Response>((_resolve, reject) => { rejectRequest = reject; }),
    );
    render(<EntryPage />);
    await chooseRequiredFields(user);

    const saveButton = screen.getByRole('button', { name: '保存并自动整理' });
    await user.click(saveButton);
    expect(saveButton).toBeDisabled();
    await user.click(saveButton);
    expect(fetch).toHaveBeenCalledTimes(1);
    rejectRequest?.(new Error('包含敏感细节的网络错误'));

    expect(await screen.findByRole('alert')).toHaveTextContent('保存失败，请稍后重试');
    expect(screen.queryByText(/敏感细节/)).not.toBeInTheDocument();
    expect(saveButton).toBeEnabled();
  });
});

function collectNodeTypes(value: unknown, types = new Set<string>()) {
  if (typeof value !== 'object' || value === null) return types;
  const record = value as Record<string, unknown>;
  if (typeof record.type === 'string') types.add(record.type);
  if (Array.isArray(record.content)) {
    for (const child of record.content) collectNodeTypes(child, types);
  }
  return types;
}
