## 2026-07-16 - Task: 完成公考记忆卡基础版产品与技术设计

### What was done

- 明确基础版的本地运行、SQLite 存储、桌面优先、炭灰与朱红视觉方向。
- 完成录入、AI 自动规范、混合背诵、间隔复习、卡片管理、薄弱复盘和备份恢复的闭环设计。
- 整理六大模块的基础刚需与进阶增值边界，并提供七套可直接使用的标准录入模板。
- 定义 DeepSeek V4 Flash 的严格结构化规则、双向题生成边界、安全要求、数据模型和验收标准。

### Testing

- 已通过逐段可视化评审确认信息架构、录入页、AI 自动整理、背诵页、卡片库、复盘、设置和技术架构。
- 已检查设计与确认范围一致；进阶功能只记录分期，不纳入首版施工，首版不包含近七天学习量和手机专项适配。
- 已完成未完成内容、内部矛盾、范围和敏感信息扫描；六大模块与七套模板数量正确，未发现真实密钥或未决内容。
- 已完成独立只读复核，并修正数据库事务边界、最终正确解析必填口径、二级考点清单和 AI 事实保护测试样例。
- 已完成第二轮独立复核，并补充无法安全生成问答时的“待完善”降级、事务失败补偿和超时状态回收。
- 已完成最终复核修正，为待完善卡片补充编辑后自动重新整理和手动重试出口。
- 独立只读终审确认无高优先级或中优先级遗留问题。

### Notes

- `docs/superpowers/specs/2026-07-16-公考记忆卡基础版设计.md`：新增完整中文产品与技术设计。
- `progress.md`：追加本轮设计任务的完成内容、验证证据、文件清单和回滚方式。
- 提交前回滚：执行 `Remove-Item -LiteralPath 'docs\superpowers\specs\2026-07-16-公考记忆卡基础版设计.md','progress.md'`。
- 提交后回滚：在本任务提交仍为当前 `HEAD` 时执行 `git revert --no-edit HEAD`。

## 2026-07-16 - Task: 编写公考记忆卡基础版实施计划

### What was done

- 将已批准设计拆为十四个按依赖顺序执行的施工任务，每个任务均包含失败测试、最小实现、验证、日志和提交闭环。
- 明确前后端文件职责、共享类型、数据库结构、AI 契约、事务边界、FSRS 调度、图片、备份恢复、页面实现和最终验收命令。
- 建立首版要求与施工任务覆盖矩阵，并纳入离线、重启、生产静态服务、真实 DeepSeek 冒烟和密钥全链路隔离验证。

### Testing

- 自动检查确认十四个任务、十四个进度日志落点、十四个提交点和八十二个可勾选步骤齐全。
- Markdown 代码围栏数量为一百八十四且成对，未发现未决标记、真实 API Key 或旧测试命令。
- 独立只读终审已完成三轮问题修正，最终确认无高优先级或中优先级遗留问题。

### Notes

- `docs/superpowers/plans/2026-07-16-公考记忆卡基础版实施计划.md`：新增可按任务直接执行的完整基础版施工计划。
- `progress.md`：追加本轮实施计划的完成内容、验证证据、文件清单和回滚方式。
- 回滚方式：在本任务提交仍为当前 `HEAD` 时执行 `git revert --no-edit HEAD`。

## 2026-07-16 - Task: 建立本地应用工程骨架

### What was done

- 建立 React、Vite、Express 与 TypeScript 的本地前后端工程骨架，补齐开发、构建、启动、测试、类型检查和端到端测试脚本。
- 提供健康检查、Zod 环境配置、生产前端静态资源与路由回退，并确保未知接口和上传地址不会返回前端入口页。
- 提供最小产品首页、依赖锁定、环境变量示例和本地运行及数据管理说明。

### Testing

- `npx vitest run tests/server/health.test.ts tests/frontend/app.test.tsx`：通过，两个测试文件共五条测试全部通过。
- `npm run typecheck`：通过，前端与服务端 TypeScript 配置均无类型错误。
- `npm run build`：通过，成功生成 `dist/client` 与 `dist-server/index.js`。
- 构建服务冒烟验证通过：健康接口返回 `ok`，前端路由返回 200 且包含“公考记忆卡”。
- `git diff --check`：通过，未发现空白错误。

### Notes

- `.gitignore`：保留工作树忽略规则并新增依赖、构建、环境、数据及测试产物忽略项。
- `.env.example`：新增仅含空 DeepSeek 密钥及默认服务配置的环境示例。
- `package.json`：新增依赖清单与开发、构建、启动和验证脚本。
- `package-lock.json`：锁定本轮安装的 npm 依赖版本。
- `tsconfig.app.json`：新增前端和前端测试的严格类型检查配置。
- `tsconfig.server.json`：新增服务端和服务端测试的严格类型检查配置。
- `vite.config.ts`：新增 React 构建配置及 `/api`、`/uploads` 开发代理。
- `vitest.config.ts`：新增默认 Node 测试环境、初始化文件和自动 JSX 转换配置。
- `index.html`：新增前端应用入口页面。
- `src/App.tsx`：新增显示产品名称的最小应用组件。
- `src/main.tsx`：新增基于 `createRoot` 的 React 挂载入口。
- `server/config.ts`：新增基于 Zod 的端口、数据目录和 DeepSeek 配置读取。
- `server/app.ts`：新增健康接口、生产静态资源服务及前端路由回退。
- `server/index.ts`：新增环境加载和 Express 服务启动入口。
- `tests/setup.ts`：新增 Testing Library 断言扩展初始化。
- `tests/server/health.test.ts`：新增健康接口、默认配置和生产静态服务测试。
- `tests/frontend/app.test.tsx`：新增产品名称渲染测试。
- `docs/本地运行与数据管理.md`：新增 Node 版本、安装、开发、构建、地址、数据目录和密钥提交约束说明。
- `progress.md`：追加本轮实现、验证证据、文件清单和回滚方式。
- 回滚方式：在本任务提交仍为当前 `HEAD` 时执行 `git revert --no-edit HEAD`。

## 2026-07-16 - Task: 建立多智能体施工隔离目录

### What was done

- 为公考记忆卡基础版施工预留项目内 Git 工作树目录，并确保该目录不会被版本库跟踪。

### Testing

- 已确认当前位于普通 `master` 工作区而非既有工作树，且工作区无未提交改动。
- 将在提交后使用 `git check-ignore .worktrees` 验证忽略规则生效，并用 `git worktree list` 验证隔离工作树创建结果。

### Notes

- `.gitignore`：新增 `.worktrees/` 忽略规则，防止工作树内容进入主仓库状态。
- `progress.md`：追加本轮隔离目录准备的记录与回滚方式。
- 回滚方式：在本任务提交仍为当前 `HEAD` 时执行 `git revert --no-edit HEAD`。

## 2026-07-16 - Task: 修正本地应用工程骨架规格偏差

### What was done

- 将 DeepSeek 模型固定为 `deepseek-v4-flash`，把数据目录解析为绝对路径，并保持环境配置由 Zod 严格校验。
- 为所有路由启用 2MB JSON 请求体解析与大小限制，收紧前端回退的保留路径判断，使 `/apiary`、`/uploads-old` 等正常前端路径仍可访问。
- 将前后端开发与运行服务限制为仅监听本机，补齐测试隔离、共享类型目录覆盖，并将编辑器依赖收敛到批准清单。
- 同步本机访问地址、固定模型、绝对数据目录和本机环境文件使用说明。

### Testing

- TDD 红灯：首次运行 `npx vitest run tests/server/health.test.ts tests/frontend/app.test.tsx`，共八条测试，其中四条按预期失败；失败分别证明正常 JSON 未解析、超过 2MB 的 JSON 返回 404、相似前缀未回退前端、默认配置仍返回相对目录与旧模型名。
- TDD 绿灯：实现后再次运行同一命令，两个测试文件共八条测试全部通过。
- `npm run typecheck`：通过，前端与服务端 TypeScript 配置均无类型错误。
- `npm run build`：通过，成功生成前端与服务端构建产物。
- 构建服务冒烟验证：健康检查精确返回 `{"status":"ok"}`，监听地址精确为 `127.0.0.1`。
- `git diff --check`：通过；依赖清单、改动范围、空示例密钥和疑似真实密钥检查均通过；验证环境 Node.js 版本为 `v22.19.0`。

### Notes

- `.env.example`：将示例模型名修正为固定的 `deepseek-v4-flash`，密钥继续保持为空。
- `package.json`：将 Vite 开发地址限制为 `127.0.0.1`，并按批准清单调整 Tiptap 直接依赖。
- `package-lock.json`：通过 npm 正常锁定批准后的 Tiptap 依赖集合。
- `server/app.ts`：在路由前启用 2MB JSON 解析，并精确区分保留路径与相似前端路径。
- `server/config.ts`：使用 Zod literal 固定模型名，并将数据目录解析为绝对路径。
- `server/index.ts`：将 Express 服务监听地址固定为 `127.0.0.1`。
- `tests/server/health.test.ts`：新增 JSON 解析、请求体上限、精确回退边界、绝对数据目录和固定模型行为验证。
- `tsconfig.app.json`：将 `shared` 纳入前端类型检查范围。
- `tsconfig.server.json`：将 `shared` 纳入服务端类型检查范围。
- `vite.config.ts`：将 `/api` 与 `/uploads` 代理目标改为 `http://127.0.0.1:8787`。
- `vitest.config.ts`：启用 `clearMocks`，隔离不同测试之间的模拟状态。
- `docs/本地运行与数据管理.md`：同步本机访问地址、固定模型、绝对数据目录和 `.env` 本机使用约束。
- `progress.md`：仅在文件末尾追加本轮修正、验证证据、改动文件清单和回滚方式。
- 回滚方式：提交后执行 `git revert --no-edit HEAD`；提交前可执行 `git diff --binary d5d2b37 -- .env.example package.json package-lock.json server/app.ts server/config.ts server/index.ts tests/server/health.test.ts tsconfig.app.json tsconfig.server.json vite.config.ts vitest.config.ts docs/本地运行与数据管理.md progress.md > task1-fix.patch` 保存回滚点，再执行 `git apply -R task1-fix.patch` 回滚本轮改动。

## 2026-07-16 - Task: 恢复 SQLite 类型声明依赖

### What was done

- 恢复 `@types/better-sqlite3` 直接开发依赖，为后续服务端 TypeScript 导入 `better-sqlite3` 提供类型声明。
- 通过 npm 将清单范围和锁文件根范围固定为 `^7.6.12`，并锁定解析版本 `7.6.12` 与完整性哈希。
- 补充锁文件提交约束和安装后的类型检查说明。

### Testing

- 依赖核对：`npm ls @types/better-sqlite3 --depth=0` 通过，清单范围和锁文件根范围均为 `^7.6.12`，锁文件解析版本为 `7.6.12` 且包含完整性哈希。
- `npm run typecheck`：通过，前端与服务端 TypeScript 配置均无类型错误。
- `npx vitest run tests/server/health.test.ts tests/frontend/app.test.tsx`：通过，两个测试文件共八条测试全部通过。
- `npm run build`：通过，成功生成前端与服务端构建产物。
- `git diff --check`：通过，未发现空白错误。

### Notes

- `package.json`：恢复 `@types/better-sqlite3@^7.6.12` 直接开发依赖，其他直接依赖保持不变。
- `package-lock.json`：通过 npm 锁定 `@types/better-sqlite3` 的根依赖范围、解析版本和完整性信息。
- `docs/本地运行与数据管理.md`：补充 SQLite 类型依赖锁定和安装后类型检查说明。
- `progress.md`：仅在文件末尾追加本轮依赖修正、验证证据、改动文件清单和回滚方式。
- 回滚方式：在本任务提交仍为当前 `HEAD` 时执行 `git revert --no-edit HEAD`。

## 2026-07-16 - Task: 收敛本地服务开发边界

### What was done

- 将 Vite 开发代理改为精确匹配 API 与上传根路径及子路径的正则，并复用经过 Zod 校验的服务端 `PORT` 配置，保持系统环境变量优先于 `.env`。
- 将生产静态回退的保留路径比较统一转为小写，避免大写 API 与上传路径被前端入口页吞掉。
- 将生产启动环境固定为 `NODE_ENV=production`，升级到 Multer 2 与配套类型声明，并使 Express 4 运行时与类型声明主版本一致。
- 将服务端测试临时目录改为系统临时目录下的独占目录，每次只清理本轮创建的目录。

### Testing

- TDD 红灯：先只扩充服务端测试，定向运行两个测试文件共十一条测试，其中三条按预期失败；失败分别证明大写保留路径返回前端页面，以及 Vite 缺少可验证的动态端口与代理边界配置。
- TDD 绿灯：最小实现后再次运行定向测试，两个测试文件共十一条测试全部通过。
- `npm run typecheck`：通过，前端与服务端 TypeScript 配置均无类型错误。
- `npm run build`：通过，成功生成前端与服务端构建产物。
- `npm ls --depth=0`：通过，顶层依赖树完整；Multer、Multer 类型声明均为 `2.2.0`，Express 类型声明为 `4.17.21`。
- `npm audit --omit=dev`：通过，生产依赖未发现已知漏洞。
- `git diff --check`：通过，未发现空白错误。

### Notes

- `package.json`：将生产启动设置为 `NODE_ENV=production`，升级 Multer 2 及配套类型，并将 Express 类型声明调整为 4.x。
- `package-lock.json`：通过 npm 锁定 Multer 2、Multer 2 类型与 Express 4 类型依赖树和完整性信息。
- `vite.config.ts`：新增可测试的配置创建函数，按环境配置生成本机代理目标并使用精确正则边界。
- `server/app.ts`：将前端回退保留路径判断改为大小写不敏感。
- `tests/server/health.test.ts`：新增开发代理和大写路径边界验证，并使用独占系统临时目录。
- `docs/本地运行与数据管理.md`：同步可配置端口、生产启动、依赖基线与验证命令。
- `progress.md`：仅在文件末尾追加本轮修正、验证证据、改动文件清单和回滚方式。
- 回滚方式：在本任务提交仍为当前 `HEAD` 时执行 `git revert --no-edit HEAD`。

## 2026-07-16 - Task: 完善开发代理 URL 边界

### What was done

- 扩展 Vite 开发代理正则，使 API 与上传根路径及子路径按大小写不敏感语义匹配。
- 允许 API 与上传根路径携带查询参数，同时继续排除 `/apiary`、`/uploads-old` 等相似前缀。
- 同步开发代理边界的本地运行说明。

### Testing

- TDD 大小写红灯：先只扩充 Vite 代理测试，定向运行两个测试文件共十一条测试，其中一条按预期失败；失败证明旧正则不匹配大写 API 路径。
- TDD 查询参数红灯：将查询参数边界拆为独立测试并临时恢复旧正则，仅运行该测试时一条按预期失败、其余十条跳过；失败证明旧正则不匹配 `/api?x=1`。
- TDD 绿灯：恢复正确正则后再次运行定向测试，两个测试文件共十二条测试全部通过，并覆盖大写根路径、子路径、根路径查询参数与相似前缀反例。
- `npm run typecheck`：通过，前端与服务端 TypeScript 配置均无类型错误。
- `npm run build`：通过，成功生成前端与服务端构建产物。
- `git diff --check`：通过，未发现空白错误。

### Notes

- `vite.config.ts`：将 API 与上传代理 context 改为兼容 JavaScript 的大小写字符类和查询参数边界正则。
- `tests/server/health.test.ts`：补充大写 API、上传根路径及子路径和根路径查询参数断言。
- `docs/本地运行与数据管理.md`：补充开发代理的大小写、查询参数和相似前缀边界说明。
- `progress.md`：仅在文件末尾追加本轮修正、验证证据、改动文件清单和回滚方式。
- 回滚方式：在本任务提交仍为当前 `HEAD` 时执行 `git revert --no-edit HEAD`。

## 2026-07-16 - Task: 建立 SQLite 结构和公考分类目录

### What was done

- 建立首版 SQLite 十张业务与迁移表、五个查询索引及字段、检查、外键和级联约束。
- 建立十个一级板块、五十九个二级考点的确定性分类目录，并通过版本迁移幂等写入共六十九条分类。
- 建立启用 WAL 与外键约束的数据库管理器，支持关闭、替换数据库后重新迁移并继续访问。
- 将服务启动接入数据目录创建、数据库打开和迁移流程，并补充本地数据库管理说明。

### Testing

- TDD 红灯：先只创建数据库测试并运行 `npx vitest run tests/server/database.test.ts`，按预期因 `../helpers/testDatabase` 模块不存在而在收集阶段失败。
- TDD 绿灯：实现最小数据库能力后运行 `npx vitest run tests/server/database.test.ts`，六条测试全部通过，覆盖十张表、五个索引、10/59/69 分类计数、确定性编号、重复迁移、WAL、外键、关键检查约束、级联删除和数据库替换。
- `npx vitest run tests/server/health.test.ts tests/frontend/app.test.tsx`：通过，任务 1 的两个测试文件共十二条测试全部通过。
- `npm run typecheck`：通过，前端与服务端 TypeScript 配置均无类型错误。
- `npm run build`：通过，成功生成前端与服务端构建产物。
- 构建服务运行检查：从项目根启动 `dist-server/index.js`，健康检查返回 `ok`，隔离临时数据目录成功生成 `gongkao.db`，随后已停止进程并清理该目录。
- `git diff --check`：通过，未发现空白错误；范围、密钥和运行产物检查无异常。

### Notes

- `server/db/database.ts`：新增数据库目录创建、WAL 与外键初始化以及关闭、获取和替换连接能力。
- `server/db/migrations.ts`：新增首版事务迁移、版本记录和确定性分类幂等写入。
- `server/db/migrations/001_initial.sql`：新增十张表、字段约束、外键级联和五个索引。
- `server/catalog/categories.ts`：新增十组、共五十九个二级考点的不可变公考分类目录。
- `tests/helpers/testDatabase.ts`：新增独占系统临时目录的数据库测试辅助器，并仅清理自身目录。
- `tests/server/database.test.ts`：新增数据库结构、分类、迁移、连接约束、级联删除和替换行为测试。
- `server/index.ts`：在本机监听前创建数据目录、打开数据库并执行迁移。
- `docs/本地运行与数据管理.md`：补充数据库路径、首次迁移、WAL、外键和删除数据目录的影响。
- `progress.md`：仅在文件末尾追加本轮实现、验证证据、改动文件清单和回滚方式。
- 回滚方式：在本任务提交仍为当前 `HEAD` 时执行 `git revert --no-edit HEAD`。

## 2026-07-17 - Task: 保证数据库替换原子可恢复

### What was done

- 将数据库替换改为源库只读完整性检查、一致快照、同目录暂存迁移与二次完整性检查，保留打开源库尚未检查点的 WAL 数据。
- 暂存验证成功后才关闭正式连接，通过同目录重命名换入并保留单次临时回滚点；换入失败时恢复原库并重新打开连接。
- 数据库初始化失败会关闭句柄，关闭操作可安全重复调用；测试资源改为动态获取 manager 当前连接。
- 补充数据库替换流程、连接持有方式和数据库专项验证命令。

### Testing

- TDD 红灯：先仅新增三条生命周期测试并运行 `npx vitest run tests/server/database.test.ts`，九条测试中三条按预期失败；损坏源导致连接关闭且清理出现 `EBUSY`，WAL 替换后资源连接不可用，测试资源仍返回缓存裸连接。
- TDD 绿灯：实现最小安全替换后再次运行数据库专项测试，九条测试全部通过；损坏的十字节源不会触碰原库，失败后原数据可读且可再次替换，打开源库的两条未检查点 WAL 数据完整保留，暂存和回滚文件无残留。
- `npm test`：通过，三个测试文件共二十一条测试全部通过。
- `npm run typecheck`：通过，前端与服务端 TypeScript 配置均无类型错误。
- `npm run build`：通过，成功生成前端与服务端构建产物。
- `git diff --check`：通过，未发现空白错误；范围、密钥、替换暂存、回滚文件和测试目录检查无异常。

### Notes

- `server/db/database.ts`：新增一致快照、暂存验证、原子换入、失败回滚、句柄清理和幂等关闭。
- `tests/helpers/testDatabase.ts`：将 `db` 改为动态 getter，始终返回 manager 当前连接。
- `tests/server/database.test.ts`：新增损坏源保护、失败后重试、WAL 数据完整性、动态连接和重复关闭验证。
- `docs/本地运行与数据管理.md`：补充安全替换步骤、连接获取约定和数据库专项测试命令。
- `progress.md`：仅在文件末尾追加本轮修复、验证证据、改动文件清单和回滚方式。
- 回滚方式：在本任务提交仍为当前 `HEAD` 时执行 `git revert --no-edit HEAD`。

## 2026-07-17 - Task: 清理数据库替换失败暂存

### What was done

- 将正式连接关闭纳入数据库替换的外层清理边界，确保忙查询导致关闭失败时仍删除本轮暂存数据库及其 WAL、SHM 文件。
- 关闭失败时保持当前正式连接和原数据库不变，不进入文件重命名、回滚或重新打开流程；释放查询后可使用同一 manager 重试替换。
- 补充忙查询拒绝替换的本地数据管理说明。

### Testing

- TDD 红灯：先仅新增忙查询生命周期测试并运行 `npx vitest run tests/server/database.test.ts`，十条测试中一条按预期失败；替换抛出忙查询错误且原库可用，但目录残留一个 `.restore-<uuid>` 暂存文件。
- TDD 绿灯：最小调整关闭与清理边界后再次运行数据库专项测试，十条测试全部通过；忙查询拒绝替换后无暂存或回滚文件，释放 iterator 后重试成功。
- `npm test`：通过，三个测试文件共二十二条测试全部通过。
- `npm run typecheck`：通过，前端与服务端 TypeScript 配置均无类型错误。
- `npm run build`：通过，成功生成前端与服务端构建产物。
- `git diff --check`：通过，未发现空白错误；范围、密钥、替换暂存、回滚文件和测试目录检查无异常。

### Notes

- `server/db/database.ts`：将正式连接关闭移入保证清理暂存文件的外层 `try/finally`。
- `tests/server/database.test.ts`：新增活动 iterator 导致关闭失败、原库保持可用、无文件残留和释放后重试验证。
- `docs/本地运行与数据管理.md`：补充忙查询时拒绝替换、清理暂存和释放后重试说明。
- `progress.md`：仅在文件末尾追加本轮修复、验证证据、改动文件清单和回滚方式。
- 回滚方式：在本任务提交仍为当前 `HEAD` 时执行 `git revert --no-edit HEAD`。

## 2026-07-17 - Task: 建立 DeepSeek 严格结构化契约

### What was done

- 建立卡片录入、规范结果、详情、复习调度和学习题面的共享类型契约，供后续前后端复用同一业务名称。
- 建立 DeepSeek 结构校验、事实保护提示词和 OpenAI 兼容请求提供者，固定模型、关闭思考模式并隔离系统规则与用户 JSON 数据。
- 对空响应、非法 JSON 和结构失败限定一次重试，对 HTTP 错误和 20 秒超时直接失败；所有错误只暴露受限错误码，不携带密钥或原始响应。
- 补充确定性测试提供者和本机密钥、数据外发、超时重试边界说明。

### Testing

- TDD 初始红灯：先只创建两份 AI 测试并运行 `npx vitest run tests/server/ai-schema.test.ts tests/server/deepseek.test.ts`，两个测试文件均因 `server/ai/schema` 与 `server/ai/prompt` 不存在而在收集阶段按预期失败。
- TDD 超时红灯：使用 Node 实际的 `TimeoutError` 语义运行 `npx vitest run tests/server/deepseek.test.ts`，十条测试中一条按预期失败，证明超时被误映射为 `http_error`；最小修复后 AI 专项两文件二十九条测试全部通过。
- TDD 角色边界红灯：增加两句设计原文的精确断言后运行 `npx vitest run tests/server/deepseek.test.ts`，十条测试中一条按预期失败；恢复提示词角色边界后十条全部通过。
- `npx vitest run tests/server/ai-schema.test.ts tests/server/deepseek.test.ts`：通过，两份测试文件共二十九条测试全部通过，未发送真实网络请求。
- `npm test`：通过，五个测试文件共五十一条测试全部通过。
- `npm run typecheck`：通过，前端与服务端 TypeScript 配置均无类型错误。
- `npm run build`：通过，成功生成前端与服务端构建产物。
- `git diff --check`：通过；包文件、应用入口、配置和数据库范围未改动，仓库与构建产物未发现真实密钥模式，`.env.example` 密钥值保持为空。

### Notes

- `shared/contracts.ts`：新增录入、规范结果、卡片详情、复习调度和学习题面的唯一共享类型。
- `server/ai/prompt.ts`：新增严格角色边界、九条事实保护规则和六个固定边界样例。
- `server/ai/schema.ts`：新增字段长度、枚举、题面数量和方向关系的 Zod 校验。
- `server/ai/provider.ts`：新增只含 `normalize` 方法的 AI 提供者接口。
- `server/ai/deepseek.ts`：新增固定模型的 DeepSeek 请求、20 秒超时、限定重试和脱敏错误处理。
- `tests/helpers/fakeAiProvider.ts`：新增返回预设规范结果的确定性测试提供者。
- `tests/server/ai-schema.test.ts`：新增规范结果、方向关系、数量和长度边界测试。
- `tests/server/deepseek.test.ts`：新增提示词、请求隔离、重试边界、超时、HTTP 错误和脱敏测试。
- `docs/本地运行与数据管理.md`：补充 AI 契约测试命令、本机新密钥、旧密钥撤销、数据外发和重试边界说明。
- `progress.md`：仅在文件末尾追加本轮实现、验证证据、改动文件清单和回滚方式。
- 回滚方式：在本任务提交仍为当前 `HEAD` 时执行 `git revert --no-edit HEAD`。

## 2026-07-17 - Task: 补全 AI 契约规格边界

### What was done

- 将系统提示词第 4、6、7 条恢复为设计原文，精确限定双向题、无法安全造题和用户手动分类的处理边界。
- 补齐题面与答案在一万字时通过、一万零一字时拒绝的参数化结构校验测试，不改变已经正确的结构校验实现。
- 将录入模式 `entry_mode` 补入 DeepSeek 数据外发字段清单，使运行文档与实际用户 JSON 一致。

### Testing

- TDD 提示词红灯：先增加第 4、6、7 条设计原文的精确断言并运行 `npx vitest run tests/server/deepseek.test.ts`，十条测试中一条按预期失败，证明现有提示词缺少第 4 条精确原文；恢复三条原文并将对应旧简写期望替换为精确契约后，十条测试全部通过。
- 结构边界覆盖补充：只增加 `question` 与 `answer` 的 10000/10001 字参数化用例后运行 `npx vitest run tests/server/ai-schema.test.ts`，二十二条测试直接全部通过，证明现有结构校验已正确执行长度上限，本轮未修改 `server/ai/schema.ts`。
- `npx vitest run tests/server/ai-schema.test.ts tests/server/deepseek.test.ts`：通过，两份测试文件共三十二条测试全部通过。
- `npm test`：通过，五个测试文件共五十四条测试全部通过。
- `npm run typecheck`：通过，前端与服务端 TypeScript 配置均无类型错误。
- `npm run build`：通过，成功生成前端与服务端构建产物。
- `git diff --check`：通过；改动范围仅包含本轮五个允许文件，仓库与构建产物未发现真实密钥模式。

### Notes

- `server/ai/prompt.ts`：恢复第 4、6、7 条设计原文的精确语义。
- `tests/server/deepseek.test.ts`：将三条提示词边界固定为设计原文精确断言。
- `tests/server/ai-schema.test.ts`：参数化覆盖题面与答案恰好达到和超过一万字的边界。
- `docs/本地运行与数据管理.md`：在 DeepSeek 外发字段中补充录入模式 `entry_mode`。
- `progress.md`：仅在文件末尾追加本轮规格修正、验证证据、改动文件清单和回滚方式。
- 回滚方式：在本任务提交仍为当前 `HEAD` 时执行 `git revert --no-edit HEAD`。

## 2026-07-17 - Task: 修正 AI 响应资源与错误边界

### What was done

- 区分响应正文读取阶段的超时、非法 JSON 和传输断流，只有非法 JSON 沿用一次重试，超时与断流直接返回脱敏错误。
- 非 2xx HTTP 响应在返回统一错误前尝试释放响应体，释放失败不会覆盖或泄露原有错误信息。
- 确定性 AI 提供者每次返回独立深拷贝，避免一次测试或调用修改结果后污染后续调用。
- 补充正文错误、响应体释放、脱敏和引用隔离测试，并同步本地运行说明。

### Testing

- TDD 红灯：先只补测试并运行 `npx vitest run tests/server/deepseek.test.ts`，十六条测试中五条按预期失败；正文超时和断流各请求两次、两个 HTTP 响应体取消回调均未调用、确定性 AI 两次返回同一对象引用。
- 外层非法 JSON 回归用例在旧实现上直接通过，证明既有 `invalid_json` 一次重试边界正确；本轮未伪造该项红灯。
- TDD 绿灯：最小实现正文错误分类、HTTP 响应体释放和结果深拷贝后，`npx vitest run tests/server/deepseek.test.ts` 十六条测试全部通过。
- `npx vitest run tests/server/ai-schema.test.ts tests/server/deepseek.test.ts`：通过，两份测试文件共三十八条测试全部通过，未发送真实网络请求。
- `npm test`：通过，五个测试文件共六十条测试全部通过。
- `npm run typecheck`：通过，前端与服务端 TypeScript 配置均无类型错误。
- `npm run build`：通过，成功生成前端与服务端构建产物。
- `git diff --check`：通过；改动范围仅包含本轮五个允许文件，仓库与构建产物未发现真实密钥模式。

### Notes

- `server/ai/deepseek.ts`：细分正文读取错误并在 HTTP 失败时释放响应体，所有失败继续使用受限错误码且不保存原始 cause。
- `tests/helpers/fakeAiProvider.ts`：每次规范化调用返回预设结果的深拷贝。
- `tests/server/deepseek.test.ts`：新增统一 mock 恢复、正文阶段错误、响应体取消失败脱敏和引用隔离覆盖。
- `docs/本地运行与数据管理.md`：补充正文超时与断流不重试、HTTP 失败释放响应体的说明。
- `progress.md`：仅在文件末尾追加本轮修正、验证证据、改动文件清单和回滚方式。
- 回滚方式：在本任务提交仍为当前 `HEAD` 时执行 `git revert --no-edit HEAD`。

## 2026-07-17 - Task: 实现卡片保存、自动整理和重试闭环

### What was done

- 新增版本 2 数据库迁移，为卡片持久化模板；全新数据库和已有版本 1 数据库都会按版本顺序升级，重复执行不会重复迁移。
- 建立卡片原始数据事务、事务外 AI 整理、结果事务和失败补偿闭环；用户固定字段、用户标签、模板和附件元数据在失败与重试时按约定保留。
- 补齐待整理、待完善、处理中和已完成状态转换，支持五分钟超时回收、单卡重试与启动后最多二十张待整理卡片的连续重试。
- 新增严格卡片创建与重试接口校验，以稳定中文错误体区分参数错误、不存在、非法状态和内部错误，不返回原始异常或 SQL 信息。
- 服务启动接入卡片服务，监听前回收超时处理中卡片，监听成功后异步执行待整理批量重试；同步补充本地运行与数据升级说明。

### Testing

- TDD 迁移红灯：先补版本 2 测试并运行 `npx vitest run tests/server/database.test.ts`，十二条中四条按预期失败，原因是只记录版本 1 且 `cards` 不存在 `template` 列。
- TDD 迁移绿灯：新增 002 并按顺序执行迁移后再次运行数据库专项，十二条测试全部通过，覆盖全新库、版本 1 原数据升级和重复迁移。
- TDD 卡片红灯：先创建 `tests/server/card-create.test.ts` 并运行专项测试，按预期在收集阶段因 `server/cards/service.ts` 尚不存在而失败。
- TDD 卡片绿灯：实现最小仓库、服务和路由闭环后运行 `npx vitest run tests/server/card-create.test.ts`，二十三条测试全部通过。
- `npx vitest run tests/server/database.test.ts tests/server/card-create.test.ts`：通过，两份专项测试共三十五条全部通过。
- `npm test`：通过，六个测试文件共八十五条测试全部通过，未调用真实网络。
- `npm run typecheck`：通过，前端与服务端 TypeScript 配置均无类型错误。
- `npm run build`：通过，成功生成前端与服务端构建产物。
- `git diff --check`：通过，改动范围仅包含本任务授权文件，未发现空白错误或真实密钥模式。

### Notes

- `server/db/migrations.ts`：改为按已记录版本顺序执行 001 和 002，并保持分类初始化只随版本 1 执行。
- `server/db/migrations/002_card_template.sql`：为 `cards` 新增非空且默认空字符串的模板字段。
- `tests/server/database.test.ts`：新增全新库版本 2、版本 1 原数据升级、模板默认值和重复迁移验证。
- `shared/contracts.ts`：在卡片详情合同中加入持久化模板字段。
- `server/cards/repository.ts`：新增原始数据、AI 结果、失败补偿、重试状态、批量查询和详情读取的 SQLite 事务实现。
- `server/cards/service.ts`：新增固定卡片服务接口，编排 AI 调用、状态转换、脱敏错误码、超时回收和批量重试。
- `server/cards/routes.ts`：新增严格创建与重试请求校验和稳定安全错误映射。
- `tests/server/card-create.test.ts`：使用真实临时 SQLite 覆盖事务、AI 结果、重试、模板、标签、恢复、批量和 HTTP 校验。
- `server/app.ts`：通过依赖注入挂载卡片路由，并统一处理请求体解析错误。
- `server/index.ts`：装配数据库、DeepSeek 与卡片服务，接入监听前恢复和监听后异步批量重试。
- `docs/本地运行与数据管理.md`：补充模板保存、AI 状态、启动恢复、批量重试和 002 自动升级说明。
- `progress.md`：仅在文件末尾追加本轮实现、验证证据、改动文件清单和回滚方式。
- 回滚方式：在本任务提交仍为当前 `HEAD` 时执行 `git revert --no-edit HEAD`。
