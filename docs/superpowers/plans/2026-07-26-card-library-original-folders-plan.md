# 卡片库用户初始稿文件夹实施计划

> **供智能体执行：** 必须使用 `subagent-driven-development`（推荐）或 `executing-plans` 逐项实施本计划。步骤使用复选框跟踪。

**目标：** 在卡片库“用户初始稿”视图顶部新增持久化文件夹，支持新建、删除、查看，并可把初始稿卡片拖入或用键盘菜单加入文件夹；加入动作只建立引用，不移除主列表卡片。

**架构：** SQLite 新增文件夹表和文件夹-卡片关联表；服务端通过现有初始稿来源键对关联卡片重新聚合，保证同一初始稿只计一次且重新衍生后仍能展开最新问题；前端以独立文件夹组件承载创建、删除、拖放和键盘入口，由卡片库页面统一管理请求与预览状态。

**技术栈：** TypeScript、React 18、Express、better-sqlite3、Zod、Vitest、Testing Library、Playwright。

---

## 文件责任边界

- 后端智能体单独负责：`server/db/migrations/005_card_folders.sql`、`server/db/migrations.ts`、`shared/contracts.ts`、`server/cards/repository.ts`、`server/cards/service.ts`、`server/cards/routes.ts`、`tests/server/card-folders.test.ts`，以及确有必要时的 `tests/server/database.test.ts`。
- 前端智能体单独负责：`src/pages/CardsPage.tsx`、`src/components/CardFolderShelf.tsx`、`src/styles/cards-glass.css`、`tests/frontend/cards-page.test.tsx`。
- 主智能体单独负责：本计划、运行说明文档、`progress.md`、集成验证、真实浏览器验收和最终整合。
- `package.json`、锁文件、公共配置、进度日志与运行文档均不允许子智能体修改。

### 任务一：新增文件夹迁移与服务端接口

**文件：**

- 新建：`server/db/migrations/005_card_folders.sql`
- 修改：`server/db/migrations.ts`
- 修改：`shared/contracts.ts`
- 修改：`server/cards/repository.ts`
- 修改：`server/cards/service.ts`
- 修改：`server/cards/routes.ts`
- 新建：`tests/server/card-folders.test.ts`
- 按需修改：`tests/server/database.test.ts`

- [x] **步骤 1：先写失败的迁移与接口测试**

覆盖以下行为：迁移创建两张表并启用级联；新建文件夹成功；空名、超长名和未知字段返回 400；同名返回 409；重复加入幂等；同一初始稿的多个衍生卡只计一条；删除文件夹后卡片仍存在；不存在的文件夹返回 404。

运行：

```powershell
npx vitest run tests/server/card-folders.test.ts tests/server/database.test.ts
```

预期：新增测试因接口和迁移尚不存在而失败。

- [x] **步骤 2：实现迁移和共享契约**

迁移版本 5 新增：

```sql
CREATE TABLE card_folders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL COLLATE NOCASE UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE card_folder_items (
  folder_id TEXT NOT NULL REFERENCES card_folders(id) ON DELETE CASCADE,
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (folder_id, card_id)
);
```

共享契约至少包含：

```ts
export interface CardFolderSummary {
  id: string;
  name: string;
  originalCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CardFolderContents {
  folder: CardFolderSummary;
  cards: CardDetail[];
}
```

迁移只追加，不修改已有版本，不改写 `cards` 表或既有数据。

- [x] **步骤 3：实现仓储和服务方法**

实现文件夹列表、创建、删除、加入卡片和读取内容。加入卡片时先完整校验 `cardIds` 均存在，再在同一事务内 `INSERT OR IGNORE`；文件夹计数按现有 `originalSourceKeySql` 去重。

读取内容时先从仍存在的关联卡恢复来源键，再展开同来源的当前所有衍生卡，并沿用卡片库当前排序规则。这样重新编辑初始稿后，文件夹能通过保留的锚点卡显示最新衍生内容。

- [x] **步骤 4：实现路由和安全错误映射**

在 `/:id` 动态路由之前注册：

```text
GET    /api/cards/folders
POST   /api/cards/folders
DELETE /api/cards/folders/:folderId
GET    /api/cards/folders/:folderId/cards
POST   /api/cards/folders/:folderId/cards
```

Zod 请求体使用严格模式；名称去除首尾空白后限制 1 至 40 个字符；`cardIds` 必须为非空、去重后的字符串数组。数据库错误不得直接返回给浏览器。

- [x] **步骤 5：验证后端任务**

运行：

```powershell
npx vitest run tests/server/card-folders.test.ts tests/server/database.test.ts
npm run typecheck
```

预期：专项测试和类型检查通过，旧数据库迁移到版本 5 后原卡片数量不变。

### 任务二：实现用户初始稿文件夹交互

**文件：**

- 新建：`src/components/CardFolderShelf.tsx`
- 修改：`src/pages/CardsPage.tsx`
- 修改：`src/styles/cards-glass.css`
- 修改：`tests/frontend/cards-page.test.tsx`

- [x] **步骤 1：先写失败的前端行为测试**

覆盖：文件夹区域仅在“用户初始稿”显示；创建请求；删除前确认且文案说明不删除卡片；拖入提交当前初始稿组全部卡片编号；成功后主列表仍保留；点击文件夹展开/收起；卡片键盘菜单可加入；请求失败不清空现有内容。

运行：

```powershell
npx vitest run tests/frontend/cards-page.test.tsx
```

预期：新增测试因组件和交互尚不存在而失败。

- [x] **步骤 2：实现独立文件夹架组件**

组件只负责展示与派发事件，不直接获取数据。提供内联创建输入、文件夹磁贴、数量、删除按钮、展开状态、拖放反馈和卡片加入菜单。删除按钮阻止触发文件夹展开。

拖放使用原生 HTML Drag and Drop；每个初始稿卡片组把其 `cards.map(card => card.id)` 作为拖动数据，文件夹放下后交由页面请求接口。重复加入由服务端幂等保证。

- [x] **步骤 3：接入卡片库页面状态与请求**

仅在 `contentVersion === 'original'` 时加载和显示文件夹。文件夹列表、活动文件夹内容和主卡片列表使用互不覆盖的加载状态。

创建、删除和加入成功后只刷新文件夹相关数据，不重新获取主卡片分页，因此下方卡片不会消失或跳页。切换到 AI 优化稿时收起活动文件夹并隐藏文件夹架。

- [x] **步骤 4：实现白色液态玻璃视觉和减少动态效果**

文件夹架使用现有浅色玻璃变量与紧凑磁贴；拖入目标只做轻微抬升、边框和阴影反馈。为 `prefers-reduced-motion: reduce` 取消位移和弹簧过渡，仅保留颜色、边框状态。移动端允许横向滚动文件夹，不压缩主卡片宽度。

- [x] **步骤 5：验证前端任务**

运行：

```powershell
npx vitest run tests/frontend/cards-page.test.tsx
npm run typecheck
```

预期：专项测试通过，键盘和拖放入口都能建立同一关联，AI 优化稿视图不出现文件夹。

### 任务三：集成、文档与真实浏览器验收

**文件：**

- 修改：`docs/` 内现有运行或数据说明文档（选择与本功能最相关的一份）
- 修改：`progress.md`
- 按需修改：只允许修复本功能集成暴露的问题文件

- [x] **步骤 1：检查并行结果边界**

查看 `git diff --check` 和改动清单，确认两个智能体未修改同一文件、未更改 `package.json`、锁文件、公共配置或无关页面；检查接口字段与前端调用完全一致。

- [x] **步骤 2：运行完整自动化验证**

```powershell
npm test
npm run typecheck
npm run build
```

预期：全部命令退出码为 0；若仓库已有与本轮无关的失败，必须单独记录原始失败证据，不得把它描述为本功能已通过。

- [x] **步骤 3：启动开发服务并进行真实浏览器验收**

```powershell
npm run dev
```

在桌面和 390 像素移动视口分别验证：创建文件夹、拖入卡片、主列表保留、数量去重、点击查看、重复加入、删除文件夹不删卡、切换 AI 优化稿隐藏、键盘入口可用、减少动态效果下无位移动画。保存验收截图并检查无重叠、截断和不可见按钮。

- [x] **步骤 4：更新正式说明和进度日志**

在 `docs/` 说明文件夹数据表、接口行为、删除语义和备份影响。在 `progress.md` 末尾按仓库固定格式追加：业务结果、真实执行的测试、全部改动文件清单，以及可执行回滚点；不得改写历史记录。

- [x] **步骤 5：最终范围核对**

确认本轮没有新增文件夹改名、文件夹排序、文件夹内手动排序、移出卡片、归档或其他未授权功能。确认所有改动均可直接追溯到“初始稿文件夹”需求。
