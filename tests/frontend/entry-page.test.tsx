// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, cleanup, createEvent, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CardDetail } from '../../shared/contracts';
import App from '../../src/App';
import { EntryPage } from '../../src/pages/EntryPage';

const entryGlassCss = readFileSync(
  resolve(process.cwd(), 'src/styles/entry-glass.css'),
  'utf8',
);

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

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function apiErrorResponse(code: string, message: string, status = 400) {
  return new Response(JSON.stringify({ code, message }), {
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
  it('按层级呈现液态玻璃并为普通按钮提供即时按压反馈', () => {
    render(<EntryPage />);

    const form = screen.getByRole('form', { name: '录入卡片表单' });
    expect(form).toHaveClass('liquid-glass', 'liquid-glass--regular');
    expect(screen.getByRole('textbox', { name: '原始内容' }).closest('.entry-content')).toHaveClass(
      'liquid-glass',
      'liquid-glass--regular',
    );
    expect(screen.getByRole('complementary', { name: '卡片属性' })).toHaveClass(
      'liquid-glass',
      'liquid-glass--regular',
    );
    expect(screen.getByRole('group', { name: '图片拖放与粘贴区域' })).toHaveClass(
      'liquid-glass',
      'liquid-glass--regular',
    );
    expect(screen.getByRole('combobox', { name: '模板' })).toHaveClass(
      'liquid-glass--thin',
      'liquid-glass__nested',
    );
    expect(screen.getByRole('toolbar', { name: '快捷编辑' })).toHaveClass(
      'liquid-glass--thin',
      'liquid-glass__nested',
    );
    expect(screen.getByRole('button', { name: '取消' })).toHaveClass('liquid-pressable');
    expect(screen.getByRole('button', { name: '保存并自动整理' })).toHaveClass(
      'liquid-glass--thin',
      'liquid-pressable',
    );
  });

  it('隐藏录入模式选择并为一二级分类标签统一提供按压反馈', async () => {
    const user = userEvent.setup();
    render(<EntryPage />);

    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(screen.queryByText('错题录入')).not.toBeInTheDocument();
    expect(screen.queryByText('知识点积累')).not.toBeInTheDocument();
    for (const checkbox of screen.getAllByRole('checkbox')) {
      expect(checkbox.closest('label')).toHaveClass('liquid-pressable');
    }

    await user.click(screen.getByRole('checkbox', { name: '常识判断' }));
    for (const checkbox of screen.getAllByRole('checkbox')) {
      expect(checkbox.closest('label')).toHaveClass('liquid-pressable');
    }
  });

  it('只暴露一个真实图片选择按钮并移除无动作拖放区焦点', async () => {
    const user = userEvent.setup();
    render(<EntryPage />);

    const dropzone = screen.getByRole('group', { name: '图片拖放与粘贴区域' });
    const picker = screen.getByRole('button', { name: '选择本地图片' });
    const input = screen.getByLabelText('图片', { selector: 'input' });
    const inputClick = vi.spyOn(input, 'click');

    expect(dropzone).not.toHaveAttribute('tabindex');
    expect(screen.getAllByRole('button', { name: '选择本地图片' })).toHaveLength(1);
    expect(picker.tagName).toBe('BUTTON');
    expect(picker).toHaveAttribute('type', 'button');
    expect(picker).toHaveAttribute('tabindex', '0');
    expect(input).toHaveAttribute('tabindex', '-1');
    expect(input).toHaveAttribute('aria-hidden', 'true');
    expect(input).toHaveAttribute('hidden');
    picker.focus();
    expect(picker).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(inputClick).toHaveBeenCalledTimes(1);
  });

  it('用页面专属样式保证小屏工具可达、44px 触控和半透明布局', () => {
    expect(entryGlassCss).toMatch(
      /\.entry-page \.rich-text-editor__toolbar\s*{[^}]*overflow-x:\s*auto;/s,
    );
    expect(entryGlassCss).toMatch(
      /\.entry-page \.entry-page__actions \.entry-page__save\.button--primary\s*{[^}]*background:\s*rgba\(198, 66, 50, 0\.94\);[^}]*color:\s*#ffffff;/s,
    );
    expect(entryGlassCss).toMatch(
      /\.entry-page \.entry-page__actions \.entry-page__save\.button--primary:disabled\s*{[^}]*background:\s*rgba\(248, 224, 220, 0\.9\);[^}]*color:\s*#7a2f27;[^}]*opacity:\s*1;/s,
    );
    expect(entryGlassCss).toMatch(
      /\.entry-page \.entry-recommended-tags button\s*{[^}]*min-height:\s*44px;/s,
    );
    expect(entryGlassCss).toMatch(
      /\.entry-page \.entry-layout\s*{[^}]*background:\s*rgba\([^)]+\);/s,
    );
    expect(entryGlassCss).toMatch(
      /\.entry-page \.entry-images__picker:focus-visible\s*{[^}]*outline:/s,
    );
    expect(entryGlassCss).toMatch(
      /@media \(max-width: 900px\)[\s\S]*?\.entry-page \.entry-layout\s*{[^}]*grid-template-columns:\s*minmax\(0, 1fr\);/,
    );
  });

  it('在应用外壳内只保留一个 main 地标', () => {
    window.history.pushState({}, '', '/entry');

    render(<App />);

    expect(screen.getAllByRole('main')).toHaveLength(1);
  });

  it('不呈现录入模式选择，并保留五个可选内容字段和录入所需属性字段', () => {
    render(<EntryPage />);

    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(screen.queryByText('错题录入')).not.toBeInTheDocument();
    expect(screen.queryByText('知识点积累')).not.toBeInTheDocument();
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
    expect(screen.getByRole('alert')).toHaveTextContent('请先补全必填内容后再保存');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('启用编辑器历史记录，Ctrl+Z 撤销当前输入', async () => {
    const user = userEvent.setup();
    render(<EntryPage />);

    const editor = screen.getByRole('textbox', { name: '原始内容' });
    await user.click(editor);
    await user.keyboard('可以撤销内容');
    await user.keyboard('{Control>}z{/Control}');

    await waitFor(() => expect(editor.textContent).toBe(''));
  });

  it('快捷工具栏可操作当前普通文本域', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const readText = vi.fn().mockResolvedValue('补充内容');
    const user = userEvent.setup();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { readText, writeText },
    });
    render(<EntryPage />);

    const textarea = screen.getByRole('textbox', { name: '正确解析' }) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '原有解析' } });
    fireEvent.focus(textarea);
    textarea.setSelectionRange(0, 2);
    await user.click(screen.getByRole('button', { name: '复制当前编辑区' }));
    expect(writeText).toHaveBeenCalledWith('原有');

    await user.click(screen.getByRole('button', { name: '全选当前编辑区' }));
    expect(textarea.selectionStart).toBe(0);
    expect(textarea.selectionEnd).toBe(4);

    await user.click(screen.getByRole('button', { name: '清空当前编辑区' }));
    expect(textarea).toHaveValue('');
    await user.click(screen.getByRole('button', { name: '撤销当前编辑区' }));
    expect(textarea).toHaveValue('原有解析');

    textarea.setSelectionRange(4, 4);
    await user.click(screen.getByRole('button', { name: '粘贴到当前编辑区' }));
    expect(readText).toHaveBeenCalledTimes(1);
    expect(textarea).toHaveValue('原有解析补充内容');
  });

  it('剪贴板读取失败时保留内容并显示稳定提示', async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { readText: vi.fn().mockRejectedValue(new DOMException('denied')) },
    });
    render(<EntryPage />);

    const textarea = screen.getByRole('textbox', { name: '补充笔记' });
    fireEvent.change(textarea, { target: { value: '原笔记' } });
    fireEvent.focus(textarea);
    await user.click(screen.getByRole('button', { name: '粘贴到当前编辑区' }));

    expect(textarea).toHaveValue('原笔记');
    expect(screen.getByRole('status')).toHaveTextContent('无法读取剪贴板，请使用 Ctrl/Cmd+V');
    expect(screen.queryByText('denied')).not.toBeInTheDocument();
  });

  it('Ctrl+S 与 Cmd+Enter 复用保存入口且不拦截编辑原生组合键', async () => {
    const fetchMock = vi.mocked(fetch).mockResolvedValue(jsonResponse(card(), 201));
    const user = userEvent.setup();
    render(<EntryPage />);
    await chooseRequiredFields(user);

    const textarea = screen.getByRole('textbox', { name: '补充笔记' });
    for (const key of ['a', 'c', 'v', 'z']) {
      expect(fireEvent.keyDown(textarea, { ctrlKey: true, key })).toBe(true);
    }
    expect(fireEvent.keyDown(textarea, { ctrlKey: true, key: 's' })).toBe(false);
    expect(await screen.findByText('已生成 2 个背诵方向，可继续录入下一条')).toBeInTheDocument();

    await chooseRequiredFields(user);
    await user.keyboard('{Meta>}{Enter}{/Meta}');
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
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
    await screen.findByText('已生成 2 个背诵方向，可继续录入下一条');

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

    expect(await screen.findByText('已生成 2 个背诵方向，可继续录入下一条')).toBeInTheDocument();
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
      entryMode: 'mistake',
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
      attachments: [],
    });
    expect(JSON.parse(payload.rawContentJson)).toMatchObject({ type: 'doc' });
  });

  it.each([
    { status: 'pending' as const, message: '已保存，等待重新整理' },
    { status: 'needs_input' as const, message: '已保存，需要补充关系后再整理，可继续录入下一条' },
  ])('为 $status 返回明确状态、清空新建表单且不弹确认框', async ({ status, message }) => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValue(jsonResponse(card({ aiStatus: status, quizItems: [] }), 201));
    render(<EntryPage />);
    await chooseRequiredFields(user);

    await user.click(screen.getByRole('button', { name: '保存并自动整理' }));

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '原始内容' })).toHaveTextContent('');
    expect(screen.getByRole('checkbox', { name: '常识判断' })).not.toBeChecked();
    expect(screen.queryByRole('checkbox', { name: '文史' })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: '确认 AI 结果' })).not.toBeInTheDocument();
  });

  it('待完善保存后清空表单，继续录入时创建下一张卡片', async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(card({ id: 'needs-card', aiStatus: 'needs_input', quizItems: [] }), 201))
      .mockResolvedValueOnce(jsonResponse(card({ id: 'next-card' }), 201));
    render(<EntryPage />);
    await chooseRequiredFields(user);
    await user.click(screen.getByRole('button', { name: '保存并自动整理' }));
    expect(await screen.findByText('已保存，需要补充关系后再整理，可继续录入下一条')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '原始内容' })).toHaveTextContent('');

    await user.click(screen.getByRole('checkbox', { name: '常识判断' }));
    await user.click(screen.getByRole('checkbox', { name: '文史' }));
    await user.click(screen.getByRole('textbox', { name: '原始内容' }));
    await user.keyboard('下一条知识点');
    await user.click(screen.getByRole('button', { name: '保存并自动整理' }));

    expect(await screen.findByText('已生成 2 个背诵方向，可继续录入下一条')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [path, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(path).toBe('/api/cards');
    expect(init.method).toBe('POST');
    const payload = JSON.parse(String((init.body as FormData).get('payload')));
    expect(payload.rawInput).toBe('下一条知识点');
    expect(fetchMock.mock.calls.some(([requestPath, requestInit]) => requestPath === '/api/cards/needs-card' && requestInit?.method === 'PATCH')).toBe(false);
  });

  it('编辑已有卡片时不虚假追加图片，并保留服务端已有附件', async () => {
    const user = userEvent.setup();
    const existingAttachment = {
      id: 'attachment-1',
      url: '/uploads/existing.png',
      originalName: '既有图片.png',
      mimeType: 'image/png',
      byteSize: 6,
    };
    const fetchMock = vi.mocked(fetch).mockImplementation(async (input, init) => {
      const path = String(input);
      if (path === '/api/cards/card-1' && (!init?.method || init.method === 'GET')) {
        return jsonResponse(card({
          aiStatus: 'needs_input',
          quizItems: [],
          attachments: [existingAttachment],
          categories: [
            { id: '常识判断', name: '常识判断', parentId: null },
            { id: '常识判断/文史', name: '文史', parentId: '常识判断' },
          ],
        }));
      }
      if (path === '/api/cards/card-1' && init?.method === 'PATCH') {
        return jsonResponse(card({
          aiStatus: 'needs_input',
          quizItems: [],
          attachments: [existingAttachment],
          categories: [
            { id: '常识判断', name: '常识判断', parentId: null },
            { id: '常识判断/文史', name: '文史', parentId: '常识判断' },
          ],
        }));
      }
      throw new Error(`unexpected request: ${path}`);
    });
    window.history.pushState({}, '', '/entry?edit=card-1');
    render(<App />);
    expect(await screen.findByText('已保存附件：既有图片.png')).toBeInTheDocument();
    expect(screen.getByLabelText('图片')).toBeDisabled();
    expect(screen.getByRole('button', { name: '编辑时不追加图片' })).toBeDisabled();
    expect(screen.getByText('已有图片会继续保留')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '保存修改' }));

    expect(await screen.findByText('已保存，需要补充关系后再整理')).toBeInTheDocument();
    expect(screen.getByText('已保存附件：既有图片.png')).toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([path, init]) => path === '/api/cards/card-1' && init?.method === 'PATCH')).toHaveLength(1);
  });

  it('编辑模式拦截图片拖经和放下的浏览器默认动作但不追加附件', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(card({
      categories: [
        { id: '常识判断', name: '常识判断', parentId: null },
        { id: '常识判断/文史', name: '文史', parentId: '常识判断' },
      ],
    })));
    window.history.pushState({}, '', '/entry?edit=card-1');
    render(<App />);
    await screen.findByRole('button', { name: '保存修改' });

    const dropzone = screen.getByRole('group', { name: '图片拖放与粘贴区域' });
    const image = new File(['png'], '编辑态图片.png', { type: 'image/png' });
    const dataTransfer = { files: [image], types: ['Files'], dropEffect: 'none' };
    const dragOver = createEvent.dragOver(dropzone, { dataTransfer });
    const drop = createEvent.drop(dropzone, { dataTransfer });

    fireEvent(dropzone, dragOver);
    fireEvent(dropzone, drop);

    expect(dragOver.defaultPrevented).toBe(true);
    expect(drop.defaultPrevented).toBe(true);
    expect(screen.queryByText('编辑态图片.png')).not.toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('编辑用户初始稿时提交 PUT 重新衍生，不夹带旧题面', async () => {
    const user = userEvent.setup();
    const existing = card({
      categories: [
        { id: '常识判断', name: '常识判断', parentId: null },
        { id: '常识判断/文史', name: '文史', parentId: '常识判断' },
      ],
      tags: [
        { id: 'tag-user', name: '古今地名', origin: 'user' },
        { id: 'tag-ai', name: '历史常识', origin: 'ai' },
      ],
    });
    const fetchMock = vi.mocked(fetch).mockImplementation(async (input, init) => {
      const path = String(input);
      if (path === '/api/cards/card-1' && (!init?.method || init.method === 'GET')) {
        return jsonResponse(existing);
      }
      if (path === '/api/cards/card-1/original' && init?.method === 'PUT') {
        const payload = JSON.parse(String(init.body));
        expect(payload).toMatchObject({
          rawInput: '广陵=扬州',
          categoryIds: ['常识判断', '常识判断/文史'],
          userTags: ['古今地名'],
          template: '常识判断',
          sourceType: '历年真题',
          sourceDetail: '2025 国考',
        });
        expect(payload).not.toHaveProperty('quizItems');
        expect(payload).not.toHaveProperty('entryMode');
        return jsonResponse({
          card: card({
            normalizedStatement: '重新衍生后的第一题',
            categories: existing.categories,
            tags: existing.tags,
          }),
          derivedCount: 3,
        });
      }
      throw new Error(`unexpected request: ${path}`);
    });
    window.history.pushState({}, '', '/entry?editOriginal=card-1');
    render(<App />);

    await screen.findByRole('button', { name: '保存并重新衍生' });
    expect(screen.getByRole('heading', { name: '编辑初始稿' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: '第 1 题题目' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '保存并重新衍生' }));

    expect(await screen.findByText('初始稿已更新，并重新衍生 3 个问题')).toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([path, init]) => (
      path === '/api/cards/card-1/original' && init?.method === 'PUT'
    ))).toHaveLength(1);
    expect(fetchMock.mock.calls.some(([path, init]) => (
      path === '/api/cards/card-1' && init?.method === 'PATCH'
    ))).toBe(false);
  });

  it('编辑已有卡片时可以手动修正背诵题面和答案', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.mocked(fetch).mockImplementation(async (input, init) => {
      const path = String(input);
      if (path === '/api/cards/card-1' && (!init?.method || init.method === 'GET')) {
        return jsonResponse(card({
          categories: [
            { id: '常识判断', name: '常识判断', parentId: null },
            { id: '常识判断/文史', name: '文史', parentId: '常识判断' },
          ],
        }));
      }
      if (path === '/api/cards/card-1' && init?.method === 'PATCH') {
        const payload = JSON.parse(String(init.body));
        expect(payload.quizItems).toEqual([
          { id: 'quiz-1', question: '广陵现在对应哪座城市？', answer: '扬州' },
          { id: 'quiz-2', question: '扬州古称什么？', answer: '广陵、江都' },
        ]);
        return jsonResponse(card({
          quizItems: [
            { id: 'quiz-1', direction: 'forward', question: '广陵现在对应哪座城市？', answer: '扬州', dueAt: '2026-07-17T00:00:00.000Z' },
            { id: 'quiz-2', direction: 'reverse', question: '扬州古称什么？', answer: '广陵、江都', dueAt: '2026-07-17T00:00:00.000Z' },
          ],
          categories: [
            { id: '常识判断', name: '常识判断', parentId: null },
            { id: '常识判断/文史', name: '文史', parentId: '常识判断' },
          ],
        }));
      }
      throw new Error(`unexpected request: ${path}`);
    });
    window.history.pushState({}, '', '/entry?edit=card-1');
    render(<App />);
    const firstQuestion = await screen.findByRole('textbox', { name: '第 1 题题目' });
    const secondAnswer = screen.getByRole('textbox', { name: '第 2 题答案' });

    await user.clear(firstQuestion);
    await user.type(firstQuestion, '广陵现在对应哪座城市？');
    await user.clear(secondAnswer);
    await user.type(secondAnswer, '广陵、江都');
    await user.click(screen.getByRole('button', { name: '保存修改' }));

    expect(await screen.findByText('已保存并完成整理')).toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([path, init]) => path === '/api/cards/card-1' && init?.method === 'PATCH')).toHaveLength(1);
  });

  it('编辑已有卡片时拒绝保存空背诵题面或答案', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.mocked(fetch).mockImplementation(async (input, init) => {
      const path = String(input);
      if (path === '/api/cards/card-1' && (!init?.method || init.method === 'GET')) {
        return jsonResponse(card({
          categories: [
            { id: '常识判断', name: '常识判断', parentId: null },
            { id: '常识判断/文史', name: '文史', parentId: '常识判断' },
          ],
        }));
      }
      throw new Error(`unexpected request: ${path}`);
    });
    window.history.pushState({}, '', '/entry?edit=card-1');
    render(<App />);
    const firstQuestion = await screen.findByRole('textbox', { name: '第 1 题题目' });

    await user.clear(firstQuestion);
    await user.click(screen.getByRole('button', { name: '保存修改' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('请补全背诵题面和答案后再保存');
    expect(fetchMock.mock.calls.filter(([path, init]) => path === '/api/cards/card-1' && init?.method === 'PATCH')).toHaveLength(0);
  });

  it('编辑保存遇到正在整理的卡片时显示服务端原因', async () => {
    const fetchMock = vi.mocked(fetch).mockImplementation(async (input, init) => {
      const path = String(input);
      if (path === '/api/cards/card-1' && (!init?.method || init.method === 'GET')) {
        return jsonResponse(card({
          aiStatus: 'processing',
          categories: [
            { id: '常识判断', name: '常识判断', parentId: null },
            { id: '常识判断/文史', name: '文史', parentId: '常识判断' },
          ],
        }));
      }
      if (path === '/api/cards/card-1' && init?.method === 'PATCH') {
        return apiErrorResponse('processing_conflict', '卡片正在整理，请稍后再编辑相关内容', 409);
      }
      throw new Error(`unexpected request: ${path}`);
    });
    const user = userEvent.setup();
    window.history.pushState({}, '', '/entry?edit=card-1');
    render(<App />);
    expect(await screen.findByText('当前卡片待整理')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '保存修改' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('卡片正在整理，请稍后再编辑相关内容');
    expect(fetchMock.mock.calls.filter(([path, init]) => path === '/api/cards/card-1' && init?.method === 'PATCH')).toHaveLength(1);
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
    expect(screen.getByRole('textbox', { name: '原始内容' })).toHaveTextContent('');
    expect(cancelButton).toBeEnabled();
  });

  it('保存成功后清空新建表单和附件但保留成功文案', async () => {
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
    await user.selectOptions(screen.getByRole('combobox', { name: '模板' }), '常识判断');
    await user.type(screen.getByRole('textbox', { name: '正确解析' }), '广陵对应扬州');
    await user.type(screen.getByLabelText('标签'), '古今地名');
    await user.upload(
      screen.getByLabelText('图片'),
      new File(['image'], '待上传.png', { type: 'image/png' }),
    );

    await user.click(screen.getByRole('button', { name: '保存并自动整理' }));

    expect(await screen.findByText('已生成 2 个背诵方向，可继续录入下一条')).toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '模板' })).toHaveValue('言语理解');
    expect(screen.getByRole('textbox', { name: '原始内容' })).toHaveTextContent('');
    expect(screen.getByRole('textbox', { name: '正确解析' })).toHaveValue('');
    expect(screen.getByRole('checkbox', { name: '常识判断' })).not.toBeChecked();
    expect(screen.queryByRole('checkbox', { name: '文史' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('标签')).toHaveValue('');
    expect(screen.getByLabelText('图片')).toHaveValue('');
    expect(screen.queryByText('待上传.png')).not.toBeInTheDocument();
    expect(screen.queryByText('已保存附件：已保存.png')).not.toBeInTheDocument();

    const clearedEditor = screen.getByRole('textbox', { name: '原始内容' });
    await user.click(clearedEditor);
    await user.keyboard('{Control>}z{/Control}');
    expect(clearedEditor).toHaveTextContent('');

    await user.click(screen.getByRole('button', { name: '保存并自动整理' }));

    expect(screen.getByText('请选择至少一个所属板块')).toBeInTheDocument();
    expect(screen.getByText('请选择至少一个细分考点')).toBeInTheDocument();
    expect(screen.getByText('请输入原始内容')).toBeInTheDocument();
    expect(screen.getByText('已生成 2 个背诵方向，可继续录入下一条')).toBeInTheDocument();
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
