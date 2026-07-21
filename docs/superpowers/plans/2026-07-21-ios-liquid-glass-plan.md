# 全站 iOS 液态玻璃实施计划

> **供智能体执行：** 必须使用 `subagent-driven-development` 按任务实施；每个生产改动先走测试驱动红绿循环，任务完成后依次进行规格符合性审查与代码质量审查。步骤使用复选框跟踪。

**目标：** 在不修改后端、数据库和业务流程的前提下，将六个页面及全站弹窗、抽屉、按钮和已有拖拽交互改造成全面 iOS 液态玻璃体验。

**架构：** 先建立共享玻璃令牌和速度感知运动函数，再由每个页面使用独立样式文件映射薄、标准、厚和深色玻璃。复盘轮播、卡片详情抽屉和背诵摇杆复用 `motion` 库与项目运动辅助函数，业务状态不依赖动画完成。并行实施时每个智能体独占页面、页面测试和页面样式，`package*`、共享令牌、文档及进度日志实行单写者。

**技术栈：** React 18、TypeScript、CSS `backdrop-filter`、Pointer Events、`motion`、Vitest、Testing Library、Playwright CLI。

---

## 文件责任图

| 任务 | 独占文件 |
| --- | --- |
| 1 运动基础 | `package.json`、`package-lock.json`、`src/motion/liquidMotion.ts`、`tests/frontend/liquid-motion.test.ts` |
| 2 玻璃基础 | `src/styles/tokens.css`、`src/styles/liquid-glass.css`、`src/main.tsx`、`tests/frontend/liquid-glass-styles.test.ts` |
| 3 外壳 | `src/components/AppShell.tsx`、`src/styles/app-shell-glass.css`、`tests/frontend/app-shell.test.tsx` |
| 4 总览 | `src/pages/DashboardPage.tsx`、`src/styles/dashboard-glass.css`、`tests/frontend/dashboard-page.test.tsx` |
| 5 录入 | `src/pages/EntryPage.tsx`、`src/styles/entry-glass.css`、`tests/frontend/entry-page.test.tsx` |
| 6 卡片库 | `src/pages/CardsPage.tsx`、`src/styles/cards-glass.css`、`tests/frontend/cards-page.test.tsx` |
| 7 复盘 | `src/pages/ReviewPage.tsx`、`src/styles/review.css`、`tests/frontend/review-page.test.tsx` |
| 8 背诵 | `src/pages/StudyPage.tsx`、`src/styles/study-glass.css`、`tests/frontend/study-joystick.test.tsx`、`tests/frontend/study-page.test.tsx` |
| 9 设置 | `src/pages/SettingsPage.tsx`、`src/styles/settings-glass.css`、`tests/frontend/settings-page.test.tsx` |
| 10 收口 | `docs/本地运行与数据管理.md`、`docs/superpowers/specs/2026-07-21-ios-liquid-glass-design.md`、`progress.md`、浏览器截图 |

当前工作树包含用户既有未提交改动。实施智能体不得执行 `git add`、`git commit`、整文件恢复或硬重置；主智能体负责整合、验证和日志追加。

## 第一阶段：共享前置

### 任务 1：速度投射与弹簧运动基础

**文件：**

- 修改：`package.json`
- 修改：`package-lock.json`
- 新建：`src/motion/liquidMotion.ts`
- 新建：`tests/frontend/liquid-motion.test.ts`

- [ ] **步骤 1：先写失败测试**

```ts
import { describe, expect, it } from 'vitest';
import { projectMomentum, rubberBand, selectProjectedSnap } from '../../src/motion/liquidMotion';

describe('液态手势物理', () => {
  it('按释放速度投射终点并选择速度方向上的卡位', () => {
    expect(projectMomentum(0, 800, 0.99)).toBeGreaterThan(70);
    expect(selectProjectedSnap(0, 800, [-320, 0, 320])).toBe(320);
    expect(selectProjectedSnap(0, -800, [-320, 0, 320])).toBe(-320);
  });

  it('越过边界后连续增加阻力而不是硬停止', () => {
    expect(rubberBand(40, 320)).toBeGreaterThan(0);
    expect(rubberBand(40, 320)).toBeLessThan(40);
  });
});
```

- [ ] **步骤 2：运行红测**

运行：`npm test -- tests/frontend/liquid-motion.test.ts`

预期：失败，提示找不到 `src/motion/liquidMotion.ts`。

- [ ] **步骤 3：安装运动库并实现最小物理函数**

运行：`npm install motion`

实现：

```ts
export function projectMomentum(position: number, velocity: number, rate = 0.99) {
  return position + (velocity / 1000) * rate / (1 - rate);
}

export function rubberBand(overshoot: number, dimension: number, constant = 0.55) {
  return (overshoot * dimension * constant)
    / (dimension + constant * Math.abs(overshoot));
}

export function selectProjectedSnap(
  position: number,
  velocity: number,
  snapPoints: readonly number[],
) {
  const projected = projectMomentum(position, velocity);
  return snapPoints.reduce((closest, point) => (
    Math.abs(projected - point) < Math.abs(projected - closest) ? point : closest
  ));
}

export const criticalSpring = { type: 'spring', bounce: 0, duration: 0.4 } as const;
export const momentumSpring = { type: 'spring', bounce: 0.2, duration: 0.4 } as const;
```

- [ ] **步骤 4：运行绿测与类型检查**

运行：`npm test -- tests/frontend/liquid-motion.test.ts && npm run typecheck`

预期：测试通过，类型检查退出码为 0。

### 任务 2：全站玻璃材质令牌

**文件：**

- 修改：`src/styles/tokens.css`
- 新建：`src/styles/liquid-glass.css`
- 修改：`src/main.tsx`
- 新建：`tests/frontend/liquid-glass-styles.test.ts`

- [ ] **步骤 1：先写失败的样式契约测试**

```ts
// @vitest-environment node
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('液态玻璃基础样式', () => {
  it('定义四级材质和三种辅助功能回退', async () => {
    const css = await readFile('src/styles/liquid-glass.css', 'utf8');
    expect(css).toContain('.liquid-glass--thin');
    expect(css).toContain('.liquid-glass--regular');
    expect(css).toContain('.liquid-glass--thick');
    expect(css).toContain('.liquid-glass--dark');
    expect(css).toContain('prefers-reduced-motion: reduce');
    expect(css).toContain('prefers-reduced-transparency: reduce');
    expect(css).toContain('prefers-contrast: more');
  });
});
```

- [ ] **步骤 2：运行红测**

运行：`npm test -- tests/frontend/liquid-glass-styles.test.ts`

预期：失败，提示样式文件不存在。

- [ ] **步骤 3：实现玻璃令牌和基础类**

在令牌文件增加薄、标准、厚和深色玻璃背景、边缘、内高光、模糊、饱和度和阴影。新样式文件至少包含：

```css
.liquid-glass {
  position: relative;
  border: 1px solid var(--glass-edge);
  background: var(--glass-regular);
  box-shadow: inset 0 1px var(--glass-highlight), var(--glass-shadow-md);
  backdrop-filter: blur(var(--glass-blur-regular)) saturate(var(--glass-saturation));
}

.liquid-glass--thin { background: var(--glass-thin); }
.liquid-glass--regular { background: var(--glass-regular); }
.liquid-glass--thick { background: var(--glass-thick); }
.liquid-glass--dark { background: var(--glass-dark); color: #fff; }

@media (prefers-reduced-transparency: reduce) {
  .liquid-glass { background: var(--glass-solid); backdrop-filter: none; }
}
```

在 `src/main.tsx` 中于全局样式之后导入 `./styles/liquid-glass.css`。

- [ ] **步骤 4：运行绿测**

运行：`npm test -- tests/frontend/liquid-glass-styles.test.ts && npm run typecheck`

预期：测试与类型检查通过。

## 第二阶段：独立页面并行实施

任务 3 到任务 9 只能在任务 1、2 通过后启动；七个任务之间文件互斥，可以并行。

### 任务 3：AppShell、侧栏和玻璃高光

**文件：**

- 修改：`src/components/AppShell.tsx`
- 新建：`src/styles/app-shell-glass.css`
- 修改：`tests/frontend/app-shell.test.tsx`

- [ ] **步骤 1：增加失败测试**

```tsx
expect(screen.getByRole('complementary')).toHaveClass('liquid-glass--dark');
expect(screen.getByRole('main')).toHaveClass('liquid-glass--regular');
fireEvent.pointerMove(screen.getByRole('main'), { clientX: 120, clientY: 80 });
expect(screen.getByRole('main').style.getPropertyValue('--glass-pointer-x')).not.toBe('');
```

- [ ] **步骤 2：运行红测**

运行：`npm test -- tests/frontend/app-shell.test.tsx`

预期：新断言失败，现有外壳没有玻璃类和高光坐标。

- [ ] **步骤 3：实现外壳材质与单一事件委托**

给侧栏、主区、品牌区、导航激活项和折叠按钮添加对应玻璃类；AppShell 的 `onPointerMove` 使用一个 `requestAnimationFrame` 更新当前最近 `.liquid-glass` 元素的 `--glass-pointer-x/y`，卸载时取消帧。导入 `app-shell-glass.css`，移动端保持 64px 侧栏和现有导航语义。

- [ ] **步骤 4：运行绿测**

运行：`npm test -- tests/frontend/app-shell.test.tsx && npm run typecheck`

预期：通过。

### 任务 4：总览全面玻璃化

**文件：**

- 修改：`src/pages/DashboardPage.tsx`
- 新建：`src/styles/dashboard-glass.css`
- 修改：`tests/frontend/dashboard-page.test.tsx`

- [ ] **步骤 1：增加失败测试**

```tsx
expect(await screen.findByText('公考时政速递')).toHaveClosest('.liquid-glass--regular');
expect(screen.getByText('本月日历')).toHaveClosest('.liquid-glass--regular');
expect(screen.getByRole('button', { name: '开始专注' })).toHaveClass('liquid-glass--thin');
```

- [ ] **步骤 2：运行红测**

运行：`npm test -- tests/frontend/dashboard-page.test.tsx`

预期：玻璃类断言失败。

- [ ] **步骤 3：映射总览材质**

给专注台、时政、日历、目标日、备忘和统计表面添加标准玻璃类；日期格、控制按钮和输入使用薄玻璃。新样式只覆盖视觉，不改新闻、计时、日历和倒计时逻辑；翻页在减少动态效果时只更新内容，不执行三维位移。

- [ ] **步骤 4：运行绿测**

运行：`npm test -- tests/frontend/dashboard-page.test.tsx`

预期：通过。

### 任务 5：录入页全面玻璃化

**文件：**

- 修改：`src/pages/EntryPage.tsx`
- 新建：`src/styles/entry-glass.css`
- 修改：`tests/frontend/entry-page.test.tsx`

- [ ] **步骤 1：增加失败测试**

```tsx
expect(screen.getByRole('form')).toHaveClass('liquid-glass--regular');
expect(screen.getByRole('button', { name: '保存并自动整理' })).toHaveClass('liquid-glass--thin');
expect(screen.getByLabelText('原始内容').closest('.entry-content')).toHaveClass('liquid-glass--regular');
```

- [ ] **步骤 2：运行红测**

运行：`npm test -- tests/frontend/entry-page.test.tsx`

预期：玻璃类断言失败。

- [ ] **步骤 3：映射录入材质**

编辑器内容区、属性区、图片拖入区和保存结果使用标准玻璃；模板选择、工具按钮、输入和下拉使用薄玻璃。拖拽高亮只改变边缘和内高光，不增加全屏动画；保存锁、粘贴和图片上传行为保持原样。

- [ ] **步骤 4：运行绿测**

运行：`npm test -- tests/frontend/entry-page.test.tsx tests/frontend/entry-image-drop-paste.test.tsx`

预期：通过。

### 任务 6：卡片库与可拖动详情抽屉

**文件：**

- 修改：`src/pages/CardsPage.tsx`
- 新建：`src/styles/cards-glass.css`
- 修改：`tests/frontend/cards-page.test.tsx`

- [ ] **步骤 1：增加失败测试**

```tsx
expect(await screen.findByRole('list', { name: '卡片列表' })).toHaveClass('cards-grid--glass');
await user.click(screen.getByRole('button', { name: /查看.+详情/ }));
expect(screen.getByRole('dialog', { name: '卡片详情' })).toHaveClass('liquid-glass--thick');
fireEvent.pointerDown(screen.getByRole('dialog'), { pointerId: 1, clientX: 400 });
fireEvent.pointerMove(screen.getByRole('dialog'), { pointerId: 1, clientX: 520 });
expect(screen.getByRole('dialog')).toHaveStyle({ transform: expect.stringContaining('translate3d') });
```

- [ ] **步骤 2：运行红测**

运行：`npm test -- tests/frontend/cards-page.test.tsx`

预期：玻璃类和抽屉跟手断言失败。

- [ ] **步骤 3：实现卡片材质和抽屉手势**

卡片、筛选、批量工具和分页映射到玻璃层；详情抽屉使用厚玻璃。抽屉把手区域使用 Pointer Events 记录速度，移动时一比一更新 X；释放后用 `selectProjectedSnap` 决定关闭或回位，再用 `motion.animate` 从当前呈现值和释放速度启动弹簧。减少动态时直接关闭或回位；保留焦点陷阱、Esc、遮罩和焦点返回。

- [ ] **步骤 4：运行绿测**

运行：`npm test -- tests/frontend/cards-page.test.tsx`

预期：通过。

### 任务 7：复盘速度感知轮播与玻璃查看器

**文件：**

- 修改：`src/pages/ReviewPage.tsx`
- 修改：`src/styles/review.css`
- 修改：`tests/frontend/review-page.test.tsx`

- [ ] **步骤 1：增加失败测试**

```tsx
expect(screen.getByLabelText('资料/综合错题图片轮播')).toHaveAttribute('data-gesture-state', 'idle');
fireEvent.pointerDown(imageButton, { pointerId: 1, clientX: 220 });
fireEvent.pointerMove(carousel, { pointerId: 1, clientX: 190 });
fireEvent.pointerUp(carousel, { pointerId: 1, clientX: 160 });
expect(screen.getByRole('img', { name: '错题图片 two.png' }).closest('figure'))
  .toHaveAttribute('data-active', 'true');
expect(screen.getByRole('dialog', { name: '放大查看错题图片' }))
  .toHaveClass('liquid-glass--thick');
```

- [ ] **步骤 2：运行红测**

运行：`npm test -- tests/frontend/review-page.test.tsx`

预期：速度切换、状态和玻璃查看器断言失败。

- [ ] **步骤 3：实现投射、橡皮筋和可中断弹簧**

保留现有多指针、防误开和原生拖拽屏蔽；将单次开始时间替换为最近位置历史，释放时计算速度和投射卡位。轮播运行弹簧时允许新 pointerdown 停止旧动画并从当前变换值继续。板块、舞台、工具和查看器使用统一玻璃令牌；相纸图片保持不透明、不模糊。

- [ ] **步骤 4：运行绿测**

运行：`npm test -- tests/frontend/review-page.test.tsx tests/frontend/review-board-management.test.tsx tests/frontend/review-board-archive.test.tsx`

预期：通过。

### 任务 8：背诵摇杆速度回弹与玻璃题卡

**文件：**

- 修改：`src/pages/StudyPage.tsx`
- 新建：`src/styles/study-glass.css`
- 修改：`tests/frontend/study-joystick.test.tsx`
- 修改：`tests/frontend/study-page.test.tsx`

- [ ] **步骤 1：增加失败测试**

```tsx
expect(screen.getByRole('button', { name: '下拉摇杆随机抽取题数' }))
  .toHaveAttribute('data-gesture-state', 'idle');
fireEvent.pointerDown(joystick, { pointerId: 1, clientY: 10 });
fireEvent.pointerMove(joystick, { pointerId: 1, clientY: 45 });
expect(joystick).toHaveAttribute('data-gesture-state', 'dragging');
fireEvent.pointerCancel(joystick, { pointerId: 1 });
expect(joystick).toHaveAttribute('data-gesture-state', 'settling');
```

- [ ] **步骤 2：运行红测**

运行：`npm test -- tests/frontend/study-joystick.test.tsx tests/frontend/study-page.test.tsx`

预期：手势状态与玻璃类断言失败。

- [ ] **步骤 3：实现速度回弹和材质**

记录摇杆最近 Y 位置与时间，将释放速度传给 `motion.animate`；取消只回位，越过阈值才抽题。封面、题卡、答案、统计和抽题台使用玻璃层，开国大典图片不加模糊。减少动态时立即回位并直接进入抽题结果。

- [ ] **步骤 4：运行绿测**

运行：`npm test -- tests/frontend/study-joystick.test.tsx tests/frontend/study-page.test.tsx tests/frontend/study-shortcuts.test.tsx tests/frontend/study-known-flow.test.tsx`

预期：通过。

### 任务 9：设置页玻璃材质与辅助功能预览

**文件：**

- 修改：`src/pages/SettingsPage.tsx`
- 新建：`src/styles/settings-glass.css`
- 修改：`tests/frontend/settings-page.test.tsx`

- [ ] **步骤 1：增加失败测试**

```tsx
expect(await screen.findByRole('heading', { name: 'DIY 主题' }).closest('section'))
  .toHaveClass('liquid-glass--regular');
expect(screen.getByRole('radio', { name: '减弱动效' }).closest('label'))
  .toHaveClass('liquid-glass--thin');
```

- [ ] **步骤 2：运行红测**

运行：`npm test -- tests/frontend/settings-page.test.tsx`

预期：玻璃类断言失败。

- [ ] **步骤 3：实现设置页材质**

主题、体验和音乐区使用标准玻璃，预览选项与分段选择使用薄玻璃。保持动效设置的系统偏好、即时预览和本地存储优先级；减少透明度和高对比度仅由媒体查询处理，不新增持久化字段。

- [ ] **步骤 4：运行绿测**

运行：`npm test -- tests/frontend/settings-page.test.tsx`

预期：通过。

## 第三阶段：整合、审查与验收

### 任务 10：全站审查、浏览器验收、文档和生产服务

**文件：**

- 修改：`docs/本地运行与数据管理.md`
- 修改：`docs/superpowers/specs/2026-07-21-ios-liquid-glass-design.md`
- 修改：`progress.md`
- 生成：`C:/Users/ROG/.codex/visualizations/2026/07/19/019f77c3-7ead-7be3-818c-76b72b56b594/ios-liquid-glass-*.png`

- [ ] **步骤 1：逐任务双重审查**

每个实现任务完成后，先由规格审查智能体逐条核对本计划和设计规格，再由代码质量智能体检查竞态、动画中断、清理、可读性、性能和测试缺口。任何重要问题必须修复并复审通过。

- [ ] **步骤 2：运行目标测试和全量测试**

运行：

```powershell
npm test -- tests/frontend/liquid-motion.test.ts tests/frontend/liquid-glass-styles.test.ts
npm test
npm run typecheck
npm run build
git diff --check
```

预期：全部退出码为 0；仅允许保留已有前端主包大于 500KB 的非阻塞构建提示，并记录新增依赖后的包体积变化。

- [ ] **步骤 3：使用 Playwright CLI 验收标准模式**

在 1440×1000、1024×768 和 390×844 下依次访问 `/`、`/entry`、`/study`、`/cards`、`/review`、`/settings`，检查：

- 文档宽度不超过视口。
- 没有文本、按钮和卡片重叠。
- 主要表面存在模糊、半透明背景、亮边和层级阴影。
- 控制台没有业务错误或资源 404。
- 抽屉可快速打开、关闭、立即重开；触控拖动能关闭或回位。
- 复盘卡片一比一跟手，轻拖回位、快甩切图、回弹中可重新抓取。

- [ ] **步骤 4：验收辅助功能回退**

分别模拟：

```text
prefers-reduced-motion: reduce
prefers-reduced-transparency: reduce
prefers-contrast: more
CSS.supports('backdrop-filter', 'blur(1px)') 为 false 的回退检查
```

减少动态时位移动画与弹簧为零；减少透明度时 `backdrop-filter` 为 `none` 且背景接近实色；高对比度时边框增强。

- [ ] **步骤 5：保存截图和像素检查**

保存桌面、移动、抽屉、复盘拖拽和减少透明度截图。对主要截图执行画布像素检查，确认页面非空白、玻璃区域有背景层次且图片未被意外模糊。

- [ ] **步骤 6：更新中文文档与进度日志**

文档说明玻璃层级、运动规则、辅助功能回退、依赖和验证方式。`progress.md` 仅在末尾追加固定结构，列出所有改动文件、测试证据和可执行回滚方法。

- [ ] **步骤 7：构建并重启生产服务**

完成最终构建后只重启监听 8787 的生产进程，保持 5173 开发服务和 `data/` 不变；验证生产首页、六个页面资源、favicon 和复盘 4 张真实图片内容接口。

## 计划自检

- 规格覆盖：全面玻璃材质、按钮响应、复盘动量、抽屉手势、摇杆回弹、辅助功能、性能预算、浏览器验收和回滚均有明确任务。
- 类型一致：所有页面统一使用 `.liquid-glass` 与四个变体；物理函数名在计划内保持一致。
- 并行边界：任务 3 到 9 文件互斥；`package*`、共享令牌、文档和日志均只有一个写者。
- 无占位项：没有待定、稍后实现或未指定的测试步骤。
