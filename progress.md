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

## 2026-07-17 - Task: 修正卡片离线配置与重试边界

### What was done

- DeepSeek 密钥为空或只有空白时立即返回稳定的 `not_configured`，不发起网络请求且不进入重试；卡片仍先保存到本地并保持 `pending`。
- 服务启动入口复用同一密钥判定，未配置密钥时跳过待整理卡片批量重试，避免无意义增加 AI 尝试次数。
- 批量重试改为调用闭包中的单卡重试函数，解构 `retryPendingBatch` 后仍能正常处理卡片；重试路由不再把显式 JSON `null` 当作空对象。
- 纠正上一轮验证记录的表述口径：`git diff --check` 只证明空白格式，本轮另行执行文件范围核对和明确密钥模式扫描。

### Testing

- TDD 红灯：先补离线配置、错误码保留、解构批量调用和 JSON `null` 四类测试，运行 `npx vitest run tests/server/deepseek.test.ts tests/server/card-create.test.ts`，四十四条中五条按预期失败；空白密钥两例仍调用 fetch，服务保存 `ai_error`，解构调用返回 `ready=0`，JSON `null` 返回 200。
- TDD 绿灯：最小修复后再次运行同一命令，DeepSeek 十八条与卡片二十六条共四十四条全部通过，注入 fetch 调用数为零。
- `npx vitest run tests/server/database.test.ts tests/server/card-create.test.ts tests/server/deepseek.test.ts`：通过，三份服务端专项共五十六条测试全部通过。
- `npm test`：通过，六个测试文件共九十条测试全部通过，未调用真实网络。
- `npm run typecheck`：通过，前端与服务端 TypeScript 配置均无类型错误。
- `npm run build`：通过，成功生成前端与服务端构建产物。
- 提交前 `git diff --name-only a1b066b` 范围核对列出十四个文件，均属于任务 4 原授权范围或本轮额外批准的 DeepSeek 文件；未出现其他模块。
- 首次提交后执行 `git diff --name-only a1b066b..HEAD`，同样只列出上述十四个任务 4 文件，确认完整提交范围没有越界。
- `git diff --check HEAD~1..HEAD`：通过；该命令仅用于确认提交差异不存在空白格式错误，不作为范围或密钥检查证据。
- 使用 PowerShell `Select-String` 对 `server`、`shared`、`tests`、`docs`、`progress.md` 和 `.env.example` 共三十个文件扫描 `sk-[A-Za-z0-9]{20,}`，结果为零条匹配。

### Notes

- `server/ai/deepseek.ts`：新增 `not_configured` 错误码和空白密钥判定，在任何 fetch 或重试前失败。
- `tests/server/deepseek.test.ts`：新增空密钥与纯空白密钥不触网的参数化测试。
- `server/cards/service.ts`：保留 `not_configured` 补偿错误码，并消除批量重试对方法接收者 `this` 的依赖。
- `server/cards/routes.ts`：只把未定义请求体视为空对象，显式 JSON `null` 继续交由严格对象校验拒绝。
- `server/index.ts`：未配置 DeepSeek 密钥时跳过启动后的待整理卡片批量重试。
- `tests/server/card-create.test.ts`：新增离线错误码、解构批量调用和 JSON `null` 路由回归测试。
- `docs/本地运行与数据管理.md`：补充无密钥时本地保存、不触网、不启动批量重试及配置后重试说明。
- `progress.md`：仅在文件末尾追加本轮修正、验证证据、改动文件清单和回滚方式。
- 回滚方式：在本任务提交仍为当前 `HEAD` 时执行 `git revert --no-edit HEAD`。

## 2026-07-17 - Task: 完成卡片管理和本地图片

### What was done

- 完成卡片详情读取、组合搜索、稳定分页、普通编辑、批量加星/加标签/归档和级联删除；默认列表排除归档卡片，分类与标签按精确关系筛选，文本搜索覆盖原文、规范表述、解析、口诀、拓展、笔记和标签名。
- 所有筛选值使用 Zod 校验和 SQLite 参数绑定；分类替换、用户标签替换、批量操作及附件元数据均使用真实事务，同名 AI 标签在用户明确添加后升级为用户来源。
- `needs_input` 卡片仅在原文实际变化后自动重新整理；星级、标签和归档等元数据修改不会触发 AI，批量和图片测试均使用确定性 AI stub，未访问真实网络。
- 完成 JSON 与 multipart 两种卡片创建、已有卡片附件增删和本地图片读取；图片仅接受 PNG、JPEG、WebP且单张不超过 10MB，使用 UUID 固定扩展名保存到 `data/uploads`。
- 创建或添加附件失败时清理本轮文件；删除附件或卡片时先提交数据库删除和外键级联，再删除本地文件，并对不存在文件保持幂等。

### Testing

- TDD 首次红灯：先新增两份测试并运行 `npx vitest run tests/server/cards-query.test.ts tests/server/uploads.test.ts`，共三十三项中一项既有 JSON 创建通过、三十二项按预期失败；管理接口因查询、详情、编辑、批量和删除路由不存在返回 404，multipart 创建落入 JSON 校验返回 400，附件及下载路由不存在返回 404，大文件在缺少 multipart 消费器时连接提前关闭。
- 首次实现后卡片管理专项二十四项中二十三项通过；唯一失败来自测试错误假设中文标签顺序，实际标签集合与来源正确。改为集合断言后卡片管理专项二十四项全部通过，上传专项首次实现即九项全部通过。
- 首次 `npm run typecheck` 发现三个类型错误：UUID 模板字面量导致过滤谓词不兼容两项，测试 spy 被断言为普通函数一项；按根因分别最小修正后类型检查通过。
- `npx vitest run tests/server/cards-query.test.ts tests/server/uploads.test.ts`：通过，两份专项共三十三项全部通过。
- `npm test`：通过，八个测试文件共一百二十三项全部通过，测试未调用真实网络。
- `npm run typecheck`：通过，前端与服务端 TypeScript 配置均无类型错误。
- `npm run build`：通过，成功生成前端与服务端构建产物。
- `git diff --check`：通过，未发现空白格式错误；PowerShell 授权范围和密钥模式核对未发现范围外文件或 `sk-[A-Za-z0-9]{20,}` 形式的真实密钥。

### Notes

- `shared/contracts.ts`：新增卡片搜索结果、普通更新和批量更新的共享类型。
- `server/cards/repository.ts`：新增参数化组合查询以及更新、批量、附件和删除事务，并实现用户标签来源升级。
- `server/cards/service.ts`：新增卡片管理编排、输入去重和数据库提交后的安全文件删除。
- `server/cards/routes.ts`：新增严格查询、详情、编辑、批量和删除接口，确保静态批量路由优先注册。
- `server/uploads/routes.ts`：新增 Multer 内存上传、格式与大小限制、UUID 落盘、失败清理及安全文件读取。
- `server/app.ts`：在提供上传目录时挂载上传接口，并保持未提供目录时的既有应用兼容。
- `server/index.ts`：创建并向卡片服务和应用传入同一个 `data/uploads` 目录。
- `tests/server/cards-query.test.ts`：使用真实临时 SQLite、真实服务和 Express 覆盖搜索、筛选、更新、批量、级联与 AI 重试边界。
- `tests/server/uploads.test.ts`：使用真实临时目录覆盖 multipart 创建、三种图片、限制、清理、读取和删除。
- `docs/本地运行与数据管理.md`：补充卡片管理 API、筛选默认值、日期分页、图片限制和文件事务顺序。
- `progress.md`：仅在文件末尾追加本轮实现、验证证据、改动文件清单和回滚方式。
- 回滚方式：在本任务提交仍为当前 `HEAD` 时执行 `git revert --no-edit HEAD`。

## 2026-07-17 - Task: 修正卡片编辑竞态与上传边界

### What was done

- 卡片处于 `processing` 时，包含原文、AI 固定字段、分类、模板或掌握度等 AI 相关内容的补丁会在任何校验和写入前整体拒绝，返回独立的 `processing_conflict`；用户标签、来源信息、星级和归档状态仍可安全更新。
- 批量添加标签在去空和去重后必须至少保留一项，空数组和全空白标签均返回参数错误且不更新卡片时间。
- 图片 MIME 白名单统一通过 `Object.hasOwn` 谓词判断，Multer 文件过滤与完整接收后的二次验证复用同一策略，不再接受原型链属性名。

### Testing

- TDD 红灯：先运行 `npx vitest run tests/server/cards-query.test.ts tests/server/uploads.test.ts`，三十六项中三项按预期失败；整理中的混合敏感补丁错误返回 200，空批量标签错误返回 200，MIME 策略导出缺失并报 `isAllowedImageMime is not a function`。
- 首次最小实现后三十六项中三十五项通过；唯一失败来自新测试错误假设标签顺序，实际标签集合和来源正确。改为集合断言后专项三十六项全部通过。
- `npm test`：通过，八个测试文件共一百二十六项全部通过，测试未调用真实网络。
- `npm run typecheck`：通过，前端与服务端 TypeScript 配置均无类型错误。
- `npm run build`：通过，成功生成前端与服务端构建产物。
- `git diff --check`：通过，未发现空白格式错误；授权范围和密钥模式扫描未发现范围外文件或真实密钥。

### Notes

- `server/cards/repository.ts`：新增整理中 AI 相关字段冲突的事务前置校验和专用错误码。
- `server/cards/service.ts`：将 `processing_conflict` 纳入服务层稳定错误类型。
- `server/cards/routes.ts`：新增整理中编辑冲突的 409 响应，并拒绝归一化后为空的批量标签。
- `server/uploads/routes.ts`：新增并复用基于自有属性的图片 MIME 白名单谓词。
- `tests/server/cards-query.test.ts`：新增 deferred AI 竞态、安全元数据、原子冲突和空批量标签回归测试。
- `tests/server/uploads.test.ts`：新增 MIME 白名单与原型属性名的直接策略测试，并移除无效的伪 MIME HTTP 覆盖。
- `docs/本地运行与数据管理.md`：补充整理中 AI 相关内容与安全元数据的编辑边界。
- `progress.md`：仅在文件末尾追加本轮修正、验证证据、改动文件清单和回滚方式。
- 回滚方式：在本任务提交仍为当前 `HEAD` 时执行 `git revert --no-edit HEAD`。

## 2026-07-17 - Task: 增加混合卡组和 FSRS 调度

### What was done

- 新增混合卡组会话接口，支持分类、卡片、标签、星级、掌握度和创建日期组合筛选；只选择未归档、状态为 `ready` 且有题面的卡片，固定顺序、到期优先和服务内随机补齐均按题面独立执行。
- 新增三级复习调度，将 `again`、`hard`、`good` 映射到 `ts-fsrs` 对应等级；新题面从空卡开始，已有题面使用已存调度状态，未开放 `Easy` 或 `Manual`。
- 在单个 SQLite 事务内全量更新题面 FSRS 状态、插入复习日志、聚合卡片最低掌握度，并只在 `again` 时增加错误次数；日志写入失败时题面和卡片改动整体回滚。
- 保持 `ts-fsrs@4.7.1` 兼容边界：FSRS 对象不虚构 `learning_steps`，题面更新 SQL 仍显式写入该字段并保持本次读取值不变。

### Testing

- TDD 首次红灯：先新增两份测试并运行 `npx vitest run tests/server/scheduler.test.ts tests/server/study-session.test.ts`，两个测试文件均因 `server/study/scheduler` 不存在而在收集阶段失败，0 项执行，符合目标模块尚未实现的预期。
- 首次最小实现后专项共二十八项中二十四项通过；三项失败来自测试错误假设 `ts-fsrs@4.7.1` 的既有卡日志到期语义，一项失败来自测试使用不存在的分类编号。只修正测试假设后，专项二十八项全部通过。
- 对计划要求的 `masteryRank` 固定对象契约补充 TDD：修改测试后运行调度专项，十三项中一项按预期失败，实际收到函数而不是映射对象；改为只读对象并调整服务下标访问后，两份专项二十八项全部通过。
- `npx vitest run tests/server/health.test.ts tests/server/card-create.test.ts tests/server/cards-query.test.ts`：通过，三个既有服务端测试文件共六十三项全部通过。
- `npm test`：通过，十个测试文件共一百五十四项全部通过；全部 AI 与随机行为使用本地注入，未访问真实网络。
- `npm run typecheck`：通过，前端与服务端 TypeScript 配置均无类型错误。
- `npm run build`：通过，成功生成前端与服务端构建产物。
- `git diff --check`：通过，未发现空白格式错误；仅输出既有 Windows 工作区的 LF/CRLF 转换提示。
- 使用 `git status --short` 与基线 `626a6d6084d2a5945825381cf1147ad23b6011d8` 差异合并核对，改动只包含本任务授权的十个文件；未修改迁移、依赖、锁文件、AI、上传、前端或其他测试。
- 使用 PowerShell `Select-String` 扫描 `server`、`shared`、`tests`、`docs`、`progress.md` 和 `.env.example` 中的 `sk-[A-Za-z0-9]{20,}` 模式，结果为零条匹配。

### Notes

- `server/study/scheduler.ts`：新增掌握度排名对象、三级等级映射、数据库状态到 FSRS 卡片转换和下一次调度计算。
- `server/study/service.ts`：新增参数化候选查询、确定性卡组选择、题面元数据组装和原子复习事务。
- `server/study/routes.ts`：新增两个严格请求体接口、数组和日期归一化以及脱敏错误响应。
- `server/app.ts`：新增可选复习服务装配，未提供依赖时保持既有应用行为。
- `server/index.ts`：使用同一个数据库 manager 创建复习服务并传入应用。
- `shared/contracts.ts`：补全背诵题面字段并新增会话与复习请求响应类型。
- `tests/server/scheduler.test.ts`：覆盖三级映射、只读掌握度排名、卡片转换、新旧题面调度、字段有效性和输入不变。
- `tests/server/study-session.test.ts`：使用真实临时 SQLite、真实服务和 Express 覆盖筛选、顺序、随机、排除、共享字段、事务、回滚和安全响应。
- `docs/本地运行与数据管理.md`：补充会话与复习接口、选择语义、事务原子性和 `learning_steps` 兼容策略。
- `progress.md`：仅在文件末尾追加本轮实现、验证证据、改动文件清单和回滚方式。
- 回滚方式：在本任务提交仍为当前 `HEAD` 时执行 `git revert --no-edit HEAD`。

## 2026-07-17 - Task: 修正会话筛选编号归一化

### What was done

- 会话筛选编号数组改为先验证元素类型，再统一去除首尾空白、忽略空白编号并去重；归一化后允许为空，继续表示不限制该类筛选。
- 保持严格请求体和元素类型校验不变，非字符串、嵌套值及额外字段仍会被拒绝。

### Testing

- TDD 红灯：先为混合空白项和三类数组全空白补充请求断言，运行 `npx vitest run tests/server/study-session.test.ts`，十五项中一项按预期失败；含空白项的有效分类数组返回 400，而预期为 200，其余十四项通过。
- TDD 绿灯：最小调整编号数组归一化顺序后，再次运行同一命令，单个测试文件十五项全部通过；混合空白和全空白数组均命中合格题面。
- `npm test`：通过，十个测试文件共一百五十四项全部通过，未访问真实网络。
- `npm run typecheck`：通过，前端与服务端 TypeScript 配置均无类型错误。
- `npm run build`：通过，成功生成前端与服务端构建产物。
- `git diff --check`：通过，未发现空白格式错误；仅输出既有 Windows 工作区的 LF/CRLF 转换提示。
- 使用 PowerShell `Select-String` 扫描 `server`、`tests`、`docs` 和 `progress.md` 中的 `sk-[A-Za-z0-9]{20,}` 模式，结果为零条匹配。

### Notes

- `server/study/routes.ts`：将筛选编号数组改为整体 trim、去空和去重，同时保留字符串元素校验。
- `tests/server/study-session.test.ts`：新增混合空白项和全空白数组均可生成会话的回归断言。
- `docs/本地运行与数据管理.md`：明确空白编号会被忽略，归一化后空数组仍有效。
- `progress.md`：仅在文件末尾追加本轮修正、验证证据、改动文件清单和回滚方式。
- 回滚方式：在本任务提交仍为当前 `HEAD` 时执行 `git revert --no-edit HEAD`。

## 2026-07-17 - Task: 增加总览、复盘和非敏感设置接口

### What was done

- 新增总览和复盘统计接口，按本机今日边界统计到期、新增和待攻克卡片；薄弱板块只使用真实复习日志计算 `again × 2 + hard`，高频错题按 `again` 次数和最近错误时间排序。
- 新增非敏感设置读取和修改接口，默认背诵数量、顺序和到期优先分别持久化到现有 `app_settings` 键值表；请求只允许三个既定字段。
- DeepSeek 配置状态只由注入密钥去除空白后是否非空决定，响应和 SQLite 均不包含密钥或密钥片段。
- 应用工厂增加统计服务和设置依赖的可选装配，未提供依赖时保持既有接口行为。

### Testing

- TDD 首次红灯：先运行 `npx vitest run tests/server/analytics.test.ts tests/server/settings.test.ts`，统计测试因目标服务模块不存在而收集失败；设置测试四项中三项因接口返回 404 按预期失败，一项未装配时返回 404 的兼容性测试通过。
- 首次最小实现后同一专项命令八项中七项通过；唯一失败为待整理卡片被错误计入待攻克，实际为三张而预期为两张。将待攻克收紧为未归档且状态为 `ready` 的薄弱卡后，专项两个文件共八项全部通过。
- `npm test`：通过，十二个测试文件共一百六十二项全部通过；全部数据使用本地临时 SQLite，未访问真实网络。
- `npm run typecheck`：通过，前端与服务端 TypeScript 配置均无类型错误。
- `npm run build`：通过，成功生成前端与服务端构建产物。
- `git diff --check`：通过，未发现空白格式错误；仅输出既有 Windows 工作区的 LF/CRLF 转换提示。
- 使用 PowerShell `Select-String` 扫描 `server`、`tests` 和 `docs` 中的 `sk-[A-Za-z0-9]{20,}` 模式，结果为零条匹配。

### Notes

- `server/analytics/service.ts`：新增本机日界统计、薄弱板块聚合和高频错题排序。
- `server/analytics/routes.ts`：新增总览与复盘查询接口和脱敏失败响应。
- `server/settings/routes.ts`：新增设置默认值、严格请求校验、键值持久化和非敏感 DeepSeek 配置状态。
- `server/app.ts`：新增统计服务与设置依赖的可选路由装配。
- `tests/server/analytics.test.ts`：覆盖今日边界、可背诵状态、薄弱分、涉及卡片数、高频错题排序和未装配兼容性。
- `tests/server/settings.test.ts`：覆盖默认值、配置状态、部分更新、重建应用后的持久化、非法输入和密钥隔离。
- `docs/本地运行与数据管理.md`：补充总览、复盘和设置接口的字段、统计口径、默认值与敏感数据边界。
- `progress.md`：仅在文件末尾追加本轮实现、验证证据、改动文件清单和回滚方式。
- `server/index.ts` 不在本任务授权范围内，本轮未修改；生产入口仍需创建统计服务，并把数据库 manager 与本机密钥作为设置依赖传入 `createApp` 后，新增接口才会在实际启动服务中装配。
- 回滚方式：在本任务提交仍为当前 `HEAD` 时执行 `git revert --no-edit HEAD`。

## 2026-07-17 - Task: 装配总览、复盘和设置生产入口

### What was done

- 在真实生产启动入口中使用现有数据库 manager 创建统计服务，并把统计服务、数据库 manager 和本机 DeepSeek 密钥配置传入应用工厂。
- 保持现有启动顺序、数据库连接、卡片服务、复习服务和待整理重试行为不变，使总览、复盘和非敏感设置接口在 `npm start` 对应的生产服务中实际可访问。

### Testing

- 复用规范复审红灯：修正前构建并启动真实 `dist-server/index.js`，`GET /api/dashboard`、`GET /api/review-summary` 和 `GET /api/settings` 均返回 404，证明应用工厂已有路由但生产入口未装配依赖。
- 首次烟测脚本因 Windows PowerShell 不支持所用的 `ProcessStartInfo.ArgumentList` 写法产生非终止脚本错误，该次结果作废且未作为验证证据；修正脚本为错误即停止并使用兼容的 `Arguments` 后重新执行。
- 生产入口烟测：构建后使用独立端口、系统临时 `DATA_DIR` 和空 `DEEPSEEK_API_KEY` 启动真实 `dist-server/index.js`；健康检查、总览、复盘和设置接口均返回 200，总览与复盘返回空库统计，设置返回默认值且 `deepseekConfigured` 为 `false`，序列化响应不含密钥字段或片段；子进程退出且临时目录清理完成。
- `npx vitest run tests/server/analytics.test.ts tests/server/settings.test.ts`：通过，两个专项文件共八项全部通过。
- `npm test`：通过，十二个测试文件共一百六十二项全部通过，未访问真实网络。
- `npm run typecheck`：通过，前端与服务端 TypeScript 配置均无类型错误。
- `npm run build`：通过，成功生成包含生产入口装配的前端与服务端构建产物。
- `git diff --check`：通过，未发现空白格式错误；仅输出既有 Windows 工作区的 LF/CRLF 转换提示。

### Notes

- `server/index.ts`：新增统计服务实例，并在现有应用创建调用中传入统计服务和非敏感设置依赖；该跨原任务文件改动用于修复真实生产入口不可用问题。
- `progress.md`：仅在文件末尾追加本轮修正、验证证据、改动文件清单和回滚方式。
- 回滚方式：在本修正提交仍为当前 `HEAD` 时执行 `git revert --no-edit HEAD`。

## 2026-07-17 - Task: 修正设置更新原子性与统计测试夹具

### What was done

- 设置修改改为在同一个 SQLite 事务内完成写入、完整读取和白名单值校验；任一已有设置的 JSON 损坏或枚举非法时，本次修改随读取异常一起回滚，不再出现接口返回失败但新值已经落库。
- 统计测试夹具改为每张卡同时绑定一个一级板块和匹配的二级考点，并验证薄弱统计仍只聚合一级板块，分数和涉及卡片数不会因二级关系翻倍。

### Testing

- TDD 红灯：预置合法的 `dueFirst=true`，并分别预置非法 `defaultOrder` 枚举和损坏 JSON 后运行 `npx vitest run tests/server/settings.test.ts`；六项中两项按预期失败，接口虽返回 500，但数据库中的 `dueFirst` 均错误变为 `false`，其余四项通过。
- TDD 绿灯：将完整响应读取移入同一事务后运行 `npx vitest run tests/server/settings.test.ts tests/server/analytics.test.ts`，两个文件共十项全部通过；两种损坏场景均保持旧值 `true`，一、二级分类并存时薄弱分和卡片数仍正确。
- `npm test`：通过，十二个测试文件共一百六十四项全部通过，未访问真实网络。
- `npm run typecheck`：通过，前端与服务端 TypeScript 配置均无类型错误。
- `npm run build`：通过，成功生成前端与服务端构建产物。
- `git diff --check`：通过，未发现空白格式错误；仅输出既有 Windows 工作区的 LF/CRLF 转换提示。

### Notes

- `server/settings/routes.ts`：让设置写入事务返回已读取并校验的完整响应，使读取失败自动回滚写入。
- `tests/server/settings.test.ts`：新增非法枚举和损坏 JSON 下的失败不落库回归测试。
- `tests/server/analytics.test.ts`：让卡片夹具同时绑定一、二级分类，并增加关系数量与一级聚合断言。
- `progress.md`：仅在文件末尾追加本轮质量修正、验证证据、改动文件清单和回滚方式。
- 回滚方式：在本修正提交仍为当前 `HEAD` 时执行 `git revert --no-edit HEAD`。

## 2026-07-17 - Task: 增加 SQLite 与图片备份恢复

### What was done

- 新增本地备份下载接口，使用 SQLite 备份能力生成包含 WAL 当前内容的一致副本，只把固定版本清单、数据库副本和图片目录根层普通文件写入 ZIP；不遍历整个数据目录，不包含环境文件、历史备份、目录外文件或 API Key，也不跟随符号链接。
- 新增安全恢复接口，先只读预检 ZIP 中央目录的路径、重复项和文件类型，再使用 `unzipper.Parse()` 逐项复验并写入独立暂存目录；仅允许清单、数据库和根层图片，拒绝路径穿越、绝对路径、反斜杠、盘符、UNC、NUL、未知或嵌套条目以及符号链接等非普通条目。
- 恢复写入前严格校验清单格式与版本、SQLite 完整性、外键、连续迁移版本和首版完整业务列契约；允许真实版本 1 数据库换入时迁移到当前版本 2，拒绝损坏库、空库、相似伪库和未来迁移版本。
- 覆盖前生成当前数据库和图片回滚点，数据库与图片任一步失败时分别尽最大可能恢复旧数据；回滚成功会清理暂存、活动目录和回滚点，回滚自身失败则保留人工恢复文件。真实生产入口复用同一个数据库 manager 装配备份服务。

### Testing

- TDD 初始红灯：先新增 `tests/server/backups.test.ts` 并运行 `npx vitest run tests/server/backups.test.ts`，测试文件因 `server/backups/service.ts` 不存在而在收集阶段失败，零项执行，符合目标模块尚未实现的预期。
- 首轮实现后专项十三项中十一项通过；合法恢复和数据库故障注入均因 Multer 的 `parts: 1` 在单文件 multipart 完成边界触发 `LIMIT_PART_COUNT` 而误返回 400。将分片上限改为 2，同时保留单文件和零文本字段限制后，十三项全部通过。
- 第二轮图片故障回归先得到二十五项中一项失败：故障操作未接入，接口返回 200 而预期 500；接入单个内部图片应用操作点后，数据库和图片均恢复旧值，专项二十五项全部通过。
- 相似伪库回归先得到明确失败：只有正确表名和少数字段的伪库收到 200 而预期 400；把可迁移性校验收紧到首版完整业务列集合后，专项二十六项全部通过，真实版本 1 迁移用例仍通过。
- `npm test`：通过，十三个测试文件共一百九十项全部通过；测试使用本地临时 SQLite、文件和注入故障，未访问真实网络。
- `npm run typecheck`：通过，前端与服务端 TypeScript 配置均无类型错误；此前 Multer 文件过滤回调的重载类型错误已通过明确接受和拒绝分支修正。
- `npm run build`：通过，成功生成包含备份恢复生产装配的前端与服务端构建产物。
- 生产入口烟测：首次脚本因 Windows PowerShell 未自动加载 `System.Net.Http` 类型而在恢复上传前中止，该次结果作废且进程和临时目录已清理；显式加载程序集后重跑，真实 `dist-server/index.js` 的健康检查、备份下载和同包恢复均返回 200，下载 ZIP 为 6119 字节，子进程与临时数据目录清理完成。
- `git diff --check`：通过，未发现空白格式错误，仅输出既有 Windows 工作区的 LF/CRLF 转换提示；使用 PowerShell 扫描 `server`、`tests`、`docs` 和 `progress.md` 中的 `sk-[A-Za-z0-9]{20,}` 模式，结果为零条匹配；系统临时目录无 `gongkao-restore-*.zip` 残留。

### Notes

- `server/backups/service.ts`：新增一致性备份、普通图片白名单打包、ZIP 双阶段校验、应用数据库验证、覆盖和双侧回滚逻辑。
- `server/backups/routes.ts`：新增备份附件下载与单文件恢复上传路由、512MB 上限、临时上传清理和脱敏稳定错误响应。
- `server/app.ts`：新增可选备份服务依赖和路由装配，未提供依赖时保持既有行为。
- `server/index.ts`：在真实启动入口中使用现有数据目录、图片目录和数据库 manager 创建并装配备份服务。
- `tests/server/backups.test.ts`：使用独立临时数据覆盖备份内容、版本 1 迁移、安全路径、特殊条目、损坏和伪数据库、回滚、上传限制、脱敏和清理行为。
- `docs/本地运行与数据管理.md`：补充备份下载、恢复上传、覆盖警告、安全校验、版本迁移、回滚点和验证命令。
- `progress.md`：仅在文件末尾追加本轮实现、验证证据、改动文件清单和回滚方式。
- 回滚方式：在本任务提交仍为当前 `HEAD` 时执行 `git revert --no-edit HEAD`。

## 2026-07-17 - Task: 修正备份恢复安全边界与同步临界段

### What was done

- 恢复 ZIP 的中央目录预检现在保留每个条目的声明字节、标志和压缩方法；逐项解析使用写入前计数转换流核对本地条目与声明，限制 64KiB 清单、10MiB 单图和全包实际解压总量，拒绝声明与实际不一致、压缩方法不一致和超限内容，并在失败后等待输入、解析器和输出流关闭。
- 备份数据库改为与应用迁移生成的同版本 canonical SQLite 结构比较，校验真实表类型、完整列定义、外键和必要唯一索引，并拒绝未知 VIEW、TRIGGER、同名视图、宽松伪表和未来迁移；当前版本从迁移结果读取，不再单独硬编码。
- 备份生成只收录根层非隐藏 `.png`、`.jpg`、`.jpeg` 和 `.webp` 普通文件；用户下载名仍为中文秒级格式，服务器内部文件名增加 UUID，同一秒并行生成不会覆盖。恢复包沿用相同图片白名单。
- 恢复成功后的清理改为尽力而为，不再因清理失败反向回滚业务；图片回滚会先确认回滚源存在，再删除当前图片，回滚失败时保留人工恢复点。Multer 已知格式错误返回 400、文件过大返回 413，未知磁盘或文件系统错误返回脱敏 500。
- 经用户明确批准，生产默认的数据库换入、同步图片重命名及失败时数据库和图片回滚改为同一事件循环同步临界段，中间不执行异步等待且不增加全局锁；取舍是恢复期间会短时阻塞本机事件循环，以避免其他成功写入落入随后被回滚的新数据库。

### Testing

- 第一轮红灯：保留并运行安全审查新增测试，`npx vitest run tests/server/backups.test.ts` 共三十九项，二十八项通过、十一项失败；失败分别命中图片白名单、同秒备份碰撞、中央声明与实际字节、单图上限、压缩方法、宽松表、未知 VIEW/TRIGGER、清理状态、回滚源和 Multer I/O 分类。
- 并发边界红灯：新增生产默认路径事件循环观察和异步故障窗口写入测试；两项均失败，数据库换入后微任务观察到图片仍未替换，且窗口写入在失败回滚后消失。同步临界段实现后，两项均通过，窗口写入只会在回滚完成后进入当前数据库，不再被覆盖。
- 代码复核补充红灯：手工恢复包中的 `uploads/.env`、文本文件和 Multer 2 新增的已知格式错误共三项失败；恢复图片白名单和错误码集合收紧后通过。
- `npx vitest run tests/server/backups.test.ts`：通过，四十三项全部通过，覆盖实际字节计数、10MiB 单图、canonical 数据库、唯一备份路径、清理与回滚故障、同步临界段、流释放和脱敏错误映射。
- `npm test`：通过，十三个测试文件共二百零七项全部通过，未访问真实网络。
- `npm run typecheck`：通过；首次全量后仅测试构造的 Multer 2 新错误码不在当前 `@types/multer` 联合类型中，使用明确测试断言后重新检查无类型错误，未修改依赖。
- `npm run build`：通过，前端与服务端构建成功，服务端产物包含修正后的备份恢复逻辑。
- 生产入口烟测：使用独立端口、空 DeepSeek 密钥和临时数据目录启动真实 `dist-server/index.js`，健康检查、备份下载和同包恢复均返回 200；内部文件名符合 `backup-YYYYMMDD-HHmmss-UUID.zip`，下载 ZIP 为 6120 字节，子进程和临时目录清理完成。

### Notes

- `server/backups/service.ts`：新增实际字节核对、canonical 数据库契约、图片白名单、唯一内部备份路径、完整流收口、尽力清理和同步恢复临界段。
- `server/backups/routes.ts`：细分 Multer 已知请求错误、文件过大和未知 I/O 的脱敏状态映射。
- `tests/server/backups.test.ts`：新增安全审查、清理回滚、同秒备份、流关闭、错误映射和用户批准并发边界的回归测试。
- `docs/本地运行与数据管理.md`：补充唯一内部文件名、实际字节限制、canonical 校验、清理语义和同步临界段取舍。
- `progress.md`：仅在文件末尾追加本轮修正、验证证据、改动文件清单和回滚方式。
- 回滚方式：在本修正提交仍为当前 `HEAD` 时执行 `git revert --no-edit HEAD`。

## 2026-07-17 - Task: 修正备份回滚快照与附件一致性

### What was done

- 将恢复前的当前数据库回滚文件和图片回滚副本纳入用户已批准的同步临界段；全部异步解包与校验完成后，紧邻换库使用当前连接 `serialize()` 和同步文件写入生成数据库回滚点，同步枚举并复制当前普通图片，再同步完成换库、换图和失败回滚，全段不让出事件循环且不增加全局锁。
- 备份图片清单改为只读取一致性 SQLite 快照中的 `attachments.stored_name`；只归档快照实际引用且当前存在的受支持普通图片，排除孤儿图片和快照完成后新增的图片。快照引用图片缺失、变成非普通文件或归档读取失败时整包失败，不发布不完整 ZIP，并清理 SQLite 快照的 WAL/SHM 伴随文件。
- canonical 数据库校验在表类型、列、外键和唯一索引之外，逐个应用表比较压缩空白后的 `sqlite_master.sql`；仅删除 CHECK 约束但保持其他 PRAGMA 结构不变的精细伪库也会在覆盖前被拒绝。

### Testing

- TDD 红灯：孤儿图片、SQLite 快照后新增图片、快照引用图片缺失、同步回滚快照完成点写入和仅删除 `cards.entry_mode` CHECK 五项均真实失败；前四项分别表现为错误打包、错误发布 ZIP 或未调用同步序列化，第五项在重建等价表并插入非法行后收到 200 而预期 400。
- `npx vitest run tests/server/backups.test.ts`：通过，四十八项全部通过；同步快照完成点排队的微任务只在失败回滚后执行并保留，数据库和图片回滚点在首次 `replaceFrom` 前均已存在。
- `npm test`：通过，十三个测试文件共二百一十二项全部通过，未访问真实网络。
- `npm run typecheck`：通过，前端与服务端 TypeScript 配置均无类型错误。
- `npm run build`：通过，前端与服务端构建成功，服务端产物包含同步回滚快照、附件关系归档和建表 SQL 校验。
- 生产入口烟测：使用独立端口、空 DeepSeek 密钥和临时数据目录启动真实 `dist-server/index.js`，健康检查、备份下载和同包恢复均返回 200；内部文件名保持唯一 UUID 格式，下载 ZIP 为 6118 字节，子进程和临时目录清理完成。

### Notes

- `server/backups/service.ts`：将回滚点创建纳入同步临界段，按 SQLite 快照附件清单归档图片，并补建表 SQL 契约与快照伴随文件清理。
- `tests/server/backups.test.ts`：新增同步回滚快照窗口、孤儿和快照后图片、引用缺失及 CHECK 约束伪库回归测试，并让既有备份测试写入真实附件关系。
- `docs/本地运行与数据管理.md`：说明快照附件关系、缺失附件失败语义、建表 SQL 校验和包含回滚点创建的同步临界段。
- `progress.md`：仅在文件末尾追加本轮二次修正、验证证据、改动文件清单和回滚方式。
- 回滚方式：在本二次修正提交仍为当前 `HEAD` 时执行 `git revert --no-edit HEAD`。

## 2026-07-17 - Task: 防止使用半成品回滚点恢复数据

### What was done

- 当前数据库和图片回滚点改为先在各自的 `.partial` 路径完整写入，再分别原子发布到正式路径；任一写入或发布失败都会尽力清理半成品和已经发布的单侧回滚点，不开始数据库或图片替换。
- 恢复流程增加回滚点就绪与业务替换开始两个状态门槛；只有完整回滚点已经发布且替换已经开始，后续失败才会执行数据库和图片回滚，回滚点准备失败不会触碰当前数据。
- 增加同步回滚图片复制故障注入边界和回归测试，覆盖两张当前图片中第二张复制失败时返回脱敏错误、数据库替换零调用、当前数据库和两张图片完整保留。

### Testing

- TDD 红灯：运行 `npx vitest run tests/server/backups.test.ts -t "回滚图片复制中途失败时不替换当前数据库和图片"`，新增用例一项失败、四十八项跳过；旧实现错误返回 `{ "restored": true }`，而预期为恢复失败。
- 最小实现后重跑同一用例一项通过；`npx vitest run tests/server/backups.test.ts` 通过，四十九项全部通过。
- `npm test`：通过，十三个测试文件共二百一十三项全部通过，未访问真实网络。
- `npm run typecheck`：通过，前端与服务端 TypeScript 配置均无类型错误。
- `npm run build`：通过，前端与服务端构建成功，服务端产物为 107.20 KB。
- 生产入口烟测：使用临时端口、空 DeepSeek 密钥和临时数据目录启动真实 `dist-server/index.js`，健康检查、备份下载和同包恢复均返回 200，恢复响应为 `{ "restored": true }`，下载 ZIP 为 6122 字节；子进程和临时目录清理完成。
- `git diff --check`：通过，仅输出既有 Windows 工作区的 LF/CRLF 转换提示；仓库源码、测试、文档和进度日志未匹配长格式密钥，系统临时目录无恢复上传包和本轮冒烟目录残留。

### Notes

- `server/backups/service.ts`：增加回滚文件同步复制注入点、双侧 `.partial` 完整发布流程和替换阶段状态门槛。
- `tests/server/backups.test.ts`：新增第二张回滚图片复制失败时当前数据库和两张图片均保持不变的回归测试。
- `docs/本地运行与数据管理.md`：明确回滚点完整发布后才开始替换，以及准备失败时当前数据保持不变。
- `progress.md`：仅在文件末尾追加本轮缺陷修正、验证证据、改动文件清单和回滚方式。
- 回滚方式：在本修正提交仍为当前 `HEAD` 时执行 `git revert --no-edit HEAD`。

## 2026-07-17 - Task: 建立桌面工作台和六个页面路由

### What was done

- 建立由应用自身持有的浏览器路由和紧凑左侧导航，固定提供总览、录入、背诵、卡片库、复盘和设置六个入口；默认侧栏宽 168 像素，可通过底部图标按钮折叠到 64 像素，折叠后仍保留可访问名称和悬停标题。
- 落实炭灰、朱红、浅灰画布、语义状态色、6 像素圆角、36 像素工具按钮和最低 1024 像素桌面宽度等统一设计变量；六个页面保持开放布局，只显示真实标题和必要空状态，不提前实现后续业务功能。
- 增加统一 JSON 与表单请求客户端和四态状态提示；JSON 请求安全合并 `Headers`，表单上传不手动设置 `Content-Type`，接口错误统一为带名称、状态码和错误码的 `ApiError`。
- 更新本地运行文档，明确六个页面地址、桌面最小宽度和侧栏折叠行为。

### Testing

- TDD 红灯：首次运行 `npx vitest run tests/frontend/app-shell.test.tsx` 时，测试文件因统一 API 客户端尚不存在而收集失败，明确命中新任务能力缺失。
- 定向测试：`npx vitest run tests/frontend/app-shell.test.tsx tests/frontend/app.test.tsx` 通过，两个测试文件共十五项全部通过，覆盖六入口、链接、路由标题、激活态、折叠可访问性、四种状态提示、请求头合并、表单边界、接口错误和旧首页产品名断言。
- `npm test`：通过，十四个测试文件共二百二十七项全部通过，未访问真实网络。
- `npm run typecheck`：通过，前端与服务端 TypeScript 配置均无类型错误。
- `npm run build`：通过，前端与服务端构建成功；前端入口脚本为 190.79 KB，服务端产物为 107.20 KB。
- 浏览器验证：使用本机 Chromium 逐一检查六个路由在 1440×900 和 1024×768 两种视口下的展开状态，页面宽度均等于视口宽度且无横向溢出；展开侧栏为 168 像素，折叠后为 64 像素。展开与折叠截图经图片目检，品牌、标题、导航、状态行和折叠按钮无重叠或裁切；实测画布为 `#eef0f2`、侧栏为 `#23262b`、标题为 24 像素。
- `git diff --check`：通过，仅输出既有 Windows 工作区的 LF/CRLF 转换提示；本轮临时浏览器服务已停止，临时截图不进入版本库。

### Notes

- `src/api/client.ts`：新增统一 JSON、表单请求和 `ApiError` 错误契约。
- `src/components/AppShell.tsx`：新增品牌、六项 Lucide 导航和可访问折叠按钮组成的桌面外壳。
- `src/components/StatusNotice.tsx`：新增加载、空、错误和成功四种稳定状态区域。
- `src/styles/tokens.css`：新增已批准的颜色、尺寸、圆角和侧栏设计变量。
- `src/styles/global.css`：新增桌面画布、侧栏、导航、页面标题和状态提示的全局样式。
- `src/pages/DashboardPage.tsx`：新增总览页标题和空状态边界。
- `src/pages/EntryPage.tsx`：新增录入页标题和空状态边界。
- `src/pages/StudyPage.tsx`：新增背诵页标题和空状态边界。
- `src/pages/CardsPage.tsx`：新增卡片库页标题和空状态边界。
- `src/pages/ReviewPage.tsx`：新增复盘页标题和空状态边界。
- `src/pages/SettingsPage.tsx`：新增设置页标题和空状态边界。
- `src/App.tsx`：改为由应用自身组合浏览器路由、桌面外壳和六个页面。
- `src/main.tsx`：加载全局样式并保持入口不重复包裹路由。
- `tests/frontend/app-shell.test.tsx`：新增工作台、状态提示和统一 API 客户端回归测试。
- `docs/本地运行与数据管理.md`：补充六个页面地址、桌面范围和侧栏折叠说明。
- `progress.md`：仅在文件末尾追加本轮实现、验证证据、改动文件清单和回滚方式。
- 回滚方式：在本任务提交仍为当前 `HEAD` 时执行 `git revert --no-edit HEAD`。

## 2026-07-17 - Task: 修正桌面外壳空响应与折叠语义

### What was done

- 统一 API 客户端增加共享成功响应解析，JSON 请求与表单请求收到 204 时直接返回 `undefined`，不再尝试解析空响应体；其他成功响应仍按 JSON 解析。
- 侧栏增加稳定标识，折叠按钮通过 `aria-controls` 和 `aria-expanded` 暴露控制对象与当前状态；鼠标或键盘触发折叠后按钮继续保持焦点。
- 品牌区增加固定 32×32 像素的 Lucide 书本图标，展开时与产品名共同显示，折叠到 64 像素后只隐藏文字并保留图标，避免品牌区域空白。
- 更新本地运行文档，明确侧栏折叠后仍保留品牌书本图标。

### Testing

- TDD 红灯：`npx vitest run tests/frontend/app-shell.test.tsx` 共十六项，十三项通过、三项失败；失败分别命中按钮缺少 `aria-expanded`、品牌图标不存在和 204 空响应仍调用 `json()` 后抛出语法错误。
- 定向测试：`npx vitest run tests/frontend/app-shell.test.tsx tests/frontend/app.test.tsx` 通过，两个测试文件共十七项全部通过，覆盖 204 JSON 与表单响应、侧栏 ARIA 关联、折叠焦点和品牌图标持久显示。
- `npm test`：通过，十四个测试文件共二百二十九项全部通过，未访问真实网络。
- `npm run typecheck`：通过，前端与服务端 TypeScript 配置均无类型错误。
- `npm run build`：通过，前端与服务端构建成功；前端入口脚本为 191.51 KB，服务端产物为 107.20 KB。
- 浏览器验证：1440×900 展开态侧栏为 168 像素，品牌图标为 32×32 像素，按钮 `aria-expanded=true` 且正确关联侧栏；1024×768 下使用 Tab 到达折叠按钮并按 Enter 后，侧栏为 64 像素，按钮继续保持焦点且 `aria-expanded=false`，品牌图标仍为 32×32 像素而文字隐藏。两个视口均无页面或元素横向溢出，控制台错误和页面错误均为零。
- 图片目检：在系统临时目录生成 1440 展开态和 1024 折叠态截图并使用图片查看工具检查，品牌、导航、标题、状态行和焦点框均无重叠或裁切；截图不进入仓库。
- `git diff --check`：通过，仅输出既有 Windows 工作区的 LF/CRLF 转换提示。

### Notes

- `src/api/client.ts`：共享成功响应解析并安全处理 204 空响应。
- `src/components/AppShell.tsx`：增加侧栏标识、按钮 ARIA 状态和常驻品牌书本图标。
- `src/styles/global.css`：增加 32×32 像素品牌图标样式并保持 6 像素圆角。
- `tests/frontend/app-shell.test.tsx`：新增 204、折叠语义、键盘焦点和品牌图标回归断言。
- `docs/本地运行与数据管理.md`：补充折叠后保留品牌书本图标的使用说明。
- `progress.md`：仅在文件末尾追加本轮审查修复、验证证据、改动文件清单和回滚方式。
- 回滚方式：在本修复提交仍为当前 `HEAD` 时执行 `git revert --no-edit HEAD`。

## 2026-07-17 - Task: 完成七模板录入页和 AI 状态反馈

### What was done

- 实现错题录入、知识点积累两种模式和七套标准模板；模板逐项使用已确认的适用范围、五类字段提示和推荐标签，不写入示例答案。
- 建立开放式主编辑区与右侧属性栏，支持一级板块、细分考点多选，来源类型和详情、一至五星、掌握程度、标签、录入日期及本地图片暂存和移除；保存前同时校验一级板块、细分考点和原始内容。
- 原始内容使用严格受控的 TipTap 节点与标记集合，只开放分段、加粗、三种文字颜色、历史记录和预置公式文本；粘贴只读取纯文本，同时保存纯文本与受控 JSON。
- 首次保存无论有无图片都只发送一次表单创建请求，完整卡片 JSON 放入 `payload` 且附件元数据保持空数组，图片使用重复文件字段；已整理状态直接显示题面数，不增加 AI 确认框。
- 待整理和待完善状态保留当前卡片编号，后续保存只更新同一张卡片；待完善原文发生变化时沿用后端自动重整。现有更新契约不支持追加附件时，页面阻止虚假保存并保留已上传附件。
- 更新本地运行文档，说明七模板、三项必填、受控富文本、首次表单请求、同卡更新和附件边界。

### Testing

- TDD 红灯：首次运行 `npx vitest run tests/frontend/entry-page.test.tsx` 时十项全部失败，首个失败为当前占位页找不到“模板”选择框，其余失败分别命中模式、字段、必填校验、编辑器工具、分类和保存能力尚不存在。
- 定向测试：`npx vitest run tests/frontend/entry-page.test.tsx` 通过，一个测试文件共十项全部通过，覆盖七模板精确内容、三项必填、五个可选字段、父子分类多选、属性字段、纯文本粘贴、图片暂存、完整表单请求、三种 AI 结果、同卡更新、附件边界和禁重复保存。
- `npm test`：通过，十五个测试文件共二百三十九项全部通过，前端测试使用假网络响应，未访问真实外部网络。
- `npm run typecheck`：通过，前端与服务端 TypeScript 配置均无类型错误。
- `npm run build`：通过，前端与服务端构建成功；前端入口脚本为 499.45 KB，服务端产物为 107.20 KB。
- 浏览器验证：当前环境没有 Browser/IAB 工具，使用 Playwright CLI 回退验证生产包。1440×900 和 1024×768 两个视口的页面宽度分别严格等于视口宽度；1024 视口顶部工具区客户宽度与滚动宽度均为 808 像素，无横向溢出。两个视口下保存按钮固定为 152 像素，五个编辑器工具均为 36 像素，控制台错误和警告均为零。
- 真实浏览器闭环：在空 AI 密钥和系统临时数据目录下切换模式与模板，勾选常识判断和文史，填写原文与解析并设置来源、四星、记忆模糊和标签；首次保存只有一次 `POST /api/cards` 并返回 201，页面显示“已保存，等待重新整理”。补充原文后只有一次 `PATCH /api/cards/:id` 并返回 200；只读数据库核对确认仍为一张卡片，原文已更新，状态为 `pending`，星级、掌握程度和父子分类正确。
- 图片目检：分别查看 1440×900 和 1024×768 实际截图，顶部模式、模板和操作区，主编辑区、右侧属性栏、字段文字和工具图标均无重叠、裁切或异常换行。截图、Playwright 会话、生产服务和临时数据目录均已清理，工作树未残留运行数据。
- `git diff --check`：通过，仅输出既有 Windows 工作区的 LF/CRLF 转换提示；源码、测试和文档未匹配密钥或系统临时路径。

### Notes

- `src/catalog/templates.ts`：新增七套录入模板的适用范围、字段提示和推荐标签纯数据目录。
- `src/components/RichTextEditor.tsx`：新增受控 TipTap 编辑器、Lucide 工具栏、纯文本粘贴和受控 JSON 回显校验。
- `src/pages/EntryPage.tsx`：实现完整录入表单、三项必填、分类与属性、多图片暂存、表单创建、同卡更新和 AI 状态反馈。
- `src/styles/global.css`：增加录入工作台、编辑器、属性栏、分类、图片和状态区域在两个桌面视口下的稳定样式。
- `tests/frontend/entry-page.test.tsx`：新增七模板、编辑器、字段、请求体、状态、同卡更新、图片边界和错误提示回归测试。
- `docs/本地运行与数据管理.md`：补充录入页使用方法、请求顺序和当前附件更新边界。
- `progress.md`：仅在文件末尾追加本轮实现、验证证据、改动文件清单和回滚方式。
- 回滚方式：在本任务提交仍为当前 `HEAD` 时执行 `git revert --no-edit HEAD`。

## 2026-07-17 - Task: 修正录入编辑器依赖边界与页面地标

### What was done

- 录入编辑器改为使用项目直接声明的 TipTap StarterKit，并显式关闭历史记录、标题、引用、列表、代码、斜体、删除线、硬换行、水平线、光标辅助等非白名单扩展，只保留文档、段落、文本和加粗，再组合直接声明的文字样式与颜色扩展。
- 保持纯文本粘贴和受控 JSON 白名单校验，富 HTML 不会生成标题、列表、代码等节点；禁用历史记录后，编辑器不响应撤销快捷键。
- 把录入页内部内容区域从 `main` 地标改为普通布局容器，保留原 class 和视觉布局，使应用外壳内始终只有一个主内容地标。

### Testing

- TDD 红灯：`npx vitest run tests/frontend/entry-page.test.tsx` 共十二项，十项通过、两项失败；失败分别确认录入路由存在两个 `main` 地标，以及输入内容会被 `Ctrl+Z` 撤销为空。
- 定向测试：`npx vitest run tests/frontend/entry-page.test.tsx` 通过，一个测试文件共十二项全部通过；新增覆盖单一 `main` 地标、禁用撤销和富 HTML 粘贴后的 `doc`、`paragraph`、`text` 节点白名单。
- `npm test`：通过，十五个测试文件共二百四十一项全部通过。
- `npm run typecheck`：通过，前端与服务端 TypeScript 配置均无类型错误。
- `npm run build`：通过，前端入口脚本为 521.62 KB，服务端产物为 107.20 KB；StarterKit 按规范替代独立扩展导入后，Vite 给出前端单块超过 500 KB 的体积提示，本轮未扩大到代码分包。
- 静态核对：编辑器不再直接导入 Bold、Document、History、Paragraph、Text 等传递扩展，所有非白名单 StarterKit 扩展均显式关闭；录入页内部不再包含 `main` 标签。
- `git diff --check`：通过，仅输出既有 Windows 工作区的 LF/CRLF 转换提示。

### Notes

- `src/components/RichTextEditor.tsx`：改用已声明的 StarterKit，显式关闭历史记录和全部非白名单扩展。
- `src/pages/EntryPage.tsx`：移除应用外壳内重复的主内容地标并保持原布局 class。
- `tests/frontend/entry-page.test.tsx`：新增撤销禁用、粘贴节点白名单和单一地标回归测试。
- `progress.md`：仅在文件末尾追加本轮规范修复、验证证据、改动文件清单和回滚方式。
- 回滚方式：在本修复提交仍为当前 `HEAD` 时执行 `git revert --no-edit HEAD`。

## 2026-07-17 - Task: 修正录入保存状态机和成功后表单清理

### What was done

- 使用同步请求锁覆盖完整保存请求生命周期，避免同一界面更新批次内重复提交；保存期间同时禁用保存和取消操作，请求结束后恢复操作。
- 整理完成时清空录入模式、模板、正文、可选字段、分类、来源、星级、掌握程度、标签以及暂存和已保存附件展示，同时保留成功提示，避免原内容被再次创建。
- 待整理和待完善状态继续保留当前表单、服务端附件和卡片编号，后续保存仍更新同一卡片。

### Testing

- TDD 红灯：首次运行 `npx vitest run tests/frontend/entry-page.test.tsx` 共十四项，十二项通过、两项失败；失败分别确认同一批次内连续提交会发出两次请求，以及整理完成后表单未恢复初始值。
- 定向测试：`npx vitest run tests/frontend/entry-page.test.tsx` 通过，一个测试文件共十四项全部通过；新增覆盖请求同步去重、保存期间禁用取消、整理完成后清空表单与附件、保留成功提示及阻止空表单再次提交。
- `npm test`：通过，十五个测试文件共二百四十三项全部通过。
- `npm run typecheck`：通过，前端与服务端 TypeScript 配置均无类型错误。
- `npm run build`：通过，前端入口脚本为 521.71 KB，服务端产物为 107.20 KB；Vite 仍提示前端单块超过 500 KB，本轮未扩大到代码分包。
- `git diff --check`：通过，仅输出既有 Windows 工作区的 LF/CRLF 转换提示。

### Notes

- `src/pages/EntryPage.tsx`：增加保存请求同步锁、保存期间取消禁用和整理完成后的表单值清理。
- `tests/frontend/entry-page.test.tsx`：新增重复提交、保存期间取消和整理完成后清空表单的回归测试。
- `progress.md`：仅在文件末尾追加本轮状态机修正、验证证据、改动文件清单和回滚方式。
- 回滚方式：在本修复提交仍为当前 `HEAD` 时执行 `git revert --no-edit HEAD`。

## 2026-07-17 - Task: 补充录入保存状态机使用说明

### What was done

- 补充录入页 AI 状态行为说明，明确整理完成后清空新建表单和附件展示并保留成功提示，待整理和待完善时保持表单供同卡更新。

### Testing

- 文档差异检查：`git diff --check` 通过，仅输出既有 Windows 工作区的 LF/CRLF 转换提示。

### Notes

- `docs/本地运行与数据管理.md`：补充 `ready`、`pending` 和 `needs_input` 状态下的表单与附件展示行为。
- `progress.md`：仅在文件末尾追加本轮文档修正、验证证据、改动文件清单和回滚方式。
- 回滚方式：在本修复提交仍为当前 `HEAD` 时执行 `git revert --no-edit HEAD`。

## 2026-07-17 - Task: 完成卡片库表格、批量管理与录入表单复用编辑

### What was done

- 实现由 URL 驱动的卡片库搜索和完整筛选，搜索停止输入三百毫秒后执行，板块与标签使用重复查询键；刷新、分页和筛选切换均保留当前条件，请求使用中止信号和请求代次避免旧响应覆盖新结果。
- 实现固定八列紧凑表格、两行知识点摘要、待整理与待完善状态、受控横向滚动、真实详情抽屉、分页以及稳定尺寸的图标操作按钮；原始输入和完整字段只在详情抽屉显示。
- 实现选择集和分别提交的批量加星、添加标签、归档操作；成功后刷新列表并清空选择。单卡归档后按默认未归档筛选移除，永久删除必须二次确认，请求失败会显示错误并保留页面状态。
- 卡片编辑统一跳转到 `/entry?edit=<卡片编号>`，读取详情后把原表单字段、父子分类、用户标签和附件映射回同一套录入表单；编辑保存始终更新同一卡片，待完善原文变化继续使用后端自动重整，不新增重试请求。
- 更新本地使用文档，说明筛选 URL、精确标签编号、编辑复用、详情和批量操作规则。

### Testing

- TDD 红灯：首次运行 `npx vitest run tests/frontend/cards-page.test.tsx` 时七项全部失败，首项因占位页没有“搜索卡片”输入框失败，其余分别命中加载状态、紧凑表格、批量操作、归档删除分页和编辑复用能力尚未实现。
- 定向测试：`npx vitest run tests/frontend/cards-page.test.tsx` 通过，一个测试文件共七项全部通过；卡片库与录入页联合测试 `npx vitest run tests/frontend/entry-page.test.tsx tests/frontend/cards-page.test.tsx` 通过，两个文件共二十一项全部通过。
- `npm test`：通过，十六个测试文件共二百五十项全部通过。
- `npm run typecheck`：通过，前端与服务端 TypeScript 配置均无类型错误。
- `npm run build`：通过，前端和服务端构建成功；Vite 仍提示前端单块超过 500 KB，本轮未扩大到代码分包。
- 浏览器验证：当前环境没有 Browser/IAB 插件，使用 Playwright CLI 复用系统 Chrome。1440×900 下三张真实接口卡片、八列表格、筛选区、批量工具和详情抽屉完整显示，页面宽度与视口均为 1440 像素；1024×768 下页面宽度与视口均为 1024 像素，筛选区宽度与滚动宽度均为 808 像素，表格在 808 像素容器内受控滚动到 1040 像素，十二个行操作控件均为 32×32 像素。
- 浏览器交互：搜索“广陵”后 URL 写入 `query` 且列表由三行缩为一行；勾选后批量工具出现；详情抽屉显示原文和全部固定字段；编辑链接正确回填父子分类、原文、来源、星级、掌握度和用户标签，实际保存只产生一次 `PATCH /api/cards/:id` 并返回 200。最终页面控制台零错误、零警告，列表请求中被中止的旧请求符合竞态保护预期。
- 图片目检：在系统临时目录生成 1440 列表、1440 详情和 1024 列表截图并使用图片查看工具逐张检查，未发现文本、筛选项、行、抽屉或操作按钮重叠和裁切；浏览器会话和 5173、8787 临时服务已停止，仓库内 Playwright 临时产物已删除。
- `git diff --check`：通过，仅输出既有 Windows 工作区的 LF/CRLF 转换提示。

### Notes

- `src/pages/CardsPage.tsx`：实现 URL 筛选、竞态保护、紧凑表格、详情抽屉、选择集、批量操作、单卡管理和分页。
- `src/pages/EntryPage.tsx`：增加 `edit` 参数读取、详情加载和原录入表单回填，编辑保存保持同卡更新并保留新建流程。
- `src/styles/global.css`：增加卡片库筛选、表格、批量工具、分页、状态和详情抽屉的稳定桌面样式。
- `tests/frontend/cards-page.test.tsx`：新增筛选 URL、三百毫秒防抖、竞态、状态、表格、详情、批量操作、归档删除分页和编辑复用测试。
- `docs/本地运行与数据管理.md`：补充卡片库筛选、标签编号、批量操作、详情与编辑复用说明。
- `progress.md`：仅在文件末尾追加本轮实现、验证证据、改动文件清单和回滚方式。
- 回滚方式：在本任务提交仍为当前 `HEAD` 时执行 `git revert --no-edit HEAD`。

## 2026-07-17 - Task: 修复编辑路由状态残留与待整理原文泄露

### What was done

- 录入页按普通新建、不同编辑卡片编号为表单设置稳定实例键；从 `/entry?edit=<卡片编号>` 通过站内导航返回 `/entry` 时会重建空白新建表单，后续保存只创建新卡片，同时不影响普通无编辑参数页面内待整理和待完善卡片的同卡续存。
- 卡片规范知识为空时，表格知识点、悬停标题、复选框和操作可访问名称统一使用“待生成知识点”，不再在详情抽屉外暴露原始输入；详情抽屉继续显示完整原文。

### Testing

- TDD 红灯：新增两项回归后运行 `npx vitest run tests/frontend/cards-page.test.tsx`，九项中七项通过、两项失败；编辑转新建测试确认标题已切回“录入”但原文仍为旧卡片内容，待整理测试确认表格文本、悬停标题、复选框和四个操作名称均包含唯一原文。
- 定向测试：`npx vitest run tests/frontend/cards-page.test.tsx` 通过，一个测试文件共九项全部通过；覆盖编辑转新建后清空表单、仅发送 `POST /api/cards`、不再 `PATCH` 旧卡，以及待整理原文仅在详情抽屉显示。
- `npm test`：通过，十六个测试文件共二百五十二项全部通过。
- `npm run typecheck`：通过，前端与服务端 TypeScript 配置均无类型错误。
- `npm run build`：通过，前端和服务端构建成功；Vite 仍提示前端单块超过 500 KB，本轮未扩大到代码分包。
- `git diff --check`：通过，仅输出既有 Windows 工作区的 LF/CRLF 转换提示。

### Notes

- `src/pages/EntryPage.tsx`：按新建或编辑卡片编号设置表单实例键，切换路由身份时清除旧表单状态。
- `src/pages/CardsPage.tsx`：规范知识为空时使用中性占位替代原始输入。
- `tests/frontend/cards-page.test.tsx`：新增编辑转新建请求语义和待整理原文隔离回归测试，并补齐编辑器测试所需的 jsdom 几何桩。
- `progress.md`：仅在文件末尾追加本轮审查修复、验证证据、改动文件清单和回滚方式。
- 回滚方式：在本修复提交仍为当前 `HEAD` 时执行 `git revert --no-edit HEAD`。

## 2026-07-17 - Task: 修复删除确认文案的原文泄露

### What was done

- 卡片规范知识为空时，永久删除确认文案使用“待生成知识点”，不再回退显示原始输入；有规范知识的卡片继续显示规范知识，删除确认与删除请求流程不变。

### Testing

- TDD 红灯：运行 `npx vitest run tests/frontend/cards-page.test.tsx -t "规范知识为空时表格和操作名称使用中性占位"`，一项失败、八项跳过；确认框实际收到“确认永久删除‘只允许详情查看的唯一原文’”，未包含“待生成知识点”。
- 定向测试：`npx vitest run tests/frontend/cards-page.test.tsx` 通过，一个测试文件共九项全部通过；确认文案包含“待生成知识点”且不含唯一原文，取消确认时不发送删除请求，详情抽屉仍显示原文。
- `npm test`：通过，十六个测试文件共二百五十二项全部通过。
- `npm run typecheck`：通过，前端与服务端 TypeScript 配置均无类型错误。
- `npm run build`：通过，前端和服务端构建成功；Vite 仍提示前端单块超过 500 KB，本轮未扩大到代码分包。
- `git diff --check`：通过，仅输出既有 Windows 工作区的 LF/CRLF 转换提示。

### Notes

- `src/pages/CardsPage.tsx`：删除确认在规范知识为空时改用中性占位。
- `tests/frontend/cards-page.test.tsx`：补充删除确认文案不得包含唯一原文的回归断言。
- `progress.md`：仅在文件末尾追加本轮删除确认边界修复、验证证据、改动文件清单和回滚方式。
- 回滚方式：在本修复提交仍为当前 `HEAD` 时执行 `git revert --no-edit HEAD`。

## 2026-07-17 - Task: 修复卡片库筛选状态、分页与详情抽屉交互

### What was done

- 板块和标签多值筛选在输入聚焦期间保留逐字输入草稿，同时立即将已识别值写入重复查询键，失焦后统一规范分隔符。
- 新筛选或分页请求发起时立即清空旧选择，避免等待中或失败后继续对旧卡片执行批量操作。
- 列表响应发现当前页超过实际总页数时，自动回到最后有效页并保持加载状态，覆盖直接访问越界页及末页最后一张卡片删除后的场景。
- 详情抽屉打开后聚焦关闭按钮，约束 Tab 和 Shift+Tab 焦点，支持 Escape 关闭并将焦点恢复到原查看按钮。

### Testing

- TDD 红灯：运行 `npx vitest run tests/frontend/cards-page.test.tsx`，十四项中五项失败、九项通过；失败分别复现多值输入逗号被吞、筛选请求保留旧选择、直接越界页不回退、末页删除不回退及详情抽屉未接管焦点。
- 卡片库定向测试：`npx vitest run tests/frontend/cards-page.test.tsx` 通过，一个测试文件共十四项全部通过。
- 卡片库与录入页联合回归：`npx vitest run tests/frontend/cards-page.test.tsx tests/frontend/entry-page.test.tsx` 通过，两个测试文件共二十八项全部通过。
- `npm test`：通过，十六个测试文件共二百五十七项全部通过。
- `npm run typecheck`：通过，前端与服务端 TypeScript 配置均无类型错误。
- `npm run build`：通过，前端和服务端构建成功；Vite 仍提示前端单块超过 500 KB，本轮未扩大到代码分包。
- `git diff --check`：通过，仅输出既有 Windows 工作区的 LF/CRLF 转换提示。

### Notes

- `src/pages/CardsPage.tsx`：修复多值筛选草稿、请求切换选择隔离、越界页回退和详情抽屉键盘焦点闭环。
- `tests/frontend/cards-page.test.tsx`：新增五项覆盖筛选输入、旧选择、分页回退及抽屉焦点的回归测试。
- `progress.md`：仅在文件末尾追加本轮交互边界修复、验证证据、改动文件清单和回滚方式。
- 回滚方式：在本修复提交仍为当前 `HEAD` 时执行 `git revert --no-edit HEAD`。

## 2026-07-17 - Task: 确认不会标注与加权抽取设计

### What was done

- 将不会标注确定为唯一用户可见的薄弱指标，明确移除星级、熟练度和三档掌握选择，并复用卡片级 `wrong_count` 兼容现有 SQLite 与 FSRS 数据。
- 固化不会与记住两种外部结果、原子事务、成功后停留当前题及失败可重试的交互规则，并明确随机加权不放回、到期池优先、固定顺序不加权和同卡多题面平分权重。
- 明确录入、卡片库、背诵、总览、复盘、设置的改动范围，以及错误处理、无障碍、响应式、测试、验收和非目标边界。

### Testing

- 规格自审：通过，占位词扫描未发现 `TBD`、`TODO`、待定或占位内容；逐项核对接口映射、事务、页面、算法、错误、验收与非目标，没有保留多选方案或冲突条款。
- 必备内容扫描：通过，文档包含 `wrong_count`、`unknown`、`known`、`again`、`good`、`StudyItem`、`CardDetail`、加权不放回、固定顺序、正反题面、无迁移及两个目标视口的明确规则。
- `git diff --check`：通过，无空白错误。

### Notes

- `docs/superpowers/specs/2026-07-17-不会标注与加权抽取设计.md`：新增经确认的不会标注、内部调度兼容和随机加权抽取正式规格。
- `progress.md`：仅在文件末尾追加本轮设计结论、检查证据、改动文件清单和回滚方式。
- 回滚方式：在本设计提交仍为当前 `HEAD` 时执行 `git revert --no-edit HEAD`。

## 2026-07-17 - Task: 编制不会标注与加权抽取实施计划

### What was done

- 将已确认设计拆为六个串行闭环，依次覆盖旧界面清理、卡片契约收紧、复习与加权抽取、完整背诵页、总览复盘设置以及端到端验收。
- 为每个任务明确失败测试、最小实现、定向与全量验证、文档更新、进度日志和独立提交要求，确保每个中间提交都能类型检查和构建。
- 明确不执行数据库迁移、不改写历史日志、不暴露内部 FSRS 等级，并将生产运行、重启、视觉、安全和真实网络冒烟纳入最终验收。

### Testing

- 计划自审：逐项对照正式规格的数据、事务、交互、随机、页面、错误、验收和非目标要求，六个任务均有明确落点。
- 未决标记与一致性检查：确认计划没有未决标记或模糊转引；外部结果、字段名称和任务依赖保持一致。
- `git diff --check`：通过，无空白错误。

### Notes

- `docs/superpowers/plans/2026-07-17-不会标注与加权抽取实施计划.md`：新增六任务 TDD 实施与最终验收计划。
- `progress.md`：仅在文件末尾追加本轮计划、检查证据、文件清单和回滚方式。
- 回滚方式：在本计划提交仍为当前 `HEAD` 时执行 `git revert --no-edit HEAD`。

## 2026-07-18 - Task: 移除录入页和卡片库的旧等级界面

### What was done

- 录入页移除旧等级状态、控件、编辑回填和更新字段；新建卡片仅在请求边界保留固定内部兼容值，待整理、待完善与编辑场景继续更新同一卡片。
- 卡片库移除旧等级筛选、查询参数、表格列和批量操作，固定为选择、知识点、板块、不会标注、下次复习、操作六列。
- 不会标注次数在表格中提供完整可访问名称，并在详情抽屉中作为只读累计值展示；同步收窄表格宽度和使用文档。

### Testing

- TDD 红灯：运行 `npx vitest run tests/frontend/entry-page.test.tsx tests/frontend/cards-page.test.tsx`，两个测试文件共二十八项，二十二项通过、六项按预期失败；失败覆盖录入控件、创建兼容值、更新字段、卡片筛选、八列表头和批量旧等级操作。
- 定向绿灯：同一命令通过，两个测试文件共二十八项全部通过。
- `npm test`：通过，十六个测试文件共二百五十七项全部通过。
- `npm run typecheck`：通过，前端与服务端 TypeScript 配置均无类型错误。
- `npm run build`：通过，前端和服务端构建成功；仅保留既有 Vite 单块超过 500 KB 提示。
- `git diff --check`：通过，仅输出既有 Windows 工作区的 LF/CRLF 转换提示。
- 范围与文本扫描：通过，仅修改本任务允许文件；两个页面和使用文档均未发现已移除的用户可见旧等级文案，卡片库页面也未残留对应查询字段。

### Notes

- `src/pages/EntryPage.tsx`：删除旧等级表单状态、回填、更新字段和控件，新建边界保留固定兼容值。
- `src/pages/CardsPage.tsx`：删除旧等级筛选、查询、列与批量操作，增加不会标注次数的表格无障碍名称和详情元数据。
- `src/styles/global.css`：删除旧等级列宽与星形样式，并按六列表格收窄最小宽度。
- `tests/frontend/entry-page.test.tsx`：更新录入字段、创建兼容载荷和同卡更新断言。
- `tests/frontend/cards-page.test.tsx`：更新筛选、严格六列表头、不会标注次数及批量工具断言。
- `docs/本地运行与数据管理.md`：同步录入页、卡片库、管理接口和不会标注只读累计值说明。
- `progress.md`：仅在文件末尾追加本轮实现、验证证据、改动文件清单和回滚方式。
- 回滚方式：在本任务提交仍为当前 `HEAD` 时执行 `git revert --no-edit HEAD`。

## 2026-07-18 - Task: 清理卡片库旧筛选参数和批量标签布局

### What was done

- 卡片库直接打开含旧筛选参数的地址时，先以替换方式删除旧参数并保留其他有效查询条件，再发起唯一一次列表请求。
- 批量标签容器改用稳定专用样式类并恢复 210 像素最小宽度，删除不再匹配当前结构的序号选择规则。

### Testing

- TDD 红灯：运行 `npx vitest run tests/frontend/cards-page.test.tsx`，十四项中十二项通过、两项按预期失败；失败分别证明旧地址身份触发重复请求、批量标签容器缺少专用样式类。
- 卡片库定向测试：同一命令通过，一个测试文件共十四项全部通过。
- 卡片库与录入页联合回归：`npx vitest run tests/frontend/entry-page.test.tsx tests/frontend/cards-page.test.tsx` 通过，两个测试文件共二十八项全部通过。
- `npm test`：通过，十六个测试文件共二百五十七项全部通过。
- `npm run typecheck`：通过，前端与服务端 TypeScript 配置均无类型错误。
- `npm run build`：通过，前端和服务端构建成功；仅保留既有 Vite 单块超过 500 KB 提示。
- `git diff --check`：通过，仅输出既有 Windows 工作区的 LF/CRLF 转换提示。

### Notes

- `src/pages/CardsPage.tsx`：增加旧筛选参数替换清理与请求门控，并为批量标签容器增加专用样式类。
- `src/styles/global.css`：以批量标签专用类替换孤儿序号规则并恢复最小宽度。
- `tests/frontend/cards-page.test.tsx`：补充地址栏清理、有效参数保留、单次请求和批量标签样式回归断言。
- `progress.md`：仅在文件末尾追加本轮修复、验证证据、改动文件清单和回滚方式。
- 回滚方式：在本修复提交仍为当前 `HEAD` 时执行 `git revert --no-edit HEAD`。

## 2026-07-18 - Task: 移除星级熟练度并接入不会标注抽取

### What was done

- 对外接口、录入页、卡片库和背诵流程不再要求用户选择星级、熟练度或掌握度；旧字段仅作为数据库和调度兼容信息在内部保留。
- 背诵页补齐可直接使用的学习流程，支持查看答案、记录“不会 +1”、记录“记住了”、上一张、下一张和本轮总结；同一卡片的不会标注次数会在当前轮次内同步展示。
- 服务端复习接口改为 `unknown` 与 `known` 两种外部结果：`unknown` 会原子增加卡片 `wrong_count`，`known` 不增加次数，内部仍映射到 FSRS 调度需要的结果。
- 随机抽取改为按不会标注次数辅助加权，并对同一卡片的多题面做权重平分；固定顺序不加权，到期优先仍先抽到期池再抽补充池。
- 总览统计、使用文档和回归测试同步改为围绕不会标注次数与内部调度结果说明，避免继续暴露模糊等级选择。

### Testing

- 服务端定向回归：`npx vitest run tests/server/card-create.test.ts tests/server/cards-query.test.ts tests/server/uploads.test.ts tests/server/study-session.test.ts tests/server/scheduler.test.ts tests/server/analytics.test.ts` 通过，六个测试文件共九十项全部通过。
- 前端定向回归：`npx vitest run tests/frontend/entry-page.test.tsx tests/frontend/cards-page.test.tsx tests/frontend/study-page.test.tsx` 通过，三个测试文件共三十项全部通过。
- `npm test`：通过，十七个测试文件共二百五十五项全部通过。
- `npm run typecheck`：通过，前端与服务端 TypeScript 配置均无类型错误。
- `npm run build`：通过，前端和服务端构建成功；Vite 仍提示既有前端单块超过 500 KB，未阻塞构建。
- `git diff --check`：通过，仅输出 Windows 工作区既有 LF/CRLF 转换提示。
- 残留文本扫描：已复核 `星级`、`熟练度`、`掌握度`、`rating`、`mastery` 等命中；剩余命中属于内部兼容字段、历史规格计划文档或说明“旧字段不再对外接受”的文档内容，未发现仍需用户选择的旧等级入口。

### Notes

- `shared/contracts.ts`：收紧对外契约，删除旧等级输入与输出字段，新增背诵项不会次数和复习结果。
- `server/cards/routes.ts`：移除卡片创建、查询、更新和批量操作中的旧等级字段校验。
- `server/cards/repository.ts`：让卡片写入依赖内部默认值，并停止通过旧等级字段查询或更新卡片。
- `server/cards/service.ts`：保留内部兼容默认值，不再把旧等级作为用户输入处理。
- `server/study/scheduler.ts`：将调度评分收口为内部 `again` 与 `good`，对外结果由服务层转换。
- `server/study/routes.ts`：删除背诵会话旧等级筛选，复习接口改收 `unknown` 与 `known`。
- `server/study/service.ts`：新增不会次数读取、复习结果写入、不会次数递增和随机加权抽取逻辑。
- `server/analytics/service.ts`：总览弱项、待攻克和高频错误统计改按不会次数与内部 `again` 记录计算。
- `src/pages/EntryPage.tsx`：录入请求停止发送旧等级字段。
- `src/pages/StudyPage.tsx`：实现可用背诵页和不会标注小组件，接入背诵会话与复习提交接口。
- `src/styles/global.css`：补充背诵页布局、操作按钮、不会标注和总结状态样式。
- `tests/frontend/entry-page.test.tsx`：更新录入页断言，确认不再提交旧等级字段。
- `tests/frontend/cards-page.test.tsx`：更新卡片库断言，保持旧等级入口清理和不会次数展示预期。
- `tests/frontend/study-page.test.tsx`：新增背诵页不会标注、查看答案、记住了和轮次同步回归测试。
- `tests/server/card-create.test.ts`：更新创建卡片接口的旧等级字段拒绝与默认兼容断言。
- `tests/server/cards-query.test.ts`：更新卡片查询、详情和批量操作对旧等级字段的预期。
- `tests/server/uploads.test.ts`：更新上传入库后的卡片契约断言。
- `tests/server/study-session.test.ts`：新增不会次数返回、复习结果、随机加权和到期优先抽取断言。
- `tests/server/scheduler.test.ts`：更新调度单元测试为内部评分输入。
- `tests/server/analytics.test.ts`：更新总览统计对不会次数和内部 `again` 记录的期望。
- `docs/本地运行与数据管理.md`：同步本地使用、接口和统计说明，明确旧等级字段不再作为用户可选项。
- `progress.md`：仅在文件末尾追加本轮实现、验证证据、改动文件清单和回滚方式。
- 回滚方式：提交前可执行 `git restore -- docs/本地运行与数据管理.md server/analytics/service.ts server/cards/repository.ts server/cards/routes.ts server/cards/service.ts server/study/routes.ts server/study/scheduler.ts server/study/service.ts shared/contracts.ts src/pages/EntryPage.tsx src/pages/StudyPage.tsx src/styles/global.css tests/frontend/cards-page.test.tsx tests/frontend/entry-page.test.tsx tests/server/analytics.test.ts tests/server/card-create.test.ts tests/server/cards-query.test.ts tests/server/scheduler.test.ts tests/server/study-session.test.ts tests/server/uploads.test.ts progress.md`，并删除 `tests/frontend/study-page.test.tsx`；提交后在本轮提交仍为当前 `HEAD` 时执行 `git revert --no-edit HEAD`。

## 2026-07-18 - Task: 添加简单项目入口

### What was done

- 在项目根目录新增可双击的 Windows 入口 `启动项目.cmd`，普通用户无需记忆 npm 命令即可打开项目。
- 入口会检查项目根目录、Node.js、`npm` 和依赖；首次运行会从 `.env.example` 创建本地 `.env`，缺少依赖时执行 `npm install`。
- 入口会优先复用已经运行的开发服务并打开 5173；没有运行服务时，会确保构建产物存在，再用 `npm start` 启动本机服务并打开 8787。
- 本地运行文档补充入口的适用场景、实际调用链路和不改变数据目录、端口配置、`.env` 配置的说明。

### Testing

- `cmd /c "启动项目.cmd --check"`：通过，入口自检返回 `Entry check passed`。
- `cmd /c "启动项目.cmd"`：通过，检测到当前开发服务已运行并打开 5173；验证过程中自动创建了被 `.gitignore` 忽略的本地 `.env`。
- `Invoke-RestMethod http://127.0.0.1:8787/api/health`：通过，返回 `{"status":"ok"}`。
- `npm run typecheck`：通过，前端与服务端 TypeScript 配置均无类型错误。
- `npm run build`：通过，前端和服务端构建成功；Vite 仍提示既有前端单块超过 500 KB，未阻塞构建。
- `git diff --check`：通过，仅输出 Windows 工作区既有 LF/CRLF 转换提示。

### Notes

- `启动项目.cmd`：新增项目双击入口，封装环境检查、依赖安装、构建检查、服务复用和本机启动流程。
- `docs/本地运行与数据管理.md`：补充 Windows 双击入口的使用说明和行为边界。
- `progress.md`：仅在文件末尾追加本轮入口交付、验证证据、改动文件清单和回滚方式。
- 回滚方式：提交前可执行 `git restore -- docs/本地运行与数据管理.md progress.md`，并删除 `启动项目.cmd`；提交后在本轮提交仍为当前 `HEAD` 时执行 `git revert --no-edit HEAD`。

## 2026-07-18 - Task: 添加归档撤销、保存后清空和 DeepSeek 可用性验证

### What was done

- 卡片库新增误归档撤销入口：单卡归档成功后显示“撤销归档”，切换到已归档视图后单卡操作显示“恢复归档”。
- 批量工具按当前归档视图切换动作：未归档视图批量归档，已归档视图批量恢复归档，成功后刷新列表并清空选择。
- 新建录入保存后统一清空表单、暂存图片和附件展示，保留本次保存结果提示，方便继续录入下一条知识点；编辑已有卡片仍保持同卡编辑语义。
- DeepSeek 提示词补充完整输出字段要求，AI schema 对真实模型容易省略的空字段和题面方向做兼容处理，避免有效返回被误判为 `invalid_schema`。
- 检查并确认真实密钥只保留在被忽略的 `.env` 中，`.env.example` 不包含密钥。

### Testing

- 前端定向回归：`npx vitest run tests/frontend/cards-page.test.tsx tests/frontend/entry-page.test.tsx` 通过，两个测试文件共二十九项全部通过。
- DeepSeek 单元回归：`npx vitest run tests/server/deepseek.test.ts` 通过，一个测试文件共二十项全部通过。
- `npm run typecheck`：通过，前端与服务端 TypeScript 配置均无类型错误。
- `npm run build`：通过，前端和服务端构建成功；Vite 仍提示既有前端单块超过 500 KB，未阻塞构建。
- DeepSeek 公网连通测试：通过，`.env` 中密钥已配置，请求返回成功且内容可解析为 JSON；测试过程未输出密钥。
- 应用配置验证：`GET /api/settings` 返回 `deepseekConfigured: true`，确认重启后的应用进程已读取本机密钥。
- 应用 AI 分析链路验证：通过应用接口创建临时卡片后自动整理为 `ready`，生成两个题面，随后已删除临时卡片；数据库记录检查显示 `ai_error_code` 为空。
- `npm test`：通过，十七个测试文件共二百五十八项全部通过。
- `git diff --check`：通过，仅输出 Windows 工作区既有 LF/CRLF 转换提示。
- 密钥安全检查：`.env` 已配置且被 `.gitignore` 忽略；`.env.example` 未配置密钥且不被忽略。

### Notes

- `src/pages/CardsPage.tsx`：新增单卡恢复、归档后撤销和已归档视图批量恢复逻辑。
- `src/pages/EntryPage.tsx`：新建保存完成后统一清空表单并保留保存结果提示，编辑页继续保留当前卡片。
- `src/styles/global.css`：新增归档撤销提示与按钮样式。
- `server/ai/prompt.ts`：补充 DeepSeek 输出字段、题面方向和空字段要求。
- `server/ai/schema.ts`：为可为空的 AI 辅助字段提供默认值，并在题型明确时补齐缺失的题面方向。
- `tests/frontend/cards-page.test.tsx`：补充单卡撤销、已归档恢复和批量恢复归档回归测试。
- `tests/frontend/entry-page.test.tsx`：更新新建保存后清空表单、继续创建下一张卡片和编辑页附件边界测试。
- `tests/server/deepseek.test.ts`：补充真实模型省略空字段和题面方向时的兼容解析测试。
- `tests/server/ai-schema.test.ts`：更新 AI schema 方向缺省时的解析预期。
- `docs/本地运行与数据管理.md`：同步归档恢复、批量恢复、保存后清空和同卡编辑说明。
- `progress.md`：仅在文件末尾追加本轮实现、验证证据、改动文件清单和回滚方式。
- 回滚方式：提交前可执行 `git restore -- src/pages/CardsPage.tsx src/pages/EntryPage.tsx src/styles/global.css server/ai/prompt.ts server/ai/schema.ts tests/frontend/cards-page.test.tsx tests/frontend/entry-page.test.tsx tests/server/deepseek.test.ts tests/server/ai-schema.test.ts docs/本地运行与数据管理.md progress.md`；提交后在本轮提交仍为当前 `HEAD` 时执行 `git revert --no-edit HEAD`。

## 2026-07-18 - Task: 修复列表型 DeepSeek 返回导致待整理

### What was done

- 定位用户已填写密钥但最新卡片未整理好的原因：应用已经识别 DeepSeek，但该卡 AI 返回了四个单向题面，超出项目当前每张卡最多两个题面的结构上限，因此被标记为 `invalid_schema`。
- AI schema 增加列表型返回兼容：单向题只保留首个核心题面，双向题最多保留两个方向题面，待完善内容丢弃多余题面，避免有效内容整张失败。
- DeepSeek 提示词补充“普通单向事实只输出一个最核心题面”的要求，减少模型把表格或列表逐行拆成多个题面的概率。
- 重新整理用户最新 pending 卡片，卡片已变为 `ready`，错误码为空，并生成一个背诵题面。

### Testing

- 当前服务配置检查：`GET /api/settings` 返回 `deepseekConfigured: true`。
- 失败定位：最新卡片原错误码为 `invalid_schema`，真实 DeepSeek 返回包含四个 `single` 题面，超出项目上限。
- 修复后重新整理：卡片 `6d235068-bdb0-4d01-9560-df3de8077ddc` 已变为 `ready`，`ai_error_code` 为空，题面数量为 1。
- 定向回归：`npx vitest run tests/server/ai-schema.test.ts tests/server/deepseek.test.ts` 通过，两个测试文件共四十三项全部通过。
- `npm run typecheck`：通过，前端与服务端 TypeScript 配置均无类型错误。
- `npm test`：通过，十七个测试文件共二百五十九项全部通过。
- `npm run build`：通过，前端和服务端构建成功；Vite 仍提示既有前端单块超过 500 KB，未阻塞构建。

### Notes

- `server/ai/prompt.ts`：补充列表和表格型内容只生成核心单向题面的提示词约束。
- `server/ai/schema.ts`：对超出上限的真实模型题面返回做裁剪兼容。
- `tests/server/ai-schema.test.ts`：更新方向缺省、单向多题面和待完善多余题面的结构校验预期。
- `tests/server/deepseek.test.ts`：补充真实模型把列表拆成多个单向题面时仍可整理成功的回归测试。
- `progress.md`：仅在文件末尾追加本轮问题定位、修复、验证证据、改动文件清单和回滚方式。
- 回滚方式：提交前可执行 `git restore -- server/ai/prompt.ts server/ai/schema.ts tests/server/ai-schema.test.ts tests/server/deepseek.test.ts progress.md`；提交后在本轮提交仍为当前 `HEAD` 时执行 `git revert --no-edit HEAD`。

## 2026-07-18 - Task: 多问题知识点拆卡并隐藏题面答案

### What was done

- 将单向多问题内容从“只保留首个题面”调整为“最多保留十二个题面”，便于后续拆成多张独立卡片。
- 卡片整理入库时只对 `single` 多题面执行拆卡：原卡保留第一个题面，额外题面各生成一张新的 `ready` 卡片，并继承原卡分类、用户标签和 AI 标签；双向题仍保留在同一张卡的正反两个题面。
- AI 提示词和 schema 增加“题面不得直接包含答案”的约束；当模型把答案原文写进 question 时，后端会把对应答案替换为空位。
- 背诵页未揭晓前只展示题目、分类、进度和不会标注次数；答案、知识点、解析和速记仅在点击“查看答案”或“不会 +1”后展示。
- 使用文档补充多问题拆卡规则和背诵页揭晓前后的展示边界。

### Testing

- 定向回归：`npx vitest run tests/server/card-create.test.ts tests/server/ai-schema.test.ts tests/server/deepseek.test.ts tests/frontend/study-page.test.tsx` 通过，四个测试文件共七十四项全部通过。
- `npm run typecheck`：通过，前端与服务端 TypeScript 配置均无类型错误。
- `npm run build`：通过，前端和服务端构建成功；Vite 仍提示既有前端单块超过 500 KB，未阻塞构建。
- `npm test`：通过，十七个测试文件共二百六十二项全部通过。
- `git diff --check`：通过，仅输出 Windows 工作区既有 LF/CRLF 转换提示。

### Notes

- `server/ai/prompt.ts`：调整 DeepSeek 输出规则，允许表格、清单或多问内容拆成多个单向题面，并要求题面不直接包含答案。
- `server/ai/schema.ts`：放宽单向题面数量上限，补齐题面方向，遮空题面中的答案原文，并恢复中文校验文案。
- `server/cards/repository.ts`：新增单向多题面的事务内拆卡落库逻辑，同时保留双向题同卡双题面的原有行为。
- `src/pages/StudyPage.tsx`：背诵未揭晓前不再显示可能包含答案的规范知识表述，揭晓后再展示知识点详情。
- `tests/server/ai-schema.test.ts`：更新多题面保留预期，并补充题面答案遮空回归测试。
- `tests/server/deepseek.test.ts`：更新提示词断言、多单向题面解析预期和题面答案遮空测试。
- `tests/server/card-create.test.ts`：补充 AI 返回多个单向题面后拆成多张独立可背诵卡片的服务级测试。
- `tests/frontend/study-page.test.tsx`：补充未揭晓前隐藏知识点、解析、速记，揭晓后再显示的前端回归测试。
- `docs/本地运行与数据管理.md`：同步多问题拆卡和背诵页展示边界说明。
- `progress.md`：仅在文件末尾追加本轮实现、验证证据、改动文件清单和回滚方式。
- 回滚方式：提交前可执行 `git restore -- server/ai/prompt.ts server/ai/schema.ts server/cards/repository.ts src/pages/StudyPage.tsx tests/server/ai-schema.test.ts tests/server/deepseek.test.ts tests/server/card-create.test.ts tests/frontend/study-page.test.tsx docs/本地运行与数据管理.md progress.md`；提交后在本轮提交仍为当前 `HEAD` 时执行 `git revert --no-edit HEAD`。

## 2026-07-18 - Task: 卡片库导出全部数据为 Excel

### What was done

- 卡片库页头新增“导出 Excel”按钮，点击后下载全量 `.xlsx` 文件，不受当前搜索、筛选、分页或勾选状态影响。
- 后端新增 `GET /api/cards/export` 下载接口，返回标准 Excel 工作簿，文件名格式为 `gongkao-cards-export-YYYYMMDD-HHmmss.xlsx`。
- Excel 工作簿包含说明、卡片、分类目录、卡片分类、标签、卡片标签、题面、附件元数据、复习记录和设置等工作表；归档卡片、待整理卡片和待完善卡片也会导出。
- 导出文件只包含附件元数据，不包含图片二进制文件；完整迁移或恢复电脑数据仍使用现有备份 ZIP。
- 前端补充 Blob 下载工具，导出失败时显示“导出失败，请稍后重试”，不改变列表状态。

### Testing

- 定向回归：`npx vitest run tests/server/card-export.test.ts tests/frontend/cards-page.test.tsx` 通过，两个测试文件共十九项全部通过。
- `npm run typecheck`：通过，前端与服务端 TypeScript 配置均无类型错误。
- `npm test`：通过，十八个测试文件共二百六十六项全部通过。
- `npm run build`：通过，前端和服务端构建成功；Vite 仍提示既有前端单块超过 500 KB，未阻塞构建。
- `git diff --check`：通过，仅输出 Windows 工作区既有 LF/CRLF 转换提示。
- 运行中服务烟测：`GET http://127.0.0.1:8787/api/cards/export` 成功下载文件，文件大小为 10436 字节，文件头为 `PK`，符合 xlsx/zip 格式。

### Notes

- `server/cards/exportExcel.ts`：新增最小标准 xlsx 工作簿生成器，复用现有 `archiver` 依赖生成多工作表文件。
- `server/cards/repository.ts`：新增全量导出查询，覆盖卡片、分类、标签、题面、附件元数据、复习记录和设置。
- `server/cards/service.ts`：新增导出 Excel 服务方法，将仓储数据转换为工作簿 Buffer。
- `server/cards/routes.ts`：新增 `GET /api/cards/export` 下载路由，并放在动态卡片编号路由之前。
- `src/api/client.ts`：新增 Blob 响应读取工具，供文件下载接口复用。
- `src/pages/CardsPage.tsx`：新增页头导出按钮、下载触发和失败提示逻辑。
- `src/styles/global.css`：补充卡片库页头动作区和导出按钮样式。
- `tests/server/card-export.test.ts`：新增 Excel 导出接口、工作表内容和空库导出回归测试。
- `tests/frontend/cards-page.test.tsx`：补充导出按钮下载、不改变筛选和勾选状态、失败提示的前端回归测试。
- `docs/本地运行与数据管理.md`：同步导出入口、导出范围、接口路径、文件名和图片本体边界说明。
- `progress.md`：仅在文件末尾追加本轮实现、验证证据、改动文件清单和回滚方式。
- 回滚方式：提交前可执行 `git restore -- server/cards/repository.ts server/cards/routes.ts server/cards/service.ts src/api/client.ts src/pages/CardsPage.tsx src/styles/global.css tests/frontend/cards-page.test.tsx docs/本地运行与数据管理.md progress.md` 并删除 `server/cards/exportExcel.ts`、`tests/server/card-export.test.ts`；提交后在本轮提交仍为当前 `HEAD` 时执行 `git revert --no-edit HEAD`。

## 2026-07-18 - Task: 添加 DIY 主题背景

### What was done

- 将项目外层的 `人民英雄.jpg`、`国徽.jpg`、`开国大典.jpg` 复制到前端公开资源目录 `public/diy`，并确认构建后进入 `dist/client/diy`。
- 设置页新增 DIY 主题配置，可分别选择导航栏背景和右侧整体背景；选择后即时预览，点击“保存主题”后写入浏览器本机 `localStorage`。
- 右侧整体背景增加淡化遮罩，默认淡化强度为 86%，可在 68% 到 96% 之间调整，避免遮挡页面文字。
- 应用外壳启动时会读取本机 DIY 主题并应用到 CSS 变量；“恢复默认”会清空本机主题并回到默认背景。
- 使用文档补充 DIY 主题入口、预置图片、淡化规则和本机保存边界。

### Testing

- 定向前端回归：`npx vitest run tests/frontend/app-shell.test.tsx tests/frontend/app.test.tsx` 通过，两个测试文件共十九项全部通过。
- `npm run typecheck`：通过，前端与服务端 TypeScript 配置均无类型错误。
- `npm test`：通过，十八个测试文件共二百六十八项全部通过。
- `npm run build`：通过，前端和服务端构建成功；Vite 仍提示既有前端单块超过 500 KB，未阻塞构建。
- `git diff --check`：通过，仅输出 Windows 工作区既有 LF/CRLF 转换提示。
- 静态资源检查：`public/diy` 与 `dist/client/diy` 均包含人民英雄、国徽和开国大典三张图片。

### Notes

- `public/diy/人民英雄.jpg`：新增 DIY 主题预置图片。
- `public/diy/国徽.jpg`：新增 DIY 主题预置图片。
- `public/diy/开国大典.jpg`：新增 DIY 主题预置图片。
- `src/theme/diyTheme.ts`：新增 DIY 主题配置、读取、保存、重置和 CSS 变量应用逻辑。
- `src/components/AppShell.tsx`：应用启动时读取并应用本机 DIY 主题。
- `src/pages/SettingsPage.tsx`：将空设置页改为 DIY 主题设置页，支持导航栏背景、右侧整体背景和淡化强度。
- `src/styles/global.css`：为导航栏背景、右侧淡化背景、主题图片选择器和设置页操作区补充样式。
- `tests/frontend/app-shell.test.tsx`：补充 DIY 主题恢复、选择、保存和恢复默认的回归测试。
- `docs/本地运行与数据管理.md`：同步 DIY 主题入口、资源目录、淡化范围和本机保存说明。
- `progress.md`：仅在文件末尾追加本轮实现、验证证据、改动文件清单和回滚方式。
- 回滚方式：提交前可执行 `git restore -- src/components/AppShell.tsx src/pages/SettingsPage.tsx src/styles/global.css tests/frontend/app-shell.test.tsx docs/本地运行与数据管理.md progress.md` 并删除 `src/theme/diyTheme.ts` 与 `public/diy`；提交后在本轮提交仍为当前 `HEAD` 时执行 `git revert --no-edit HEAD`。

## 2026-07-18 - Task: 丰富前端轻动效

### What was done

- 为页面进入、导航悬停、当前导航标记、按钮悬停和按压补充轻量动效，让操作反馈不再只停留在加载旋转。
- 为卡片库表格行、操作按钮、批量工具条、归档撤销提示和详情抽屉补充过渡与进入动效，提升浏览和管理卡片时的反馈。
- 为背诵页答案揭晓、解析分块、不会标注次数和完成统计补充轻微动效，避免干扰记忆节奏。
- 为录入页输入聚焦、富文本工具按钮、推荐标签和保存提示补充细微反馈。
- 为 DIY 主题图片选项补充悬停浮起和图片预览缩放，并保留 `prefers-reduced-motion` 降级，减少动效模式下关闭明显位移和持续动画。

### Testing

- 定向前端回归：`npx vitest run tests/frontend/app-shell.test.tsx tests/frontend/cards-page.test.tsx tests/frontend/study-page.test.tsx tests/frontend/entry-page.test.tsx` 通过，四个测试文件共五十一项全部通过。
- `npm run typecheck`：通过，前端与服务端 TypeScript 配置均无类型错误。
- `npm run build`：通过，前端和服务端构建成功；Vite 仍提示既有前端单块超过 500 KB，未阻塞构建。
- `npm test`：通过，十八个测试文件共二百六十八项全部通过。
- `git diff --check`：通过，仅输出 Windows 工作区既有 LF/CRLF 转换提示。

### Notes

- `src/styles/global.css`：新增 motion token、关键帧、页面/按钮/导航/表格/抽屉/背诵/录入/主题选择的轻动效和减少动效兜底。
- `progress.md`：仅在文件末尾追加本轮实现、验证证据、改动文件清单和回滚方式。
- 回滚方式：提交前可执行 `git restore -- src/styles/global.css progress.md`；提交后在本轮提交仍为当前 `HEAD` 时执行 `git revert --no-edit HEAD`。

## 2026-07-18 - Task: 修复卡片库编辑保存反馈

### What was done

- 定位卡片库编辑保存失败的主要体验原因：编辑入口正常，保存链路会在必填分类缺失、编辑态误选图片或后端返回正在整理冲突时被拦截，但原页面提示不够明确。
- 录入页保存前校验失败时在保存按钮附近显示“请先补全必填内容后再保存”，同时保留上一次保存成功提示，避免用户误以为按钮没有反应。
- 编辑已有卡片时直接禁用图片选择入口，并提示已有图片会继续保留，避免选择新图片后再保存失败。
- 编辑保存遇到后端 `processing_conflict` 时显示服务端明确原因“卡片正在整理，请稍后再编辑相关内容”，不再只显示通用失败文案。
- 使用文档同步编辑页图片边界和正在整理卡片的保存限制。

### Testing

- 定向前端回归：`npx vitest run tests/frontend/entry-page.test.tsx tests/frontend/cards-page.test.tsx` 通过，两个测试文件共三十二项全部通过。
- 类型检查：`npm run typecheck` 通过，前端与服务端 TypeScript 配置均无类型错误。
- 全量回归：`npm test` 通过，十八个测试文件共二百六十九项全部通过。
- 构建验证：`npm run build` 通过，前端和服务端构建成功；Vite 仍提示既有前端单块超过 500 KB，未阻塞构建。
- 空白检查：`git diff --check` 通过，仅输出 Windows 工作区既有 LF/CRLF 转换提示。

### Notes

- `src/pages/EntryPage.tsx`：新增保存失败原因映射、必填校验的独立提示通道，并在编辑态禁用新增图片入口。
- `src/styles/global.css`：补充编辑态图片选择禁用样式。
- `tests/frontend/entry-page.test.tsx`：补充必填校验提示、编辑态图片禁用和正在整理冲突提示的回归测试。
- `docs/本地运行与数据管理.md`：同步编辑已有卡片时图片只保留不追加，以及 `processing` 卡片保存限制。
- `progress.md`：追加本轮问题定位、修复、验证证据、改动文件清单和回滚方式。
- 回滚方式：提交前可执行 `git restore -- src/pages/EntryPage.tsx src/styles/global.css tests/frontend/entry-page.test.tsx docs/本地运行与数据管理.md progress.md`；提交后在本轮提交仍为当前 `HEAD` 时执行 `git revert --no-edit HEAD`。

## 2026-07-18 - Task: 修复多问题拆卡在卡片库重复显示

### What was done

- 定位“点击保存一个内容后卡片库重复出现”不是前端重复提交，而是多问题知识点被拆成多张卡片后仍共用同一个卡片库标题，导致看起来像重复保存。
- 新建拆卡时，原卡和额外拆出的卡片都改为使用各自题面作为卡片库标题，且标题不包含答案，避免题目提前泄露答案。
- 新增版本 3 数据库迁移，自动修复历史上已经产生的同标题拆卡数据。
- 已为当前本地数据库创建备份，并修复现有“替代比较”相关重复标题，使卡片库直接显示为各自题面。

### Testing

- 定向服务端回归：`npx vitest run tests/server/database.test.ts tests/server/card-create.test.ts tests/server/cards-query.test.ts` 通过，三个测试文件共六十六项全部通过。
- 类型检查：`npm run typecheck` 通过，前端与服务端 TypeScript 配置均无类型错误。
- 全量回归：`npm test` 通过，十八个测试文件共二百七十项全部通过。
- 构建验证：`npm run build` 通过，前端和服务端构建成功；Vite 仍提示既有前端单块超过 500 KB，未阻塞构建。
- 空白检查：`git diff --check` 通过，仅输出 Windows 工作区既有 LF/CRLF 转换提示。

### Notes

- `server/cards/repository.ts`：调整多问题拆卡入库标题，使用每张卡自己的题面展示，避免同一知识点拆卡后在卡片库显示为重复标题。
- `server/db/migrations.ts`：接入版本 3 数据库迁移。
- `server/db/migrations/003_distinct_split_card_titles.sql`：新增历史拆卡标题修复迁移。
- `tests/server/card-create.test.ts`：补充多问题拆卡后标题各自独立且不含答案的服务端回归测试。
- `tests/server/database.test.ts`：补充从版本 2 升级时修复历史重复拆卡标题的迁移测试。
- `tests/server/backups.test.ts`：同步备份恢复后的迁移版本断言。
- `docs/本地运行与数据管理.md`：同步说明多问题拆卡的卡片库标题规则和版本 3 数据迁移。
- `progress.md`：追加本轮问题定位、修复、验证证据、改动文件清单和回滚方式。
- 数据回滚点：`data/backups/before-split-title-migration-20260718T124901Z.db`；需要回滚当前数据时，先停止服务，再用该备份替换 `data/gongkao.db`。
- 代码回滚方式：提交前可执行 `git restore -- server/cards/repository.ts server/db/migrations.ts tests/server/card-create.test.ts tests/server/database.test.ts tests/server/backups.test.ts docs/本地运行与数据管理.md progress.md`，并删除 `server/db/migrations/003_distinct_split_card_titles.sql`；提交后在本轮提交仍为当前 `HEAD` 时执行 `git revert --no-edit HEAD`。

## 2026-07-18 - Task: 优化背诵页本轮抽取互动

### What was done

- 背诵页新增本轮设置工具条，支持直接调整本轮题面数量、常用数量快捷选择、随机或固定顺序，以及是否到期优先。
- “按设置抽取”会把设置同步到 `/study` 查询参数，并基于现有 `POST /api/study/sessions` 重新创建一轮背诵会话。
- 数量边界沿用后端已有规则，限制为 1 到 100，避免新增协议和额外服务端状态。
- 页面在加载、空状态、错误状态、背诵中和本轮完成后均保留同一套设置入口，用户可以直接调整下一轮。

### Testing

- 定向前端回归：`npx vitest run tests/frontend/study-page.test.tsx` 通过，一个测试文件共三项全部通过。
- 类型检查：`npm run typecheck` 通过，前端与服务端 TypeScript 配置均无类型错误。
- 全量回归：`npm test` 通过，十八个测试文件共二百七十一项全部通过。
- 构建验证：`npm run build` 通过，前端和服务端构建成功；Vite 仍提示既有前端单块超过 500 KB，未阻塞构建。
- 空白检查：`git diff --check` 通过，仅输出 Windows 工作区既有 LF/CRLF 转换提示。

### Notes

- `src/pages/StudyPage.tsx`：新增本轮设置状态、URL 参数同步、数量快捷按钮、顺序切换、到期优先开关和按设置重新抽取逻辑。
- `src/styles/global.css`：新增背诵页设置工具条、数量输入、分段按钮、开关和窄屏换行样式。
- `tests/frontend/study-page.test.tsx`：补充用户调整本轮数量、抽取顺序和到期优先后重新抽取的回归测试。
- `docs/本地运行与数据管理.md`：同步背诵页本轮设置入口和查询参数行为。
- `progress.md`：追加本轮实现、验证证据、改动文件清单和回滚方式。
- 回滚方式：提交前可执行 `git restore -- src/pages/StudyPage.tsx src/styles/global.css tests/frontend/study-page.test.tsx docs/本地运行与数据管理.md progress.md`；提交后在本轮提交仍为当前 `HEAD` 时执行 `git revert --no-edit HEAD`。

## 2026-07-18 - Task: 背诵页电玩城摇杆随机抽取

### What was done

- 将背诵页本轮设置改为白色机台风格：左侧滚轮居中显示本轮题数，右侧红色摇杆负责随机抽取题数。
- 会话响应新增 `totalAvailable`，表示当前筛选条件下可进入背诵的题面总数，前端摇杆随机范围严格限制为 `1-totalAvailable`。
- 手动数量输入和快捷数量按钮同步受可抽题面总数约束，避免设置超过当前可抽范围。
- 摇杆点击后展示滚动动效，最终数字会写入本轮数量、同步 `/study` 查询参数，并创建新一轮随机背诵会话。

### Testing

- 定向回归：`npx vitest run tests/frontend/study-page.test.tsx tests/server/study-session.test.ts` 通过，两个测试文件共十八项全部通过。
- 类型检查：`npm run typecheck` 通过，前端与服务端 TypeScript 配置均无类型错误。
- 全量回归：`npm test` 通过，十八个测试文件共二百七十二项全部通过。
- 构建验证：`npm run build` 通过，前端和服务端构建成功；Vite 仍提示既有前端单块超过 500 KB，未阻塞构建。
- 空白检查：`git diff --check` 通过，仅输出 Windows 工作区既有 LF/CRLF 转换提示。

### Notes

- `shared/contracts.ts`：为背诵会话响应增加 `totalAvailable`。
- `server/study/service.ts`：创建背诵会话时返回当前筛选条件下的可抽题面总数。
- `src/pages/StudyPage.tsx`：新增摇杆随机抽取、滚轮数字展示、数量范围约束和基于最终随机数的新一轮抽取逻辑。
- `src/styles/global.css`：新增白色机台、红色滚轮数字、右侧摇杆和滚动动效样式。
- `tests/frontend/study-page.test.tsx`：补充摇杆随机生成题数、同步输入框、更新查询参数并触发新一轮请求的回归测试。
- `tests/server/study-session.test.ts`：补充会话接口返回可抽题面总数的断言。
- `docs/本地运行与数据管理.md`：同步 `totalAvailable`、摇杆随机范围和背诵页抽取入口说明。
- `progress.md`：追加本轮实现、验证证据、改动文件清单和回滚方式。
- 回滚方式：提交前可执行 `git restore -- shared/contracts.ts server/study/service.ts src/pages/StudyPage.tsx src/styles/global.css tests/frontend/study-page.test.tsx tests/server/study-session.test.ts docs/本地运行与数据管理.md progress.md`；提交后在本轮提交仍为当前 `HEAD` 时执行 `git revert --no-edit HEAD`。

## 2026-07-18 - Task: 加强 DeepSeek 精准整理能力

### What was done

- DeepSeek 系统提示词改为精准优先，补充字段来源、复杂输入拆分、选择题边界、表格清单拆题、限定条件保留、超过十二题取舍和输出前自检规则。
- 请求参数增加低温度 `temperature: 0.1`、输出预算 `max_tokens: 8192`，并把单次超时从 20 秒提升到 60 秒，降低复杂输入被截断或超时的概率。
- JSON 解析增加安全兜底，兼容 markdown JSON 代码块和唯一 JSON 对象外的说明文字；多个 JSON 对象或无法唯一确认结构时仍按非法 JSON 处理。
- 结构校验继续只做格式类兜底，不替模型补事实；题面泄露数字、公式或别称答案时会遮空。

### Testing

- 定向 AI 回归：`npx vitest run tests/server/deepseek.test.ts tests/server/ai-schema.test.ts` 通过，两个测试文件共四十九项全部通过。
- 类型检查：`npm run typecheck` 通过，前端与服务端 TypeScript 配置均无类型错误。
- 全量回归：`npm test` 通过，十八个测试文件共二百七十六项全部通过。
- 构建验证：`npm run build` 通过，前端和服务端构建成功；Vite 仍提示既有前端单块超过 500 KB，未阻塞构建。
- 空白检查：`git diff --check` 通过，仅输出 Windows 工作区既有 LF/CRLF 转换提示。

### Notes

- `server/ai/prompt.ts`：增强 DeepSeek 系统提示词，明确复杂输入拆分和事实保护边界。
- `server/ai/deepseek.ts`：新增精准优先请求参数、60 秒超时和 JSON 提取兜底。
- `server/ai/schema.ts`：保持事实字段严格校验，继续遮空题面中的答案泄露。
- `tests/server/deepseek.test.ts`：补充提示词关键词、请求参数、JSON 代码块、外层说明文字和多 JSON 拒绝测试。
- `tests/server/ai-schema.test.ts`：补充公式和别称答案泄露遮空测试。
- `docs/本地运行与数据管理.md`：同步 DeepSeek 请求配置、重试边界和 JSON 解析兜底说明。
- `progress.md`：追加本轮实现、验证证据、改动文件清单和回滚方式。
- 回滚方式：提交前可执行 `git restore -- server/ai/prompt.ts server/ai/deepseek.ts server/ai/schema.ts tests/server/deepseek.test.ts tests/server/ai-schema.test.ts docs/本地运行与数据管理.md progress.md`；提交后在本轮提交仍为当前 `HEAD` 时执行 `git revert --no-edit HEAD`。

## 2026-07-18 - Task: 卡片库增加 AI 修复入口

### What was done

- 卡片库表格操作区新增“AI 修复”按钮，显示在待整理和待完善卡片上。
- 点击“AI 修复”会调用现有 `POST /api/cards/:id/retry-ai` 接口重新整理该卡片，成功后刷新卡片列表。
- 已整理和正在整理中的卡片不显示该按钮，避免对已完成内容或在途任务重复触发 AI。
- 当卡片标题为空时，按钮可访问名称使用“待生成知识点”，不泄露原始输入。

### Testing

- 定向前端回归：`npx vitest run tests/frontend/cards-page.test.tsx` 通过，一个测试文件共十九项全部通过。
- 类型检查：`npm run typecheck` 通过，前端与服务端 TypeScript 配置均无类型错误。
- 全量回归：`npm test` 通过，十八个测试文件共二百七十八项全部通过。
- 构建验证：`npm run build` 通过，前端和服务端构建成功；Vite 仍提示既有前端单块超过 500 KB，未阻塞构建。
- 空白检查：`git diff --check` 通过，仅输出 Windows 工作区既有 LF/CRLF 转换提示。

### Notes

- `src/pages/CardsPage.tsx`：在卡片行操作区增加 AI 修复按钮和重试调用逻辑。
- `tests/frontend/cards-page.test.tsx`：补充 AI 修复按钮点击刷新、请求体、状态可见性和空标题占位测试。
- `docs/本地运行与数据管理.md`：同步卡片库 AI 修复入口和状态边界说明。
- `progress.md`：追加本轮实现、验证证据、改动文件清单和回滚方式。
- 回滚方式：提交前可执行 `git restore -- src/pages/CardsPage.tsx tests/frontend/cards-page.test.tsx docs/本地运行与数据管理.md progress.md`；提交后在本轮提交仍为当前 `HEAD` 时执行 `git revert --no-edit HEAD`。

## 2026-07-18 - Task: 支持手动修正已整理背诵卡片

### What was done

- 编辑页在已有卡片且存在背诵题面时显示“背诵题面”编辑区，可逐题修改题目和答案。
- 编辑保存按钮区分为“保存修改”，题面修正只保存人工内容，不因改题面重新调用 DeepSeek。
- `PATCH /api/cards/:id` 支持 `quizItems` 更新已有题面文本，校验题面编号属于当前卡片，拒绝空题目、空答案、重复编号和额外字段。
- 数据库只更新 `quiz_items.question` 与 `quiz_items.answer`，保留到期时间、复习次数、不会标注次数和 FSRS 调度字段；`processing` 卡片仍拒绝题面修正，避免在途 AI 覆盖人工内容。

### Testing

- 定向服务端回归：`npx vitest run tests/server/card-create.test.ts` 通过，一个测试文件共三十四项全部通过。
- 定向前端回归：`npx vitest run tests/frontend/entry-page.test.tsx` 通过，一个测试文件共十七项全部通过。
- 联合定向回归：`npx vitest run tests/frontend/entry-page.test.tsx tests/server/card-create.test.ts` 通过，两个测试文件共五十一项全部通过。
- 卡片库回归：`npx vitest run tests/frontend/cards-page.test.tsx` 通过，一个测试文件共十九项全部通过。
- 类型检查：`npm run typecheck` 通过，前端与服务端 TypeScript 配置均无类型错误。
- 全量回归：首次 `npm test` 因卡片库旧测试仍断言“保存并自动整理”失败；修正测试文案后重跑 `npm test` 通过，十八个测试文件共二百八十七项全部通过。
- 构建验证：`npm run build` 通过，前端和服务端构建成功；Vite 仍提示既有前端单块超过 500 KB，未阻塞构建。
- 空白检查：`git diff --check` 通过，仅输出 Windows 工作区既有 LF/CRLF 转换提示。

### Notes

- `shared/contracts.ts`：为卡片更新输入增加已有题面的 `quizItems` 修正字段。
- `server/cards/routes.ts`：为题面修正请求增加严格结构校验和重复编号拒绝。
- `server/cards/service.ts`：统一清洗题面修正输入的首尾空白。
- `server/cards/repository.ts`：在同一更新事务内写入题目和答案，并将题面修正纳入 `processing` 冲突保护。
- `src/pages/EntryPage.tsx`：新增编辑态背诵题面编辑区、空值拦截和“保存修改”文案。
- `src/styles/global.css`：新增背诵题面编辑区布局样式。
- `tests/server/card-create.test.ts`：补充题面修正成功、调度字段保留、非法请求和 `processing` 冲突测试。
- `tests/frontend/entry-page.test.tsx`：补充编辑页手动修正题面和空题面拦截测试。
- `tests/frontend/cards-page.test.tsx`：同步编辑页保存按钮的新文案断言。
- `docs/本地运行与数据管理.md`：同步编辑页题面修正能力、接口字段和 DeepSeek 调用边界。
- `progress.md`：追加本轮实现、验证证据、改动文件清单和回滚方式。
- 回滚方式：提交前可执行 `git restore -- shared/contracts.ts server/cards/routes.ts server/cards/service.ts server/cards/repository.ts src/pages/EntryPage.tsx src/styles/global.css tests/server/card-create.test.ts tests/frontend/entry-page.test.tsx tests/frontend/cards-page.test.tsx docs/本地运行与数据管理.md progress.md`；提交后在本轮提交仍为当前 `HEAD` 时执行 `git revert --no-edit HEAD`。

## 2026-07-19 - Task: 升级总览学习驾驶舱并增加轻量备忘

### What was done

- 总览页接入现有今日统计和非敏感设置，增加 5、15、25、45 分钟专注倒计时，支持开始、暂停、继续、重置和完成反馈。
- 总览页按当前默认背诵数量、顺序和到期优先设置生成快速背诵入口，并用轻量状态条展示今日待复习、已新增和待攻克情况。
- 设置页增加默认专注时长入口，沿用现有 `app_settings` 键值表持久化，不增加数据库表或迁移。
- 总览页增加本机轻量备忘，支持新增、完成和删除；备忘只保存在浏览器 `localStorage`，不进入服务端、导出或备份。

### Testing

- TDD 失败验证：新增测试首次运行时，总览组件仍为占位、设置接口拒绝 `defaultFocusMinutes`、设置页没有体验区域、总览没有备忘输入，均因目标功能缺失按预期失败。
- 定向回归：`npx vitest run tests/frontend/dashboard-page.test.tsx tests/frontend/settings-page.test.tsx tests/frontend/app-shell.test.tsx tests/server/settings.test.ts` 通过，四个测试文件共二十九项全部通过。
- 本阶段尚未单独运行类型检查、全量测试和构建；这些验证将在全部阶段整合完成后统一执行并追加最终记录。

### Notes

- `shared/contracts.ts`：增加总览、非敏感设置和专注时长契约。
- `server/settings/routes.ts`：增加默认专注时长的默认值、严格校验、读取和持久化。
- `src/pages/DashboardPage.tsx`：实现学习驾驶舱、专注计时、今日状态、快速背诵和本机备忘。
- `src/pages/SettingsPage.tsx`：在现有 DIY 主题基础上增加体验设置和默认专注时长保存。
- `src/styles/global.css`：增加驾驶舱、专注计时、状态、备忘和体验设置样式。
- `tests/frontend/dashboard-page.test.tsx`：新增驾驶舱、计时、快速背诵和备忘回归测试。
- `tests/frontend/settings-page.test.tsx`：新增默认专注时长读取与保存测试。
- `tests/server/settings.test.ts`：补充默认专注时长默认值、持久化和非法值测试。
- `docs/本地运行与数据管理.md`：同步驾驶舱、专注时长、备忘存储边界和设置接口。
- `progress.md`：仅在末尾追加本阶段实现、验证证据、改动文件和回滚说明。
- 回滚点：本阶段开始前的未提交工作树状态。`DashboardPage.tsx`、`server/settings/routes.ts` 和 `tests/server/settings.test.ts` 在本阶段开始前无差异，可用 `git restore -- src/pages/DashboardPage.tsx server/settings/routes.ts tests/server/settings.test.ts` 回滚；新增测试可用 `Remove-Item -LiteralPath 'tests/frontend/dashboard-page.test.tsx','tests/frontend/settings-page.test.tsx'` 删除。`shared/contracts.ts`、`SettingsPage.tsx`、`global.css`、文档和进度日志在本阶段前已有用户改动，禁止直接执行 `git restore`，应按本条列出的新增契约、组件和样式标识做反向补丁，避免覆盖既有成果。

## 2026-07-19 - Task: 升级背诵机台并支持减弱动效

### What was done

- 修正候选题面超过一百时摇杆可能生成无效题数的问题，将单轮随机范围统一限制为 `1-min(totalAvailable, 100)`，并明确显示总题面数和单轮上限。
- 增加标准与减弱两档全站动效偏好，保存在本机浏览器；减弱模式同时压缩 CSS 动画并跳过背诵滚轮的 JavaScript 快速变数。
- 背诵滚轮只在最终结果时进行一次无障碍播报，避免逐次播报中间数字。
- 强化摇杆球高光、金属杆、分层底座、落定反馈，以及抽取、查看答案、不会标注、记住和导航按钮的按压反馈；所有效果保持在正常文档流内。

### Testing

- TDD 失败验证：新增测试首次运行时，设置页没有动效选项、应用入口不会恢复偏好、减弱模式仍等待滚轮定时器，且一百五十个候选时无法发出合法的第二次请求，均按预期失败。
- 定向回归：`npx vitest run tests/frontend/settings-page.test.tsx tests/frontend/app-shell.test.tsx tests/frontend/study-page.test.tsx` 通过，三个测试文件共二十五项全部通过。
- 本阶段尚未单独运行浏览器尺寸检查；1024 像素与宽屏视觉边界将在最终浏览器验收中统一检查。

### Notes

- `src/theme/experienceSettings.ts`：新增版本化的本机动效偏好读取、保存、应用和系统偏好判断。
- `src/components/AppShell.tsx`：应用启动时同步恢复全站动效强度。
- `src/pages/SettingsPage.tsx`：在体验设置中增加标准与减弱动效选项。
- `src/pages/StudyPage.tsx`：修正随机上限、减少中间播报并为减弱模式提供无快速滚动路径。
- `src/styles/global.css`：强化摇杆、滚轮和学习按钮反馈，并增加用户主动减弱动效的全站 CSS 降级。
- `tests/frontend/app-shell.test.tsx`：补充应用启动恢复动效偏好的测试。
- `tests/frontend/settings-page.test.tsx`：补充动效选择、保存和根元素应用测试。
- `tests/frontend/study-page.test.tsx`：补充超过一百候选、单轮上限、减弱滚动和最终播报测试。
- `docs/本地运行与数据管理.md`：同步动效存储位置、降级范围和摇杆随机上限。
- `progress.md`：仅在末尾追加本阶段实现、验证证据、改动文件和回滚说明。
- 回滚点：本阶段开始前的未提交工作树状态。新增文件可用 `Remove-Item -LiteralPath 'src/theme/experienceSettings.ts'` 删除；其余文件在本阶段前已有用户或前序阶段改动，禁止直接 `git restore`，应按 `experience-settings__motion`、`study-controls__result`、`data-motion`、`RollState` 和本条测试名称定位并执行反向补丁。

## 2026-07-19 - Task: 增强录入与编辑快捷操作

### What was done

- 为原始内容富文本编辑器和全部普通文本域增加统一快捷工具栏，可对最近获得焦点的编辑区执行复制、粘贴、全选、撤销和清空。
- 剪贴板权限失败时保留原内容并显示稳定提示，不暴露浏览器原始异常；键盘复制、粘贴、全选和撤销仍使用当前编辑区的原生行为。
- `Ctrl/Cmd+S` 与 `Ctrl/Cmd+Enter` 复用现有表单保存入口，继续沿用必填校验、单请求锁以及新建或编辑分支。
- 启用富文本编辑器的当前内容撤销，并在保存、取消和切换卡片时重建编辑器，隔离不同卡片的撤销历史。

### Testing

- TDD 失败验证：快捷操作测试首次运行时，富文本撤销仍被禁用、页面没有快捷工具栏、剪贴板拒权没有稳定反馈且保存快捷键不会提交，均因目标功能缺失按预期失败。
- 录入页定向回归：`npx vitest run tests/frontend/entry-page.test.tsx` 通过，一个测试文件共二十项全部通过。
- 录入与卡片库联合回归：`npx vitest run tests/frontend/entry-page.test.tsx tests/frontend/cards-page.test.tsx` 通过，两个测试文件共三十九项全部通过。
- 本阶段尚未单独运行类型检查和全量构建；将在全部阶段整合完成后统一执行并追加最终记录。

### Notes

- `src/components/editingTarget.ts`：定义富文本与普通文本域共用的局部编辑操作契约。
- `src/components/RichTextEditor.tsx`：启用撤销历史并暴露受控复制、粘贴、全选、撤销和清空操作。
- `src/pages/EntryPage.tsx`：增加当前编辑区工具栏、普通文本域操作和表单保存快捷键，并隔离跨卡片撤销历史。
- `src/styles/global.css`：增加紧凑、正常文档流内的快捷工具栏及反馈样式。
- `tests/frontend/entry-page.test.tsx`：补充富文本撤销、普通文本域工具栏、拒权提示、保存快捷键、原生快捷键和保存后历史隔离测试。
- `docs/本地运行与数据管理.md`：同步快捷工具栏、键盘组合键、权限降级和撤销历史边界。
- `progress.md`：仅在末尾追加本阶段实现、验证证据、改动文件和回滚说明。
- 回滚点：本阶段开始前的未提交工作树状态。新增文件可用 `Remove-Item -LiteralPath 'src/components/editingTarget.ts'` 删除；`RichTextEditor.tsx` 在本阶段前无差异，可用 `git restore -- src/components/RichTextEditor.tsx` 回滚。`EntryPage.tsx`、`global.css`、测试、文档和进度日志在本阶段前已有用户或前序阶段改动，禁止直接 `git restore`，应按 `entry-edit-toolbar`、`handleFormKeyDown`、`EditingTarget` 和本条测试名称定位并执行反向补丁。

## 2026-07-19 - Task: 增加受控 QQ 音乐入口

### What was done

- 设置页增加 QQ 音乐路径、检测状态和“打开音乐”按钮，未安装或路径不可用时显示稳定提示。
- QQ 音乐路径保存到现有本机 `app_settings` 键值表，无需数据库迁移；设置响应只返回用户配置路径和是否可用，不暴露自动检测到的实际路径。
- 新增 QQ 音乐专用服务，仅接受盘符绝对路径且文件名必须为 `QQMusic.exe`，启动前确认是普通文件并拒绝目录、符号链接、UNC、设备路径和其他程序。
- 新增固定 POST 启动端点，只读取服务端设置，不接受路径、命令、参数或查询字符串；进程启动固定为零参数、`shell: false`、隐藏窗口和脱离服务。
- 启动端点拒绝非 JSON、跨站来源和外部 Origin，失败响应不包含本机路径、系统异常或命令信息。

### Testing

- TDD 失败验证：新增测试首次运行时，QQ 音乐模块不存在、设置接口缺少路径和检测字段、设置页没有音乐控件，均因目标功能缺失按预期失败。
- 定向联合回归：`npx vitest run tests/server/local-apps.test.ts tests/server/settings.test.ts tests/frontend/settings-page.test.tsx tests/frontend/dashboard-page.test.tsx` 通过，四个测试文件共十八项全部通过。
- 补充安全回归：`npx vitest run tests/server/local-apps.test.ts` 通过，一个测试文件共八项全部通过，覆盖目录拒绝、同源允许和未装配端点保持不存在。
- 阶段类型检查：`npm run typecheck` 通过，前端与服务端 TypeScript 配置均无类型错误。
- 所有进程测试均使用假启动器，未启动本机真实 QQ 音乐；真实窗口拉起保留为最终本机人工验收项。

### Notes

- `server/localApps/qqMusic.ts`：新增 QQ 音乐专用路径策略、固定常见位置检测和零参数进程启动器。
- `server/localApps/routes.ts`：新增固定启动路由、请求来源限制和稳定错误映射。
- `server/settings/routes.ts`：增加 QQ 音乐路径的严格校验、持久化和可用状态读取。
- `server/app.ts`：仅在注入本机应用依赖时装配固定启动路由。
- `server/index.ts`：生产启动时创建 QQ 音乐专用服务并注入设置和本机应用路由。
- `shared/contracts.ts`：增加 QQ 音乐用户配置路径与可用状态契约。
- `src/pages/SettingsPage.tsx`：增加路径配置、检测反馈和打开音乐操作。
- `src/styles/global.css`：增加体验设置内音乐入口的紧凑布局和状态样式。
- `tests/server/local-apps.test.ts`：覆盖路径白名单、普通文件、固定候选、启动参数、请求边界和错误脱敏。
- `tests/server/settings.test.ts`：补充路径默认值、持久化、可用状态和非法路径测试。
- `tests/frontend/settings-page.test.tsx`：补充路径保存、固定启动入口和失败提示测试。
- `tests/frontend/dashboard-page.test.tsx`：同步设置响应契约。
- `docs/本地运行与数据管理.md`：同步路径存储、常见位置、启动安全边界、接口和人工验收限制。
- `progress.md`：仅在末尾追加本阶段实现、验证证据、改动文件和回滚说明。
- 回滚点：本阶段开始前的未提交工作树状态。新增模块和测试可用 `Remove-Item -Recurse -LiteralPath 'server/localApps'; Remove-Item -LiteralPath 'tests/server/local-apps.test.ts'` 删除；其余文件在本阶段前已有用户或前序阶段改动，禁止直接 `git restore`，应按 `qqMusicPath`、`qqMusicAvailable`、`experience-settings__music` 和本条测试名称定位并执行反向补丁。

## 2026-07-19 - Task: 增加背诵连续反馈与轮次结算

### What was done

- 背诵会话内连续两次“记住了”后显示轻量连续反馈，“不会 +1”会中断当前连续次数。
- 本轮保留最佳连续记住次数，结束本轮后与已记录、不会和记住数量一起结算。
- 结算面板根据本轮作答情况显示简短结果反馈，不增加账号、积分、排行榜或数据库统计。
- 连续次数在重新抽取、再来一轮或刷新时清零，不影响现有复习请求、FSRS 调度和不会标注次数。

### Testing

- TDD 失败验证：连续反馈测试首次运行时页面没有连续记住提示、最佳连续记录和结果反馈，因目标功能缺失按预期失败。
- 定向回归：`npx vitest run tests/frontend/study-page.test.tsx` 通过，一个测试文件共七项全部通过，覆盖连续记住、不会中断、最佳记录和原有复习请求边界。
- 一次与类型检查并行运行时，旧摇杆测试的约一秒定时器超过 Vitest 默认等待窗口；单独重跑相同命令稳定通过，新增两条连续反馈测试在两次运行中均通过。
- 阶段类型检查：`npm run typecheck` 通过，前端与服务端 TypeScript 配置均无类型错误。

### Notes

- `src/pages/StudyPage.tsx`：增加当前连续、最佳连续、结果反馈和轮次重置逻辑。
- `src/styles/global.css`：增加连续反馈与结算提示样式，并纳入减弱动效覆盖。
- `tests/frontend/study-page.test.tsx`：补充连续记住、不会中断和轮次结算回归测试。
- `docs/本地运行与数据管理.md`：同步连续反馈的会话边界及其不写数据库、不影响调度的限制。
- `progress.md`：仅在末尾追加本阶段实现、验证证据、改动文件和回滚说明。
- 回滚点：本阶段开始前的未提交工作树状态。相关文件在本阶段前均已有用户或前序阶段改动，禁止直接 `git restore`；应按 `knownStreak`、`bestKnownStreak`、`roundFeedback`、`study-card__streak`、`study-summary__result` 和本条测试名称定位并执行反向补丁。

## 2026-07-19 - Task: 完成学习驾驶舱体验升级集成验收

### What was done

- 完成总览学习驾驶舱、专注倒计时、快速背诵、本机轻量备忘、体验设置、背诵机台动效、编辑快捷操作、受控 QQ 音乐入口和背诵轮次反馈的整体验收，现有录入、卡片库、背诵、导出、DeepSeek 整理和备份恢复的数据边界保持不变。
- 修正 1024 像素桌面视口下应用根节点固定最小宽度造成的横向滚动，背诵控制区在窄桌面下按既有断点纵向排列，题目、答案和操作区保持正常文档流且互不遮挡。
- 修正设置页 QQ 音乐路径示例的可见反斜杠，并稳定两项既有测试：为真实摇杆动画预留明确等待时间，在卡片库分页测试中等待第一页请求建立后再返回数据，避免并行回归中的时序竞争。
- 使用本地浏览器分别检查总览、设置、录入和背诵页面；验证标准与减弱动效可切换、1024 与 1440 像素视口无横向溢出，并保留验收截图供复核。

### Testing

- 联合定向回归：`npx vitest run tests/frontend/dashboard-page.test.tsx tests/frontend/settings-page.test.tsx tests/frontend/app-shell.test.tsx tests/frontend/study-page.test.tsx tests/frontend/entry-page.test.tsx tests/frontend/cards-page.test.tsx tests/server/settings.test.ts tests/server/local-apps.test.ts` 通过，八个测试文件共八十五项全部通过。
- 最终定向回归：`npx vitest run tests/frontend/settings-page.test.tsx tests/frontend/study-page.test.tsx tests/frontend/cards-page.test.tsx` 通过，三个测试文件共二十八项全部通过。
- 类型检查：`npm run typecheck` 通过，前端与服务端 TypeScript 配置均无类型错误。
- 全量回归：`npm test` 通过，二十一个测试文件共三百零八项全部通过；此前首次全量回归暴露的卡片库测试请求时序竞争已修正并通过单文件及全量重跑。
- 生产构建：`npm run build` 通过，前端与服务端产物均成功生成；Vite 仍提示现有前端单块超过 500 KB，此提示不阻塞构建且本轮未扩大范围处理分包。
- 浏览器验收：在 `http://127.0.0.1:5173` 检查 1024 像素总览、设置、录入、背诵页和 1440 像素背诵页；页面无横向溢出、控件无重叠，减弱动效模式的动画时长已降级为近零。为避免实际拉起用户程序，QQ 音乐仅通过假启动器完成自动化安全验证，真实窗口启动未执行。
- 空白检查：`git diff --check` 通过，仅输出 Windows 工作区既有 LF/CRLF 转换提示。

### Notes

- `src/styles/global.css`：取消应用根节点的 1024 像素固定最小宽度，保留现有桌面断点并消除窄桌面横向滚动。
- `src/pages/SettingsPage.tsx`：修正 QQ 音乐可执行文件路径示例的显示文本。
- `tests/frontend/study-page.test.tsx`：为真实摇杆动画测试设置与业务时长匹配的等待窗口。
- `tests/frontend/cards-page.test.tsx`：等待分页请求处理器建立后再解析第一页数据，消除并行测试时序竞争。
- `output/playwright/*.png`：保存总览、设置、录入和背诵页面的 1024/1440 像素浏览器验收截图，其中 `study-1024.png` 为溢出修正前对照图，`study-1024-fixed.png` 为修正后结果。
- `progress.md`：仅在末尾追加最终集成验收、验证证据、改动文件和回滚说明。
- 回滚点：本轮全部阶段开始前的未提交工作树状态。由于目标文件在施工前已包含用户改动，禁止对共享文件直接执行 `git restore`；应按 `gongkao-dashboard-memos-v1`、`gongkao-experience-v1`、`defaultFocusMinutes`、`qqMusicPath`、`EditingTarget`、`knownStreak` 及本轮新增测试名称定位并执行反向补丁。仅回滚最终稳定性修正时，可反向恢复本条所列四个源码或测试改动；验收截图可单独移除，不影响产品行为。

## 2026-07-19 - Task: 优化卡片库、总览与背诵工作台

### What was done

- 卡片库改为响应式小卡网格，并可在 AI 优化稿和用户初始稿之间切换；原有筛选、详情、编辑、AI 修复、批量选择、归档和删除保持可用。
- 总览增加按周一开头的当月六周日历，并将专注计时明确为学习倒计时；本机 QQ 音乐路径已写入现有设置，未启动真实程序。
- 背诵题目字号提高，抽题摇杆改为纵向下拉与回弹；空格查看答案，左右方向键切题，“记住了”成功后自动下一题，末题直接结算。
- 学习会话在答案展开后完整返回并展示用户原始输入；提交期间锁定切题和重新抽取，失败与“不会 +1”仍停留当前题。
- 700 像素以下使用图标侧栏和单列内容布局，桌面布局不变。

### Testing

- 背诵定向回归通过：study-page、study-known-flow、study-shortcuts、study-joystick 四个测试文件共十三项。
- 卡片库定向回归通过：cards-page 一个测试文件共二十二项。
- 总览与 QQ 音乐相关测试已纳入全量回归，dashboard-page 五项、local-apps 八项均通过。
- 全量回归 npm test 通过，二十六个测试文件共三百二十三项全部通过。
- 类型检查 npm run typecheck 通过；生产构建 npm run build 通过。
- 浏览器验收覆盖 1440 像素桌面与 390 像素移动视口；总览、卡片库、录入和背诵均无横向溢出，移动端无按钮跑出屏幕。卡片库桌面为四列，移动端为一列。
- git diff --check 通过，仅保留 Windows 工作区既有行尾转换提示。

### Notes

- src/pages/CardsPage.tsx：增加稿件切换并把列表改为小卡网格。
- src/pages/DashboardPage.tsx：增加当月日历并调整学习倒计时呈现。
- src/pages/StudyPage.tsx：增加纵向摇杆、快捷键、完整原文、提交锁定和自动跳题。
- server/study/service.ts：在学习会话查询和映射中返回 cards.raw_input。
- shared/contracts.ts：为 StudyItem 增加必需的 rawInput。
- src/styles/global.css：增加卡片网格、日历、纵向摇杆、题目字号和桌面、移动响应式样式。
- tests/frontend/cards-page.test.tsx：覆盖稿件切换、网格和既有管理操作。
- tests/frontend/dashboard-page.test.tsx：覆盖当月日历与倒计时。
- tests/frontend/study-page.test.tsx：同步自动跳题后的背诵主流程。
- tests/frontend/study-shortcuts.test.tsx：覆盖空格和左右方向键边界。
- tests/frontend/study-joystick.test.tsx：覆盖纵向拖动、限位、回弹和触发。
- tests/frontend/study-known-flow.test.tsx：覆盖完整原文、自动下一题和末题结算。
- tests/server/study-session.test.ts：覆盖多行原始输入完整返回。
- tests/server/local-apps.test.ts：覆盖用户提供的 QQ 音乐绝对路径。
- data/gongkao.db：把 app_settings.qqMusicPath 更新为 D:/QQ音乐/QQMusic/QQMusic.exe。
- output/playwright/final-*.png：保存桌面和移动视口验收截图。
- 回滚点：本任务开始前的未提交工作树状态。新增四个背诵测试文件可逐个执行 Remove-Item -LiteralPath 删除；共享源码在任务前已有改动，禁止直接 git restore，应按 CardContentVersion、CalendarDays、JOYSTICK_MAX_PULL、isKeyboardShortcutTarget、rawInput 和本条测试名称定位并应用反向补丁。QQ 音乐路径可在设置页清空。

## 2026-07-19 - Task: 增加资料分析公式排版与用户原稿样式预览

### What was done

- DeepSeek 在资料分析模板或分类中把分数、根式、上下标和连续运算整理为受限数学标记，只改变显示形式，不改变数字、分子分母、单位或结论。
- 新增零依赖公式文本组件，用 React 节点显示分数、运算符、根式和上下标；不支持的命令完整回退原字符串，不执行 HTML。
- 卡片库 AI 稿、详情和背诵结构化字段启用公式排版，用户原始输入保持原文。
- 卡片库用户初始稿读取受控 rawContentJson，还原加粗和三种白名单文字颜色；富文本与纯文本不一致时回退纯文本。

### Testing

- DeepSeek 提示词测试通过，一个测试文件共二十五项。
- 公式组件测试通过，一个测试文件共两项，覆盖分数、运算符、普通文本和非法命令回退。
- 卡片库测试共二十二项通过，其中新增用例验证红色与加粗同时保留。
- 全量回归、类型检查、生产构建和浏览器验收结果与上一轮记录一致。

### Notes

- server/ai/prompt.ts：增加资料分析专用公式排版规则和固定样例。
- src/components/MathText.tsx：新增受限公式解析、无 HTML 渲染和失败回退。
- src/components/RichTextPreview.tsx：新增受控原稿段落、加粗和白名单颜色预览。
- src/pages/CardsPage.tsx：AI 稿使用公式组件，用户稿使用富文本预览。
- src/pages/StudyPage.tsx：题目、答案、知识点和解析使用公式组件，原始输入保持纯文本。
- src/styles/global.css：增加分数、根式、上下标和公式行内、独立布局样式。
- tests/server/deepseek.test.ts：校验资料分析公式边界和 JSON 反斜杠规则。
- tests/frontend/math-text.test.tsx：覆盖公式结构与不支持命令回退。
- tests/frontend/cards-page.test.tsx：覆盖用户原稿红色与加粗预览。
- 回滚点：本任务开始前的未提交工作树状态。新增组件和公式测试可执行 Remove-Item -LiteralPath 'src/components/MathText.tsx','src/components/RichTextPreview.tsx','tests/frontend/math-text.test.tsx' 删除；现有文件应按“资料分析公式排版规则”、MathText、RichTextPreview、math-expression 和对应测试名称定位并应用反向补丁。

## 2026-07-19 - Task: 支持录入图片拖放与剪贴板粘贴

### What was done

- 保留本地文件选择，并支持从微信、QQ 等外部程序拖入图片以及在录入表单任意位置直接粘贴剪贴板图片。
- 三种入口统一复用现有 stagedFiles 和 multipart/form-data 创建链路，只接收 PNG、JPEG 和 WebP。
- 普通文字粘贴和不支持的文件不被拦截；缺少 files 或 items 的剪贴板事件安全返回，不影响富文本粘贴。
- 拖放区域支持键盘焦点、拖入高亮和编辑模式禁用；已有卡片继续不追加图片。

### Testing

- TDD 失败阶段新增用例三项均因拖放区域不存在而失败。
- 录入图片与录入页联合回归通过，两个测试文件共二十三项。
- 全量回归 npm test 通过，二十六个测试文件共三百二十三项；没有未处理的粘贴异常。
- npm run typecheck、npm run build 和 git diff --check 通过。
- 浏览器验收确认桌面和 390 像素移动视口的拖放区域可见、文件输入保持隐藏，移动端无横向溢出。

### Notes

- src/pages/EntryPage.tsx：统一文件选择、拖放和粘贴的图片暂存，并兼容普通剪贴板事件。
- src/styles/global.css：增加拖放区域、焦点、拖入高亮、禁用和移动端重排样式。
- tests/frontend/entry-image-drop-paste.test.tsx：覆盖拖入图片、粘贴图片和普通文字粘贴不拦截。
- docs/本地运行与数据管理.md：同步图片入口、公式、卡片网格、日历和背诵快捷操作。
- docs/superpowers/specs/2026-07-19-study-workbench-design.md：记录本轮设计、边界和验证范围。
- docs/superpowers/plans/2026-07-19-study-workbench-plan.md：记录全部实施任务和完成状态。
- progress.md：仅在末尾追加本轮三项任务记录。
- 回滚点：本任务开始前的未提交工作树状态。新增测试可执行 Remove-Item -LiteralPath 'tests/frontend/entry-image-drop-paste.test.tsx' 删除；现有文件应按 acceptedImageTypes、stageImageFiles、handleImagePaste、entry-images__dropzone 和本条测试名称定位并应用反向补丁。

## 2026-07-20 - Task: 合并卡片库用户初始稿重复内容

### What was done

- 用户初始稿视图按当前分页内相同的原始富文本或原始纯文本分组，同一份初始稿只渲染一张小卡。
- 分组卡显示衍生问题数量；详情抽屉列出该初始稿对应的全部规范问题摘要。
- 分组勾选会一次选择全部成员，批量标签和归档恢复覆盖整组；单成员卡片继续保留原有删除、编辑和 AI 修复。
- 多成员组隐藏删除、编辑和 AI 修复，避免前端逐个请求造成半组删除或重复 AI 整理。
- 保留 AI 优化稿逐题展示，确保每个衍生问题仍可单独编辑和处理。

### Testing

- 卡片库回归通过，单文件二十三项全部通过，新增用例确认同一原始稿只显示一张卡、显示衍生数量、详情包含全部问题摘要。
- 前端和服务端类型检查通过。
- 之前的全量回归仍为二十六个测试文件、三百二十三项通过；本轮仅修改卡片库展示层和样式，未改服务端协议。
- git diff --check 通过。

### Notes

- src/pages/CardsPage.tsx：增加当前页原始内容分组、整组选择和归档、衍生问题详情摘要及多成员危险操作边界。
- src/styles/global.css：增加衍生问题数量标记和详情分组样式。
- tests/frontend/cards-page.test.tsx：新增重复初始稿合并回归。
- docs/本地运行与数据管理.md：记录初始稿分组语义和跨分页边界。
- docs/superpowers/specs/2026-07-19-study-workbench-design.md：补充分组展示与操作决策。
- docs/superpowers/plans/2026-07-19-study-workbench-plan.md：追加并勾选重复内容修复任务。
- progress.md：仅在末尾追加本轮修复记录。
- 回滚点：本任务开始前的未提交工作树状态。新增逻辑可按 groupCards、sourceGroupKey、cards-card__group-count 和本条测试名称应用反向补丁；共享文件在此前已有用户改动，禁止直接 git restore。当前实现按接口返回的单页去重，同一原稿跨页仍需后端组分页或稳定来源组契约才能全库合并。

## 2026-07-20 - Task: 校正初始稿分组汇总次数

### What was done

- 分组卡片的“不会标注次数”改为取组内最大值，避免代表卡数据偏小导致汇总误导。

### Testing

- 卡片库回归二十三项通过。
- 前端和服务端类型检查通过。
- 生产构建通过；仅保留既有的前端包体积提示。
- git diff --check 通过。

### Notes

- src/pages/CardsPage.tsx：按分组成员计算最高不会标注次数。
- progress.md：仅在末尾追加本轮校正记录。
- 回滚点：删除本节并移除 CardGrid 中 groupWrongCount 的计算与引用即可回退本轮改动；此前分组修复仍按上一节记录保留。

## 2026-07-20 - Task: 验收卡片库初始稿分组渲染

### What was done

- 使用真实本地数据完成卡片库桌面端和移动端验收，确认切换到用户初始稿后按分组呈现，且页面保持可操作。

### Testing

- Playwright 桌面视口：AI 视图二十张卡片，用户初始稿视图七张卡片，其中五个分组显示衍生问题标记；切换按钮状态正确。
- Playwright 移动视口（390×844）：页面无横向溢出；浏览器控制台无错误。
- 截图证据：`C:/Users/ROG/.codex/visualizations/2026/07/19/019f77c3-7ead-7be3-818c-76b72b56b594/cards-original-grouped.png`、`cards-mobile.png`。

### Notes

- progress.md：仅在末尾追加真实数据浏览器验收记录。
- 回滚点：删除本节即可移除本轮验收记录；不影响代码和此前实现记录。

## 2026-07-20 - Task: 卡片库修复最终全量回归

### What was done

- 完成卡片库重复初始稿修复后的全项目回归，确认既有背诵、录入、公式、图片和设置功能未受影响。

### Testing

- `npm test`：二十六个测试文件、三百二十四项全部通过。
- `npm run typecheck`、`npm run build`、`git diff --check` 均通过。

### Notes

- progress.md：仅在末尾追加最终回归结果。
- 回滚点：删除本节即可移除本轮回归记录；代码回滚点沿用前述卡片库分组记录。

## 2026-07-20 - Task: 背诵封面、3D 摇杆、抽题控件精简与主题持久化

### What was done

- 背诵页改为“封面 → 背诵 → 结算 → 封面”流程，封面书本使用项目内开国大典图片，下方抽题机台整体居中。
- 纵向摇杆增加手部同步下拉、立体球头、金属杆、底座和阻尼回弹；支持鼠标、触摸和键盘激活。
- 移除固定 5、10、20、50、顺序切换和到期优先控件，只保留随机摇杆与手动数量输入；会话固定随机顺序且关闭到期优先。
- DIY 导航背景、主背景和淡化强度改为变更即保存，应用重启或页面重新挂载后自动恢复。

### Testing

- `npm test`：二十六个测试文件、三百二十六项全部通过。
- `npm run typecheck`、`npm run build`、`git diff --check` 均通过；构建仅保留既有前端包体积提示。
- Playwright 真实数据验收：开国大典图片加载成功（703×703），抽题内容中心偏差 0px；摇杆拖动中间态为 35px 且手部同步变换；随机抽取、手动开始、结束本轮和下一页返回封面均通过。
- DIY 主题刷新恢复通过；390×844 移动视口无横向溢出，浏览器控制台无错误。
- 截图证据：`C:/Users/ROG/.codex/visualizations/2026/07/19/019f77c3-7ead-7be3-818c-76b72b56b594/study-cover-kaiguo-dadian.png`、`study-joystick-pulled.png`、`study-cover-mobile.png`。

### Notes

- src/pages/StudyPage.tsx：增加背诵阶段状态、项目图片封面、居中抽题入口、手部摇杆变量和固定随机会话参数。
- src/styles/global.css：增加图片书封、3D 摇杆、居中布局、移动端重排和减弱动效样式。
- src/pages/SettingsPage.tsx：主题变更即时写入现有本地持久化存储。
- tests/frontend/study-page.test.tsx：覆盖封面、开国大典图片、精简控件和随机会话请求。
- tests/frontend/study-joystick.test.tsx：覆盖手部节点、下拉阈值、回弹和随机抽取。
- tests/frontend/study-known-flow.test.tsx：覆盖结算页“下一页”返回封面。
- tests/frontend/study-shortcuts.test.tsx：适配封面先行后的快捷键验证。
- tests/frontend/settings-page.test.tsx：覆盖 DIY 背景即时保存和重新挂载恢复。
- docs/本地运行与数据管理.md：同步背诵封面、开国大典图片、精简控件和主题自动保存说明。
- docs/superpowers/specs/2026-07-19-study-workbench-design.md：补充封面视觉、抽题布局、摇杆动效和主题持久化设计。
- docs/superpowers/plans/2026-07-19-study-workbench-plan.md：追加并勾选本轮实施任务。
- progress.md：仅在末尾追加本轮实现、验证和回滚记录。
- 回滚点：本任务开始前的未提交工作树状态。共享文件已有用户改动，禁止直接 `git restore`；可按 `StudyStage`、`StudyCover`、`study-cover__book`、`study-joystick__hand`、`updateTheme` 和本条测试名称定位并应用反向补丁。

## 2026-07-20 - Task: 总览目标日倒计时

### What was done

- 总览页增加可自定义名称和日期的目标日倒计时，按本机自然日显示“还有 N 天”“就是今天”或“已过去 N 天”。
- 倒计时设置保存到当前浏览器，刷新或重新打开后自动恢复；支持一键清除。
- 倒计时卡片适配桌面与移动布局，保存区和结果区在窄屏下自动纵向排列。

### Testing

- 测试驱动验证：生产实现前新增的五项倒计时测试均按预期失败；完成实现后，`tests/frontend/dashboard-page.test.tsx` 十项测试全部通过。
- `npm test`：二十六个测试文件、三百三十一项全部通过。
- `npm run typecheck`、`npm run build`、`git diff --check` 均通过；构建仅保留既有前端包体积提示。
- Playwright 浏览器验收：桌面端 1440×1000 与移动端 390×844 均无横向溢出；结果区与表单无重叠，刷新后仍显示已保存目标，浏览器控制台无错误。
- 截图证据：`C:/Users/ROG/.codex/visualizations/2026/07/19/019f77c3-7ead-7be3-818c-76b72b56b594/dashboard-date-countdown-desktop.png`、`dashboard-date-countdown-mobile.png`。

### Notes

- src/pages/DashboardPage.tsx：增加目标日输入、自然日差计算、本地保存、恢复和清除逻辑。
- src/styles/global.css：增加目标日倒计时卡片及桌面、移动响应式样式。
- tests/frontend/dashboard-page.test.tsx：覆盖未来日期、当天、过期、恢复与清除场景。
- docs/本地运行与数据管理.md：补充倒计时规则、存储键和数据边界说明。
- docs/superpowers/specs/2026-07-19-study-workbench-design.md：补充总览目标日倒计时设计。
- docs/superpowers/plans/2026-07-19-study-workbench-plan.md：追加并勾选目标日倒计时实施任务。
- progress.md：仅在末尾追加本轮实现、验证和回滚记录。
- 回滚点：本任务开始前的未提交工作树状态。共享文件已有用户改动，禁止直接 `git restore`；可按 `dashboardCountdownStorageKey`、`dashboard-date-countdown`、`目标日倒计时` 测试和文档章节定位并应用反向补丁。

## 2026-07-20 - Task: 总览品牌、公考时政轮播与翻页日历

### What was done

- 侧栏品牌图标改为项目内国徽图片，展开时显示“为人民服务”和辅助产品名“公考记忆卡”；总览顶部副文案同步改为“为人民服务”。
- 今日状态改为自动滚动的公考时政资讯，前端每 10 分钟更新；服务端固定读取新华网时政，提供 5 秒超时、10 分钟缓存、公考主题准入、文娱生活噪声排除和稳定回退。
- 月历增加上月、下月控制和双向 3D 纸页翻动效果；按用户修正将资讯卡、日历卡统一为白色、浅灰与政务红。

### Testing

- `tests/server/current-affairs.test.ts` 十一项通过，覆盖合法来源、缓存、超时、公考相关性、噪声排除和不足六条整体回退。
- 真实联网验收返回十二条新华网公考相关资讯，未混入娱乐、体育、旅游、美食、购票促销、生活猎奇或纯摄影内容。
- Playwright 桌面和 390×844 移动端验收：国徽加载成功，资讯轨道实际移动，日历从 2026 年 7 月翻至 8 月，两张卡片背景均为白色，无横向溢出和控制台错误。
- 最终 `npm test`：三十一个测试文件、三百七十四项全部通过；`npm run typecheck`、`npm run build`、`git diff --check` 均通过，构建仅保留既有前端包体积提示。
- 截图证据：`C:/Users/ROG/.codex/visualizations/2026/07/19/019f77c3-7ead-7be3-818c-76b72b56b594/dashboard-light-briefing-calendar.png`、`dashboard-light-mobile.png`。

### Notes

- src/components/AppShell.tsx：使用国徽图片和“为人民服务”双层品牌信息。
- src/pages/DashboardPage.tsx：增加公考资讯自动刷新、弹幕轨道、紧凑统计和可切换翻页月历。
- src/styles/global.css：增加品牌、浅色资讯轮播和 3D 纸页日历样式。
- server/currentAffairs/service.ts：增加新华网抓取、缓存、超时、公考相关性筛选和回退内容。
- server/currentAffairs/routes.ts：新增公考时政读取接口。
- server/app.ts、server/index.ts：挂载并启动时政服务。
- tests/frontend/app-shell.test.tsx、tests/frontend/dashboard-page.test.tsx：覆盖品牌、资讯、回退和月份切换。
- tests/server/current-affairs.test.ts：覆盖时政服务契约和相关性边界。
- docs/本地运行与数据管理.md：补充来源、刷新、筛选和回退规则。
- docs/superpowers/specs/2026-07-19-study-workbench-design.md、docs/superpowers/plans/2026-07-19-study-workbench-plan.md：同步设计和完成清单。
- progress.md：仅在末尾追加本轮实现、验证和回滚记录。
- 回滚点：本任务开始前的未提交工作树状态。共享入口已有其他改动，禁止直接 `git restore`；可按 `createCurrentAffairsService`、`dashboard-ticker`、`dashboard-calendar--flip`、`app-shell__brand-emblem` 和对应测试定位并应用反向补丁。

## 2026-07-20 - Task: 复盘错题影像积累与浅色 3D 轮播

### What was done

- 复盘页改为“错题积累”，支持本地选择、微信或 QQ 拖入、剪贴板粘贴 PNG、JPEG 和 WebP。
- 图片和原子清单持久化到独立 `data/review-images`，提供列表、上传、读取和删除接口；单张不超过 10MB，一次最多 12 张，不修改 SQLite。
- 页面改为全白、浅灰与象牙相纸风格，中心卡清晰放大，两侧最多各三层透视景深；侧边按钮、底部按钮和键盘左右键可循环切换。

### Testing

- 复盘图片接口覆盖上传、格式与签名限制、列表、读取、删除和服务重建恢复；真实接口成功上传、轮播切换、刷新恢复并清理可确认的测试图片。
- Playwright 1440×1000 与 390×844 验收：相纸层级、图片加载、侧边与底部导航正常，页面、舞台和卡片均为浅色，无横向溢出和控制台错误。
- 最终全量验证与上一任务相同：三十一个测试文件、三百七十四项通过，类型检查、生产构建和空白检查通过。
- 截图证据：`C:/Users/ROG/.codex/visualizations/2026/07/19/019f77c3-7ead-7be3-818c-76b72b56b594/review-carousel-light-desktop.png`、`review-carousel-light-mobile.png`。

### Notes

- server/reviewImages/index.ts、server/reviewImages/service.ts、server/reviewImages/routes.ts：新增独立图片清单、文件校验和复盘图片接口。
- server/app.ts、server/index.ts：挂载复盘图片服务并注入独立数据目录。
- src/pages/ReviewPage.tsx：实现图片载入、三种上传入口、轮播、删除和状态反馈。
- src/styles/review.css：实现全浅色相纸舞台、多层 3D 景深和移动端布局。
- tests/server/review-images.test.ts、tests/frontend/review-page.test.tsx：覆盖图片后端和前端主流程。
- docs/本地运行与数据管理.md：补充存储位置、上传限制和不进入现有 ZIP 备份的边界。
- docs/superpowers/specs/2026-07-19-study-workbench-design.md、docs/superpowers/plans/2026-07-19-study-workbench-plan.md：同步复盘影像设计和完成清单。
- progress.md：仅在末尾追加本轮实现、验证和回滚记录。
- 回滚点：本任务开始前的未提交工作树状态。代码可按 `/api/review-images`、`ReviewImageService`、`review-stage` 和对应测试定位并应用反向补丁；回滚前必须先完整复制 `data/review-images`，现有 ZIP 备份不会保留该目录。

## 2026-07-20 - Task: 复盘多级板块与图片放大查看

### What was done

- 默认增加资料、言语、判断三个大板块；资料和判断带“综合”，言语带“中心理解、后文推断、逻辑填空”。
- 用户可新增大板块和小板块，并在管理区隐藏或恢复；隐藏不删除图片，上传只允许进入当前可见小板块。
- 图片清单升级为 v2 并保存 `sectionId`；旧 v1 图片原子迁入“其他 / 未分类”。
- 每个可见大板块拥有独立 3D 轮播和当前小板块；键盘只切换聚焦舞台。任意图片可打开全屏浅色查看器，支持 100% 到 300% 缩放、恢复比例、关闭按钮和 `Esc`。

### Testing

- 后端复盘分类两组测试共十四项通过，覆盖默认目录、新增、重名和长度限制、隐藏恢复、可见性上传约束、v1 迁移与跨服务恢复。
- 前端复盘两组测试共十七项通过；独立测试发现并修复了异步状态更新读取失效事件对象导致的新增小板块崩溃。
- 隔离的 8790 构建服务真实验收：创建“数量关系 / 工程问题”、向不同小板块上传三张图片、隐藏恢复大小板块、任意图片放大至 150%、刷新和服务重启后仍保留四个大板块、三张图片及归属；临时数据已删除。
- 正式服务重启后返回资料、言语、判断和迁移得到的其他板块；仅删除了可确认属于本轮测试的三张项目样例，无法确认来源的旧图片保持不动。
- 最终 `npm test`：三十一个测试文件、三百七十四项全部通过；`npm run typecheck`、`npm run build`、`git diff --check` 均通过。
- 截图证据：`C:/Users/ROG/.codex/visualizations/2026/07/19/019f77c3-7ead-7be3-818c-76b72b56b594/review-multiboard-real-desktop.png`、`review-multiboard-real-mobile.png`、`review-multiboard-viewer-real.png`。

### Notes

- server/reviewImages/service.ts、server/reviewImages/routes.ts：增加板块目录、v1 到 v2 迁移、图片归属和分类管理接口。
- src/pages/ReviewPage.tsx：增加多大板块独立轮播、小板块切换、新增、隐藏恢复和全屏缩放查看器。
- src/styles/review.css：增加多板块、管理区和浅色全屏查看器的桌面与移动端样式。
- tests/server/review-images.test.ts、tests/server/review-board-routes.test.ts：覆盖分类存储、路由和迁移。
- tests/frontend/review-page.test.tsx、tests/frontend/review-board-management.test.tsx：覆盖板块交互、分区上传、聚焦键盘和任意图片放大。
- docs/本地运行与数据管理.md：补充默认目录、分类接口、迁移和查看器说明。
- docs/superpowers/specs/2026-07-19-study-workbench-design.md、docs/superpowers/plans/2026-07-19-study-workbench-plan.md：同步多级目录设计和完成清单。
- progress.md：仅在末尾追加本轮实现、验证和回滚记录。
- 回滚点：本任务开始前的未提交工作树状态。代码可按 `manifestVersion = 2`、`sectionId`、`review-manager`、`review-viewer` 和新增测试定位并应用反向补丁；任何代码降级前必须先停止服务并完整复制 `data/review-images`，旧版不能安全解释 v2 分类清单。
## 2026-07-20 - Task: 复盘图片分类目录迁移与板块归档

### What was done

- 将复盘图片清单升级为 v3，程序会把 v1/v2 平铺图片自动迁移到按大板块、小板块划分的可读目录，并按板块、小板块、加入北京时间和完整图片稳定编号重命名。
- 迁移前生成 SHA-256 临时凭据；中断续跑只接受哈希一致的目标文件，源与目标冲突或目标无法证明时停止，v3 清单原子落盘后自动清理凭据。
- 新增大板块和小板块时立即创建对应目录，上传图片直接进入所选小板块；同一进程内多个服务实例共享写入队列，避免清单互相覆盖。
- 复盘管理区增加大板块、小板块可恢复归档，归档后移出轮播和上传入口但不删除图片；补齐并发锁、稳定焦点、选中项回退和失败重试。
- 停止生产写入服务后建立完整回滚副本，并由新构建自动迁移真实 4 张图片；逐图稳定编号、字节数、SHA-256 和 API 内容长度保持一致。

### Testing

- `npm test`：通过，33 个测试文件、389 项测试全部通过。
- `npm run typecheck`：通过，前端与服务端 TypeScript 检查无错误。
- `npm run build`：通过，客户端与服务端生产构建成功；保留既有客户端包大于 500KB 的非阻塞提示。
- `git diff --check`：通过，仅输出工作树既有 LF 到 CRLF 提示。
- 复盘存储定向测试：3 个文件、23 项通过；额外覆盖迁移中断续跑、错误目标拒绝、Windows 特殊名称、同根多实例写入和嵌套读删。
- 复盘前端定向测试：3 个文件、22 项通过；Playwright 在 1440×1000 与 390×844 验证归档、恢复、并发锁、焦点回收和无控制台错误。
- 真实数据验收：`data/review-images/manifest.json` 为 v3，4 张图片均位于三级相对路径；与回滚副本逐图 SHA-256 一致，根目录无平铺图片，迁移凭据已清理，4 个内容接口均可读取正确字节数。

### Notes

- `server/reviewImages/service.ts`：增加 v3 目录布局、北京时间命名、SHA-256 迁移凭据、共享写队列、安全续跑和显式删除回滚错误。
- `src/pages/ReviewPage.tsx`：把板块隐藏操作改为可恢复归档，并完善并发 pending、焦点、选中项与图片索引。
- `tests/server/review-image-storage-layout.test.ts`：新增目录、命名、迁移完整性、特殊名称和多实例写入测试。
- `tests/server/review-images.test.ts`：同步 v3 清单与嵌套文件测试契约。
- `tests/frontend/review-board-archive.test.tsx`：新增归档、恢复、并发、焦点和状态边界测试。
- `tests/frontend/review-board-management.test.tsx`：同步归档文案并验证图片保留和无删除请求。
- `docs/本地运行与数据管理.md`：说明 v3 目录、稳定编号、命名、迁移凭据、归档和备份边界。
- `docs/superpowers/specs/2026-07-19-study-workbench-design.md`：同步复盘目录迁移和归档设计。
- `docs/superpowers/plans/2026-07-20-review-image-directory-migration.md`：记录本任务实施步骤与完成状态。
- `progress.md`：追加本轮实现、验证、文件清单和回滚点。
- 真实数据回滚点：`data/backups/review-images-pre-v3-20260721-020409`。回滚时先停止 8787 服务，将当前 `data/review-images` 重命名为隔离目录，再把该回滚目录完整复制为新的 `data/review-images`，最后启动服务；旧代码不能读取 v3 清单，代码与数据必须同时回滚。

## 2026-07-20 - Task: 全站 Apple 式交互与物理拖拽改造

### What was done

- 保留政务红、白色工作台和项目图片主题，统一 4px/8px 间距、8px 卡片圆角、轻量表面层级、44px 触控目标、90ms 按压反馈和 150ms 到 280ms 可中断动效。
- 卡片库详情抽屉补充遮罩与立即重开回归保护；操作按钮可自动换行，四到五个 44px 按钮不会溢出卡片。
- 复盘图片轮播支持直接在图片上水平跟手拖拽、弹性回正和速度/距离阈值切换，屏蔽原生图片拖动、双指抢占和拖拽后误开查看器；图片删除改为单任务锁。
- 复盘查看器增加初始焦点、Tab 循环、Esc 即时关闭和焦点返回，查看器、板块管理、轮播导航和上传入口统一触控尺寸。
- 背诵摇杆增加多指针保护、8px 手势迟滞、取消/捕获丢失回弹、同步抽奖锁和请求中止；减弱动效不等待抽奖动画。
- “减弱动效”支持即时预览、保存持久化和重启恢复，判定顺序固定为系统偏好、当前页面预览、本地已保存设置；同时适配降低透明度和高对比度。
- 修复 390px 设置页主题选择器横向溢出，并使用项目内国徽作为网站图标，消除首次加载 404。

### Testing

- 测试驱动验证：新增边界用例在修复前稳定复现图片原生拖拽、双指取消、同图/跨图重复删除和减弱动效正反向预览问题，修复后全部转绿。
- `npm test`：33 个测试文件、397 项测试全部通过。
- `npm run typecheck`：前端与服务端 TypeScript 检查通过。
- `npm run build`：客户端与服务端生产构建通过；仅保留既有前端包大于 500KB 的非阻塞提示。
- `git diff --check`：通过，仅输出工作树既有 LF 到 CRLF 提示。
- Playwright 桌面端 1440×1000：五页无横向溢出且控制台 0 错误；抽屉打开、关闭、立即重开分别约 27ms、15ms、19ms；复盘拖拽中途跟手 -36px，释放后切图且未误开查看器；四到五个卡片操作按钮均未溢出。
- Playwright 移动端 390×844：五页无横向溢出、文本与按钮无重叠、控制台 0 错误；系统减弱动效下可见节点、抽屉和轮播的动画与过渡均为 0。
- 独立代码复审最终通过；截图证据：`C:/Users/ROG/.codex/visualizations/2026/07/19/019f77c3-7ead-7be3-818c-76b72b56b594/apple-desktop.png`、`apple-mobile.png`。

### Notes

- `index.html`：使用项目内国徽作为网站图标。
- `src/styles/tokens.css`：增加间距、表面、边框、阴影、圆角和 44px 控件令牌。
- `src/styles/global.css`：统一全站按钮、抽屉、焦点、禁用状态、触控尺寸、可中断动效、减弱动效及设置页移动布局。
- `src/pages/ReviewPage.tsx`：增加物理拖拽、多指针保护、防误触、删除锁和查看器焦点管理。
- `src/styles/review.css`：收敛轮播弹簧时长并统一复盘页 44px 触控目标和减弱动效。
- `src/pages/StudyPage.tsx`：完善摇杆取消/回弹、抽奖锁、减弱动效直达和复习请求中止。
- `src/pages/SettingsPage.tsx`、`src/theme/experienceSettings.ts`：实现动效设置即时应用、持久化恢复及统一判定优先级。
- `tests/frontend/cards-page.test.tsx`：补充抽屉遮罩、内部点击和立即重开回归。
- `tests/frontend/review-page.test.tsx`：覆盖图片拖拽、双指针、原生拖动、删除锁、查看器焦点循环和焦点返回。
- `tests/frontend/settings-page.test.tsx`：覆盖减弱动效即时应用、重启恢复和正反向预览。
- `tests/frontend/study-joystick.test.tsx`、`tests/frontend/study-page.test.tsx`：覆盖摇杆迟滞、取消、单次抽奖、减弱动效和异步请求边界。
- `docs/本地运行与数据管理.md`、`docs/superpowers/specs/2026-07-19-study-workbench-design.md`：同步全站交互、拖拽、弹窗焦点和动效数据边界。
- `progress.md`：仅在末尾追加本轮实现、验证和回滚记录。
- 回滚点：本任务开始前已完成 v3 图片迁移与板块归档的未提交工作树状态。共享文件包含既有用户改动，禁止直接 `git restore`；应按本条 Notes 文件清单，仅对全站交互、轮播拖拽、动效设置和对应测试/文档应用反向补丁。该回滚不需要回退 `data/review-images`。

## 2026-07-21 - Task: 全站 iOS 液态玻璃与可中断手势改造

### What was done

- 建立薄、标准、厚、深色四级液态玻璃令牌、指针高光和显式按压反馈；嵌套小组件不重复背景模糊。
- 六个页面、侧栏、按钮、输入、分段控件、复选标签、弹窗、抽屉和图片查看器统一接入白色与政务红液态玻璃层级。
- 卡片详情抽屉改为视口 Portal，支持同路径进退、速度投射、橡皮筋边界、标题栏重抓、失焦恢复、滚动锁和动画异常兜底。
- 复盘轮播改为真实卡位测量、可中断 FLIP 和迟到帧隔离；修复移动端图片点击、300% 全方向查看、上传删除竞态和 1024 像素溢出。
- 背诵摇杆改为纵向一比一跟手、速度回弹和可中断短动画；会话请求立即发起，标准动效保留约 300 毫秒反馈，减弱动效同步进入结果。
- 辅助模式覆盖系统和应用内减弱动效、减少透明度、高对比度及无背景模糊能力回退，并保留 DIY 背景图片。
- 新增 `motion` 依赖和共享运动函数；数据目录、SQLite、复盘图片清单及后端业务协议均未修改。

### Testing

- `npm test`：通过，36 个测试文件、459 项测试全部通过。
- `npm run typecheck`：通过，前端与服务端 TypeScript 检查无错误。
- `npm run build`：通过，客户端与服务端生产构建成功；前端主包 696.80KB，仅保留既有大于 500KB 的非阻塞提示。
- `git diff --check`：通过，仅输出工作树既有 LF 到 CRLF 提示。
- Playwright 1440×1000：六页无横向溢出、破图、控制台错误、页面错误或 404，主要玻璃计算样式生效。
- Playwright 1024×768 与 390×844：六页无横向溢出；时政链接、稿件切换和普通控件命中区不小于 44px；抽屉固定在视口，复盘中心图片可打开查看器。
- 手势验收：卡片抽屉 6px 不启动、36px 一比一跟手，极高速退场 60ms 内可从标题栏重抓并回到 `idle/0`；复盘轮播和背诵摇杆同样通过迟滞、一比一跟手、捕获丢失与回位检查。
- 辅助功能验收：减少动态时无弹簧和自动滚动，减少透明度时无背景模糊，高对比度边框增强；组合模式控制台错误为 0。

### Notes

- `package.json`：增加 `motion` 运行依赖。
- `package-lock.json`：锁定新增运动依赖及其解析版本。
- `src/main.tsx`：在全局样式后加载液态玻璃基础样式。
- `src/motion/liquidMotion.ts`：新增速度投射、卡位选择、橡皮筋边界和弹簧配置。
- `src/styles/tokens.css`：增加四级玻璃、阴影、边缘、模糊、圆角和按压令牌。
- `src/styles/liquid-glass.css`：增加共享玻璃类、嵌套回退、按压反馈和辅助模式。
- `src/components/AppShell.tsx`：增加外壳玻璃层级、首帧主题恢复和单一指针高光委托。
- `src/components/RichTextEditor.tsx`：为全部富文本工具按钮增加显式按压反馈。
- `src/pages/DashboardPage.tsx`：为驾驶舱模块和小组件增加玻璃层级、触控尺寸与辅助语义。
- `src/pages/EntryPage.tsx`：为录入表单和标签增加玻璃反馈，并完善图片入口键盘与拖放安全。
- `src/pages/CardsPage.tsx`：增加卡片玻璃网格和可中断视口抽屉手势。
- `src/pages/ReviewPage.tsx`：增加响应式可中断轮播、移动点击、查看器画布和并发状态保护。
- `src/pages/SettingsPage.tsx`：为主题、体验和音乐设置增加分层玻璃与键盘焦点。
- `src/pages/StudyPage.tsx`：增加玻璃封面、题卡、纵向摇杆和非阻塞抽奖反馈。
- `src/styles/app-shell-glass.css`：定义侧栏、主区、导航和高对比回退。
- `src/styles/dashboard-glass.css`：定义总览模块、日历、时政和控件玻璃样式。
- `src/styles/entry-glass.css`：定义录入表单、工具栏、标签和移动端玻璃样式。
- `src/styles/cards-glass.css`：定义卡片网格、筛选、抽屉和视口 Portal 样式。
- `src/styles/review.css`：定义复盘轮播、查看器、板块表单和响应式玻璃样式。
- `src/styles/settings-glass.css`：定义设置分区、选项和辅助模式样式。
- `src/styles/study-glass.css`：定义背诵封面、摇杆、题卡和高对比样式。
- `tests/frontend/liquid-motion.test.ts`：覆盖运动公式、边界和弹簧契约。
- `tests/frontend/liquid-glass-styles.test.ts`：覆盖玻璃层级、嵌套规则和辅助模式。
- `tests/frontend/app-shell.test.tsx`：覆盖外壳材质、高光委托、首帧恢复和回退。
- `tests/frontend/dashboard-page.test.tsx`：覆盖总览玻璃、触控、读屏和减弱动效。
- `tests/frontend/entry-page.test.tsx`：覆盖录入玻璃、标签反馈、窄屏和图片入口语义。
- `tests/frontend/cards-page.test.tsx`：覆盖抽屉进退、手势中断、滚动锁、Portal 和高速重抓。
- `tests/frontend/review-page.test.tsx`：覆盖轮播投射、FLIP、迟到帧、移动点击和图片缩放。
- `tests/frontend/settings-page.test.tsx`：覆盖设置玻璃、焦点环和应用内减弱动效。
- `tests/frontend/study-joystick.test.tsx`：覆盖摇杆迟滞、速度、异常降级和请求时序。
- `tests/frontend/study-page.test.tsx`：覆盖背诵页面材质、反馈时长和高对比契约。
- `tests/frontend/rich-text-editor-liquid.test.tsx`：覆盖富文本按钮按压类。
- `docs/本地运行与数据管理.md`：说明玻璃层级、运动规则、响应式和辅助回退。
- `docs/superpowers/specs/2026-07-21-ios-liquid-glass-design.md`：记录批准设计及最终实施结果。
- `docs/superpowers/plans/2026-07-21-ios-liquid-glass-plan.md`：记录任务边界、执行步骤和完成状态。
- `progress.md`：仅在末尾追加本轮实现、验证和回滚说明。
- 截图证据：`C:/Users/ROG/.codex/visualizations/2026/07/19/019f77c3-7ead-7be3-818c-76b72b56b594/ios-liquid-glass-*` 目录保存桌面、平板、移动、辅助模式和手势截图。
- 回滚点：代码基线为提交 `2da84ca` 后、本轮实现开始前的工作树。由于共享文件包含用户既有未提交改动，禁止对页面或样式执行整文件恢复；应仅对以上文件中的液态玻璃类、页面专属样式、运动函数、新增测试和文档段落应用反向补丁，并移除 `motion` 依赖。回滚不需要修改 `data/`、SQLite 或 `data/review-images`。

## 2026-07-21 - Task: 录入页固定模式与保存按钮对比度修复

### What was done

- 删除录入页“错题录入 / 知识点积累”模式选择；新建内容固定按错题录入模式保存，编辑历史卡片时继续保留原有模式，不改写旧数据。
- 修复保存按钮在液态玻璃背景下文字不可见的问题；正常状态使用政务红底白字，禁用状态使用浅红底深红字并保持清晰对比。
- 同步更新录入页与卡片编辑联动验证，确认页面不再出现模式单选项，连续编辑仍只更新同一张卡片。

### Testing

- `npm test`：通过，36 个测试文件、459 项测试全部通过。
- `npm run typecheck`：通过，前端与服务端 TypeScript 检查无错误。
- `npm run build`：通过，客户端与服务端生产构建成功；仅保留前端主包大于 500KB 的非阻塞提示。
- `git diff --check`：通过，仅输出工作树既有的 LF 到 CRLF 提示。
- Playwright 390×844 实际页面验证：录入模式单选项数量为 0；保存按钮正常状态为政务红底白字、禁用状态为浅红底深红字，按钮高度 44 像素，页面无横向溢出。

### Notes

- `src/pages/EntryPage.tsx`：移除录入模式选择界面，并保留新建固定模式与编辑历史模式的数据逻辑。
- `src/styles/entry-glass.css`：删除失去用途的模式样式并增加保存按钮正常、禁用状态的高对比颜色。
- `tests/frontend/entry-page.test.tsx`：覆盖模式入口删除、固定新建模式和保存按钮颜色契约。
- `tests/frontend/cards-page.test.tsx`：更新编辑卡片联动测试，验证模式单选项已删除且连续 PATCH 行为保持不变。
- `docs/本地运行与数据管理.md`：说明录入页固定模式和历史数据保留规则。
- `progress.md`：仅在末尾追加本轮实现、验证和回滚说明。
- 回滚点：以本任务开始前的未提交工作树为基线。回滚时仅对上述文件中“删除模式选择、固定新建模式、保存按钮颜色及对应测试和文档”的差异应用反向补丁；不得整文件恢复，也不需要修改 SQLite、卡片数据或复盘图片数据。
- 生产验收：使用最新构建重启 8787 服务，`/api/health` 返回 `ok`，首页及五个一级页面、国徽资源均返回 200；5173 开发服务保持运行，复盘接口中的 6 张现有用户图片完整保留。

## 2026-07-21 - Task: 卡片库详情改为底部预览

### What was done

- 卡片详情预览由右侧抽屉改为贴合浏览器底部的居中预览面板，桌面端限制为 960 像素宽，移动端左右各保留 6 像素间距。
- 进场、退场和手势全部改为纵向：面板从下方上滑，按住顶部把手可向下拖动关闭，10 像素迟滞、一比一跟手、速度投射、橡皮筋边界和可中断弹簧继续保留。
- 保留 Portal、遮罩点击关闭、关闭按钮、`Esc`、焦点循环与恢复、底层滚动锁和减弱动效直接关闭能力。

### Testing

- `npm test`：通过，36 个测试文件、459 项测试全部通过。
- `npm run typecheck`：通过，前端与服务端 TypeScript 检查无错误。
- `npm run build`：通过，客户端与服务端生产构建成功；仅保留前端主包大于 500KB 的非阻塞提示。
- `git diff --check`：通过，仅输出工作树既有的 LF 到 CRLF 提示。
- Playwright 真实浏览器验收：1440×1000 下预览面板为 960×720、底部贴合并水平居中；390×844 下为 378×742.7、文档宽度保持 390；向下拖动 347 像素时面板同量跟手，超过半高释放后关闭。
- 截图证据：`output/playwright/cards-bottom-mobile.png`。

### Notes

- `src/pages/CardsPage.tsx`：把抽屉尺寸、位移、指针坐标和释放投射从横向改为纵向。
- `src/styles/cards-glass.css`：实现贴底居中、顶部圆角、向上阴影和移动端底部预览尺寸，并提高专属遮罩定位规则的优先级。
- `tests/frontend/cards-page.test.tsx`：覆盖从下方进退、向下拖动、高速重抓、失焦回位和真实底部布局契约。
- `docs/本地运行与数据管理.md`：说明底部预览位置、关闭方式和纵向手势。
- `progress.md`：仅在末尾追加本轮实现、验证和回滚说明。
- 回滚点：以本任务开始前的未提交工作树为基线。回滚时仅反向应用上述文件中“底部预览、纵向手势及对应测试和文档”的差异；不得整文件恢复，不需要修改卡片数据、SQLite 或图片目录。

## 2026-07-21 - Task: DIY 主题自定义图片拖入与粘贴

### What was done

- 导航栏背景和右侧整体背景均新增自定义图片入口，支持系统文件选择、从微信或 QQ 拖入，以及直接粘贴剪贴板图片；加入后立即选中并保存。
- 限定 PNG、JPEG、WebP 和 10MB 原始文件上限；较大图片在浏览器内自动缩放并转为 WebP，单张最终存储内容限制在约 900,000 个字符，避免挤满本机站点存储。
- 自定义背景与原有主题一同持久化，刷新和重启后自动恢复；存储空间不足时保留当前主题并显示稳定提示，“恢复默认”同步清除自定义图片。

### Testing

- 定向测试：`tests/frontend/diy-theme.test.ts`、`tests/frontend/settings-page.test.tsx`、`tests/frontend/app-shell.test.tsx` 共 42 项通过，覆盖格式与容量校验、自动压缩、选择/拖入/粘贴、即时应用、刷新恢复和旧数据兼容。
- `npm test`：通过，37 个测试文件、468 项测试全部通过。
- `npm run typecheck`：通过，前端与服务端 TypeScript 检查无错误。
- `npm run build`：通过，客户端与服务端生产构建成功；仅保留前端主包大于 500KB 的非阻塞提示。
- `git diff --check`：通过，仅输出工作树既有的 LF 到 CRLF 提示。
- Playwright 真实浏览器验收：上传项目内 694KB JPEG 后自动转为 WebP 并立即应用，刷新后仍恢复；390×844 下页面宽度保持 390，两个拖放区完整可见且选择按钮高度均为 44 像素，控制台错误为 0。
- 截图证据：`output/playwright/diy-custom-mobile.png`。

### Notes

- `src/theme/diyTheme.ts`：扩展自定义图片主题数据、校验压缩、稳定存储、旧数据兼容和默认恢复能力。
- `src/pages/SettingsPage.tsx`：增加两个背景的文件选择、拖放、剪贴板粘贴、处理中状态和存储失败反馈。
- `src/styles/settings-glass.css`：增加自定义图片拖放区、焦点、拖入反馈和移动端布局。
- `tests/frontend/diy-theme.test.ts`：覆盖自定义图片处理和主题持久化边界。
- `tests/frontend/settings-page.test.tsx`：覆盖三种加入方式以及自定义图片保存、应用和状态提示。
- `docs/本地运行与数据管理.md`：说明自定义图片入口、格式、容量、压缩、保存位置和恢复默认行为。
- `progress.md`：仅在末尾追加本轮实现、验证和回滚说明。
- 回滚点：以本任务开始前的未提交工作树为基线。回滚时仅反向应用上述文件中“自定义 DIY 图片、处理与持久化、对应测试和文档”的差异；不得整文件恢复，不需要修改 SQLite、卡片数据或复盘图片目录。

## 2026-07-21 - Task: 卡片预览展示 AI 题目答案并取消背景模糊

### What was done

- 卡片库底部预览新增“AI 优化题目与答案”区域，每道 AI 题目直接显示对应答案，问题和答案中的公式继续使用安全排版。
- 从合并后的用户初始稿打开预览时，按接口顺序汇总同一初始稿全部衍生卡片的题目与答案；没有背诵题面的卡片不显示空问答区域。
- 保持预览从页面底部上滑、向下拖动关闭和底部贴合定位；遮罩改为仅轻度压暗，显式关闭页面背景模糊，移动端问答改为纵向排列。

### Testing

- `tests/frontend/cards-page.test.tsx`：35 项通过，覆盖单卡问答、衍生多题逐项对应、底部定位和遮罩不模糊的样式契约。
- `npm test`：通过，37 个测试文件、469 项测试全部通过。
- `npm run typecheck`：通过，前端与服务端 TypeScript 检查无错误。
- `npm run build`：通过，客户端与服务端生产构建成功；仅保留前端主包大于 500KB 的非阻塞提示。
- `git diff --check`：通过，仅输出工作树既有的 LF 到 CRLF 提示。
- Playwright 真实浏览器验收：真实同源初始稿的 6 道衍生题及 6 个答案全部显示；1440×1000 下预览为 960×720 且底边贴合 1000，390×844 下预览为 378×742.7 且底边贴合 844，页面宽度保持 390；两种视口的遮罩 `backdrop-filter` 均为 `none`，移动端问答单列且面板可滚动，控制台错误为 0。
- 截图证据：`output/playwright/cards-ai-answers-desktop.png`、`output/playwright/cards-ai-answers-mobile.png`。
- 生产验收：使用最新构建重启 8787 服务，`/api/health` 返回 `ok`，首页及五个一级页面、国徽资源均返回 200；卡片接口仍返回非空答案，复盘接口中的 6 张现有用户图片完整保留。

### Notes

- `src/pages/CardsPage.tsx`：增加按卡片与题面稳定编号汇总的 AI 问题答案预览区域。
- `src/styles/cards-glass.css`：增加问答双列/移动端单列排版，关闭预览遮罩的背景模糊并保留轻度压暗。
- `tests/frontend/cards-page.test.tsx`：覆盖问题答案对应关系、衍生多题和底部无模糊预览契约。
- `docs/本地运行与数据管理.md`：说明问答展示范围、空状态、公式排版、底部位置和无背景模糊行为。
- `progress.md`：仅在末尾追加本轮实现、验证和回滚说明。
- 回滚点：以本任务开始前的未提交工作树为基线。回滚时仅反向应用上述文件中“AI 问题答案预览、遮罩取消模糊、对应测试和文档”的差异；不得整文件恢复，不需要修改数据库、卡片内容、题面调度或复盘图片目录。

## 2026-07-21 - Task: 清理项目临时文件并明确目录边界

### What was done

- 删除已完成验收后不再有业务作用的 `.playwright-cli/`、`.superpowers/`、`output/` 和 `.tmp/` 临时目录，未触碰源码、测试、正式文档、数据库、复盘图片或项目内 DIY 背景。
- 为浏览器验收产物和临时头脑风暴目录补充 `.gitignore` 规则，避免下次运行再次污染工作树。
- 新增根目录中文 README，说明启动方式、源码目录和本机数据/密钥边界；同步在运行文档中区分正式 `docs/superpowers` 文档与临时 `.superpowers` 草稿。

### Testing

- `npm test`：通过，37 个测试文件、469 项测试全部通过。
- `npm run typecheck`：通过，前端与服务端 TypeScript 检查无错误。
- `npm run build`：通过，客户端与服务端生产构建成功；仅保留前端主包大于 500KB 的非阻塞提示。
- `git diff --check`：通过，仅输出工作树既有的 LF 到 CRLF 提示。
- 清理后核验：四个临时目录不存在；`.env`、`data/`、`data/review-images` 和 6 张复盘图片保留；`public/diy` 中 3 张背景图片保留且未被忽略。

### Notes

- `.gitignore`：忽略浏览器验收、临时头脑风暴和输出目录。
- `README.md`：新增项目目录、启动和本机数据边界说明。
- `docs/本地运行与数据管理.md`：新增仓库目录与本地产物约定。
- `progress.md`：仅在末尾追加本轮实现、验证和回滚说明。
- 已删除：`.playwright-cli/`、`.superpowers/`、`output/`、`.tmp/`，均为可重新生成的本机临时产物。
- 回滚点：若需恢复截图或临时草稿，只能从外部备份恢复；本轮未删除源码、正式文档、数据库、复盘图片、DIY 背景或构建依赖。

## 2026-07-21 - Task: 修复用户初始稿数量显示口径

### What was done

- 修复卡片库切换到用户初始稿后仍只显示衍生卡片总数的问题。
- 用户初始稿模式改为同时显示当前页去重后的初始稿数量和筛选结果中的 AI 题目总数；列表与页头复用同一份分组结果，避免统计与实际卡片数量再次不一致。

### Testing

- `npm test -- tests/frontend/cards-page.test.tsx`：通过，35 项测试全部通过。
- `npm run typecheck`：通过，前端与服务端 TypeScript 检查无错误。
- 用例验证：同一初始稿衍生 2 道 AI 题目时，页面只显示 1 张初始稿卡片，页头显示“当前页 1 份初始稿 · 共 2 道 AI 题目”。

### Notes

- `src/pages/CardsPage.tsx`：统一计算当前内容版本的可见卡片组，并按版本显示正确数量口径。
- `tests/frontend/cards-page.test.tsx`：增加初始稿去重数量断言。
- `docs/本地运行与数据管理.md`：说明初始稿数量与 AI 题目总数的统计口径。
- `progress.md`：仅在末尾追加本轮实现、验证和回滚说明。
- 回滚点：仅反向应用本轮页头数量文案、可见分组复用、对应测试和文档差异；不需要修改卡片数据、分页接口或数据库。

## 2026-07-21 - Task: Excel 仅导出去重后的用户原始内容

### What was done

- 将卡片库导出入口改为“导出原始内容”，工作簿只保留“用户原始内容”一个工作表和一列原文。
- 同一初始稿衍生的重复卡片只导出一次，纯空白原文不导出；归档与未归档原文均包含，不受页面筛选、分页或勾选状态影响。
- 删除导出中的卡片编号、AI 字段、富文本 JSON、分类标签、题面答案、调度、附件、复习记录和本机设置；前后端下载名统一为 `gongkao-original-content-时间.xlsx`。

### Testing

- `npm test -- tests/server/card-export.test.ts tests/frontend/cards-page.test.tsx`：通过，2 个测试文件、37 项测试全部通过。
- `npm run typecheck`：通过，前端与服务端 TypeScript 检查无错误。
- 导出用例覆盖归档/未归档、衍生重复、空原文、XML 特殊字符、单工作表单列和敏感字段不导出。

### Notes

- `server/cards/repository.ts`：将导出数据收敛为去重后的非空用户原文。
- `server/cards/routes.ts`：统一接口下载文件名。
- `src/pages/CardsPage.tsx`：更新导出按钮文案和浏览器下载文件名。
- `tests/server/card-export.test.ts`：重写工作簿内容和排除字段验证。
- `tests/frontend/cards-page.test.tsx`：更新导出入口、请求和下载名验证。
- `docs/本地运行与数据管理.md`：说明精简后的导出范围和数据边界。
- `progress.md`：仅在末尾追加本轮实现、验证和回滚说明。
- 回滚点：仅反向应用本轮导出查询、按钮/文件名、对应测试和文档差异；不需要修改数据库、卡片原文或复盘图片。

## 2026-07-21 - Task: 背诵摇杆抽奖后由用户主动开始

### What was done

- 将背诵封面的摇杆抽奖与会话开始拆成两个明确步骤：摇杆只更新并显示抽中的题数，抽奖结束继续停留封面。
- 用户可继续重抽或手动修改题数；只有点击“开始背诵”后才使用当前题数进入现有会话流程。
- 标准动效、减弱动效和弹簧异常回退均不再自动跳转；删除了仅服务于自动跳转的延迟计时状态。

### Testing

- `npm test -- tests/frontend/study-joystick.test.tsx tests/frontend/study-page.test.tsx`：通过，2 个测试文件、17 项测试全部通过。
- `npm run typecheck`：通过，前端与服务端 TypeScript 检查无错误。
- 用例覆盖点击、键盘抽奖、标准数字滚动、减弱动效、弹簧异常回退、停留封面、无新增会话请求和点击开始后使用当前题数。

### Notes

- `src/pages/StudyPage.tsx`：分离随机题数反馈与会话开始，清理自动跳转状态和计时器。
- `tests/frontend/study-joystick.test.tsx`：覆盖摇杆抽奖后停留封面及主动开始。
- `tests/frontend/study-page.test.tsx`：覆盖减弱动效下的两阶段流程。
- `docs/本地运行与数据管理.md`：说明抽奖、调整题数和主动开始的行为边界。
- `progress.md`：仅在末尾追加本轮实现、验证和回滚说明。
- 回滚点：仅反向应用本轮摇杆抽奖与开始会话解耦、对应测试和文档差异；不需要修改背诵数据、调度状态或数据库。

## 2026-07-21 - Task: 背诵卡片新增 Y/N 复习快捷键

### What was done

- 背诵题目页新增 `Y/y` 与 `N/n` 快捷操作：`Y` 直接提交“记住了”并沿用自动前进/末张结算，`N` 提交“不会”、显示答案并停留当前题。
- 两个快捷键无需先按空格查看答案，且与页面按钮复用同一个复习提交函数，不新增旁路状态。
- 保留空格和左右方向键；输入控件、可编辑区、输入法组合、已处理事件、修饰键、长按重复、提交中、请求锁和已记录题目均不会误触发或重复请求。

### Testing

- 背诵相关 4 个测试文件共 25 项全部通过。
- `npm run typecheck`：通过，前端与服务端 TypeScript 检查无错误。
- 用例覆盖 `Y` 请求体与自动前进、`n` 请求体与停留揭晓、封面保护、可编辑区保护、输入法/组合键/重复事件保护及提交中防重复。

### Notes

- `src/pages/StudyPage.tsx`：把键盘监听放在复习提交函数之后，并接入 `Y/N` 分支。
- `tests/frontend/study-shortcuts.test.tsx`：新增快捷键提交和保护条件测试。
- `docs/本地运行与数据管理.md`：说明 `Y/N` 语义和不触发边界。
- `progress.md`：仅在末尾追加本轮实现、验证和回滚说明。
- 回滚点：仅反向应用本轮 `Y/N` 键盘分支、对应测试和文档差异；不需要修改复习记录、不会次数、调度状态或数据库。
## 2026-07-21 - Task: 修复用户初始稿按卡片分页导致每页不足 20 份
### What was done

- 卡片查询新增 `contentVersion` 口径；用户初始稿模式改为先按有效原始富文本、原始纯文本或卡片编号生成稳定源稿分组，再按源稿组分页。
- 用户初始稿每页现在稳定输出最多 20 份去重后的初始稿，并完整返回当页各初始稿在当前筛选结果中的全部衍生卡片；AI 优化稿继续按单张卡片分页。
- 卡片库切换内容版本时保留筛选条件并回到第一页，所有列表请求携带内容版本；初始稿页头和分页总数统一使用服务端源稿组数量。

### Testing

- `npm test -- tests/server/cards-query.test.ts tests/frontend/cards-page.test.tsx`：通过，2 个测试文件、63 项测试全部通过。
- `npm run typecheck`：通过，前端与服务端 TypeScript 检查无错误。
- 用例覆盖 25 份初始稿、同稿多张衍生卡片、分类过滤、第一页 20 份、第二页 5 份、初始稿切换回第一页和 AI 优化稿原有分页口径。

### Notes

- `shared/contracts.ts`：为卡片查询补充 AI 优化稿与用户初始稿内容版本字段。
- `server/cards/routes.ts`：解析并校验 `contentVersion` 查询参数，省略时保持 AI 优化稿默认行为。
- `server/cards/repository.ts`：增加用户初始稿服务端分组、计数与分组分页查询。
- `src/pages/CardsPage.tsx`：接入内容版本查询并按服务端源稿组总数显示和分页。
- `tests/server/cards-query.test.ts`：覆盖源稿去重后分页、组内完整返回、筛选与旧模式兼容。
- `tests/frontend/cards-page.test.tsx`：覆盖每页 20 份初始稿、组内衍生卡片和版本切换请求。
- `docs/本地运行与数据管理.md`：说明两种内容版本的分页计数与接口返回边界。
- `progress.md`：仅在末尾追加本轮实现、验证和回滚说明。
- 回滚点：仅反向应用本轮 `contentVersion` 查询、初始稿分组分页、对应前端接入、测试和文档差异；不需要修改或回滚任何现有卡片数据。
## 2026-07-21 - Task: 卡片库新增一键置顶和置底并迁移手动排序字段
### What was done

- 经用户明确批准，为 `cards` 新增非空整数 `manual_order` 字段并执行版本 4 迁移；64 张现有卡片全部保留，默认排序值为 `0`。
- 卡片列表统一按手动排序值、创建时间和卡片编号倒序；连续置顶取新的最大值，连续置底取新的最小值，未移动卡片继续保持原创建时间顺序。
- 卡片库新增置顶与置底图标按钮；AI 优化稿移动单卡，用户初始稿一次提交当前分组全部衍生卡片，归档与未归档视图均可操作。
- `PATCH /api/cards/bulk` 新增严格校验的 `position: top | bottom`，实际存在的同批卡片在同一事务中获得相同排序值，缺失编号继续忽略。
- 生产迁移前通过备份接口生成 `data/backups/pre-manual-order-20260721-2345.zip`，随后用最新构建重启 8787 服务并完成迁移。

### Testing

- 整合定向测试：数据库迁移、服务端卡片查询和前端卡片库共 3 个测试文件、84 项测试全部通过。
- `npm test`：通过，37 个测试文件、483 项测试全部通过；同时更新备份恢复用例对当前版本 4 的预期。
- `npm run typecheck`：通过，前端与服务端 TypeScript 检查无错误。
- `npm run build`：通过，客户端与服务端生产构建成功；保留既有客户端主包大于 500KB 的非阻塞提示。
- `git diff --check`：通过，仅输出工作树既有的 LF 到 CRLF 提示。
- 生产核验：`/api/health` 返回 `ok`；数据库版本为 1-4，卡片数迁移前后均为 64，`manual_order` 定义为 `INTEGER NOT NULL DEFAULT 0`，非零值为 0，`integrity_check` 返回 `ok`；用户初始稿接口返回共 23 份，第一页口径为 20 份。

### Notes

- `server/db/migrations/004_card_manual_order.sql`：新增卡片手动排序字段。
- `server/db/migrations.ts`：登记并执行版本 4 迁移。
- `shared/contracts.ts`：为批量卡片操作新增置顶和置底位置契约。
- `server/cards/routes.ts`：严格校验批量位置请求。
- `server/cards/repository.ts`：实现事务内排序赋值，并把两种内容版本查询接入手动排序。
- `src/pages/CardsPage.tsx`：新增置顶、置底图标按钮和整组请求。
- `src/styles/cards-glass.css`：为新增图标按钮保持 44 像素稳定触控尺寸。
- `tests/server/database.test.ts`：覆盖新库字段定义及旧库升级数据保留。
- `tests/server/cards-query.test.ts`：覆盖默认顺序、连续移动、分组顺序、严格校验和事务回滚。
- `tests/server/backups.test.ts`：把真实旧库恢复后的当前迁移版本预期更新为版本 4。
- `tests/frontend/cards-page.test.tsx`：覆盖单卡、初始稿整组、归档视图、失败反馈和可访问名称。
- `docs/本地运行与数据管理.md`：说明按钮行为、排序口径、批量协议和版本 4 迁移。
- `progress.md`：仅在末尾追加本轮实现、验证和回滚说明。
- 回滚点：停止 8787 服务后，通过现有恢复入口使用 `data/backups/pre-manual-order-20260721-2345.zip` 恢复迁移前数据库；代码回滚仅反向应用本轮版本 4 迁移登记、排序协议、查询、前端按钮、测试和文档差异，不得直接对运行中的 SQLite 删除字段。
## 2026-07-21 - Task: 卡片归档后支持彻底删除
### What was done

- 卡片删除事务新增归档状态门槛：未归档卡片返回 409 并保留全部数据和附件文件，只有已归档卡片才执行永久删除。
- 卡片库未归档视图移除删除入口；已归档视图新增“彻底删除”图标按钮和不可撤销确认，AI 优化稿删除单卡，用户初始稿删除当前分组全部衍生卡片。
- 删除成功后沿用现有刷新和页码纠正，删除失败或用户取消时保留当前列表；不存在卡片继续返回 404。

### Testing

- `npm test -- tests/server/cards-query.test.ts tests/frontend/cards-page.test.tsx`：通过，2 个测试文件、75 项测试全部通过。
- `npm run typecheck`：通过，前端与服务端 TypeScript 检查无错误。
- `git diff --check`：通过，仅输出工作树既有的 LF 到 CRLF 提示。
- 用例覆盖未归档无入口与 409 保留、归档后级联删除和附件清理、单卡删除、初始稿整组删除、取消确认、失败反馈及末页删除后的有效页码。

### Notes

- `server/cards/repository.ts`：删除事务增加归档状态校验。
- `src/pages/CardsPage.tsx`：按归档筛选控制彻底删除入口，并支持初始稿整组删除。
- `tests/server/cards-query.test.ts`：更新删除用例，覆盖未归档拒绝及归档后完整清理。
- `tests/frontend/cards-page.test.tsx`：覆盖入口范围、确认、分组、失败和分页行为。
- `docs/本地运行与数据管理.md`：说明归档门槛、前端入口和删除范围。
- `progress.md`：仅在末尾追加本轮实现、验证和回滚说明。
- 回滚点：仅反向应用本轮归档删除门槛、前端入口、对应测试和文档差异；回滚代码不能恢复已经由用户确认彻底删除的卡片或附件，数据恢复必须使用删除前备份。
## 2026-07-22 - Task: 补充归档删除全量验证与状态提示
### What was done

- 补齐本地图片删除回归用例的归档前置步骤，确认归档门槛不会削弱附件记录和本地文件清理验证。
- 将服务端通用 `invalid_state` 提示改为“当前卡片状态不允许此操作”，避免未归档删除被拒绝时显示“不可重新整理”的错误语义。
- 使用最新构建重启 8787 服务，并在生产数据上只读核对卡片总数；对一张未归档卡片发起删除验证得到 409，卡片总数保持 64，未修改用户卡片状态或内容。

### Testing

- `npm test -- tests/server/uploads.test.ts`：通过，10 项测试全部通过。
- `npm test`：通过，37 个测试文件、488 项测试全部通过。
- `npm run build`：通过，客户端与服务端生产构建成功；保留既有客户端主包大于 500KB 的非阻塞提示。
- `git diff --check`：通过，仅输出工作树既有的 LF 到 CRLF 提示。
- 生产核验：`/api/health` 返回 `ok`；未归档卡片删除返回 409，验证前后未归档卡片总数均为 64。

### Notes

- `tests/server/uploads.test.ts`：在附件彻底删除用例中先归档卡片，再验证级联清理。
- `server/cards/routes.ts`：把 `invalid_state` 响应改为适用于重试和删除的中性提示。
- `tests/server/card-create.test.ts`：同步通用状态错误的安全文案预期。
- `progress.md`：仅在末尾追加本轮补充验证、生产核验和回滚说明。
- 回滚点：仅反向应用本轮通用状态提示和图片删除测试的归档前置差异；生产数据未发生排序、归档或删除写入，不需要数据回滚。
## 2026-07-22 - Task: Excel 导出按一级板块拆分工作表
### What was done

- 用户原始内容导出改为按实际有内容的一级板块建立不同 Sheet，二级分类自动归入所属一级板块，“未分类”固定排在最后。
- 同一原始内容在同一一级板块内去重；一份原稿关联多个一级板块时，在对应 Sheet 分别保留。归档和未归档内容继续同时导出，空原文继续排除。
- 每个 Sheet 仍只包含“用户原始内容”一列，不增加分类列，也不导出 AI 内容、富文本 JSON、卡片编号、题面答案、标签或本地敏感数据。
- 完全没有非空原文时，工作簿保留一个只有表头的“未分类”Sheet，确保文件结构有效。

### Testing

- `npm test -- tests/server/card-export.test.ts`：通过，2 项测试全部通过。
- `npm run typecheck`：通过，前端与服务端 TypeScript 检查无错误。
- `git diff --check`：通过，仅输出工作树既有的 LF 到 CRLF 提示。
- 用例覆盖一级板块排序、二级归父级、归档内容、同板块去重、跨板块保留、未分类、空原文、空库单表头和敏感字段隔离。

### Notes

- `server/cards/repository.ts`：按一级板块聚合非空用户原文并生成多工作表数据。
- `tests/server/card-export.test.ts`：重写工作簿结构和内容边界验证。
- `docs/本地运行与数据管理.md`：说明分 Sheet 规则、去重范围和数据边界。
- `progress.md`：仅在末尾追加本轮实现、验证和回滚说明。
- 回滚点：仅反向应用本轮导出分组查询、工作簿测试和文档差异；不修改数据库结构或卡片内容，无需数据回滚。
## 2026-07-22 - Task: 补充 Excel 分板块导出的全量与生产验收
### What was done

- 使用分 Sheet 导出实现完成全量回归和生产构建，并以最新构建重启 8787 服务。
- 在内存中解析真实导出响应，只核对工作表名称和数据行数，不把用户原文写入终端或额外文件。
- 真实数据工作簿按实际有内容的一级板块生成 8 个 Sheet，没有生成旧总表或空板块 Sheet。

### Testing

- `npm test`：通过，37 个测试文件、488 项测试全部通过。
- `npm run build`：通过，客户端与服务端生产构建成功；保留既有客户端主包大于 500KB 的非阻塞提示。
- `git diff --check`：通过，仅输出工作树既有的 LF 到 CRLF 提示。
- 生产核验：`/api/health` 返回 `ok`；`GET /api/cards/export` 返回 200 和 8,133 字节有效 XLSX，工作表为“言语理解、常识判断、定义判断、类比推理、逻辑判断、资料分析、数量关系、申论素材”，对应数据行数为 2、4、2、1、3、8、3、2。

### Notes

- 本轮没有新增源代码差异，仅补充最新构建部署与真实导出验收记录。
- `progress.md`：仅在末尾追加本轮全量测试和生产验收结果。
- 回滚点：生产服务可重启到分 Sheet 实现前的旧构建；本轮未修改数据库结构或卡片内容，无需数据回滚。
## 2026-07-22 - Task: 背诵支持按板块与录入时间选择范围
### What was done

- 在背诵封面新增板块范围和录入时间范围设置；板块支持一级、二级多选，不选择表示全部板块，日期留空表示不限时间。
- 一级板块与所属二级板块自动去除冗余：选择一级时清除其二级项，改选二级时清除所属一级；开始日期晚于结束日期时显示错误并禁止开始。
- 范围设置先保留在封面草稿中，随机摇杆只改变题数；用户主动点击“开始背诵”后才把板块、日期和题数一并写入地址栏并创建会话，既有卡片和标签深链筛选保持不变。
- 使用现有服务端会话筛选能力完成接入，没有修改数据库结构、卡片数据或复习记录。

### Testing

- `npm run typecheck`：通过，前端与服务端 TypeScript 检查无错误。
- 背诵专项回归：通过 6 个测试文件、43 项测试，覆盖范围选择、日期校验、摇杆、快捷键、记住流程和服务端筛选。
- `npm test`：通过，38 个测试文件、492 项测试全部通过。
- `npm run build`：通过，客户端与服务端生产构建成功；保留既有客户端主包大于 500KB 的非阻塞提示。
- 真实浏览器验收：桌面与 390px 窄屏均无控件重叠或横向溢出；选择“资料分析”和 `2026-07-01` 至 `2026-07-22` 后，地址栏同步筛选参数并加载 18 道匹配题面；两次会话请求均返回 200，控制台无错误或警告。
- 生产健康检查：最新构建已在 `http://127.0.0.1:8787` 启动，`/api/health` 返回 `ok`。

### Notes

- `src/pages/StudyPage.tsx`：增加范围草稿、板块层级选择、日期校验和主动开始时的参数同步。
- `src/styles/study-glass.css`：增加浅色玻璃范围面板、层级复选、日期输入及桌面和窄屏适配。
- `tests/frontend/study-range.test.tsx`：新增板块与日期请求、父子去重、非法日期阻断和空日期省略测试。
- `docs/本地运行与数据管理.md`：补充背诵范围选择的规则、生效时机和默认语义。
- `progress.md`：仅在末尾追加本轮实现、验证和回滚说明。
- 回滚方式：仅移除 `StudyPage.tsx` 本轮新增的范围草稿、选择器和 URL 同步逻辑，移除 `study-glass.css` 中 `study-controls__scope` 与 `study-scope__*` 样式，删除 `tests/frontend/study-range.test.tsx`，并恢复本文档对应背诵封面说明；本轮没有数据迁移或业务数据写入，无需数据回滚。
## 2026-07-22 - Task: 背诵范围变化后即时刷新题面总数
### What was done

- 将封面范围选择拆分为只读预览与正式开始两条流程：勾选一级或二级板块、修改有效开始日期或结束日期后，立即刷新封面顶部、书本统计和摇杆可抽上限，页面继续停留在背诵封面。
- 预览复用现有会话接口但只请求一条候选，保留卡片和标签深链筛选；预览不替换题目、进度或当前正式会话，也不修改地址栏。
- 快速连续调整范围时取消旧请求并使用请求序号隔离响应，较慢的旧结果不能覆盖最新范围；非法日期不发预览，预览为零时显示零题并禁用摇杆和开始按钮。
- 用户点击“开始背诵”后才把板块、日期和题数写入地址栏并创建正式随机会话，没有修改数据库结构或用户业务数据。

### Testing

- `npm run typecheck`：通过，前端与服务端 TypeScript 检查无错误。
- 背诵专项回归：通过 7 个测试文件、49 项测试，覆盖即时板块和日期总数、父子去重、深链筛选保留、URL 延后写入、非法范围、零结果、旧响应竞态、摇杆、快捷键和服务端筛选。
- `npm test`：通过，39 个测试文件、498 项测试全部通过。
- `npm run build`：通过，客户端与服务端生产构建成功；保留既有客户端主包大于 500KB 的非阻塞提示。
- 真实浏览器验收：真实数据初始显示 78 道题面，勾选“资料分析”后封面原地更新为 18，地址栏仍为原范围且没有进入题目；开始日期改为 `2026-07-22` 后即时显示 0，摇杆和开始按钮同步禁用。三次会话请求均返回 200，控制台无错误或警告。
- 生产健康检查：最新构建已在 `http://127.0.0.1:8787` 启动，`/api/health` 返回 `ok`。

### Notes

- `src/pages/StudyPage.tsx`：增加只读范围预览、请求取消与竞态保护、预览总数接线和零结果禁用。
- `tests/frontend/study-range-preview.test.tsx`：新增即时总数、日期、深链参数、旧响应、非法范围、零结果和正式开始测试。
- `tests/frontend/study-range.test.tsx`：适配预览请求与正式会话分离后的请求序列。
- `docs/本地运行与数据管理.md`：补充范围预览的触发、生效边界、竞态和零结果规则。
- `progress.md`：仅在末尾追加本轮实现、验证和回滚说明。
- 回滚方式：仅从 `StudyPage.tsx` 移除 `ScopePreview`、范围差异预览副作用、预览总数接线和零结果开始限制，删除 `tests/frontend/study-range-preview.test.tsx`，把 `tests/frontend/study-range.test.tsx` 恢复为无预览请求序列，并恢复本文档对应说明；本轮没有数据迁移或业务数据写入，无需数据回滚。

## 2026-07-23 - Task: 用户初始稿支持编辑并整体重新衍生问题

### What was done

- 卡片库“用户初始稿”视图为每份未归档原稿增加编辑入口，多问题衍生组无需切换到单卡即可修改完整原稿。
- 录入页新增初始稿编辑模式，复用富文本、模板、固定字段、父子分类、用户标签和来源表单；旧衍生题面只读退出本次提交，保存固定使用独立整组重建接口。
- 服务端按现有原稿内容键和归档状态收拢整组，在事务内迁移附件、删除旧衍生卡片及其题面和复习记录、替换分类与标签、重置学习状态，然后重新调用 AI 拆题；新结果替换旧结果，不追加重复问题。
- AI 失败时保存修改后的单张 `pending` 原稿；同原文已归档卡与未归档原稿相互隔离；重新衍生卡继承原组置顶或置底排序值。本轮没有数据库结构迁移。

### Testing

- 初始稿专项回归：`tests/server/card-create.test.ts`、`tests/frontend/cards-page.test.tsx`、`tests/frontend/entry-page.test.tsx` 共 107 项全部通过，覆盖整组替换、字段与标签更新、附件迁移、归档隔离、失败补偿、编辑入口、PUT 请求和旧题面隔离。
- `npm test`：通过，39 个测试文件、502 项测试全部通过。
- `npm run typecheck`：通过，前端与服务端 TypeScript 检查无错误。
- `npm run build`：通过，客户端与服务端生产构建成功；保留既有客户端主包大于 500KB 的非阻塞提示。

### Notes

- `shared/contracts.ts`：增加初始稿完整重写输入与包含衍生数量的响应契约。
- `server/cards/repository.ts`：实现原稿整组事务替换、附件迁移、归档隔离、状态重置、衍生计数及手动排序继承。
- `server/cards/service.ts`：接入原稿重写准备、AI 重新整理和稳定结果返回。
- `server/cards/routes.ts`：增加严格校验的 `PUT /api/cards/:id/original` 接口。
- `src/pages/CardsPage.tsx`：为未归档用户初始稿组增加编辑入口。
- `src/pages/EntryPage.tsx`：增加初始稿编辑模式、独立 PUT 提交和重新衍生结果提示。
- `tests/server/card-create.test.ts`：覆盖整组替换、附件保留、失败待整理、归档隔离和排序继承。
- `tests/frontend/cards-page.test.tsx`：覆盖初始稿组编辑入口和路由参数。
- `tests/frontend/entry-page.test.tsx`：覆盖初始稿 PUT 提交、旧题面隔离和衍生数量反馈。
- `docs/本地运行与数据管理.md`：补充初始稿编辑流程、数据影响、失败边界和接口约定。
- `progress.md`：仅在末尾追加本轮实现、验证和回滚说明。
- 回滚方式：反向应用本轮上述源代码、测试和文档差异即可恢复旧行为；本轮未执行数据库迁移。若用户已实际保存过初始稿，旧衍生题及其复习记录已按业务规则被新结果替换，代码回滚不会自动恢复这些已被替换的数据，需使用操作前备份恢复。

## 2026-07-23 - Task: 补充初始稿编辑的生产与浏览器验收

### What was done

- 使用最新生产构建重启本机服务，只读验收真实卡片库的用户初始稿入口和编辑表单，没有提交或修改用户卡片数据。
- 核对初始稿编辑页完整布局、独立保存按钮和旧衍生题面隔离，确认页面没有可见重叠或文字溢出。

### Testing

- 生产健康检查：`http://127.0.0.1:8787/api/health` 返回 `ok`，服务进程监听 `127.0.0.1:8787`。
- 真实浏览器验收：用户初始稿第一页显示 20 个“编辑初始稿”入口；点击后进入 `/entry?editOriginal=<卡片编号>`，显示“编辑初始稿”和“保存并重新衍生”，不显示旧“背诵题面”编辑区。
- 浏览器控制台：0 个错误、0 个警告；整页截图未发现控件重叠或文字溢出。

### Notes

- `output/playwright/original-draft-edit.png`：保存本轮只读浏览器验收截图，该目录受 Git 忽略，不进入正式源码提交。
- `progress.md`：仅在末尾追加生产健康与浏览器验收证据。
- 回滚方式：停止当前 `8787` 生产进程并启动上一版构建；本轮只读验收未写入卡片数据库，无需数据回滚。截图可直接删除，不影响应用运行。

## 2026-07-25 - Task: 复盘顺序与页码跳转、卡片时间排序及背诵随机初始稿

### What was done

- 复盘管理区新增未归档大板块和小板块上移、下移操作；前端立即更新顺序，失败时回滚并恢复焦点，服务端严格接收完整同级编号并把顺序原子写回现有 v3 `manifest.json`，归档项保持原位置。
- 每个有图片的小板块轮播新增页码输入，按回车或失焦后校正到有效范围并跳转；切换图片或删除导致总数变化时，输入值同步到当前图片。
- 卡片库的 AI 优化稿、用户初始稿分组代表、组间和组内统一改为录入时间优先；原有置顶、置底仍保留，但只在录入时间完全相同时作为次级顺序。
- 新增只读随机初始稿接口，并在背诵页底部加入白色液态玻璃扑克牌抽取组件；只从未归档、原文非空且按来源去重的初始稿中抽取，完整展示原稿富文本、分类和录入时间，不写入背诵记录或卡片数据。
- 同步更新本地运行与数据管理文档，并用最新生产构建在 `http://127.0.0.1:8788` 完成只读浏览器验收；原 `8787` 进程未被强制终止。

### Testing

- `npm test`：通过，40 个测试文件、516 项测试全部通过。
- `npm run typecheck`：通过，前端与服务端 TypeScript 检查无错误。
- `npm run build`：通过，客户端与服务端生产构建成功；保留既有客户端主包大于 500KB 的非阻塞提示。
- 专项合并回归：卡片查询、复盘顺序接口和背诵随机原稿共 46 项通过；复盘管理与轮播前端共 34 项通过。
- 生产接口检查：`/api/health` 返回 `ok`，随机初始稿接口返回可用卡片，复盘目录读取到 6 个大板块和 9 张图片。
- 真实浏览器验收：桌面和 390px 窄屏均无横向溢出；复盘页码从第 1 页输入第 3 页后正确切换，管理区大小板块排序控件在两种视口下均完整显示；背诵抽牌成功显示真实用户初始稿，浏览器控制台 0 个错误、0 个警告。验收未点击真实板块排序按钮，未修改 `manifest.json`。
- `git diff --check`：通过，仅有工作树既有 LF/CRLF 转换提示。

### Notes

- `server/reviewImages/service.ts`：在现有清单写入队列中增加大小板块完整顺序校验与持久化。
- `server/reviewImages/routes.ts`：增加大板块和指定大板块下小板块的顺序更新接口。
- `tests/server/review-board-routes.test.ts`：覆盖合法顺序重启保持及缺失、重复、未知编号不改数据。
- `src/pages/ReviewPage.tsx`：增加大小板块乐观排序、失败回滚、焦点恢复和轮播页码跳转。
- `src/styles/review.css`：增加排序按钮与页码输入的桌面、窄屏和减弱动效样式。
- `tests/frontend/review-board-management.test.tsx`：覆盖完整编号提交、归档槽位保持、相关控件禁用和失败回滚。
- `tests/frontend/review-page.test.tsx`：覆盖页码回车、失焦边界校正、外部切图和图片总数变化同步。
- `server/cards/repository.ts`：统一卡片时间优先排序并增加去重后的随机初始稿查询。
- `server/cards/service.ts`：向路由提供只读随机初始稿详情。
- `server/cards/routes.ts`：增加 `GET /api/cards/random-original` 静态路由。
- `tests/server/cards-query.test.ts`：覆盖旧置顶卡不越过新卡、初始稿各层时间顺序和随机抽取边界。
- `src/pages/StudyPage.tsx`：在所有背诵状态底部接入随机初始稿抽牌组件并复用安全富文本预览。
- `src/styles/study-glass.css`：增加扑克牌抽取、放大、窄屏及减弱动效样式。
- `tests/frontend/study-random-original.test.tsx`：覆盖按需请求、富文本、空库、错误重试和再次抽取。
- `docs/本地运行与数据管理.md`：记录卡片排序、随机初始稿、板块顺序接口和页码跳转规则。
- `progress.md`：仅在末尾追加本轮实现、验证、文件清单与回滚说明。
- 回滚方式：反向应用上述源代码、测试与文档的本轮差异，并重新执行 `npm run build`；本轮未修改数据库结构，也未在真实数据上执行板块排序、上传、删除或复习写入，因此不需要数据回滚。停止 `8788` 进程即可撤销本轮额外验收服务，`output/playwright` 截图可直接删除。

## 2026-07-25 - Task: 背诵初始稿反馈、复盘板块折叠与卡片置顶修复

### What was done

- 背诵页随机初始稿新增“记住了”和“没记住”反馈按钮、本次会话计数及反馈后自动抽取下一份原稿；反馈只保留在当前页面会话，不写入复习记录、FSRS 状态或错题统计。
- 随机初始稿左侧牌组统一使用项目内开国大典图片作为封面，并补齐桌面、窄屏、减少动态效果和降低透明度模式下的交互样式。
- 复盘页每个大板块新增独立收起与展开按钮；收起后只保留板块标题、图片数量和展开入口，重新展开时恢复原小板块、当前图片及页码。
- 修复卡片库置顶失效：确认批量置顶已正确写入 `manual_order`，问题位于列表仍把录入时间放在首要排序；现统一为置顶区、普通区、置底区，区内继续按录入时间和稳定编号排序，用户初始稿的代表卡、组间和组内顺序保持一致。
- 同步更新本地运行与数据管理文档，并用最新生产构建在 `http://127.0.0.1:8789` 完成真实浏览器验收；未改动数据库结构或真实卡片顺序。

### Testing

- 测试驱动红灯：卡片排序先稳定复现 2 项失败、31 项通过；随机初始稿反馈先复现 3 项失败、3 项既有用例通过；复盘折叠先复现 3 项失败、24 项通过，并单独复现 1 项 ARIA 状态失败。
- 专项合并回归：`tests/server/cards-query.test.ts`、`tests/frontend/study-random-original.test.tsx`、`tests/frontend/review-page.test.tsx`、`tests/frontend/review-board-management.test.tsx` 共 75 项全部通过。
- `npm test`：通过，40 个测试文件、520 项测试全部通过。
- `npm run typecheck`：通过，前端与服务端 TypeScript 检查无错误。
- `npm run build`：通过，客户端与服务端生产构建成功；保留既有客户端主包大于 500KB 的非阻塞提示。
- 生产接口检查：`http://127.0.0.1:8789/api/health` 返回 `ok`；随机初始稿接口可用，复盘目录读取到 6 个大板块和 9 张图片。
- 真实浏览器验收：随机初始稿的两类反馈累计为 `1 / 1`，每次反馈后均抽取下一份原稿，网络记录没有 `/api/reviews` 写入；复盘“申论”从第 3 张收起后完全隐藏内容，重新展开仍保持第 3 张；桌面和 390px 窄屏无横向溢出，浏览器控制台 0 个错误、0 个警告。
- `git diff --check`：通过，仅有工作树既有 LF/CRLF 转换提示。

### Notes

- `server/cards/repository.ts`：把 AI 优化稿和用户初始稿查询统一改为置顶区、普通区、置底区排序。
- `tests/server/cards-query.test.ts`：覆盖旧卡置顶、新卡普通排序、置底边界和初始稿分组顺序。
- `src/pages/StudyPage.tsx`：为随机初始稿增加开国大典封面、会话反馈计数、防重复提交和反馈后继续抽取。
- `src/styles/study-glass.css`：补充初始稿封面和双反馈按钮的桌面、窄屏及无障碍动效样式。
- `tests/frontend/study-random-original.test.tsx`：覆盖两类反馈、自动抽取、失败保持、重复保护、会话重置及不写复习接口。
- `src/pages/ReviewPage.tsx`：为每个大板块增加独立折叠状态和可访问的展开、收起入口。
- `src/styles/review.css`：增加板块折叠按钮、展开状态和减少动态效果样式。
- `tests/frontend/review-page.test.tsx`：覆盖默认展开、独立收起、重新展开和页码状态恢复。
- `docs/本地运行与数据管理.md`：记录卡片置顶优先级、初始稿反馈边界和复盘板块折叠规则。
- `progress.md`：仅在末尾追加本轮实现、验证、文件清单与回滚说明。
- 回滚方式：反向应用上述源代码、测试和文档的本轮差异并重新执行 `npm run build`；本轮没有数据库迁移，也未在真实数据上执行卡片置顶、置底、复盘上传、删除或复习写入，无需数据回滚。停止 `8789` 进程即可撤销本轮额外验收服务，`output/playwright` 截图可直接删除。

## 2026-07-25 - Task: 恢复卡片录入时间优先于置顶状态

### What was done

- 将卡片库排序恢复为录入时间第一优先级：新输入内容始终排在较旧置顶卡之前；录入时间相同时，再按置顶、普通、置底和稳定编号排列。
- AI 优化稿列表以及用户初始稿的分组代表、组间和组内排序统一使用该规则；保留既有置顶、置底写入能力，不修改数据库字段或卡片数据。
- 同步更新本地运行与数据管理文档，并使用最新生产构建在 `http://127.0.0.1:8790` 完成只读接口验收。

### Testing

- 测试驱动红灯：修改期望后，`tests/server/cards-query.test.ts` 稳定复现 2 项失败、31 项通过；实际失败结果明确显示旧置顶卡仍压过新录入卡，且用户初始稿仍选择旧置顶卡作为分组代表。
- 定向绿灯：`npm test -- tests/server/cards-query.test.ts` 通过，33 项测试全部通过。
- `npm test`：通过，40 个测试文件、520 项测试全部通过。
- `npm run typecheck`：通过，前端与服务端 TypeScript 检查无错误。
- `npm run build`：通过，客户端与服务端生产构建成功；保留既有客户端主包大于 500KB 的非阻塞提示。
- 生产接口检查：`http://127.0.0.1:8790/api/health` 返回 `ok`；真实卡片接口共返回 169 张，抽查第一页 100 张的录入时间倒序违例为 0。
- `git diff --check`：通过，仅有工作树既有 LF/CRLF 转换提示。

### Notes

- `server/cards/repository.ts`：把共享列表排序恢复为录入时间、人工顺序、稳定编号依次倒序。
- `tests/server/cards-query.test.ts`：覆盖新卡优先于旧置顶卡，以及用户初始稿各层时间优先。
- `docs/本地运行与数据管理.md`：明确新输入内容和置顶卡之间的优先级及同时间处理规则。
- `progress.md`：仅在末尾追加本轮实现、验证、文件清单与回滚说明。
- 回滚方式：反向应用上述四个文件的本轮差异并重新执行 `npm run build`；本轮没有数据库迁移，也未在真实数据上执行置顶、置底或其他写操作，无需数据回滚。停止 `8790` 进程即可撤销本轮额外验收服务。

## 2026-07-25 - Task: 卡片库支持多关键词模糊搜索

### What was done

- 卡片库搜索保留单个连续片段的字面包含匹配，并补充易错点、背诵题目和答案三个搜索来源；现有用户原稿、规范知识、解析、速记、拓展、备注和标签继续参与搜索。
- 搜索文本按连续空白拆分为多个关键词，每个关键词可在同一张卡片的任意搜索来源中命中，多个关键词之间使用 AND；英文匹配不区分大小写，百分号、下划线和注入样式文本仍按字面处理。
- 未修改前端筛选协议、数据库结构、分类和标签精确筛选规则；同步更新本地运行与数据管理文档，并使用最新生产构建在 `http://127.0.0.1:8791` 完成只读验收。

### Testing

- 测试驱动红灯：`tests/server/cards-query.test.ts` 先稳定复现 2 项失败、32 项通过；失败分别证明易错点未被搜索，以及空格分隔的跨字段关键词被错误当成整句。
- 定向绿灯：`npm test -- tests/server/cards-query.test.ts` 通过，34 项测试全部通过。
- `npm test`：通过，40 个测试文件、521 项测试全部通过。
- `npm run typecheck`：通过，前端与服务端 TypeScript 检查无错误。
- `npm run build`：通过，客户端与服务端生产构建成功；保留既有客户端主包大于 500KB 的非阻塞提示。
- 生产接口检查：`http://127.0.0.1:8791/api/health` 返回 `ok`；真实数据搜索“支持”命中 10 张，搜索“支持 做法”按双关键词共同过滤后命中 2 张。
- `git diff --check`：通过，仅有工作树既有 LF/CRLF 转换提示。

### Notes

- `server/cards/repository.ts`：增加搜索分词、逐词组合以及易错点、题目、答案模糊匹配。
- `tests/server/cards-query.test.ts`：覆盖片段匹配、缺失字段、多关键词跨字段组合和特殊字符字面处理。
- `docs/本地运行与数据管理.md`：记录模糊搜索范围、多关键词语义与字符处理规则。
- `progress.md`：仅在末尾追加本轮实现、验证、文件清单与回滚说明。
- 回滚方式：反向应用上述四个文件的本轮差异并重新执行 `npm run build`；本轮没有数据库迁移，也未通过验收接口写入卡片数据，无需数据回滚。停止 `8791` 进程即可撤销本轮额外验收服务。
## 2026-07-25 - Task: 背诵随机初始稿支持独立范围

### What was done

- 为背诵页“随机抽查用户初始稿”增加独立的板块与录入日期范围；板块支持一级、二级多选并沿用父子去重规则，日期留空表示不限制。
- 调整范围后仍停留在当前背诵页面，不自动抽取；旧抽取结果会清空，但本次“记住 / 没记住”计数保留。用户点击抽取后才按新范围请求，反馈后继续沿用同一范围抽取下一份。
- 服务端随机初始稿接口新增严格范围参数校验，先按未归档、板块和录入日期过滤，再按原始来源去重并随机返回；无匹配时返回空结果，日期倒置或未知参数返回 400。
- 本轮没有修改数据库结构，也没有写入或迁移用户卡片数据。

### Testing

- 测试驱动红灯：服务端范围用例先稳定复现 7 项失败、34 项通过；前端交互用例先稳定复现 3 项失败、6 项通过。
- 子任务绿灯：服务端专项 41 项、服务端全量 294 项通过；前端随机初始稿专项 9 项、背诵页相关 44 项通过。
- 合并专项回归：`npm test -- tests/server/cards-query.test.ts tests/frontend/study-random-original.test.tsx tests/frontend/study-range.test.tsx tests/frontend/study-range-preview.test.tsx` 通过，4 个测试文件共 60 项全部通过。
- `npm test`：通过，40 个测试文件、531 项测试全部通过。
- `npm run typecheck`：通过，前端与服务端 TypeScript 检查无错误。
- `npm run build`：通过，客户端与服务端生产构建成功；保留既有客户端主包大于 500KB 的非阻塞提示。
- 生产接口检查：`http://127.0.0.1:8792/api/health` 返回 `ok`；按“资料分析”和 `2026-07-01` 至 `2026-07-25` 抽取到匹配初始稿，日期倒置请求返回 400。
- 真实浏览器验收：调整板块与日期时未触发抽取请求；点击抽取后请求携带完整范围，点击“记住了”后的下一次请求继续使用相同范围；再次改变范围后卡片清空且计数保持为 `1 / 0`。桌面与 390px 窄屏无横向溢出，控制台 0 个错误、0 个警告。

### Notes

- `server/cards/repository.ts`：增加随机初始稿范围过滤、来源去重和匹配代表卡选择。
- `server/cards/service.ts`：把随机初始稿范围传递到仓储查询。
- `server/cards/routes.ts`：解析并严格校验板块与录入日期查询参数。
- `tests/server/cards-query.test.ts`：覆盖板块精确匹配、日期边界、来源去重、空结果和非法参数。
- `src/pages/StudyPage.tsx`：增加独立范围草稿、父子板块选择、日期校验、请求参数和状态重置逻辑。
- `src/styles/study-glass.css`：增加随机初始稿范围面板的桌面、窄屏和降低透明度样式。
- `tests/frontend/study-random-original.test.tsx`：覆盖按需请求、范围参数、反馈续抽、范围变化、计数保持和请求中禁用。
- `docs/本地运行与数据管理.md`：记录随机初始稿范围的操作方式、接口约定和数据边界。
- `progress.md`：仅在末尾追加本轮实现、验证、文件清单与回滚说明。
- 回滚方式：反向应用上述源代码、测试与文档的本轮差异并重新执行 `npm run build`；本轮没有数据库迁移或用户数据写入，无需数据回滚。停止 `8792` 进程即可撤销本轮额外验收服务，`output/playwright` 内截图可直接删除。

## 2026-07-25 - Task: 修复随机初始稿越过所选板块

### What was done

- 修复随机初始稿的一级板块筛选语义：选择一级板块时同时包含直接挂在该板块及其二级板块下的初始稿，选择二级板块时仍只匹配该二级板块，多选范围按并集处理。
- 确认截图中的主要越界还来自旧 `8787` 服务实例；已停止 `8787` 至 `8792` 的六个旧项目实例，并只在 `http://127.0.0.1:8787` 启动最新生产构建。
- 本轮没有修改数据库结构、卡片数据或复习记录。

### Testing

- 测试驱动红灯：新增一级板块包含二级板块用例后，旧实现返回空结果，1 项按预期失败。
- 定向绿灯：卡片查询与随机初始稿前端共 50 项通过；合并专项回归共 81 项通过。
- `npm test`：通过，40 个测试文件、545 项测试全部通过。
- `npm run typecheck`：通过，前端与服务端 TypeScript 检查无错误。
- `npm run build`：通过，客户端与服务端生产构建成功；保留客户端主包大于 500KB 的非阻塞提示。
- 生产接口检查：全部初始稿为 46 份，“资料分析”范围为 10 份；连续抽取 20 次均属于资料分析或其二级板块，日期倒置请求返回 400。
- 真实浏览器验收：勾选“资料分析”后抽取内容的分类为“资料分析 / 基础公式 / 速算技巧”，没有越出所选范围；控制台 0 个错误、0 个警告。

### Notes

- `server/cards/repository.ts`：让随机初始稿的一级板块筛选包含所属二级板块。
- `tests/server/cards-query.test.ts`：覆盖一级板块、二级板块和不相关板块的随机抽取边界。
- `docs/本地运行与数据管理.md`：明确随机初始稿父子板块的匹配口径。
- `progress.md`：仅在末尾追加本轮实现、验证、文件清单与回滚说明。
- 回滚方式：反向应用上述仓储、测试和文档差异并重新执行 `npm run build`；如需恢复旧服务，可停止当前 `8787` 进程并启动上一版构建。本轮没有数据库迁移或用户数据写入，无需数据回滚。

## 2026-07-25 - Task: 总览专注倒计时跨页面持续运行

### What was done

- 专注倒计时改为按绝对结束时间计算，并把时长、剩余时间、运行状态和结束时间保存到当前浏览器本地存储；切换到其他页面、刷新或重新进入总览后会按真实经过时间继续。
- 暂停状态离开页面期间不再消耗时间，倒计时到期后恢复为完成状态；开始、暂停、继续和重置入口保持不变。
- 本轮只调整浏览器本地状态，不写入 SQLite，也不修改学习记录。

### Testing

- 测试驱动红灯：跨页面恢复、暂停恢复和到期恢复 3 项用例在旧实现下均重置为 `05:00`；修复后连同既有计时回归 4 项全部通过。
- Dashboard 专项测试 23 项通过；最终全量测试 545 项、类型检查和生产构建全部通过。
- 真实浏览器验收：5 分钟倒计时运行后离开总览进入卡片库，再返回总览时从 `04:56` 继续减少到 `04:34`，没有停表或重置；刷新后继续计时直至完成。

### Notes

- `src/pages/DashboardPage.tsx`：增加专注倒计时本地持久化、绝对时间计算和恢复逻辑。
- `tests/frontend/dashboard-page.test.tsx`：覆盖运行、暂停、到期和页面重新挂载后的恢复行为。
- `docs/本地运行与数据管理.md`：记录专注倒计时的跨页面行为、本地存储键和数据边界。
- `progress.md`：仅在末尾追加本轮实现、验证、文件清单与回滚说明。
- 回滚方式：反向应用上述页面、测试和文档差异并重新执行 `npm run build`；浏览器中可删除 `gongkao-dashboard-focus-timer-v1` 本地存储键恢复默认计时状态。本轮没有数据库改动。

## 2026-07-25 - Task: 总览改为 AI 衍生问题随机漂浮弹幕

### What was done

- 总览的原时政内容区改为只读卡片库中的 AI 衍生问题；从前 100 张未归档 AI 优化卡片提取题面、去空和去重，每次进入页面随机选择最多 4 条。
- 四条问题使用独立速度和随机相位在白色液态玻璃面板内轻量漂浮，悬停时暂停；真实截图发现整屏位移会造成窄面板长时间空白后，改为始终留在面板内的交错漂浮轨道。
- 减少动态效果模式下改为可滚动静态列表；空数据或只读请求失败时显示明确空态，今日学习统计保持可用。
- 总览生产代码已停止请求 `/api/current-affairs`，也不会触发 DeepSeek、卡片写入或复习记录。

### Testing

- 测试驱动红灯：AI 题面来源、去重及停止请求时政接口 3 项用例在旧实现下失败；修复后全部通过。视觉验收发现弹幕离场后新增 CSS 回归用例，先按预期失败，改为面板内漂浮后通过。
- Dashboard 专项测试 23 项通过；最终全量测试 545 项、类型检查和生产构建全部通过。
- 真实浏览器网络记录只包含 `/api/dashboard`、`/api/settings` 和优化卡片查询，没有 `/api/current-affairs`；桌面与 390 像素视口均完整显示四条问题且无横向溢出，控制台 0 个错误、0 个警告。

### Notes

- `src/pages/DashboardPage.tsx`：读取、去重并随机组织 AI 衍生题面，同时保留学习统计和空态。
- `src/styles/dashboard-glass.css`：增加四轨问题漂浮、悬停暂停和减少动态效果回退，并保证窄面板内持续可见。
- `tests/frontend/dashboard-page.test.tsx`：覆盖题面来源、去重、失败空态、减少动态效果及弹幕不使用整屏位移。
- `docs/本地运行与数据管理.md`：记录 AI 衍生问题的数据来源、展示数量、动效回退和只读边界。
- `progress.md`：仅在末尾追加本轮实现、验证、文件清单与回滚说明。
- 回滚方式：反向应用上述页面、样式、测试和文档差异并重新执行 `npm run build`；本轮没有数据库迁移或用户数据写入，无需数据回滚。

## 2026-07-25 - Task: 初始稿范围实时显示匹配总数

### What was done

- 新增只读初始稿计数接口，计数与实际随机抽取共用同一套未归档、非空原稿、板块、日期和来源去重规则，避免页面显示数量与实际抽取范围不一致。
- 背诵页首次进入即显示全部范围数量；勾选大小板块或调整有效日期后立即刷新为“匹配初始稿 X 份”，仍停留在当前页面且不会自动抽取。
- 快速连续切换范围时取消旧请求并忽略过期响应；日期范围非法时不请求计数，计数请求失败时给出提示但不阻止用户手动抽取。

### Testing

- 测试驱动红灯：新增计数接口和交互用例后 7 项按预期失败、既有 50 项通过；修复后专项测试 58 项全部通过。
- 为新增只读计数请求适配四组既有背诵测试桩；摇杆 7 项、已记住流程 2 项、快捷键 6 项、背诵页 10 项均通过。
- 最终 `npm test` 通过，40 个测试文件、545 项测试全部通过；`npm run typecheck`、`npm run build` 和 `git diff --check` 均通过。
- 生产接口和真实浏览器均确认：全部范围显示 46 份，选择“资料分析”后立即显示 10 份；桌面与 390 像素视口无横向溢出，控制台 0 个错误、0 个警告。

### Notes

- `server/cards/repository.ts`：复用随机初始稿范围查询并增加来源去重后的匹配数量查询。
- `server/cards/service.ts`：向路由提供初始稿范围计数服务。
- `server/cards/routes.ts`：增加 `GET /api/cards/random-original/count` 及严格查询参数校验。
- `src/pages/StudyPage.tsx`：增加初始稿匹配数量状态、即时请求、竞态保护和加载、失败提示。
- `tests/server/cards-query.test.ts`：覆盖计数与抽取口径一致、父子板块、日期和非法参数。
- `tests/frontend/study-random-original.test.tsx`：覆盖初始数量、范围即时刷新、竞态、失败和非法日期。
- `tests/frontend/study-joystick.test.tsx`、`tests/frontend/study-known-flow.test.tsx`、`tests/frontend/study-shortcuts.test.tsx`、`tests/frontend/study-page.test.tsx`：把只读计数请求与正式背诵会话、复习提交断言分离。
- `docs/本地运行与数据管理.md`：记录计数接口、即时刷新、竞态处理和抽取口径。
- `progress.md`：仅在末尾追加本轮实现、验证、文件清单与回滚说明。
- 回滚方式：反向应用上述服务端、前端、测试和文档差异并重新执行 `npm run build`；本轮没有数据库迁移或真实数据写入，无需数据回滚。当前生产服务可继续使用 `http://127.0.0.1:8787`，`output/playwright` 验收截图可直接删除。

## 2026-07-26 - Task: 修复卡片库置顶置底排序无反应

### What was done

- 修复卡片库人工排序失效：列表、用户初始稿分组代表、组间和组内统一先按人工顺序排列，同一人工顺序再按录入时间和稳定编号从新到旧排列。
- 新录入卡片在创建事务内自动取得当前最大人工顺序加一，因此会进入现有全部卡片之前；之后点击任意卡片置顶会取得新的最大顺序，点击置底会取得新的最小顺序，可以反复调整。
- 保留既有置顶、置底按钮、批量位置接口和 `manual_order` 字段，不修改数据库结构，也未在真实卡片数据上执行排序写入。

### Testing

- 测试驱动红灯：仓储旧实现稳定复现 3 项失败、44 项通过；失败分别证明旧卡置顶后仍在原位、新卡没有取得新的最大顺序、用户初始稿分组仍被录入时间压过人工顺序。
- 定向绿灯：`tests/server/cards-query.test.ts` 通过，47 项测试全部通过。
- 卡片专项回归：卡片查询、卡片创建和卡片库前端共 128 项全部通过。
- `npm test`：通过，40 个测试文件、546 项测试全部通过。
- `npm run typecheck`：通过，前端与服务端 TypeScript 检查无错误。
- `npm run build`：通过，客户端与服务端生产构建成功；保留客户端主包大于 500KB 的非阻塞提示。
- 生产只读检查：最新构建已运行在 `http://127.0.0.1:8787`，健康检查返回 `ok`，卡片查询正常返回 197 张；`8788` 至 `8792` 没有旧实例监听。
- `git diff --check`：通过，仅有工作树既有 LF/CRLF 转换提示。

### Notes

- `server/cards/repository.ts`：新卡创建时分配当前最大人工顺序，并把共享列表排序改为人工顺序优先。
- `tests/server/cards-query.test.ts`：覆盖默认新卡在前、旧卡置顶、新卡置底、新录入越过已有置顶卡及初始稿分组顺序。
- `docs/本地运行与数据管理.md`：更新新录入、置顶、置底和同顺序回退规则。
- `progress.md`：仅在末尾追加本轮实现、验证、文件清单与回滚说明。
- 回滚方式：反向应用上述仓储、测试和文档差异并重新执行 `npm run build`，再重启 `8787` 服务；本轮未修改数据库结构或真实卡片顺序，无需数据回滚。

## 2026-07-27 - Task: 卡片库用户初始稿文件夹

### What was done

- 在“用户初始稿”视图顶部新增持久化文件夹，支持新建、展开、收起和删除；初始稿可原生拖入文件夹，也可通过键盘可达的“加入文件夹”菜单建立同一引用。
- 文件夹只保存稳定卡片编号引用，加入后主卡片仍保留在原分页；同一初始稿按来源去重，重复加入不会增加数量或更新时间，删除文件夹不会归档、删除或修改卡片。
- 文件夹内容会从仍存在的锚点卡恢复初始稿来源并展开当前全部衍生卡；真实重写接口测试确认旧衍生卡替换后，新衍生卡仍自动出现在原文件夹。
- SQLite 迁移版本 5 新增文件夹表、关联表、双向级联外键和卡片编号索引；文件夹详情使用固定批量查询，避免查询数量随文件夹卡片数线性增长。
- 文件夹列表、活动内容和主卡片列表分别管理加载与失败状态；快速切换文件夹时旧响应不会覆盖当前内容，系统和项目减弱动效模式都会取消拖入位移。

### Testing

- 后端文件夹与迁移专项通过，2 个测试文件、31 项测试；覆盖迁移、严格参数、同名冲突、幂等加入、来源去重、真实初始稿重写、删除不删卡、安全错误和批量查询。
- 前端卡片库专项通过，54 项测试；覆盖仅在初始稿显示、创建与删除、整组拖放、键盘加入、主列表保留、展开预览、竞态保护和减弱动效。
- 备份恢复专项 49 项通过；旧 v1 数据库恢复后会完整迁移到版本 5。
- `npm test` 最终通过，41 个测试文件、573 项测试全部通过；`npm run typecheck` 通过；`npm run build` 前后端生产构建成功，仅保留既有客户端主包大于 500KB 的非阻塞提示。
- Playwright 在 1440×1000 和 390×844 视口验收：文件夹展开、键盘加入、重复加入、删除确认和删除后主卡片保留均正常；移动端页面宽度为 390 像素且无横向溢出，控制台 0 个错误、0 个警告。截图位于 `output/playwright/card-folders-desktop.png`、`card-folders-expanded.png` 和 `card-folders-mobile-scrolled.png`。

### Notes

- `server/db/migrations/005_card_folders.sql`：新增文件夹、引用关系、级联外键和卡片引用索引。
- `server/db/migrations.ts`：按顺序注册迁移版本 5。
- `shared/contracts.ts`：增加文件夹概要和文件夹内容共享契约。
- `server/cards/repository.ts`：实现文件夹持久化、来源去重、幂等写入和批量详情读取。
- `server/cards/service.ts`：暴露文件夹列表、创建、删除、加入和内容服务。
- `server/cards/routes.ts`：增加五个文件夹接口、严格请求校验和安全错误映射。
- `src/components/CardFolderShelf.tsx`：提供文件夹架、创建、删除、拖放和只读内容预览组件。
- `src/pages/CardsPage.tsx`：接入文件夹独立状态、请求竞态保护、整组拖动和键盘加入入口。
- `src/styles/cards-glass.css`：增加浅色玻璃文件夹、横向滚动、拖入反馈和两类减弱动效回退。
- `tests/server/card-folders.test.ts`：覆盖文件夹端到端服务行为、真实重写和查询数量上限。
- `tests/server/database.test.ts`：更新迁移版本、表与索引断言。
- `tests/server/backups.test.ts`：更新旧数据库恢复后的版本 5 断言。
- `tests/frontend/cards-page.test.tsx`：覆盖文件夹完整前端行为、失败保留和切换竞态。
- `docs/本地运行与数据管理.md`：记录文件夹操作、接口、备份边界和迁移版本 5。
- `docs/superpowers/specs/2026-07-26-card-library-original-folders-design.md`：记录已批准的数据与交互规格。
- `docs/superpowers/plans/2026-07-26-card-library-original-folders-plan.md`：记录测试驱动实施步骤和验收口径。
- `progress.md`：仅在末尾追加本轮实现、验证、文件清单与回滚说明。
- 回滚方式：先停止全部应用进程并备份 `data/gongkao.db`，再反向应用以上文件中的本任务差异并重新构建；不要整文件还原含有既有用户改动的脏文件。若版本 5 已应用且需要完整数据库降级，在备份后使用同一 SQLite 事务依次执行 `DROP TABLE card_folder_items`、`DROP TABLE card_folders` 和 `DELETE FROM schema_migrations WHERE version = 5`，确认提交后再启动回滚代码。
- 运行交付：新版开发服务已使用正式数据目录启动在 `http://127.0.0.1:5173`，后端使用 `8788`；健康检查与文件夹接口均返回 200，正式数据库已完成幂等版本 5 迁移且初始文件夹列表为空。既有 `8787` 进程未停止。

## 2026-07-27 - Task: 显示初始稿文件夹归属并支持单独移出

### What was done

- 用户初始稿主卡片新增文件夹归属标签，可同时显示全部所属文件夹；未归属卡片不显示空占位，AI 优化稿和文件夹内部副本不重复显示。
- 文件夹概要在原有查询中返回仍存在的直接关联卡片编号，主卡片按初始稿整组成员匹配归属；加入或删除文件夹后标签立即同步。
- 文件夹内容卡片新增“移出文件夹”图标按钮，按当前初始稿整组移除引用并刷新文件夹数量、内容和主卡片标签；卡片原文、衍生问题、归档和排序均不改变。
- 新增文件夹卡片移除接口，复用严格编号校验并在事务内只删除指定引用；本轮未修改数据库结构或真实业务数据。

### Testing

- 测试驱动红灯：新增服务端与前端用例分别稳定复现移除接口 404、文件夹预览无移除按钮；实现后转为绿灯。
- 卡片文件夹服务端专项通过，19 项测试；卡片库前端专项通过，56 项测试。
- `npm run typecheck`：通过，前端与服务端 TypeScript 检查无错误。
- `npm run build`：通过，客户端与服务端生产构建成功，仅保留既有客户端主包大于 500KB 的非阻塞提示。
- `npm test -- --maxWorkers=1 --minWorkers=1`：通过，41 个测试文件、577 项测试全部通过；并行全量运行时一个既有背诵范围用例受资源争用超过 5 秒，单文件与单工作线程全量均通过。
- Playwright 使用真实本地数据在 1440×1000 和 390×844 视口验收：归属标签和文件夹内移除按钮可见，页面无横向溢出，控制台 0 个错误；截图位于 `output/playwright/card-folder-remove-desktop.png` 和 `card-folder-remove-mobile.png`。
- `git diff --check`：通过，仅有工作树既有 LF/CRLF 转换提示；开发页 `http://127.0.0.1:5173/cards?contentVersion=original` 与后端健康检查均返回 200。

### Notes

- `shared/contracts.ts`：文件夹概要增加直接关联卡片编号。
- `server/cards/repository.ts`：概要查询返回关联编号，并新增事务内移除文件夹引用。
- `server/cards/service.ts`：增加从文件夹移除卡片组的服务入口。
- `server/cards/routes.ts`：增加文件夹卡片移除接口与严格请求校验。
- `src/components/CardFolderShelf.tsx`：在文件夹副本卡片上增加移出按钮和进行中反馈。
- `src/pages/CardsPage.tsx`：显示主卡片全部文件夹归属，并接入移除后的列表与内容刷新。
- `src/styles/cards-glass.css`：增加紧凑归属标签和移出按钮样式。
- `tests/server/card-folders.test.ts`：覆盖概要关联编号与移除引用不删卡。
- `tests/frontend/cards-page.test.tsx`：覆盖归属展示范围、即时同步和文件夹内单份移出。
- `docs/本地运行与数据管理.md`：记录归属标签、移出行为、接口及数据边界。
- `docs/superpowers/specs/2026-07-26-card-library-original-folders-design.md`：补充归属与移出交互规格。
- `progress.md`：仅在末尾追加本轮实现、验证、文件清单与回滚说明。
- 回滚方式：反向应用上述文件中本任务新增的 `cardIds` 概要字段、移除接口、归属标签、移出按钮、测试与文档差异后重新执行 `npm run build`；本轮无数据库迁移和真实数据写入，无需数据回滚。

## 2026-07-27 - Task: GitHub 发布前隔离本地数据与密钥

### What was done

- 将整个项目源码、测试、中文文档和项目内置 DIY 图片纳入发布范围，同时明确排除真实环境变量、本机数据库、错题图片目录、备份目录、日志、构建产物和浏览器验收产物。
- 补强 Git 忽略规则，覆盖 `.env.*`、SQLite 主文件及 WAL/SHM 文件、独立 `review-images`、`backups` 和日志；保留无密钥的 `.env.example` 作为配置模板。
- 对全部 Git 候选文件与既有提交历史执行密钥检查；本机 `.env` 中已配置的 DeepSeek 密钥未出现在任何候选提交文件中，`.env` 也从未被历史提交跟踪。

### Testing

- `git check-ignore -v`：确认 `.env`、`data/`、`data/gongkao.db`、`output/`、`.tmp/`、`.playwright-cli/`、构建目录和依赖目录均由忽略规则排除。
- 候选文件扫描：共检查 137 个待发布文件，本机已配置 DeepSeek 密钥命中 0 次；检测到的两处密钥样式均为服务端测试中的固定假值。
- 历史检查：`.env` 无提交记录；DeepSeek 配置命中仅来自备份测试构造的假环境变量内容。
- GitHub 目标检查：`git-nyf/gongkaofupan` 为公开空仓库，可作为本项目首次发布目标。

### Notes

- `.gitignore`：补充环境文件、数据库、错题图片、备份和日志忽略规则，并继续允许提交 `.env.example`。
- `progress.md`：仅在末尾追加本轮安全审计、验证、文件清单与回滚说明。
- 回滚方式：执行 `git restore --source=HEAD -- .gitignore progress.md` 可撤销本轮发布前隔离记录；若已经产生后续提交，应使用 `git revert <提交编号>`，不要删除本机 `data/`、`.env` 或错题图片。

## 2026-07-27 - Task: 编写带隐私打码截图的项目 README

### What was done

- 将根目录 README 扩展为完整项目说明，覆盖总览、录入、背诵、卡片库、错题复盘、DIY 设置、数据隐私、系统结构、启动方式、常用命令和目录职责。
- 使用真实运行页面生成六张 1440×960 界面截图；卡片正文、AI 题面、答案、错题图片、文件夹和板块名称、统计数量及本机配置均在截图生成阶段直接打码。
- 截图采用压缩 JPEG 并纳入正式文档资源，六张图片合计小于 600 KB，不引用本机临时输出目录或真实用户数据。

### Testing

- Playwright 依次打开总览、录入、背诵、卡片库、复盘和设置六个路由并完成截图，浏览器控制台错误数为 0。
- 人工逐张检查六张截图：页面构图完整，卡片正文与本机数据不可辨认，复盘错题原图已转换为强模糊灰阶轮廓。
- 文档资源检查：六张图片均存在，分辨率统一为 1440×960，README 中的六个截图引用和数据管理文档引用均可解析。
- `git check-ignore -v`：确认 `.env`、`data/`、Playwright 会话和临时截图继续被忽略，正式 README 图片位于 `docs/readme-assets/`。
- `git diff --check`：通过，仅有工作树既有 LF/CRLF 转换提示；本轮未修改业务代码，因此未重复执行代码测试套件。

### Notes

- `README.md`：重写为覆盖系统能力、隐私边界、架构和运行方式的中文项目首页。
- `docs/readme-assets/readme-dashboard.jpg`：新增已打码的总览页面截图。
- `docs/readme-assets/readme-entry.jpg`：新增录入页面截图。
- `docs/readme-assets/readme-study.jpg`：新增已隐藏题量的背诵封面截图。
- `docs/readme-assets/readme-cards.jpg`：新增已隐藏正文、文件夹与统计的卡片库截图。
- `docs/readme-assets/readme-review.jpg`：新增已隐藏板块信息并强模糊错题原图的复盘截图。
- `docs/readme-assets/readme-settings.jpg`：新增设置与 DIY 主题页面截图。
- `progress.md`：仅在末尾追加本轮文档、隐私处理、验证和回滚记录。
- 回滚方式：执行 `git restore -- README.md progress.md`，再执行 `Remove-Item -LiteralPath @('docs\\readme-assets\\readme-dashboard.jpg','docs\\readme-assets\\readme-entry.jpg','docs\\readme-assets\\readme-study.jpg','docs\\readme-assets\\readme-cards.jpg','docs\\readme-assets\\readme-review.jpg','docs\\readme-assets\\readme-settings.jpg')` 删除本轮新增截图；本轮未修改业务代码和本机数据，无需数据回滚。

## 2026-07-31 - Task: 优化初始稿文件夹换行排列并增加原卡定位

### What was done

- 将用户初始稿文件夹从横向滚动列表改为固定 220 像素卡片网格，按可用宽度自动换行，宽屏每行最多六个，后续文件夹进入下一行。
- 文件夹内每份初始稿新增“定位原卡”链接；目标已在当前列表时直接滚动，受筛选或分页遮挡时自动按原稿检索并回到第一页，再聚焦和短暂高亮对应主卡片。
- 定位过程只调整卡片库当前筛选和视口，不修改卡片内容、人工排序、归档状态或文件夹引用。

### Testing

- 测试驱动红灯：新增网格样式和原卡定位用例，分别稳定复现现有横向滚动布局与缺少定位链接；实现后卡片库专项 58 项全部通过。
- `npm run typecheck`：通过，前端与服务端 TypeScript 检查无错误。
- `npm run build`：通过，客户端与服务端生产构建成功，仅保留既有客户端主包大于 500KB 的非阻塞提示。
- `npm test -- --maxWorkers=1 --minWorkers=1`：通过，41 个测试文件、579 项测试全部通过。
- Playwright 使用临时网络模拟的 8 个文件夹验收：1720×950 视口首行 6 个且共 2 行，390×844 视口无横向溢出；定位后目标主卡获得焦点、描边高亮并进入视区，控制台错误数为 0。
- `git diff --check`：通过，仅有工作树既有 LF/CRLF 转换提示。

### Notes

- `src/components/CardFolderShelf.tsx`：在文件夹副本操作区新增语义化原卡定位链接。
- `src/pages/CardsPage.tsx`：接入跨筛选和分页的原稿检索、滚动聚焦及临时高亮状态。
- `src/styles/cards-glass.css`：将文件夹列表改为最多六列的固定尺寸换行网格，并增加定位链接和目标高亮样式。
- `tests/frontend/cards-page.test.tsx`：覆盖六列换行规则、筛选重置、滚动聚焦和高亮结果。
- `README.md`：补充文件夹换行排列与原卡定位能力说明。
- `docs/本地运行与数据管理.md`：记录定位时的筛选变化、视觉反馈和数据不变边界。
- `progress.md`：仅在末尾追加本轮实现、验证、文件清单与回滚说明。
- 回滚方式：执行 `git restore -- README.md docs/本地运行与数据管理.md progress.md src/components/CardFolderShelf.tsx src/pages/CardsPage.tsx src/styles/cards-glass.css tests/frontend/cards-page.test.tsx` 可撤销本轮全部改动；本轮无数据库迁移和真实业务数据写入，无需数据回滚。

## 2026-08-01 - Task: 新增球状 3D 知识图谱

### What was done

- 新增独立“图谱”板块，进入 `/graphs` 后展示球状 3D 知识图谱，支持多图谱切换、预览自转、编辑模式、卡片拖入建点、节点拖动保存坐标、节点详情和关系标签编辑。
- 新增知识图谱数据库迁移、共享类型、服务端仓储和 `/api/knowledge-maps` 路由，覆盖图谱、节点和关系的增删改查，并通过外键级联处理卡片删除后的图谱清理。
- 前端沿用液态玻璃视觉体系，加入右侧卡片搜索、详情和关系面板；预览模式下自转可被用户点击、拖拽、滚轮和聚焦动作中断，减少动态效果时保持静态 3D 视图。
- 同步补充中文使用说明，明确入口、预览、编辑、关系、迁移数据和验证方式。

### Testing

- `npm run typecheck`：通过，前端与服务端 TypeScript 检查无错误。
- `npx vitest run tests/server/database.test.ts tests/server/knowledge-maps.test.ts tests/frontend/graphs-page.test.tsx tests/frontend/app-shell.test.tsx tests/frontend/app.test.tsx`：通过，5 个测试文件、43 项测试全部通过。
- `npm test`：通过，43 个测试文件、584 项测试全部通过。
- `npm run build`：通过，客户端与服务端生产构建成功；客户端主包因新增 3D/WebGL 依赖超过 500KB，构建仅输出非阻塞提示。
- Playwright 真实生产服务验证：使用临时数据库打开 `/graphs`，桌面 1440×900 与移动 390×844 视口均生成非空 canvas；两帧 canvas 截图像素校验不同，确认预览自转可见；右侧面板与 3D 主操作区在两个视口下均可见。
- `git diff --check`：通过，仅有工作树既有 LF/CRLF 转换提示。
- `npm audit --omit=dev --audit-level=critical`：通过，无 critical；当前依赖树仍提示 3 个 high，涉及 `brace-expansion` 与 `react-router/react-router-dom`，本轮未执行 `npm audit fix` 以避免扩大升级范围。

### Notes

- `package.json`：新增 `react-force-graph-3d` 运行依赖。
- `package-lock.json`：锁定 3D 图谱依赖及其 WebGL/ThreeJS 相关传递依赖。
- `shared/contracts.ts`：新增知识图谱摘要、详情、节点和关系共享类型。
- `server/db/migrations/006_knowledge_maps.sql`：新增图谱、节点和关系三张 SQLite 表及索引、唯一约束和级联外键。
- `server/db/migrations.ts`：接入版本 6 数据库迁移。
- `server/knowledgeMaps/repository.ts`：新增知识图谱数据访问、约束映射和图谱更新时间维护。
- `server/knowledgeMaps/service.ts`：新增知识图谱业务服务，并把节点映射到现有卡片详情。
- `server/knowledgeMaps/routes.ts`：新增 `/api/knowledge-maps` 路由和错误响应。
- `server/app.ts`：挂载知识图谱 API 路由。
- `server/index.ts`：生产启动时创建并注入知识图谱服务。
- `src/App.tsx`：新增 `/graphs` 页面路由。
- `src/components/AppShell.tsx`：在主导航加入“图谱”入口。
- `src/pages/GraphsPage.tsx`：新增球状 3D 图谱页面、卡片拖入、节点详情、关系编辑和自转控制。
- `src/styles/graphs.css`：新增图谱页面液态玻璃布局、画布、侧栏、详情和关系面板样式。
- `tests/server/database.test.ts`：补充版本 6 迁移、表和索引断言。
- `tests/server/knowledge-maps.test.ts`：新增知识图谱 API、约束和卡片删除级联测试。
- `tests/server/backups.test.ts`：同步真实旧库恢复后的迁移版本断言到版本 6。
- `tests/server/card-folders.test.ts`：同步从版本 4 迁移后的版本断言到版本 6。
- `tests/frontend/graphs-page.test.tsx`：新增图谱页面预览、编辑、拖入节点和关系标签测试。
- `docs/知识图谱.md`：新增图谱使用、数据和验证说明。
- `progress.md`：仅在末尾追加本轮实现、验证、文件清单与回滚说明。
- 回滚方式：代码层执行 `git restore -- package.json package-lock.json shared/contracts.ts server/app.ts server/db/migrations.ts server/index.ts src/App.tsx src/components/AppShell.tsx tests/server/backups.test.ts tests/server/card-folders.test.ts tests/server/database.test.ts progress.md`，再执行 `Remove-Item -LiteralPath @('server\db\migrations\006_knowledge_maps.sql','server\knowledgeMaps','src\pages\GraphsPage.tsx','src\styles\graphs.css','tests\frontend\graphs-page.test.tsx','tests\server\knowledge-maps.test.ts','docs\知识图谱.md') -Recurse -Force` 删除本轮新增文件；若真实数据库已运行版本 6 迁移，应先备份数据库，再恢复迁移前备份，或执行 `DROP TABLE knowledge_map_edges; DROP TABLE knowledge_map_nodes; DROP TABLE knowledge_maps; DELETE FROM schema_migrations WHERE version = 6;` 后重新启动应用。

## 2026-08-01 - Task: 修复图谱创建按钮和导航位置

### What was done

- 修复图谱页空输入点击“添加图谱”没有反应的问题；现在未填写名称时会自动创建不重名的默认图谱名称。
- 将左侧主导航中的“图谱”入口移动到倒数第二位，位于“设置”前面。
- 同步更新图谱使用说明，并补充前端回归测试覆盖默认创建和导航顺序。

### Testing

- `npm run typecheck`：通过，前端与服务端 TypeScript 检查无错误。
- `npx vitest run tests/frontend/graphs-page.test.tsx tests/frontend/app-shell.test.tsx`：通过，2 个测试文件、27 项测试全部通过。
- `npm test`：通过，43 个测试文件、586 项测试全部通过。
- `npm run build`：通过，客户端与服务端生产构建成功；客户端主包仍有 3D/WebGL 依赖导致的大包非阻塞提示。

### Notes

- `src/pages/GraphsPage.tsx`：空名称创建图谱时自动生成默认名称，并把创建按钮可访问名称改为“添加图谱”。
- `src/components/AppShell.tsx`：调整主导航顺序，将“图谱”移动到“设置”前。
- `tests/frontend/graphs-page.test.tsx`：新增空输入点击添加图谱的回归测试。
- `tests/frontend/app-shell.test.tsx`：新增主导航顺序断言，并将图谱入口纳入固定入口检查。
- `docs/知识图谱.md`：补充直接点击“添加图谱”会自动生成默认名称的说明。
- `progress.md`：仅在末尾追加本轮修复、验证、文件清单与回滚说明。
- 回滚方式：执行 `git restore -- src/pages/GraphsPage.tsx src/components/AppShell.tsx tests/frontend/graphs-page.test.tsx tests/frontend/app-shell.test.tsx docs/知识图谱.md progress.md` 可撤销本轮修复；本轮未新增数据库迁移，也不会修改真实业务数据。

## 2026-08-01 - Task: 强化图谱添加链路

### What was done

- 将空名称默认图谱生成下沉到服务端，前端空输入时发送空对象，由后端按数据库真实状态创建 `知识图谱 N`。
- 图谱创建失败时在左侧创建区显示明确错误提示，不再只把顶部状态改成“保存失败”。
- 保持手动输入同名图谱仍然拒绝的原规则，避免默默创建用户未指定的新名称。

### Testing

- `npm run typecheck`：通过，前端与服务端 TypeScript 检查无错误。
- `npx vitest run tests/server/knowledge-maps.test.ts tests/frontend/graphs-page.test.tsx tests/frontend/app-shell.test.tsx`：通过，3 个测试文件、30 项测试全部通过。
- `npm test`：通过，43 个测试文件、586 项测试全部通过。
- `npm run build`：通过，客户端与服务端生产构建成功；客户端主包仍有 3D/WebGL 依赖导致的大包非阻塞提示。
- Playwright 真实生产服务验证：使用临时数据库打开 `/graphs`，直接点击创建区按钮后接口返回 1 张图谱，页面标题变为 `知识图谱 1`，错误提示数量为 0。

### Notes

- `server/knowledgeMaps/routes.ts`：创建图谱接口允许缺省名称，并继续限制显式名称长度。
- `server/knowledgeMaps/service.ts`：新增服务端默认图谱名称生成逻辑。
- `src/pages/GraphsPage.tsx`：空输入时发送空对象，并显示创建失败原因。
- `src/styles/graphs.css`：新增创建错误提示样式。
- `tests/server/knowledge-maps.test.ts`：覆盖空对象创建默认图谱。
- `tests/frontend/graphs-page.test.tsx`：同步空输入创建请求断言。
- `progress.md`：仅在末尾追加本轮修复、验证、文件清单与回滚说明。
- 回滚方式：执行 `git restore -- server/knowledgeMaps/routes.ts server/knowledgeMaps/service.ts src/pages/GraphsPage.tsx src/styles/graphs.css tests/server/knowledge-maps.test.ts tests/frontend/graphs-page.test.tsx progress.md` 可撤销本轮强化；本轮未新增数据库迁移，真实数据无需回滚。

## 2026-08-01 - Task: 优化图谱一屏布局与确认式连线

### What was done

- 将图谱页高度收敛到当前工作区一屏内，图谱列表、卡片搜索、详情和关系面板改为各自内部滚动，不再把整页撑长。
- 图谱加载后自动居中适屏，并在工具栏新增“居中”按钮，方便从缩放或拖动状态快速回到中心视野。
- 参考 `nashsu/llm_wiki` 的适屏和明确操作思路，保留当前 3D 球状视觉，优化为编辑模式下可直接点击“连线”，再选择起点、目标、标签，最后点击“创建关系”才保存。
- 关系预设标签在创建前即可选择；已存在关系仍可点击关系线后改标签或删除。

### Testing

- `npm run typecheck`：通过，前端与服务端 TypeScript 检查无错误。
- `npx vitest run tests/frontend/graphs-page.test.tsx tests/frontend/app-shell.test.tsx tests/server/knowledge-maps.test.ts`：通过，3 个测试文件、30 项测试全部通过。
- `npm test`：通过，43 个测试文件、586 项测试全部通过。
- `npm run build`：通过，客户端与服务端生产构建成功；客户端主包仍有 3D/WebGL 依赖导致的大包非阻塞提示。
- Playwright 真实生产服务验证：桌面 1440×900 与移动 390×844 视口下 `scrollHeight` 均等于视口高度，canvas 非空且保留在一屏内；编辑后点击工具栏“连线”可打开关系面板。

### Notes

- `src/pages/GraphsPage.tsx`：新增居中适屏控制、加载后自动居中、工具栏连线入口和确认式关系创建流程。
- `src/styles/graphs.css`：调整图谱页为一屏固定工作区，侧栏和面板内部滚动，并新增待创建关系确认区样式。
- `tests/frontend/graphs-page.test.tsx`：覆盖居中按钮和确认后才创建关系的前端行为。
- `docs/知识图谱.md`：更新一屏布局、居中按钮和确认式连线说明。
- `progress.md`：仅在末尾追加本轮优化、验证、文件清单与回滚说明。
- 回滚方式：执行 `git restore -- src/pages/GraphsPage.tsx src/styles/graphs.css tests/frontend/graphs-page.test.tsx docs/知识图谱.md progress.md` 可撤销本轮优化；本轮未新增数据库迁移，真实数据无需回滚。

## 2026-08-01 - Task: 优化图谱 2D 编辑与 3D 预览

### What was done

- 将图谱编辑模式改为 2D 平面关系编辑：进入编辑后中间区域显示可拖拽的 2D 圆盘，用户在平面内移动节点、选择节点并创建关系，降低 3D 空间连线的操作难度。
- 保留预览模式的 3D 球形知识图谱：退出编辑后自动把 2D 平面坐标投影为球面 `x/y/z` 坐标，并继续以 3D 球状自转方式展示。
- 参考 `nashsu/llm_wiki` 的图谱浏览思路，在 Apple Design 风格基础上补充板块、关系、掌握度三种视图，增加关系权重、悬停邻域高亮、图例、统计信息和孤立节点提示。
- 调整卡片拖入和节点移动保存逻辑：编辑模式下拖入到 2D 圆盘即可建点，拖动已有节点会保存投影后的 3D 坐标；本轮未修改数据库结构。

### Testing

- `npm run typecheck`：通过，前端与服务端 TypeScript 检查无错误。
- `npx vitest run tests/frontend/graphs-page.test.tsx tests/frontend/app-shell.test.tsx tests/server/knowledge-maps.test.ts`：通过，3 个测试文件、30 项测试全部通过。
- `npm test`：通过，43 个测试文件、586 项测试全部通过。
- `npm run build`：通过，客户端与服务端生产构建成功；客户端主包仍有 3D/WebGL 依赖导致的大包非阻塞提示。
- Playwright 真实生产服务验证：使用临时数据库打开 `/graphs`，预览模式存在 3D canvas；切换编辑后显示 2D 关系编辑平面且不再显示 3D canvas；拖动 2D 节点后保存状态出现，接口返回的节点 `x/y/z` 坐标已变化；退出编辑后 3D canvas 恢复显示。

### Notes

- `src/pages/GraphsPage.tsx`：新增 2D 编辑平面、平面与球面坐标投影、视图模式、悬停邻域高亮、关系权重和图谱统计展示。
- `src/styles/graphs.css`：新增 2D 平面编辑器、关系标签、节点拖拽反馈、图谱状态栏和视图切换控件样式。
- `tests/frontend/graphs-page.test.tsx`：更新图谱页测试，覆盖编辑模式显示 2D 平面、视图切换和关系创建流程。
- `docs/知识图谱.md`：更新图谱使用说明，说明编辑走 2D 平面、预览自动转为 3D 球形展示。
- `progress.md`：仅在末尾追加本轮优化、验证、文件清单与回滚说明。
- 回滚方式：执行 `git restore -- src/pages/GraphsPage.tsx src/styles/graphs.css tests/frontend/graphs-page.test.tsx docs/知识图谱.md progress.md` 可撤销本轮优化；本轮未新增数据库迁移，真实数据无需回滚。

## 2026-08-01 - Task: 图谱自定义节点与层级思维导图

### What was done

- 新增图谱节点扩展迁移，支持不绑定卡片的自定义知识点，并保存标题、正文、层级和球面坐标。
- 将图谱编辑态改为按层级分列的 2D 思维导图，用户可直接添加自定义知识点，也可继续从卡片库拖入卡片。
- 修复 2D 节点拖动吸附错位问题，拖动时保留按下位置相对节点中心的偏移，松手后按所在层级保存。
- 将 3D 预览改为红色系层级展示，节点大小由层级和连接数共同决定，关系强度由关系标签和层级差共同决定。
- 统一默认层级规则：自定义节点未指定层级时默认第 1 层，卡片节点和旧版图谱节点默认第 2 层。

### Testing

- `npm run typecheck`：通过，前端与服务端 TypeScript 检查无错误。
- `npx vitest run tests/frontend/graphs-page.test.tsx tests/server/knowledge-maps.test.ts tests/server/database.test.ts tests/server/backups.test.ts tests/server/card-folders.test.ts`：通过，5 个测试文件、96 项测试全部通过。
- `npm test`：通过，43 个测试文件、594 项测试全部通过。
- `npm run build`：通过，客户端与服务端生产构建成功；客户端主包仍有 3D/WebGL 依赖导致的大包非阻塞提示。
- Playwright 真实生产服务验证：使用临时数据库打开 `/graphs`，创建默认图谱后新增 2 个自定义节点和 1 条关系；拖动节点后层级从 3 变为 6；桌面 1440×900 与移动 390×844 视口下页面均保持一屏；图谱区域截图像素检查通过，桌面红色像素 1151，移动红色像素 231；控制台无应用错误，仅有 Playwright 截图触发的 WebGL `ReadPixels` 性能警告。
- Playwright 截图位置：`C:\Users\ROG\AppData\Local\Temp\gongkao-graphs-e2e-output\graphs-desktop.png`、`C:\Users\ROG\AppData\Local\Temp\gongkao-graphs-e2e-output\graphs-mobile.png`、`C:\Users\ROG\AppData\Local\Temp\gongkao-graphs-e2e-output\graphs-desktop-canvas.png`、`C:\Users\ROG\AppData\Local\Temp\gongkao-graphs-e2e-output\graphs-mobile-canvas.png`。

### Notes

- `shared/contracts.ts`：扩展图谱节点契约，支持可空 `cardId`、自定义标题正文、层级和节点创建/更新输入。
- `server/db/migrations.ts`：注册第 7 号知识图谱节点扩展迁移。
- `server/db/migrations/007_knowledge_map_custom_nodes.sql`：重建图谱节点和关系表，增加自定义节点字段、层级约束和兼容旧节点的默认层级。
- `server/knowledgeMaps/repository.ts`：支持可空卡片节点、自定义节点字段、层级持久化和节点详情更新。
- `server/knowledgeMaps/service.ts`：返回自定义节点 `card: null`，并统一节点层级默认值与校验。
- `server/knowledgeMaps/routes.ts`：放开自定义节点创建和节点详情更新参数，并拒绝完全空的自定义节点。
- `src/pages/GraphsPage.tsx`：实现 2D 思维导图编辑、自定义知识点表单、拖动偏移修复、按层级投影 3D 红色预览和关系强度计算。
- `src/styles/graphs.css`：新增 2D 层级导轨、自定义知识点表单、红色节点、关系标签和详情编辑样式。
- `tests/frontend/graphs-page.test.tsx`：覆盖自定义节点、卡片拖入层级、2D 拖动保存、关系创建和 3D 红色层级显示。
- `tests/server/database.test.ts`：覆盖迁移版本、节点扩展字段、层级约束和 v6 到 v7 升级兼容。
- `tests/server/knowledge-maps.test.ts`：覆盖自定义节点创建更新、空节点拒绝、层级校验、关系和卡片删除级联。
- `tests/server/backups.test.ts`：同步当前迁移版本断言。
- `tests/server/card-folders.test.ts`：同步当前迁移版本断言。
- `docs/知识图谱.md`：更新图谱使用说明、2D 编辑、3D 预览、层级关系和迁移说明。
- `progress.md`：仅在末尾追加本轮实现、验证、文件清单与回滚说明。
- 回滚方式：执行 `git restore -- shared/contracts.ts server/db/migrations.ts server/knowledgeMaps/repository.ts server/knowledgeMaps/service.ts server/knowledgeMaps/routes.ts src/pages/GraphsPage.tsx src/styles/graphs.css tests/frontend/graphs-page.test.tsx tests/server/database.test.ts tests/server/knowledge-maps.test.ts tests/server/backups.test.ts tests/server/card-folders.test.ts docs/知识图谱.md progress.md` 恢复已跟踪文件，并删除 `server/db/migrations/007_knowledge_map_custom_nodes.sql`。如果真实数据库已执行版本 7，先备份数据库，再还原到执行版本 7 前的备份；旧结构无法保留不绑定卡片的自定义节点。

## 2026-08-01 - Task: 修复图谱添加失败与树形编辑

### What was done

- 修复自定义知识点正文为空时添加失败的问题，前端现在发送空字符串，不再发送 `null`。
- 左侧新增当前图谱重命名表单，调用已有图谱重命名接口，并保留重名和空名称错误提示。
- 将 2D 编辑态从自由分层圆点改为树形思维导图视觉：节点按层级横向展开，关系线以分叉曲线连接，节点改为圆角条目样式。
- 自定义知识点默认层级调整为第 1 层，更符合树形思维导图从根节点开始搭建的用法。
- 更新知识图谱文档，补充重命名、空正文自定义节点和 2D 树形思维导图说明。

### Testing

- `npm run typecheck`：通过，前端与服务端 TypeScript 检查无错误。
- `npx vitest run tests/frontend/graphs-page.test.tsx tests/server/knowledge-maps.test.ts tests/server/database.test.ts`：通过，3 个测试文件、30 项测试全部通过。
- `npm test`：通过，43 个测试文件、596 项测试全部通过。
- `npm run build`：通过，客户端与服务端生产构建成功；客户端主包仍有 3D/WebGL 依赖导致的大包非阻塞提示。
- Playwright 真实生产服务验证：使用临时数据库打开 `/graphs`，新建图谱后重命名为“数量关系图谱”；进入编辑态后添加标题为“数量关系”、正文为空、层级为 1 的自定义节点；页面没有出现添加失败提示；接口返回节点 `content: ""`、`level: 1`、`cardId: null`；桌面和移动视口均能看到 2D 树形节点。
- Playwright 截图位置：`C:\Users\ROG\AppData\Local\Temp\gongkao-graphs-fix-e2e-output\graphs-tree-desktop.png`、`C:\Users\ROG\AppData\Local\Temp\gongkao-graphs-fix-e2e-output\graphs-tree-mobile.png`。

### Notes

- `src/pages/GraphsPage.tsx`：修复空正文创建请求，新增图谱重命名表单与逻辑，改造 2D 编辑点位和连线为树形思维导图布局。
- `src/styles/graphs.css`：新增重命名表单样式，调整 2D 编辑区背景、关系线和节点为树形导图视觉。
- `tests/frontend/graphs-page.test.tsx`：覆盖图谱重命名、空正文自定义知识点添加和树形编辑平面。
- `docs/知识图谱.md`：同步重命名、空正文自定义节点和树形 2D 编辑说明。
- `progress.md`：仅在末尾追加本轮修复、验证、文件清单与回滚说明。
- 回滚方式：执行 `git restore -- src/pages/GraphsPage.tsx src/styles/graphs.css tests/frontend/graphs-page.test.tsx docs/知识图谱.md progress.md` 可撤销本轮修复；本轮未新增数据库迁移，真实数据无需结构回滚。

## 2026-08-02 - Task: 修复刷新后图谱节点添加失败并简化树形图谱控件

### What was done

- 定位刷新后仍提示“知识点添加失败”的直接原因：`8787` 端口运行的是旧的 `dist-server/index.js` 生产进程，浏览器刷新仍命中旧构建，旧构建会拒绝自定义知识点新增请求。
- 重新执行生产构建并重启 `8787` 服务，新进程已加载包含自定义知识点修复的新构建。
- 进一步兼容后端节点创建参数，允许自定义节点正文为空字符串或 `null`，但仍拒绝标题和正文都为空的无效知识点。
- 将图谱编辑收敛为树形思维导图：移除顶部“层级 / 关系 / 掌握”切换和“居中”按钮，移除右侧“关系”页签、关系标签编辑、关系删除入口和详情中的手动层级输入。
- 分支关系改为纯自动维护：选中父节点后添加知识点或卡片会自动生成父子分支，2D 分支线只展示和高亮，不再作为可编辑关系按钮。

### Testing

- `npm run typecheck`：通过，前端与服务端 TypeScript 检查无错误。
- `npm test -- tests/frontend/graphs-page.test.tsx`：通过，12 项图谱前端测试全部通过，覆盖旧控件移除、自定义节点添加、卡片分支添加和分支线展示。
- `npm test -- tests/server/knowledge-maps.test.ts`：通过，5 项图谱服务端测试全部通过，覆盖空正文、`null` 正文和空节点拒绝。
- `npm run build`：通过，客户端与服务端生产构建成功；客户端主包仍有 3D/WebGL 依赖导致的大包非阻塞提示。
- `npm test`：通过，43 个测试文件、599 项测试全部通过。
- `8787` 生产服务接口验证：新构建启动后，直接调用 `/api/knowledge-maps/:id/nodes` 成功创建标题为“刷新后新增节点”的自定义知识点，返回 `nodeCount: 1`。
- Playwright 真实浏览器验证：打开 `http://127.0.0.1:8787/graphs` 后刷新页面，再进入编辑模式添加“刷新后可添加”；页面显示“已保存”，没有出现“知识点添加失败，请稍后重试”；接口回读确认节点已写入；页面只保留右侧“搜索 / 详情”页签，旧的“层级 / 关系 / 掌握 / 居中”按钮均不存在。
- 清理验证数据：已删除本轮创建的临时诊断图谱，`8787` 当前仅保留用户原有图谱。

### Notes

- `server/knowledgeMaps/routes.ts`：兼容自定义节点 `content: null`，避免空正文经过接口校验时被误拒绝；该文件由并行后端智能体在限定范围内修改并由主流程复验。
- `tests/server/knowledge-maps.test.ts`：补充空正文、`null` 正文和完全空节点的服务端回归测试。
- `src/pages/GraphsPage.tsx`：移除旧视图切换、居中按钮、关系编辑入口、关系选择状态和详情层级输入，固定使用树形分支编辑与层级红色 3D 预览。
- `src/styles/graphs.css`：删除旧视图模式、图例和关系编辑样式，调整分支线标签为不可点击展示态。
- `tests/frontend/graphs-page.test.tsx`：更新图谱前端测试，断言旧控件不存在，并覆盖分支线仅展示、高亮和不可编辑。
- `docs/知识图谱.md`：同步新版树形分支规则，删除关系面板、居中按钮和手动层级编辑说明。
- `progress.md`：仅在末尾追加本轮根因、验证、文件清单与回滚说明。
- 回滚点：若只撤销本轮并保留前序图谱功能，回到上一条 `2026-08-01 - Task: 修复图谱添加失败与树形编辑` 记录对应状态；当前图谱相关文件仍未纳入 git 跟踪，需通过编辑器本地历史或备份恢复上述图谱文件到该回滚点。若要撤销整个未跟踪图谱功能，再按前序图谱功能记录删除对应未跟踪文件并还原已跟踪入口文件。

## 2026-08-02 - Task: 优化知识图谱径向思维导图与节点添加稳定性

### What was done

- 修复刷新后仍可能添加节点失败的问题：服务启动迁移后会检查 `knowledge_map_nodes` 真实表结构，发现旧结构时自动补执行自定义节点扩展迁移。
- 修复 2D 思维导图节点被鼠标选中或拖动时错位的问题：节点不再使用会覆盖定位位移的通用按压类，拖动坐标统一按可滚动画布计算。
- 将 2D 思维导图从固定横向层级栏改为中心向外扩展的径向树形布局，画布支持上下左右滚动，层级较深或节点较多时自动扩大。
- 将 3D 预览改为按 2D 树形结构投影：第一层节点位于圆心，后续层级按父子分支向外扩充。
- 为绑定卡片的节点新增 3D 临时 AI 衍生小节点，用于承载整理稿、解析、速记和拓展；这些小节点不写入数据库，也不参与 2D 编辑。
- 右侧卡片搜索结果和 2D 节点标题改为只显示用户初始稿，不再把 AI 整理稿、解析、速记铺到 2D 编辑视图中。
- 鼠标悬停某个知识点时，高亮该节点及其所有下级子点，而不只高亮直接相连的一级邻点。

### Testing

- `npm run typecheck`：通过，前端与服务端 TypeScript 检查无错误。
- `npm test -- tests/server/knowledge-maps.test.ts`：通过，6 项知识图谱服务端测试全部通过，覆盖旧表结构修复后继续新增自定义节点和卡片节点。
- `npm test -- tests/frontend/graphs-page.test.tsx`：通过，12 项图谱前端测试全部通过，覆盖用户初始稿展示、可滚动径向画布、拖动偏移、子树高亮、3D 外扩坐标和 3D AI 衍生小节点。
- `npm test`：通过，43 个测试文件、600 项测试全部通过。
- `npm run build`：通过，客户端与服务端生产构建成功；客户端主包仍有 3D/WebGL 依赖导致的大包非阻塞提示。
- Playwright 真实生产服务验证：重启 `8787` 后打开 `/graphs`，创建临时图谱并新增根节点和子分支；页面没有出现添加失败提示；2D 画布 `704×684` 视口内生成 `2460×2460` 可滚动世界；悬停根节点同时高亮根节点和子分支；3D 预览 canvas 截图像素检查通过，非白像素 `171805`、红色像素 `1449`；移动 `390×844` 视口下图谱区域尺寸正常；控制台无应用错误。
- 临时验证图谱已通过接口清理，复查没有残留 `codex-graph-check-*` 图谱。

### Notes

- `server/db/migrations.ts`：新增迁移后表结构自检，修复迁移版本已记录但节点表仍为旧结构的真实数据库状态。
- `tests/server/knowledge-maps.test.ts`：新增旧版节点表结构回归用例，验证修复后自定义节点和卡片节点都能继续新增。
- `src/pages/GraphsPage.tsx`：统一 2D 径向树形坐标、3D 中心外扩坐标、拖动偏移计算、用户初始稿标题、3D AI 衍生小节点和子树高亮逻辑。
- `src/styles/graphs.css`：将 2D 编辑区改为可滚动大画布和同心层级提示，补充节点高亮、弱化和按压定位样式。
- `tests/frontend/graphs-page.test.tsx`：更新图谱前端断言，覆盖用户初始稿展示、滚动画布、节点不再错位、子树高亮和 3D 层级半径。
- `docs/知识图谱.md`：同步径向树形编辑、右侧卡片显示收敛、子树高亮、3D 层级外扩和 3D AI 衍生小节点说明。
- `progress.md`：仅在末尾追加本轮修复、验证、文件清单与回滚说明。
- 回滚方式：若只撤销本轮后端兼容修复，执行 `git restore -- server/db/migrations.ts tests/server/knowledge-maps.test.ts progress.md`；若只撤销本轮前端图谱优化，由于 `src/pages/GraphsPage.tsx`、`src/styles/graphs.css`、`tests/frontend/graphs-page.test.tsx`、`docs/知识图谱.md` 当前仍未纳入 git 跟踪，需使用编辑器本地历史或上一条进度记录对应状态回退这些文件。若撤销整个图谱功能，按前序图谱记录还原已跟踪入口文件并删除未跟踪的图谱页面、样式、迁移、服务端模块和测试文件；真实数据库如已执行图谱迁移，需先备份再恢复到迁移前数据库备份。

## 2026-08-02 - Task: 修复 3D 图谱悬浮归位并增强 2D 思维导图画布

### What was done

- 修复 3D 预览中悬浮或选中节点后视角定期归位的问题：自动自转和初始居中都会识别当前悬浮、选中或关系预览状态，用户正在查看节点时不再强制拉回默认轨道。
- 点击 3D 空白区域会释放当前选中节点并回到搜索面板，之后才恢复自动自转。
- 2D 树形思维导图支持在空白画布按住鼠标拖动平移；节点拖动仍只移动节点并保存节点坐标，不会与画布平移冲突。
- 2D 思维导图画布按节点数量、树深和视口尺寸自动扩大，并预留更大的平移缓冲区，减少多节点或深层级时被固定画布边界卡住的问题。
- 右侧卡片库搜索结果改为完整展示用户初始稿内容，保留换行和长文本，不再用 AI 整理稿作为搜索结果正文。
- 同步更新知识图谱使用说明，补充空白拖动画布、完整初始稿展示和 3D 悬浮/选中暂停自转规则。

### Testing

- `npm test -- tests/frontend/graphs-page.test.tsx`：通过，15 项图谱前端测试全部通过，覆盖 3D 悬浮/选中不触发相机自转归位、2D 空白拖动画布不保存节点位置、右侧卡片库完整显示用户初始稿。
- `npm run typecheck`：通过，前端与服务端 TypeScript 检查无错误。
- `npm test`：通过，43 个测试文件、603 项测试全部通过。
- `npm run build`：通过，客户端与服务端生产构建成功；客户端主包仍有 3D/WebGL 依赖导致的大包非阻塞提示。
- Playwright 临时生产实例验证：使用临时数据目录启动 `127.0.0.1:8791`，新建图谱和自定义节点后，2D 画布从 `scrollLeft: 620 / scrollTop: 520` 平移到 `710 / 590`；切换预览后 3D canvas 可见，尺寸为 `704 × 760`；控制台没有应用错误，仅有 WebGL `ReadPixels` 性能警告。
- 临时验证服务和临时数据目录已清理。

### Notes

- `src/pages/GraphsPage.tsx`：新增 3D 预览焦点门禁、2D 空白拖动画布平移逻辑、动态画布扩展计算和完整初始稿展示 helper。
- `src/styles/graphs.css`：新增 2D 画布平移游标状态，补充右侧卡片结果完整换行显示样式。
- `tests/frontend/graphs-page.test.tsx`：新增 3D 悬浮/选中、2D 空白拖动画布、右侧初始稿完整展示的回归测试。
- `docs/知识图谱.md`：同步本轮 2D 画布、3D 预览和右侧卡片库展示规则。
- `progress.md`：仅在末尾追加本轮修复、验证、文件清单与回滚说明。
- 回滚方式：本轮未新增数据库迁移、未改真实数据。若只撤销本轮记录，可执行 `git restore -- progress.md`；图谱页面、样式、测试和文档在当前工作区仍属于未跟踪图谱功能文件，需使用编辑器本地历史或上一条进度记录对应状态回退 `src/pages/GraphsPage.tsx`、`src/styles/graphs.css`、`tests/frontend/graphs-page.test.tsx`、`docs/知识图谱.md` 中的本轮改动。
## 2026-08-02 - Task: 修复图谱右侧卡片库完整展示与 3D AI 衍生小球数量

### What was done

- 修复图谱右侧卡片库数据来源：按卡片库用户初始稿接口拉取所有分页，保持接口返回顺序逐张展示，不在图谱页前端重新排序、合并或截断卡片。
- 右侧卡片结果继续使用用户初始稿富文本预览，保留换行和原始内容，不再用 AI 整理稿、解析、速记等字段替换或省略初始稿。
- 修复 3D 智慧图谱的小球生成规则：小球只来自同一初始稿下已经完成 AI 整理且存在整理稿的真实卡片，不再按解析、速记、拓展等字段拆分，也不生成处理中卡片的小球。
- 补充前端回归测试，覆盖完整分页拉取、同一初始稿多张卡不被省略、3D 小球按实际 AI 衍生卡片数量生成。
- 同步更新知识图谱使用说明，明确右侧卡片库展示规则和 3D AI 衍生小球来源。

### Testing

- `npm test -- tests/frontend/graphs-page.test.tsx`：通过，16 项图谱前端测试全部通过。
- `npm run typecheck`：通过，前端与服务端 TypeScript 检查无错误。
- `npm test`：通过，43 个测试文件、604 项测试全部通过。
- `npm run build`：通过，客户端与服务端生产构建成功；客户端仍有 3D/WebGL 依赖导致的大包体积非阻塞警告。
- Playwright 真实生产页面验证：Browser plugin not available，使用普通 Playwright 打开临时生产服务 `http://127.0.0.1:8791/graphs`。临时数据库中 4 张卡全部显示在右侧卡片库，3 张同一初始稿没有被前端合并或省略，换行文本“第二行不能省略”完整存在；桌面 canvas 尺寸为 `704 × 740`，截图采样得到非白像素 `13285`、红色像素 `107`；移动视口 `390 × 844` 下右侧 DOM 仍包含 4 张卡，canvas 尺寸为 `300 × 355`，截图采样得到非白像素 `4886`、红色像素 `18`。
- Playwright 控制台没有应用错误；仅出现截图/像素检查触发的 WebGL `ReadPixels` 性能警告。
- 临时生产服务和临时数据库目录已清理；验证截图保留在系统临时目录：`C:\Users\ROG\AppData\Local\Temp\gongkao-graphs-card-library-e2e.png`、`C:\Users\ROG\AppData\Local\Temp\gongkao-graphs-card-library-e2e-mobile.png`。

### Notes

- `src/pages/GraphsPage.tsx`：图谱页右侧卡片库改为完整拉取用户初始稿分页并保存全量卡片集合，3D AI 衍生小球改为按同源 ready 卡片生成。
- `tests/frontend/graphs-page.test.tsx`：新增右侧卡片库完整分页、不省略同源卡片，以及 3D 小球按实际 AI 衍生数量生成的回归断言。
- `docs/知识图谱.md`：同步说明右侧卡片库逐张完整展示规则和 3D 小球真实来源。
- `progress.md`：仅在末尾追加本轮修复、验证和回滚说明。
- 回滚方式：本轮未新增数据库迁移、未修改真实数据。若只撤销本轮记录，可执行 `git restore -- progress.md`；若撤销本轮功能改动，由于图谱页相关文件仍是未跟踪图谱功能文件，需要使用编辑器本地历史或上一条进度记录对应状态回退 `src/pages/GraphsPage.tsx`、`tests/frontend/graphs-page.test.tsx`、`docs/知识图谱.md` 中的本轮改动。

## 2026-08-02 - Task: 修复知识图谱初始稿展示、3D 衍生节点与分支交互

### What was done

- 右侧卡片库按初始稿来源去重，每份初始稿只显示一次，并完整保留用户输入的全部正文与换行；AI 优化稿、解析和速记不进入该列表。
- 3D 图谱将 AI 优化稿和解析分别生成为独立小球，并恢复两类临时小球的点击、详情查看与聚焦能力。
- 2D 编辑模式支持右击节点后选择“添加分支”，直接把目标节点设为父节点并进入新增区域。
- 选中或悬停节点时，父节点及其他非焦点节点改为可辨识的淡红色，保留图谱上下文。

### Testing

- 测试驱动红灯：新增去重、右键添加分支、AI 优化/解析小球点击与淡红色上下文断言后，修复前稳定失败 3 项；实现后 `npm test -- --run tests/frontend/graphs-page.test.tsx` 通过，17 项图谱前端测试全部通过。
- `npm run typecheck`：通过，前端与服务端 TypeScript 检查无错误。
- `npm test -- --run tests/server/knowledge-maps.test.ts tests/frontend/app-shell.test.tsx`：通过，30 项知识图谱服务端与应用入口回归测试全部通过。
- `npm test -- --run`：通过，43 个测试文件、605 项测试全部通过。
- `npm run build`：通过，客户端与服务端生产构建成功；客户端仍有既有 3D/WebGL 依赖导致的大包体积非阻塞警告。
- Playwright 真实本地页面验证：桌面 `1440 × 900` 与移动 `390 × 844` 下 3D 图谱均可见且布局无重叠；canvas 截图采样分别得到彩色像素 `10936`、`1928`，其中红色像素 `154`、`31`，确认画布非空且节点可见。为避免写入用户真实数据，右键菜单的完整选择流程由前端自动化测试验证。

### Notes

- `src/pages/GraphsPage.tsx`：修复初始稿去重、AI 优化与解析小球生成和点击详情、右键添加分支菜单及淡红色非焦点显示。
- `src/styles/graphs.css`：新增节点右键菜单样式，并保证衍生节点完整内容按原换行显示。
- `tests/frontend/graphs-page.test.tsx`：补充本轮四项行为的前端回归测试。
- `docs/知识图谱.md`：同步本轮初始稿列表、3D 小球、右键分支和节点可见性规则。
- `progress.md`：仅在末尾追加本轮实现、验证、文件清单与回滚说明。
- 回滚点：本轮未新增数据库迁移、未修改真实业务数据。图谱相关文件仍未纳入 Git 跟踪，不能使用 `git restore` 单独回滚其本轮增量；应通过编辑器本地历史恢复到上一条 `2026-08-02 - Task: 修复图谱右侧卡片库完整展示与 3D AI 衍生小球数量` 记录完成后的状态。若仅撤销本轮日志，可执行 `git restore -- progress.md`。

## 2026-08-02 - Task: 优化知识图谱缩放、摘要、菜单与可见性

### What was done

- 3D 预览只为 AI 优化稿生成可点击小球，解析不再生成独立小球；相机拉近到可阅读距离后，每个真实节点和 AI 优化小球自动浮现短内容摘要。
- 2D 思维导图支持按住 `Ctrl` 滚动鼠标滚轮缩放，缩放范围限制在 `60%` 至 `160%`，并以鼠标所在位置为缩放锚点。
- 右侧卡片库将分类标签和完整初始稿正文拆分颜色作用域，正文恢复正常文字颜色；2D 思维导图单独使用纯白背景，不改变页面其他区域。
- 右键节点菜单支持点击任意其他位置或按 `Escape` 关闭；取消选中或悬停后淡化无关节点的效果，所有节点始终保持自身颜色与可见度。

### Testing

- 测试驱动红灯：新增 AI-only 小球、距离摘要、`Ctrl + 滚轮` 缩放、正文颜色作用域、菜单外部关闭和节点不淡化断言后，修复前稳定失败 4 项。
- `npm test -- --run tests/frontend/graphs-page.test.tsx`：通过，18 项知识图谱前端测试全部通过。
- `npm run typecheck`：通过，前端与服务端 TypeScript 检查无错误。
- `npm run build`：通过，客户端与服务端生产构建成功；客户端仍有既有 3D/WebGL 依赖导致的大包体积非阻塞警告。
- `git diff --check`：通过，仅有工作树既有 LF/CRLF 转换提示。

### Notes

- `package.json`、`package-lock.json`：将 3D 摘要精灵使用的 `three` 声明为直接运行依赖。
- `src/three-runtime.d.ts`：为本页实际使用的纹理和精灵 API 提供最小局部类型声明，避免引入会影响全局 Canvas 类型的第三方声明包。
- `src/pages/GraphsPage.tsx`：实现 AI-only 小球、距离摘要、2D 缩放、菜单关闭、颜色作用域和节点常显逻辑。
- `src/styles/graphs.css`：收紧分类标签颜色选择器，增加 2D 独立白底，并移除节点淡化样式。
- `tests/frontend/graphs-page.test.tsx`：新增本轮行为回归断言并更新旧的解析球和淡化预期。
- `docs/知识图谱.md`：同步本轮 3D、2D、右侧卡片和右键菜单使用规则。
- `progress.md`：仅在末尾追加本轮实现、验证、文件清单与回滚说明。
- 回滚方式：本轮未新增数据库迁移、未修改真实业务数据。依赖和局部声明可执行 `npm uninstall three; Remove-Item -LiteralPath 'src\three-runtime.d.ts'` 撤销；当前图谱页面、样式、测试和文档仍属于未跟踪的前序图谱功能文件，其本轮增量应通过编辑器本地历史恢复到上一条进度记录完成后的状态。若仅撤销本轮日志，可执行 `git restore -- progress.md`。

## 2026-08-02 - Task: 支持图谱自定义层级与长按连线

### What was done

- 2D 编辑模式允许卡片节点和自定义节点在第 1 至第 6 层之间直接调整，布局始终使用节点已保存层级；删除父节点后，剩余子节点不再被强制移回根层。
- 节点支持长按 500 毫秒后拖向另一节点建立关系，拖动过程中显示临时连线；普通短按拖动仍用于移动节点。
- 2D 图只保留默认分支的关系线，不显示重复的“分支”文字标签；3D 预览关系线改为淡红色细线。
- 补充服务端回归验证，确认删除父节点只清理相关边，子节点和其自定义层级保持不变。

### Testing

- 测试驱动红灯：新增自定义层级、长按连线、隐藏默认分支标签和 3D 淡红细线断言后，修复前稳定失败 3 项。
- `npm test -- tests/frontend/graphs-page.test.tsx tests/server/knowledge-maps.test.ts`：通过，27 项知识图谱前后端测试全部通过。
- `npm test -- tests/server/knowledge-maps.test.ts -t "keeps child nodes and their custom levels when deleting a parent node"`：通过，确认父节点删除后子节点及层级保留。

### Notes

- `src/pages/GraphsPage.tsx`：实现自定义层级布局、长按连线、默认分支标签隐藏和 3D 淡红细线。
- `src/styles/graphs.css`：补充层级选择器和长按临时连线样式。
- `tests/frontend/graphs-page.test.tsx`：新增层级、长按连线和 3D 连线回归测试，并同步默认分支标签预期。
- `tests/server/knowledge-maps.test.ts`：新增删除父节点时保留子节点及其层级的回归测试。
- `docs/知识图谱.md`：同步层级选择、长按连线、删除稳定性和 3D 连线说明。
- `progress.md`：仅在末尾追加本轮实现、验证、文件清单与回滚说明。
- 回滚方式：本轮未新增数据库迁移、未修改真实业务数据。当前图谱页面、样式、测试和文档仍属于未跟踪的前序图谱功能文件，应通过编辑器本地历史恢复到上一条 `2026-08-02 - Task: 优化知识图谱缩放、摘要、菜单与可见性` 记录完成后的状态；若仅撤销服务端测试，可执行 `git clean -f -- tests/server/knowledge-maps.test.ts`，但该命令会删除整个未跟踪测试文件，执行前需确认不再保留此前测试内容。

## 2026-08-02 - Task: 修复 3D 悬停视角重置与摘要遮挡

### What was done

- 3D 图谱在暂停和恢复自转时同步当前相机角度、旋转半径与高度；用户缩放、旋转或悬停节点后，自转从当前视角继续，不再突然跳回固定远景。
- 近景内容摘要改为不随透视距离放大的屏幕恒定尺寸，并按文字长度紧凑调整；连续放大时摘要框不再随镜头占满画布。
- 将 2D 拖动回归测试的坐标换算为包含画布滚动偏移的真实客户端坐标，保证全量并行测试稳定验证节点层级保存。

### Testing

- 测试驱动红灯：新增相机轨道保持和摘要屏幕恒定尺寸断言后，修复前分别得到固定半径 `806` 和摘要透视放大的失败结果。
- `npm test -- tests/frontend/graphs-page.test.tsx tests/server/knowledge-maps.test.ts`：通过，28 项知识图谱前后端测试全部通过。
- `npm test`：通过，43 个测试文件、610 项测试全部通过。
- `npm run typecheck`：通过，前端与服务端 TypeScript 检查无错误。
- `npm run build`：通过，客户端与服务端生产构建成功；客户端仍有既有 3D/WebGL 依赖导致的大包体积非阻塞警告。
- Playwright 真实本地页面验证：桌面 `1440 × 900` 下正常视角可见淡红色细关系线；连续五次近距离放大后，摘要仍保持小型白色标签，未遮挡画布。验收截图已在确认后清理，未留入项目。
- `git diff --check`：通过，仅有工作树既有 LF/CRLF 转换提示。

### Notes

- `src/pages/GraphsPage.tsx`：同步自动旋转轨道并将摘要精灵改为屏幕恒定紧凑尺寸。
- `src/three-runtime.d.ts`：补充摘要精灵关闭距离缩放所需的 `sizeAttenuation` 局部类型。
- `tests/frontend/graphs-page.test.tsx`：新增相机连续性、摘要尺寸回归断言，并修正 2D 拖动测试坐标。
- `docs/知识图谱.md`：同步悬停后从当前视角继续自转和摘要不随透视放大的使用规则。
- `progress.md`：仅在末尾追加本轮实现、验证、文件清单与回滚说明。
- 回滚方式：本轮未新增数据库迁移、未修改真实业务数据。当前图谱页面、局部类型、测试和文档仍属于未跟踪的前序图谱功能文件，应通过编辑器本地历史恢复到上一条 `2026-08-02 - Task: 支持图谱自定义层级与长按连线` 记录完成后的状态；若仅撤销本轮日志，可从 `progress.md` 末尾删除本节。

## 2026-08-02 - Task: 阻止 2D 图谱 Ctrl 滚轮触发浏览器缩放

### What was done

- 将 2D 思维导图的 `Ctrl + 滚轮` 处理改为画布元素上的非被动原生监听，阻止浏览器默认缩放，同时继续按鼠标位置缩放图谱画布。
- 普通滚轮行为保持不变，不影响画布滚动和平移。
- 更新知识图谱使用说明，明确画布内快捷缩放不会改变浏览器页面比例。

### Testing

- 测试驱动红灯：新增非被动滚轮监听断言后，修复前定向测试稳定失败，实际仅存在 React 注册的被动 `wheel` 监听。
- `npm test -- tests/frontend/graphs-page.test.tsx -t "2D 思维导图只在按住 Ctrl 滚动时缩放"`：通过，1 项目标测试通过、20 项跳过。

### Notes

- `src/pages/GraphsPage.tsx`：为 2D 画布注册可阻止默认行为的非被动滚轮监听，并移除重复的 React 滚轮处理。
- `tests/frontend/graphs-page.test.tsx`：补充非被动监听注册及画布缩放回归断言。
- `docs/知识图谱.md`：补充画布内 `Ctrl + 滚轮` 不缩放浏览器的说明。
- `progress.md`：在末尾追加本轮修复、验证、文件清单与回滚点。
- 回滚点：恢复到本节之前的工作区状态；撤销时删除 `GraphsPage.tsx` 中 `handleWheel` 对应的 `useEffect`、恢复原 JSX `onWheel`，删除目标测试中的 `addEventListenerSpy` 断言，并将文档说明恢复为“按住 `Ctrl` 并滚动鼠标滚轮可以缩放画布”。

## 2026-08-02 - Task: 解耦节点拖拽与连线并支持删除关系

### What was done

- 修复固定层级节点拖动后回弹：2D 布局读取节点已保存角度，拖动时沿所属层级圆环移动，保存后层级不变且新位置可稳定恢复。
- 移除长按触发连线的冲突手势；新增独立“连接节点”模式，依次选择起点和目标节点建立关系，`Escape` 或点击空白画布可取消。
- 在节点右侧详情中列出全部入向和出向连线，并接入现有删除接口，支持逐条删除错误关系而不影响节点。
- 更新知识图谱使用说明，明确拖拽、连接模式和关系删除操作。

### Testing

- 测试驱动红灯：新增连接模式、固定层级长按拖动和单条连线删除断言后，修复前 3 项测试稳定失败。
- `npm test -- tests/frontend/graphs-page.test.tsx tests/server/knowledge-maps.test.ts`：通过，28 项知识图谱前后端测试全部通过。
- `npm run typecheck`：通过，前端与服务端 TypeScript 检查无错误。

### Notes

- `src/pages/GraphsPage.tsx`：持久化节点角度、固定拖拽层级，新增连接节点模式和关系删除调用及详情展示。
- `src/styles/graphs.css`：新增连接模式工具、起点高亮和详情关系列表样式，删除不再使用的长按临时连线样式。
- `tests/frontend/graphs-page.test.tsx`：将长按连线回归改为显式连接模式，并补充固定层级拖拽和单条连线删除验证。
- `docs/知识图谱.md`：同步固定层级拖拽、连接模式和关系删除说明。
- `progress.md`：在末尾追加本轮实现、验证、文件清单与回滚点。
- 回滚点：恢复到上一节“阻止 2D 图谱 Ctrl 滚轮触发浏览器缩放”完成后的工作区状态；撤销时恢复长按 500 毫秒连线处理、按释放位置计算层级的拖拽逻辑和树结构默认角度布局，移除“连接节点”工具与详情关系列表，并删除本节对应测试和文档增量。

## 2026-08-02 - Task: 参考 llm_wiki 重构 3D 知识图谱

### What was done

- 参考 `llm_wiki` 的知识图谱视觉层级，将 3D 节点按卡片知识点、AI 优化稿和自定义知识点区分颜色，并按连线数量调整节点尺寸。
- 将关系线改为淡蓝灰细线，按关系权重调整粗细；AI 优化稿的辅助关系使用琥珀色，减少视觉干扰并保留关系辨识度。
- 增加图谱放大、缩小、适配视图控制和节点类型图例，移除装饰性轨道，改为浅色点阵画布。
- 将放大后出现的内容概括改为无底框的小号文字，保留白色描边以兼顾复杂节点区域的可读性。

### Testing

- 测试驱动红灯：新增节点分类配色、连线权重、图谱控制、图例和装饰轨道移除断言后，修复前目标测试稳定失败。
- `npm test`：通过，43 个测试文件、610 项测试全部通过。
- `npm run typecheck`：通过，前端与服务端 TypeScript 检查无错误。
- `npm run build`：通过，客户端与服务端均构建成功；仅保留项目既有的客户端单包超过 500 kB 提示。
- Playwright 桌面端与移动端验证：2 项交互测试通过；真实按住 `Ctrl` 滚轮后图谱缩放值由 1 变为 1.1，浏览器视口比例和尺寸保持不变。
- 3D 画布像素检查：705×741 画布采样中检测到 448 个彩色像素和 496 个深色像素，确认节点、连线和文字正常渲染而非空白画布。
- `git diff --check`：通过，未发现空白错误；仅显示工作区既有的换行符提示。

### Notes

- `src/pages/GraphsPage.tsx`：重构 3D 节点配色、尺寸、关系线、视图控制、图例和概括文字渲染。
- `src/styles/graphs.css`：调整 3D 画布背景、控制器、图例和概括文字样式，移除装饰轨道样式。
- `tests/frontend/graphs-page.test.tsx`：补充 3D 图谱视觉规则、控制器、图例和关系权重回归测试。
- `docs/知识图谱.md`：同步 3D 图谱配色、关系线、视图控制和内容概括说明。
- `progress.md`：在末尾追加本轮实现、验证、文件清单与回滚点。
- 回滚点：恢复到上一节“解耦节点拖拽与连线并支持删除关系”完成后的工作区状态；撤销时恢复原 3D 红色节点、红色关系线、装饰轨道和概括文字框，移除图谱缩放控制与图例，并删除本节对应测试和文档增量。

## 2026-08-02 - Task: 重构径向圈层知识图谱并完善撤销与详情联动

### What was done

- 将 2D 图谱调整为纯手动关系编辑：新建普通节点或导入卡片只产生独立节点，长按节点拖向目标节点才建立连线，拖到空白处不产生关系，节点位置统一由径向圈层布局管理。
- 新增自动重新排布和手动“重新排布”入口；双击普通节点或卡片节点均能在右侧完整回显并编辑标题、正文、层级和关联关系，长文本不会再撑破详情栏。
- 新增工具栏撤销按钮和 `Ctrl+Z` 快捷键，可撤销本轮节点新增或删除、连线新增或删除以及节点内容修改；输入框内仍保留原生文字撤销。
- 将 3D 预览改为只读红色星球图谱：核心层节点更大、更深，外层节点依次缩小、变浅，全部关系线使用淡红细线；卡片节点和普通节点采用同一层级规则，AI 优化稿单独生成可点击小球，解析不生成节点。
- 3D 图谱按中心、球面和外层轨道映射 2D 层级，支持可中断的缓慢自转、旋转开关、拖拽视角、滚轮缩放和自适应 Billboard 摘要；移动端适配视图会自动减少边距。
- 2D 画布加入低透明度项目背景图、磨砂点阵和玻璃控件，并为减少动态效果与增强对比度偏好提供降级样式。

### Testing

- `npm test -- tests/frontend/graphs-page.test.tsx --reporter=dot`：通过，24 项图谱前端测试全部通过。
- `npm test -- tests/server/knowledge-maps.test.ts --reporter=dot`：通过，7 项图谱服务端测试全部通过。
- `npm test -- --reporter=dot`：通过，43 个测试文件、613 项测试全部通过。
- `npm run typecheck`：通过，前端与服务端 TypeScript 检查无错误。
- `npm run build`：通过，客户端与服务端均构建成功；仅保留项目既有的客户端单包超过 500 kB 提示。
- Playwright 桌面端与 390×844 移动端验证：重新排布按钮保持可见，普通节点和卡片节点双击后均正确加载右侧完整详情，页面宽度与视口一致，控制台错误为 0。
- 3D 画布像素检查：705×741 画布抽样检测到 1249 个非空像素和 145 个红色像素，确认红色节点与关系线正常渲染。
- `git diff --check`：通过，未发现空白错误；仅显示工作区既有的换行符提示。

### Notes

- `src/pages/GraphsPage.tsx`：重构 2D 径向布局、手动长按连线、完整详情编辑、撤销栈和 3D 红色圈层预览。
- `src/styles/graphs.css`：增加苹果磨砂画布、红色层级视觉、固定排布按钮、详情长文本约束及无障碍偏好样式。
- `tests/frontend/graphs-page.test.tsx`：覆盖禁止自动连线、长按连线、自动排布、详情联动、撤销和 3D 红色层级行为。
- `tests/server/knowledge-maps.test.ts`：补充删除节点时清理直接关联关系但保留其他关系的回归验证。
- `docs/知识图谱.md`：同步 2D 编辑、撤销、详情联动、3D 预览、数据规则和验收方式。
- `progress.md`：仅在末尾追加本轮实现、验证、文件清单与回滚说明。
- 回滚方式：本轮未新增数据库迁移、未修改真实业务数据。恢复 `src/pages/GraphsPage.tsx`、`src/styles/graphs.css`、两份图谱测试和 `docs/知识图谱.md` 到本节开始前的状态，并删除本节日志，即可撤销本轮交互与视觉重构；不要回滚工作区中此前已经存在的知识图谱数据库、接口或其他页面改动。

## 2026-08-03 - Task: 优化图谱分支布局、预览开关、搜索与 Markdown 导出

### What was done

- 将 2D 圈层图调整为按根分支分配扇区的树形排布，子节点始终沿父分支继续向外展开，减少层级错位和连线交叉。
- 所有关系线保持常显；选中节点时，该节点到第一层祖先的完整路径会加粗发光，其他关系不再被隐藏或弱化。
- 新增节点和导入卡片前均可选择第 1 至第 6 层；3D 预览增加文字摘要和 AI 衍生球体两个独立开关。
- 卡片库搜索改为短暂防抖并只请求去重首屏；新增 Markdown 导出，保存完整节点正文、层级和关系。

### Testing

- `npm test -- --reporter=dot`：通过，43 个测试文件、619 项测试全部通过。
- `npm run typecheck`：通过，前端与服务端 TypeScript 检查无错误。
- `npm run build`：通过，客户端与服务端构建成功；仅保留项目既有的客户端单包超过 500 kB 提示。
- Playwright 桌面端验证：2D 分支布局、层级选择、3D 开关和 Markdown 导出入口正常；3D 画布抽样得到 678 个非背景像素，控制台错误为 0。

### Notes

- `src/pages/GraphsPage.tsx`：实现分支扇区布局、祖先路径高亮、层级选择、3D 显示开关、首屏搜索和 Markdown 导出。
- `src/styles/graphs.css`：补充分支层级、路径高亮、预览开关和降低动态效果样式。
- `tests/frontend/graphs-page.test.tsx`：补充布局、层级、开关、搜索和导出回归验证。
- `docs/知识图谱.md`：同步上述图谱操作与验收说明。
- `progress.md`：仅在末尾追加本轮实现、验证、文件清单与回滚点。
- 回滚方式：本轮未新增数据库迁移、未修改真实业务数据；恢复上述源码、样式、测试和文档到本节开始前状态，并删除本节日志即可回滚。

## 2026-08-03 - Task: 新增横向思维导图编辑并自动生成 2D 与 3D 预览

### What was done

- 将图谱操作明确拆分为“横向编辑、2D 预览、3D 预览”：横向模式是唯一编辑入口，2D 和 3D 均保持只读。
- 新增中心主题快捷输入和节点右侧加号；用户提交子节点时，系统创建下一层节点及其父子分支，同级节点可以连续录入。
- 横向编辑、2D 圈层和 3D 星球共用现有节点与关系数据，横向编辑保存后两种预览立即同步，不增加转换文件或重复数据。
- 横向树使用从左到右的自动层级排布、绿色曲线和固定尺寸红色磨砂节点；长标题显示摘要，完整内容仍在右侧详情中呈现。
- 修复真实数据下根节点初次进入时落出可视区的问题；桌面、窄屏和窗口尺寸变化后都会重新将根节点置于合适位置。

### Testing

- `npm test -- tests/frontend/graphs-page.test.tsx --reporter=dot`：通过，33 项图谱前端测试全部通过。
- `npm test -- --reporter=dot`：通过，43 个测试文件、622 项测试全部通过。
- `npm run typecheck`：通过，前端与服务端 TypeScript 检查无错误。
- `npm run build`：通过，客户端与服务端构建成功；仅保留项目既有的客户端单包超过 500 kB 提示。
- Playwright 桌面端与 390×844 窄屏验证：根节点自动居中、三模式切换正常、2D 编辑表单数量为 0、3D 控制器正常，控制台错误为 0。
- 3D 画布像素检查：582×455 画布抽样检测到 983 个非背景像素和 155 个红色像素，确认节点与连线正常渲染。

### Notes

- `src/pages/GraphsPage.tsx`：新增横向编辑器、层级树排布、父子快捷录入、根节点自适应居中和编辑/预览权限隔离。
- `src/styles/graphs.css`：新增横向画布、红色磨砂节点、绿色曲线、模式切换、窄屏与降低动态效果样式。
- `tests/frontend/graphs-page.test.tsx`：新增横向录入与三视图同步验证，并将原 2D 编辑回归调整为横向编辑和 2D 只读预览语义。
- `docs/知识图谱.md`：改写为横向编辑、2D 预览和 3D 预览的最新使用说明。
- `progress.md`：仅在末尾追加本轮实现、验证、文件清单与回滚点。
- 回滚方式：本轮未新增数据库迁移、未修改真实业务数据；恢复 `src/pages/GraphsPage.tsx`、`src/styles/graphs.css`、`tests/frontend/graphs-page.test.tsx` 和 `docs/知识图谱.md` 到上一节完成后的状态，并删除本节日志即可回滚。

## 2026-08-03 - Task: 重构横向图谱交互与太阳系 3D 预览

### What was done

- 将卡片导入改为横向编辑器内的紧凑搜索入口，移除常驻右侧卡片库和手工层级选择；卡片仍按用户初始稿去重，并可直接加入当前图谱。
- 扩大横向画布，新增 `Ctrl` 加滚轮定点缩放和空白处按住拖动平移；横向与 2D 节点悬浮时显示完整内容，预览自动限制在窗口内部。
- 节点点击详情改为底部弹出，并将详情背景提高到接近不透明的浅色磨砂层，避免背景节点和连线干扰正文。
- 将 3D 预览重绘为太阳系轨道模型：根节点作为中心太阳，普通节点按父子层级进入递增同心轨道，子节点沿父分支方向展开，AI 优化稿作为父星球附近的小陨石。
- 修复默认相机将轨道压成直线的问题；标签按镜头距离调整，远景隐藏 AI 小陨石摘要、拉近后显示，窄屏使用更短摘要以减少遮挡。
- 补充 390×844 窄屏纵向布局，图谱列表、工具栏和画布不再横向挤出页面；保留减少动态效果、降低透明度和高对比度适配。

### Testing

- `npm test -- --run`：通过，44 个测试文件、631 项测试全部通过。
- `npm run typecheck`：通过，前端与服务端 TypeScript 检查无错误。
- `npm run build`：通过，客户端与服务端构建成功；仅保留项目既有的客户端单包超过 500 kB 提示。
- Playwright 桌面端验证：横向画布缩放值由 1 变为 1.1，浏览器视口比例保持 1；空白拖动时滚动位置由 0、171 变为 42、196，拖动结束后状态正常释放。
- Playwright 节点预览验证：右侧边缘悬浮预览最终范围为 1044 至 1424，完整位于 1440 像素桌面视口内；底部详情背景实测为 `rgba(250, 252, 255, 0.984)`，背景不再穿透干扰。
- Playwright 移动端验证：390×844 视口页面宽度与滚动宽度均为 390，图谱画布为 300×560，无页面水平溢出；控制台错误为 0。
- 3D 画布截图像素检查：300×561 画布抽样检测到 227 个红色像素、1084 个非浅色像素，亮度范围为 63 至 255，确认太阳、轨道、节点和文字正常渲染。
- 行尾空白检查：本轮源码、样式、测试和文档未发现行尾空白。

### Notes

- `src/pages/GraphsPage.tsx`：实现横向内嵌卡片搜索、画布缩放和平移、悬浮完整预览、底部详情联动、太阳系 3D 渲染和响应式标签。
- `src/styles/graphs.css`：扩大图谱工作区，补充搜索弹层、悬浮预览、近不透明详情层、太阳系视觉与桌面和移动端布局。
- `src/graphs/solarOrbitLayout.ts`：新增可测试的太阳系轨道布局算法，负责太阳、普通行星、父分支方向和 AI 小陨石坐标。
- `src/three-runtime.d.ts`：补充轨道线、几何体、材质、分组和向量的 Three.js 类型声明。
- `tests/frontend/graphs-page.test.tsx`：覆盖内嵌搜索、删除层级选择、横向缩放和平移、完整悬浮预览、3D 标签和太阳系层级行为。
- `tests/frontend/solar-orbit-layout.test.ts`：覆盖轨道半径、默认相机平面、父分支方向、兄弟展开、AI 小陨石和确定性布局。
- `docs/知识图谱.md`：更新横向编辑、卡片搜索、悬浮和点击预览、2D 预览、太阳系 3D 预览与验收说明。
- `progress.md`：仅在末尾追加本轮实现、验证、文件清单与回滚说明。
- 回滚方式：本轮未修改数据库结构和真实业务数据；恢复 `src/pages/GraphsPage.tsx`、`src/styles/graphs.css`、`src/three-runtime.d.ts`、`tests/frontend/graphs-page.test.tsx` 和 `docs/知识图谱.md` 到本节开始前状态，删除 `src/graphs/solarOrbitLayout.ts` 与 `tests/frontend/solar-orbit-layout.test.ts`，并移除本节日志即可回滚。

## 2026-08-03 - Task: 修复横向编辑用户初始稿搜索无响应

### What was done

- 修正横向编辑器搜索浮层的高度参照，避免搜索结果被顶部表单裁成极窄区域；输入关键词后用户初始稿结果可完整显示并滚动查看。
- 新增样式回归测试，禁止搜索浮层再次使用依赖顶部表单高度的百分比上限。

### Testing

- 先运行新增回归测试并确认失败，修复后 `tests/frontend/liquid-glass-styles.test.ts` 与 `tests/frontend/graphs-page.test.tsx` 共 45 项测试全部通过。
- `npm run typecheck`：通过，前端与服务端 TypeScript 检查无错误。
- `npm run build:client`：通过；仅保留项目既有的客户端单包超过 500 kB 提示。
- Playwright 桌面端验证：搜索浮层由修复前的 26 像素恢复为最多 500 像素；输入“几何”后匹配初始稿完整可见，接口返回 200，控制台错误为 0。

### Notes

- `src/styles/graphs.css`：将横向搜索浮层最大高度改为按浏览器可视区计算。
- `tests/frontend/liquid-glass-styles.test.ts`：新增搜索浮层不得被父表单百分比高度裁切的回归测试。
- `progress.md`：仅在末尾追加本轮实现、验证、文件清单与回滚说明。
- 回滚方式：将 `src/styles/graphs.css` 中搜索浮层最大高度恢复为本节开始前的百分比写法，删除 `tests/frontend/liquid-glass-styles.test.ts` 本轮新增测试，并移除本节日志即可回滚。

## 2026-08-03 - Task: 修复 3D 图谱放大后文字未适配

### What was done

- 修正 3D 标签与镜头距离的缩放方向：镜头拉近时文字同步放大，拉远时适度缩小。
- 为标签设置最小和最大缩放范围，兼顾远景可见性与近景遮挡控制；普通节点和 AI 优化稿标签使用同一套规则。
- 补充镜头放大回归测试，并同步更新 3D 预览使用说明。

### Testing

- 新增回归测试先确认失败：相机距离从 900 拉近至 360 后，标签宽度仍保持 0.15；修复后 `tests/frontend/graphs-page.test.tsx` 的 36 项测试全部通过。
- `npm run typecheck`：通过，前端与服务端 TypeScript 检查无错误。
- `npm run build:client`：通过；仅保留项目既有的客户端单包超过 500 kB 提示。
- Playwright 桌面端验证：连续点击两次“放大图谱”后，普通节点与 AI 标签均明显增大，控制台错误为 0。

### Notes

- `src/pages/GraphsPage.tsx`：反转 3D 标签缩放公式，并调整近景与远景尺寸上下限。
- `tests/frontend/graphs-page.test.tsx`：新增放大后标签增长回归，并将旧的反向缩放断言更新为正确行为。
- `docs/知识图谱.md`：明确 3D 标签近景放大、远景缩小及尺寸限制规则。
- `progress.md`：仅在末尾追加本轮实现、验证、文件清单与回滚说明。
- 回滚方式：恢复 `src/pages/GraphsPage.tsx` 本轮修改的三个标签缩放常量与公式，恢复 `tests/frontend/graphs-page.test.tsx` 本轮新增和调整的断言，恢复 `docs/知识图谱.md` 对应说明，并移除本节日志即可回滚。

## 2026-08-03 - Task: 将卡片搜索移入节点添加弹窗并修复结果滚动

### What was done

- 移除横向编辑顶部只能创建根节点的卡片搜索入口，将搜索能力放入每个节点的子节点添加弹窗。
- 从搜索结果添加卡片时，按当前父节点的下一层级创建节点，并自动建立父节点到新卡片节点的“分支”关系。
- 为搜索结果设置独立滚动区域和稳定高度，支持查看完整首屏搜索结果，不会带动画布。

### Testing

- 新增回归测试先确认失败，修复后 `tests/frontend/graphs-page.test.tsx` 的 37 项测试全部通过。
- `npm run typecheck`：通过，前端与服务端 TypeScript 检查无错误。
- `npm run build:client`：通过；仅保留项目既有的客户端单包超过 500 kB 提示。
- Playwright 桌面端验证：节点弹窗内加载 12 条搜索结果，可视高度 320 像素、内容高度 2037 像素；真实鼠标滚轮可将列表从 0 滚动到 900 像素，顶部旧搜索入口数量为 0。

### Notes

- `src/pages/GraphsPage.tsx`：将卡片搜索迁入节点子节点弹窗，并按父节点层级创建卡片子节点和分支关系。
- `src/styles/graphs.css`：为弹窗内搜索结果增加固定上限、独立纵向滚动和结果摘要截断。
- `tests/frontend/graphs-page.test.tsx`：新增父子层级与分支回归，并将旧顶部搜索用例更新为节点弹窗搜索语义。
- `docs/知识图谱.md`：更新卡片搜索入口、滚动方式和父子关系说明。
- `progress.md`：仅在末尾追加本轮实现、验证、文件清单与回滚说明。
- 回滚点：恢复上述四个业务、样式、测试和文档文件至本节开始前状态，并删除本节进度记录；本轮未修改数据库结构和真实业务数据。
## 2026-08-08 - Task: 新增每日 Anki 初始稿卡组与 cc-connect 推送

### What was done

- 每日从未归档且已有可靠 AI 题面的用户初始稿中随机抽取最多 10 条，按完整原始内容去重，避免同一初始稿因衍生多个问题被重复发送。
- 将抽取结果先整理为中文 Markdown，再生成包含稳定编号、DeepSeek 衍生题面和完整初始稿答案的 Anki `.apkg` 卡组；输出文件按本地日期保存到 `output/anki/`。
- 补齐 Anki schema 11 的牌组、复习配置、复习日志表和索引，避免仅能解压但无法被 Anki 可靠解析。
- 新增每日生成服务、命令行入口和本地接口；设置页增加“生成并发送今日 Anki”入口，发送失败时保留已经生成的两个文件。
- 接入 cc-connect 附件发送，Windows 自动绕过 npm 脚本垫片并启动安装包内原生程序；已全局安装 `cc-connect v1.4.1`。
- 更新版后端已启动在 `127.0.0.1:8788`，前端开发服务已启动在 `127.0.0.1:5173` 并代理到更新版后端。

### Testing

- 按测试驱动流程先确认日期、Anki 复习日志、官方 schema 关键字段、可靠 AI 题面筛选和 Windows 原生程序解析用例失败，完成修复后对应回归全部通过。
- `npm test -- --run tests/server/anki-source.test.ts tests/server/anki-apkg.test.ts tests/server/anki-sender.test.ts tests/server/anki-daily.test.ts tests/server/anki-routes.test.ts tests/frontend/settings-page.test.tsx tests/server/health.test.ts`：通过，7 个测试文件、43 项测试全部通过。
- `npm run typecheck`：通过，前端与服务端 TypeScript 检查无错误。
- `npm run build`：通过，客户端与服务端构建成功；仅保留项目既有的客户端单包超过 500 kB 提示。
- `npm test -- --run`：49 个测试文件中 48 个通过，655 项中 654 项通过；唯一失败为既有知识图谱搜索浮层样式断言，与本轮 Anki 文件无交集。
- 真实本地数据验证：成功生成 10 条去重初始稿、`daily-review-2026-08-08.md` 和 `daily-review-2026-08-08.apkg`；cc-connect 原生程序已成功启动并明确返回后台 socket 尚未运行，生成文件未丢失。
- 开发服务接口验证：通过 `http://127.0.0.1:5173/api/anki/daily` 生成 10 张卡，健康检查和前端代理均正常。

### Notes

- `.env.example`：补充 Anki 输出目录和 cc-connect 命令配置示例。
- `package.json`：新增 `anki:daily` 手动生成与发送命令。
- `server/anki/markdown.ts`：将用户初始稿整理为可追溯的中文 Markdown 中间文档。
- `server/anki/apkg.ts`：生成符合 Anki schema 11 关键结构的 `.apkg` 卡组。
- `server/anki/source.ts`：抽取、去重并随机选择带可靠 AI 题面的用户初始稿。
- `server/anki/sender.ts`：封装 cc-connect 双附件发送、结构化失败结果、超时终止和 Windows 原生程序解析。
- `server/anki/daily.ts`：编排每日抽取、Markdown 转换、卡组生成、落盘和发送。
- `server/anki/routes.ts`：新增每日 Anki 本地接口及参数校验。
- `server/anki/cli.ts`：新增定时任务可调用的命令行入口。
- `server/config.ts`：读取 Anki 输出目录和 cc-connect 命令配置。
- `server/app.ts`：允许挂载每日 Anki 路由。
- `server/index.ts`：在应用启动时组装每日 Anki 服务与发送器。
- `src/pages/SettingsPage.tsx`：新增立即生成并发送今日 Anki 的设置入口和状态提示。
- `tests/server/anki-source.test.ts`：覆盖初始稿筛选、分类、去重、随机上限和可靠 AI 题面要求。
- `tests/server/anki-apkg.test.ts`：覆盖 Markdown 内容、卡组压缩结构、数据库表和官方 schema 关键字段。
- `tests/server/anki-sender.test.ts`：覆盖附件参数、Windows 原生程序解析、命令失败、缺失和超时。
- `tests/server/anki-daily.test.ts`：覆盖十张卡落盘、无数据分支和本地日期命名。
- `tests/server/anki-routes.test.ts`：覆盖每日接口生成、发送和非法参数。
- `tests/frontend/settings-page.test.tsx`：覆盖设置页生成并发送入口。
- `tests/server/health.test.ts`：覆盖新增 Anki 环境配置默认值。
- `docs/anki-cc-connect.md`：记录功能边界、手动命令、定时任务、环境变量和接口使用方式。
- `progress.md`：仅在末尾追加本轮实现、验证、文件清单与回滚说明。
- 回滚方式：删除 `server/anki/`、本轮新增的五个 `tests/server/anki-*.test.ts` 和 `docs/anki-cc-connect.md`，恢复 `.env.example`、`package.json`、`server/config.ts`、`server/app.ts`、`server/index.ts`、`src/pages/SettingsPage.tsx`、`tests/frontend/settings-page.test.tsx` 与 `tests/server/health.test.ts` 中本轮 Anki 相关片段，并移除此节日志；如需同时移除外部工具，执行 `npm uninstall -g cc-connect`。本轮未修改数据库结构或用户数据，`output/anki/` 已被 Git 忽略。
## 2026-08-08 - Task: 设计卡片库 Anki 导出历史与启动自动发送

### What was done

- 明确卡片库手动导出的范围规则、独立批次文件、历史回顾和再次下载交互。
- 明确应用启动后按最近 24 小时成功发送时间决定是否随机发送 1 张卡，并限定只有发送成功才更新时间。
- 选择文件历史与现有 `app_settings` 方案，不新增数据库表，不改变卡片和复习协议。

### Testing

- 完成设计文档占位符、内部一致性、范围和歧义自检；未发现 `TBD`、`TODO` 或未决实现项。
- 本轮仅新增正式设计文档和进度记录，尚未修改业务代码，因此未运行代码测试。

### Notes

- `docs/superpowers/specs/2026-08-08-Anki导出与自动发送设计.md`：记录导出范围、历史文件、接口、卡片库交互、24 小时发送判定和验收标准。
- `progress.md`：仅在末尾追加本轮设计交付、检查结果、文件清单与回滚说明。
- 回滚方式：删除本轮设计文档并移除此节进度记录；本轮未修改业务代码、数据库结构或用户数据。
## 2026-08-08 - Task: 编制 Anki 导出与自动发送实施计划

### What was done

- 将已批准规格拆成通用数据源、导出历史服务、24 小时自动发送、接口组装、卡片库交互和验证记录六个可执行任务。
- 明确并行代理的独立文件责任和共享入口单写规则，避免并行修改冲突。
- 为每项行为规定测试先行的红灯、最小实现和绿灯验证命令。

### Testing

- 完成实施计划的规格覆盖、占位符、类型命名和任务依赖自检；规格中的导出范围、历史回顾、再次下载、24 小时判定、成功后记录和文件隔离均有对应任务。
- 本轮仅新增实施计划和进度记录，尚未修改业务代码，因此未运行代码测试。

### Notes

- `docs/superpowers/plans/2026-08-08-Anki导出与自动发送实施计划.md`：记录六项测试驱动施工任务、文件责任、接口和验证命令。
- `progress.md`：仅在末尾追加本轮计划交付、检查结果、文件清单与回滚说明。
- 回滚方式：删除本轮实施计划并移除此节进度记录；本轮未修改业务代码、数据库结构或用户数据。

## 2026-08-08 - Task: 完成卡片库 Anki 导出历史与启动自动发送

### What was done

- 在卡片库增加“导出 Anki”和“导出记录”：有勾选时仅导出选中初始稿，无勾选时导出全部合格初始稿；成功后立即下载 `.apkg`。
- 为每次手动导出保存独立批次，可在底部白色玻璃面板查看题面、分类和完整初始稿答案，并再次下载历史卡组。
- 应用服务每次启动后异步检查最近一次成功发送时间；不足 24 小时跳过，否则随机生成并通过 cc-connect 发送 1 张，只有发送成功才更新时间。
- 自动发送文件使用本地时间和独立短编号，避免同秒重启覆盖；异常未来时间不再阻止发送。
- 历史面板补齐键盘焦点循环、关闭后焦点恢复、滚动条宽度补偿、底部弹簧进入动效和减少动态效果适配。
- 复用现有 `app_settings` 保存成功时间，未新增数据库表或迁移；导出文件继续保存在 Git 忽略目录。

### Testing

- 测试驱动红灯已覆盖通用初始稿选择、导出历史服务、24 小时门禁、导出接口、界面导出与回顾，以及审查发现的未来时间、同秒文件覆盖、焦点逃逸、页面横移、动效和选中数量问题。
- `npm test -- --run tests/server/anki-source.test.ts tests/server/anki-library-exports.test.ts tests/server/anki-daily.test.ts tests/server/anki-auto-send.test.ts tests/server/anki-routes.test.ts tests/frontend/cards-page.test.tsx`：通过，6 个测试文件、98 项测试全部通过。
- `npm run typecheck`：通过，前端与服务端 TypeScript 检查无错误。
- `npm run build`：通过，客户端与服务端生产构建成功；仅保留项目既有的客户端单包超过 500 kB 提示。
- `npm test -- --run`：51 个测试文件中 50 个通过，686 项中 685 项通过；唯一失败仍为既有 `横向图谱搜索浮层使用视口高度而不会被顶部表单裁切` 样式断言，与本轮 Anki 文件无交集。
- 真实本地数据闭环：创建 1 个包含 63 张去重初始稿的批次，历史摘要、63 条完整非空答案和 `.apkg` 下载均验证成功，下载响应为 200、文件大小 151770 字节。
- 运行中服务验证：启动后自动发送检查已实际执行；当前 cc-connect 后台未运行时返回未完成，服务仍正常监听，不写成功时间。
- `git diff --check`：通过；`output/anki/` 及其历史导出文件由 `.gitignore` 排除。
- 多智能体最终只读质量审查通过，未发现 P1/P2 阻断问题。

### Notes

- `server/anki/source.ts`：增加指定卡片或全部卡片的非随机去重初始稿选择能力。
- `server/anki/libraryExports.ts`：新增手动导出批次的创建、列表、详情和安全下载路径服务。
- `server/anki/daily.ts`：允许自动发送使用独立且受控的文件名前缀。
- `server/anki/autoSend.ts`：新增 24 小时成功发送门禁、并发合并、未来时间处理和唯一短编号。
- `server/anki/routes.ts`：增加卡片库导出创建、历史列表、详情与下载接口。
- `server/index.ts`：组装导出服务，并在服务监听后异步执行自动发送检查。
- `src/pages/CardsPage.tsx`：增加 Anki 导出按钮、选中数量、历史回顾面板和完整交互状态。
- `src/styles/cards-glass.css`：增加白色底部历史面板、响应式布局、弹簧进入和减少动态效果样式。
- `tests/server/anki-source.test.ts`：覆盖指定编号和非随机顺序。
- `tests/server/anki-library-exports.test.ts`：覆盖批次创建、历史读取、完整答案、损坏元数据和安全下载。
- `tests/server/anki-daily.test.ts`：覆盖受控自动文件前缀且保持每日默认命名。
- `tests/server/anki-auto-send.test.ts`：覆盖 24 小时门禁、成功与失败落点、并发、未来时间和同秒唯一文件名。
- `tests/server/anki-routes.test.ts`：覆盖导出创建、列表、详情、下载、非法参数和缺失记录。
- `tests/frontend/cards-page.test.tsx`：覆盖导出范围、自动下载、历史回顾、错误状态、关闭方式、焦点、滚动补偿和动效。
- `docs/anki-cc-connect.md`：补充卡片库导出、历史目录、启动发送规则和接口说明。
- `progress.md`：仅在末尾追加本轮实现、验证、文件清单与回滚说明。
- 回滚方式：恢复上述业务、测试和文档文件至本节开始前状态，并删除本节进度记录；可删除 `ANKI_OUTPUT_DIR/exports/` 清理本轮本地导出产物。无需回滚数据库迁移；若需清除自动发送时间，仅删除 `app_settings` 中键 `anki_last_successful_send_at`。

## 2026-08-08 - Task: 修复 Anki 导出报错并启动 cc-connect

### What was done

- 定位到用户访问的旧 `127.0.0.1:8787` 仍运行旧生产构建，`POST /api/anki/exports` 返回 404；已重新构建并重启当前生产服务，保留原端口可用。
- 为 cc-connect 发送器增加可选数据目录参数，项目现在可以连接已运行的 `D:\cc-connect\cc-connect-data` API socket，不再误用默认空配置目录。
- 本地环境增加 `CC_CONNECT_DATA_DIR`，示例文档同步说明；DeepSeek 密钥未输出、未写入新文件、未进入提交范围。
- 启动并验证本机 cc-connect v1.4.1 进程及其 API socket，未发送额外测试消息。

### Testing

- 先复现红灯：新增数据目录参数测试和配置测试分别因参数未传递、配置字段不存在而失败。
- `npm test -- --run tests/server/anki-sender.test.ts tests/server/health.test.ts tests/server/anki-daily.test.ts tests/server/anki-auto-send.test.ts tests/server/anki-routes.test.ts`：通过，5 个测试文件、43 项测试全部通过。
- `npm run typecheck`：通过。
- `npm run build:server`：通过。
- `git diff --check`：通过。
- 真实端口验证：`http://127.0.0.1:8787/cards` 返回 200，`POST http://127.0.0.1:8787/api/anki/exports` 返回 201 并生成 63 张卡片导出批次；8788 和 5173 也保持可用。
- cc-connect 验证：v1.4.1 进程响应正常，`D:\cc-connect\cc-connect-data\run\api.sock` 存在，历史微信会话可读取；未发送额外测试消息。

### Notes

- `.env.example`：增加 `CC_CONNECT_DATA_DIR` 示例。
- `server/config.ts`：读取并解析 cc-connect 数据目录。
- `server/anki/sender.ts`：向 `cc-connect send` 注入受控 `--data-dir` 参数。
- `server/index.ts`：将数据目录传入发送器。
- `tests/server/anki-sender.test.ts`：覆盖数据目录参数映射。
- `tests/server/health.test.ts`：覆盖数据目录配置读取。
- `docs/anki-cc-connect.md`：补充数据目录配置说明。
- `progress.md`：仅在末尾追加本轮故障定位、修复、验证和回滚说明。
- `.env`：仅增加本机 cc-connect 数据目录配置；该文件已被 Git 忽略，保留原有密钥内容不变。
- 回滚方式：恢复上述代码、测试和文档文件至本节开始前状态并移除此节日志；删除 `.env` 中新增的 `CC_CONNECT_DATA_DIR` 行即可恢复原本地发送配置。旧 8787 进程若需回滚，可停止当前 `dist-server/index.js` 后启动原构建。

## 2026-08-08 - Task: 验证 cc-connect 活动会话边界

### What was done

- 使用真实生成的单卡文件验证 cc-connect 附件发送参数，确认数据目录已正确连接到 D 盘 API socket。
- 发现当前 cc-connect 只有历史微信会话、没有活动会话；CLI 明确返回 `no active session found`，未把该外部状态误记为项目发送成功。
- 保持 cc-connect 前台连接进程运行，平台日志已进入 `platform ready`；项目下次启动或手动发送会继续使用已生成文件。

### Testing

- `cc-connect send --data-dir D:\\cc-connect\\cc-connect-data --help`：确认当前版本支持重复 `--file`、`--message` 和 `--data-dir`。
- 真实单卡发送诊断：返回结构化 `COMMAND_FAILED/no active session found`，未发送错误消息，未丢失 Anki 文件。
- `GET http://127.0.0.1:8787/cards`：200；历史 `.apkg` 下载：200。

### Notes

- `docs/anki-cc-connect.md`：明确发送必须存在活动会话，历史会话不足以直接发送。
- `progress.md`：仅在末尾追加本轮外部依赖验证和回滚说明。
- 回滚方式：删除本节日志即可；不需要回滚代码或数据库。保持 cc-connect 运行状态不影响项目数据，停止它可执行 `taskkill /PID 28356 /F`。

## 2026-08-08 - Task: 将每日 Anki 自动发送数量调整为三个初始稿

### What was done

- 将应用启动后的每日自动发送数量从 1 个用户初始稿调整为 3 个，继续沿用随机抽取和 Anki 卡组生成流程。
- 保留原有 24 小时防重复门禁；只有 cc-connect 明确发送成功后才更新最近成功时间。
- 同步更新自动发送说明，手动导出数量和其他 Anki 功能保持不变。

### Testing

- 测试驱动红灯：修改期望后，`tests/server/anki-auto-send.test.ts` 的 8 个发送场景均因“期望 3、实际 1”失败，确认测试命中目标行为。
- `npm test -- --run tests/server/anki-auto-send.test.ts`：通过，12 项测试全部通过。
- `npm test -- --run tests/server/anki-auto-send.test.ts tests/server/anki-daily.test.ts tests/server/anki-source.test.ts tests/server/anki-sender.test.ts`：通过，4 个测试文件、30 项测试全部通过。
- `npm run typecheck`：通过。
- `npm run build:server`：通过。
- 生产服务重启验证：`http://127.0.0.1:8787/api/health` 返回 200；最近成功时间保持为 `2026-08-08T05:38:46.978Z`，证明 24 小时内未重复发送。

### Notes

- `server/anki/autoSend.ts`：将自动发送服务的每日抽取数量改为 3。
- `tests/server/anki-auto-send.test.ts`：更新成功、失败和连续检查场景的数量断言及测试文案。
- `docs/anki-cc-connect.md`：将启动时自动发送说明更新为随机抽取 3 个用户初始稿。
- `progress.md`：追加本轮实现、验证、文件清单与回滚说明。
- 回滚方式：将 `server/anki/autoSend.ts` 的 `generateAndSend(3, ...)` 恢复为 `generateAndSend(1, ...)`，同步恢复测试和文档中的数量，并移除本节进度记录后重新执行 `npm run build:server`、重启服务。

## 2026-08-08 - Task: 为用户初始稿增加单卡 Anki 手机发送

### What was done

- 在用户初始稿卡片的操作区增加单卡发送按钮，点击后直接调用 cc-connect 发送到手机端，并提供发送中、成功和失败状态。
- 新增按卡片编号生成单张 Anki 卡组的服务参数与路由，不改变批量导出和每日自动发送逻辑。
- 对非法编号、不可用初始稿和 cc-connect 发送失败分别返回明确错误，不产生数据库结构变更。

### Testing

- 测试驱动红灯：新增单卡发送路由和卡片库交互测试在实现前分别因路由不存在、发送按钮不存在而失败。
- `npm test -- --run tests/server/anki-routes.test.ts tests/server/anki-daily.test.ts tests/server/anki-auto-send.test.ts tests/server/anki-source.test.ts tests/server/anki-sender.test.ts tests/server/anki-library-exports.test.ts`：通过，6 个测试文件、42 项测试全部通过。
- `npm test -- --run tests/frontend/cards-page.test.tsx`：通过，69 项测试全部通过。
- `npm run typecheck`：通过。
- `npm run build`：通过，客户端和服务端构建成功，仅保留既有客户端包体积提示。

### Notes

- `server/anki/daily.ts`：支持按指定 `cardIds` 生成单卡 Anki 卡组。
- `server/anki/routes.ts`：新增 `POST /api/anki/cards/:cardId/send` 单卡发送接口。
- `src/pages/CardsPage.tsx`：用户初始稿卡片增加发送到手机按钮和状态反馈。
- `tests/server/anki-routes.test.ts`：覆盖单卡发送、非法编号和不可用卡片。
- `tests/server/anki-daily.test.ts`：覆盖按编号定向生成卡组。
- `tests/frontend/cards-page.test.tsx`：覆盖卡片按钮调用 cc-connect 发送接口及成功提示。
- `docs/anki-cc-connect.md`：补充单卡发送接口和使用说明。
- `progress.md`：追加本轮实现、验证、文件清单与回滚说明。
- 回滚方式：删除单卡路由及 `DailyAnkiGenerateOptions.cardIds` 定向分支，移除卡片库按钮和对应测试、文档段落后，重新执行 `npm run build` 并重启服务。

## 2026-08-08 - Task: 设计申论答题纸页面

### What was done

- 明确新增独立“申论”页面，侧栏入口位于“复盘”下方，整体延续现有项目并采用克制的 Apple 式材质与交互反馈。
- 定义每行 25 格、四种字数模板、中英文占格、中文分词、标点避首、每 200 字水印和超限警示规则。
- 定义普通备注、复盘内部链接、选中文字批注、浅色连接箭头、本地草稿、打印 PDF 和快捷键的完整交互边界。
- 划分排版逻辑、申论页面、页面样式与共享入口的并行施工责任区，避免多智能体修改同一文件。

### Testing

- 已按用户确认内容检查页面结构、超链接语法、批注与备注共存方式以及快捷键映射。
- 已完成设计文档占位符、内部一致性、范围和歧义检查；未发现 `TODO`、`TBD` 或未定交付项。
- 本轮只形成设计文档，尚未修改运行时代码；实现验证将在后续施工任务中执行。

### Notes

- `docs/superpowers/specs/2026-08-08-申论答题纸设计.md`：新增申论页面的产品、交互、排版、批注、打印、快捷键和验证设计。
- `progress.md`：仅在末尾追加本轮设计、检查证据、文件清单和回滚说明。
- 回滚方式：删除 `docs/superpowers/specs/2026-08-08-申论答题纸设计.md`，并移除本节进度记录；若设计文档已单独提交，可执行 `git revert --no-edit <设计提交哈希>`。

## 2026-08-08 - Task: 编写申论答题纸实施计划

### What was done

- 将已批准设计拆分为七个按依赖推进的测试驱动任务，覆盖排版、草稿、备注链接、复盘锚点、页面样式、批注箭头、快捷键、路由、文档和最终验证。
- 明确首轮四个互不冲突的并行责任区，以及页面和共享入口的串行整合顺序。
- 为每项任务写明准确文件、失败测试、最小接口、验证命令、预期结果和统一提交边界。

### Testing

- 已对照设计文档检查需求覆盖，排版、粘贴、模板、水印、超限、备注、链接、批注、箭头、快捷键、本地草稿、打印和响应式均有实施与验证落点。
- 已检查计划中的类型名称和跨任务导出接口保持一致，未发现 `TODO`、`TBD`、待定实现或未定义的后续调用名称。
- 本轮只新增实施计划，尚未修改运行时代码；代码红绿测试将在计划执行阶段逐项产生。

### Notes

- `docs/superpowers/plans/2026-08-08-申论答题纸实施计划.md`：新增可直接执行的七任务测试驱动施工计划和多智能体文件责任边界。
- `progress.md`：仅在末尾追加本轮计划、检查证据、文件清单和回滚说明。
- 回滚方式：删除 `docs/superpowers/plans/2026-08-08-申论答题纸实施计划.md` 并移除本节进度记录；若计划文档已单独提交，可执行 `git revert --no-edit <计划提交哈希>`。

## 2026-08-08 - Task: 限制未整理初始稿的无效 Anki 发送

### What was done

- 保留所有用户初始稿的 Anki 发送入口，但对待 AI 整理或已归档卡片禁用按钮，避免点击后产生无效发送请求。
- 禁用状态补充“完成 AI 整理后可发送”提示，已整理初始稿继续使用 cc-connect 单卡发送流程。

### Testing

- `npm test -- --run tests/frontend/cards-page.test.tsx -t '用户初始稿卡片可以直接通过 cc-connect 发送 Anki 到手机|待整理初始稿保留发送入口但避免触发无效发送'`：通过，2 项测试全部通过。
- `npm run build`：通过，客户端和服务端构建成功。
- 生产服务重启验证：`http://127.0.0.1:8787/api/health` 返回 200，非法单卡发送请求返回 400，最近每日发送时间保持不变。

### Notes

- `src/pages/CardsPage.tsx`：为未整理或已归档初始稿增加禁用条件和提示。
- `tests/frontend/cards-page.test.tsx`：新增待整理初始稿不可触发发送的回归测试。
- `progress.md`：追加本轮边界修正、验证和回滚说明。
- 回滚方式：移除发送按钮的 `card.archived` 和 `card.aiStatus` 禁用条件及对应测试、日志即可，不涉及数据库或历史 Anki 文件。

## 2026-08-08 - Task: 单卡 Anki 发送最终回归核对

### What was done

- 完成单卡发送功能的最终卡片库回归和生产服务核对，未发现对既有卡片操作的影响。
- 保持申论草稿模块的既有问题不变，未扩大本轮任务范围。

### Testing

- `npm test -- --run tests/frontend/cards-page.test.tsx`：通过，70 项测试全部通过。
- `npm run typecheck`：未通过；仓库既有 `src/shenlun/draft.ts` 2 个类型错误和 `tests/frontend/shenlun-draft-notes.test.ts` 1 个类型不匹配错误，与本轮 Anki 文件无关。
- Anki 服务单测、卡片库单测、`npm run build` 均已在本轮前后通过；生产健康检查仍返回 200。

### Notes

- `progress.md`：追加最终回归结果和未解决的既有类型检查缺口。
- 回滚方式：删除本节日志即可；单卡发送功能的回滚点见上一节，申论模块错误需单独处理。

## 2026-08-08 - Task: 新增申论答题纸、批注与备注工作区

### What was done

- 新增“申论”一级页面并接入主导航，支持 200、400、800、1000 字模板、每行 25 格、中文标点避首、英数字符两字符一格、200 字水印和超限淡红提示。
- 实现剪贴板逐字符填格、普通备注与复盘锚点链接、批注卡片和浅色箭头、本地草稿恢复、独立清空备注以及打印 PDF 保留链接。
- 增加 Alt 模板切换、组合键粘贴、选区批注、打印和 Esc 取消等快捷键，并补充申论中文使用文档。

### Testing

- `npm test -- --run tests/frontend/shenlun-layout.test.ts tests/frontend/shenlun-draft-notes.test.ts tests/frontend/shenlun-styles.test.ts tests/frontend/shenlun-page.test.tsx tests/frontend/review-page.test.tsx tests/frontend/app-shell.test.tsx`：通过，6 个文件 107 项测试全部通过。
- `npm run typecheck`：通过。
- `npm run build`：通过，客户端与服务端构建成功；仅保留既有大包体积提示。
- 浏览器验证：Chromium 实际访问 `http://127.0.0.1:5183/shenlun`，确认桌面与 390px 窄屏截图、模板切换、200 字水印、备注链接、选区批注和箭头渲染；Playwright CLI 的移动设备预设因本机未安装 WebKit 未执行，已改用 Chromium 窄屏视口完成等价检查。
- `npm test -- --run`：申论及其他相关测试通过；全量套件仍有仓库既有 `tests/frontend/liquid-glass-styles.test.ts` 图谱搜索样式断言失败，本轮未触碰该模块。

### Notes

- `src/shenlun/layout.ts`：实现 25 格排版、字符/格计数、标点与分词换行、水印和超限数据。
- `src/shenlun/draft.ts`：实现申论草稿本地存储和批注位置恢复。
- `src/shenlun/notes.ts`：解析受限的复盘内部链接标记语法。
- `src/shenlun/selection.ts`：读取答题格文字选区并生成批注定位信息。
- `src/pages/ShenlunPage.tsx`：新增申论页面状态、粘贴、快捷键、批注和打印入口。
- `src/components/ShenlunGrid.tsx`：渲染答题格、水印和选区事件。
- `src/components/ShenlunNotesRail.tsx`：渲染普通备注、链接预览和批注卡片。
- `src/components/ShenlunConnectors.tsx`：绘制随工作区尺寸更新的浅色批注箭头。
- `src/styles/shenlun.css`：新增 Apple 风格工作区、网格、备注、批注、响应式和打印样式。
- `src/App.tsx`、`src/components/AppShell.tsx`：增加申论路由及“复盘”下方导航入口。
- `src/pages/ReviewPage.tsx`：为复盘条目增加可跳转锚点。
- `tests/frontend/shenlun-layout.test.ts`、`shenlun-draft-notes.test.ts`、`shenlun-styles.test.ts`、`shenlun-page.test.tsx`：覆盖排版、草稿、样式和页面交互。
- `tests/frontend/app-shell.test.tsx`、`tests/frontend/review-page.test.tsx`：覆盖新入口和复盘锚点回归。
- `docs/申论答题纸.md`：记录使用方式、链接语法、快捷键和打印规则。
- 回滚方式：本轮未提交；删除以上新增申论文件，并仅按本节差异撤销 `src/App.tsx`、`src/components/AppShell.tsx`、`src/pages/ReviewPage.tsx` 及对应测试中的申论入口/锚点改动，保留工作树中的其他用户修改。

## 2026-08-08 - Task: 申论最终回归核验

### What was done

- 将英数字符的实际字符计数与超限判断独立于占用格数，补充换行后闭合标点不跨越原文换行的保护。
- 移除粘贴失败路径中的临时调试输出，保持页面错误提示可见但不污染控制台。

### Testing

- 申论、复盘锚点和导航相关测试：6 个文件 108 项全部通过。
- `npm run typecheck`：通过。
- `npm run build`：通过。
- 全量测试仍仅报告既有图谱搜索样式断言失败，申论相关测试未失败。

### Notes

- `src/shenlun/layout.ts`：补充实际字符计数和硬换行标点边界。
- `src/pages/ShenlunPage.tsx`：移除临时粘贴调试输出。
- `tests/frontend/shenlun-layout.test.ts`：新增英数字符计数和硬换行回归测试。
- `progress.md`：追加最终核验记录。
- 回滚方式：保留本轮未提交状态；如需回滚，仅反向应用上述三个文件的本节差异，不触碰其他用户改动。

## 2026-08-09 - Task: 完善申论类 Word 编辑、复盘保存与卡片库回看

### What was done

- 将申论答题纸升级为可在任意方格定位的类 Word 编辑器，支持输入、粘贴、复制、剪切、方向键、全选删除、撤销重做、加粗、下划线、删除线及完整快捷键；修正反向拖选、换行留白定位和移动端输入。
- 新增标准答案导入、透明玻璃右栏、备注内部链接、批注箭头与上下排序；批注在重复词语、结构空位和横向滚动后保持正确位置。
- 经用户批准新增独立 `shenlun_reviews` 表及版本 8 迁移，提供列表、详情、新建和原记录更新接口；本地草稿记录复盘编号，保存竞态不会误报“已保存”。
- 在卡片库增加“申论复盘”同级页签，支持摘要列表、完整预览和返回原记录编辑；正文格式、标准答案、备注链接和批注均可回看。
- 将 PDF 调整为 A4 横向双栏，保留标题、答题格、标准答案、备注、批注和可点击复盘链接，并同步更新申论中文使用文档、设计说明与实施计划。

### Testing

- TDD 红绿验证：先复现复制剪切缺失、打印内容缺失、批注越界、反向拖选、末尾及中间留白定位、保存竞态、草稿编号恢复、批注重定位、方向键/移动输入、箭头滚动刷新和卡片库链接等失败，再修复至通过。
- `npm test -- --run tests/frontend/shenlun-editor.test.ts tests/frontend/shenlun-layout.test.ts tests/frontend/shenlun-draft-notes.test.ts tests/frontend/shenlun-styles.test.ts tests/frontend/shenlun-page.test.tsx tests/frontend/shenlun-review-library.test.tsx tests/frontend/shenlun-route.test.tsx tests/frontend/cards-page.test.tsx tests/frontend/app-shell.test.tsx tests/frontend/review-page.test.tsx tests/server/shenlun-reviews.test.ts tests/server/database.test.ts`：通过，12 个文件 255 项测试全部通过。
- `npm test -- --run tests/server/card-folders.test.ts tests/server/backups.test.ts`：通过，2 个文件 68 项迁移与恢复测试全部通过。
- `npm run typecheck`：通过；客户端和服务端 TypeScript 检查均无错误。
- `npm run build`：通过；客户端和服务端构建成功，仅保留既有大包体积提示。
- `npm test -- --run`：59 个文件中 58 个通过，811 项中 810 项通过；唯一失败为既有 `tests/frontend/liquid-glass-styles.test.ts` 图谱搜索浮层样式断言，与申论改动无关。
- 浏览器与 PDF 验证：Chromium 实测新建保存跳转、卡片库预览、原记录编辑更新、1440px 与 390px 布局，控制台 0 错误；导出 PDF 为 1 页 A4 横向双栏，渲染图无覆盖，`pypdf` 检出 `/review#review-item-target` 可点击链接。
- `git diff --check`：通过；仅输出工作树既有 LF/CRLF 提示。

### Notes

- `server/db/migrations/008_shenlun_reviews.sql`、`server/db/migrations.ts`：新增并注册申论复盘表结构迁移。
- `server/shenlunReviews/`、`server/app.ts`、`server/index.ts`、`shared/contracts.ts`：实现申论复盘契约、仓储、服务、路由和应用挂载。
- `src/shenlun/editor.ts`、`src/shenlun/layout.ts`、`src/shenlun/draft.ts`、`src/shenlun/notes.ts`：实现编辑历史、方格排版、草稿迁移、批注重定位和安全链接解析。
- `src/pages/ShenlunPage.tsx`、`src/components/ShenlunGrid.tsx`、`src/components/ShenlunNotesRail.tsx`、`src/components/ShenlunConnectors.tsx`：实现类 Word 编辑、标准答案、备注批注和箭头交互。
- `src/components/ShenlunReviewLibrary.tsx`、`src/pages/CardsPage.tsx`、`src/App.tsx`：接入申论复盘卡片库、预览和编辑路由。
- `src/styles/shenlun.css`、`src/styles/shenlun-library.css`：实现 Apple 风格工作区、透明玻璃右栏、响应式布局和 A4 横向打印。
- `tests/frontend/shenlun-*.test.ts*`、`tests/frontend/cards-page.test.tsx`、`tests/frontend/app-shell.test.tsx`、`tests/frontend/review-page.test.tsx`、`tests/server/shenlun-reviews.test.ts`、`tests/server/database.test.ts`、`tests/server/card-folders.test.ts`、`tests/server/backups.test.ts`：覆盖本轮功能及迁移回归。
- `docs/申论答题纸.md`、`docs/superpowers/specs/2026-08-09-申论复盘与类Word编辑设计.md`、`docs/superpowers/plans/2026-08-09-申论复盘与类Word编辑实施计划.md`：记录使用方式、设计决策和施工步骤。
- `progress.md`：追加本轮实现、验证与回滚说明。
- 回滚点：设计基线提交为 `9a1e75b`。申论专属新增路径可按本节文件清单移除；`server/app.ts`、`server/index.ts`、`server/db/migrations.ts`、`shared/contracts.ts`、`src/App.tsx`、`src/pages/CardsPage.tsx` 等共享文件只反向应用申论相关导入、路由、挂载和页签代码块，禁止整体还原，以免覆盖工作树中的其他用户修改。

## 2026-08-09 - Task: 修复申论正文输入及英数、空格排版

### What was done

- 修复隐藏输入代理持续清空组合文本的问题；中文输入法组合期间保留临时文本，结束时只提交一次，并在组合结果缺失时从输入框兜底读取，避免正文不落字或页面崩溃。
- 组合期间拦截键盘字符，避免同一汉字被键盘事件与组合结束事件重复写入；移动端直接输入、粘贴和既有快捷键保持可用。
- 将英文字母和数字的双字符格改为左右横排；普通空格占一格并计入字数与超限，Tab 生成的结构空位仍不计字数。
- 同步更新申论使用文档中的输入法、英数排版和空格计数规则。

### Testing

- TDD 红灯：中文组合输入缺少结果时保持 0 字，组合期键盘事件会重复落字，普通空格保持 0 字，英数双字符样式未声明横排；修复后对应回归测试全部通过。
- `npx vitest run tests/frontend/shenlun-page.test.tsx tests/frontend/shenlun-layout.test.ts tests/frontend/shenlun-grid-layout.test.tsx tests/frontend/shenlun-styles.test.ts`：通过，4 个文件 47 项测试全部通过。
- `npm run typecheck`：通过，客户端与服务端 TypeScript 检查均无错误。
- `npm run build`：通过，客户端与服务端构建成功；仅保留既有大包体积提示。
- `npm test`：60 个文件中 59 个通过，815 项中 814 项通过；唯一失败为既有 `tests/frontend/liquid-glass-styles.test.ts` 图谱搜索浮层样式断言，与本轮申论改动无关。
- 浏览器验证：Chromium 实测点击方格后输入 `申论A1 `，总字数为 5，中文仅落一次，`A1` 同格横排，空格独占一格，输入代理提交后清空；页面保持可见且控制台 0 错误、0 警告。截图保存于 `output/playwright/shenlun-input-fix-desktop.png`。
- `git diff --check`：通过；仅输出工作树既有 LF/CRLF 提示。

### Notes

- `src/pages/ShenlunPage.tsx`：修复中文组合输入提交、重复输入保护和普通空格写入。
- `src/shenlun/layout.ts`：保留普通空格为计数字符，同时继续忽略其他非正文空白。
- `src/styles/shenlun.css`：将格内字符容器改为横向 Flex 排列。
- `tests/frontend/shenlun-page.test.tsx`：新增中文输入法、重复提交和空格键回归测试。
- `tests/frontend/shenlun-layout.test.ts`：新增普通空格计数、超限和结构空位区分测试。
- `tests/frontend/shenlun-grid-layout.test.tsx`：新增英数双字符同格横排测试。
- `docs/申论答题纸.md`：补充本轮输入与排版规则。
- `progress.md`：追加本轮实现、验证和回滚说明。
- 回滚点：本轮未单独提交；回滚时仅反向应用以上文件中“非受控组合输入代理、组合状态拦截、普通空格保留、`.shenlun-cell` 横向 Flex、三组新增测试及文档条目”的本节差异，不得整体还原这些仍包含其他申论功能的未跟踪文件。

## 2026-08-09 - Task: 修复申论标点占格、末格输入与中文输入法拼音显示

### What was done

- 连续中文标点改为每两个共用一格；闭合标点落在行尾时与前一文字共格，并把第 25 格释放给后续正文。
- 修复模板最后一格缺少末端光标的问题，最后一格可正常写入中文，继续输入会生成溢出格并保留超限提示。
- 将原生输入法代理挂到页面根节点，消除玻璃主区域坐标系造成的 168px 偏移；聚焦前同步目标格坐标，拼音组合文本可见并随滚动、侧栏变化持续对齐。
- 移除输入法代理的全局焦点外框，只保留当前方格光标提示，并同步更新申论使用文档。

### Testing

- TDD 红绿验证：先复现连续标点拆格、行尾标点挤占第 25 格、末格组合输入缺失、输入法代理不在页面根节点、聚焦时沿用旧坐标、焦点外框及滚动监听事件误传问题，再修复至通过。
- `npx vitest run tests/frontend/shenlun-layout.test.ts tests/frontend/shenlun-editor.test.ts tests/frontend/shenlun-page.test.tsx tests/frontend/shenlun-styles.test.ts tests/frontend/shenlun-grid-layout.test.tsx`：通过，5 个文件 65 项测试全部通过。
- `npm run typecheck`：通过，客户端与服务端 TypeScript 检查均无错误。
- `npm run build`：通过，客户端与服务端构建成功；仅保留既有大包体积提示。
- Chromium 实测：侧栏展开、折叠及页面滚动后，拼音输入代理与当前格横纵坐标误差均为 0px；`shen`、`lun` 组合文本可见，提交后正文得到“申论”且焦点保持。
- Chromium 实测：`甲。”乙！？丙` 排为 `甲｜。”｜乙｜！？｜丙`；24 个“甲”后输入 `，乙` 时第 24 格为“甲，”、第 25 格为“乙”；第 200 格提交“末”后可在第 201 格继续写入“续”。

### Notes

- `src/shenlun/layout.ts`：实现连续标点配对占格及行尾闭合标点与前文共格。
- `src/components/ShenlunGrid.tsx`：增加模板满格时的末端光标，并把点击目标格传给输入聚焦逻辑。
- `src/pages/ShenlunPage.tsx`：将输入法代理 portal 到页面根节点，修正聚焦前定位和滚动、缩放同步。
- `src/styles/shenlun.css`：显示组合输入文本、增加末格光标并清除代理输入框焦点外框。
- `tests/frontend/shenlun-layout.test.ts`：新增连续标点和行尾闭合标点占格回归测试。
- `tests/frontend/shenlun-editor.test.ts`：调整末格空位用例以覆盖分词换行形成的真实结构空位。
- `tests/frontend/shenlun-page.test.tsx`：新增末格组合输入、页面根节点、聚焦前定位和滚动跟随测试。
- `tests/frontend/shenlun-styles.test.ts`：新增可见组合输入、末格光标和焦点外框约束。
- `docs/申论答题纸.md`：补充标点共格、行尾标点、末格输入和拼音显示规则。
- `output/playwright/shenlun-ime-aligned.png`：保存输入法组合文本与当前格对齐的浏览器验证截图。
- `progress.md`：追加本轮实现、验证与回滚说明。
- 回滚点：本轮未单独提交；回滚时仅反向应用上述源码、测试、文档和本节日志的对应差异，并删除 `output/playwright/shenlun-ime-aligned.png`。这些申论文件仍包含其他未提交功能，禁止整体删除或还原。

## 2026-08-09 - Task: 修复申论保存失败与卡片库无法恢复加载

### What was done

- 确认现有申论接口、数据库记录和正常 PUT 保存链路可用，将不可恢复场景定位为本地草稿持有失效复盘编号，以及卡片库首次请求失败后错误状态锁死。
- 编辑旧记录遇到 404 时自动改为 POST 新建，并切换到新记录地址，避免用户反复保存失败。
- 卡片库错误状态增加就地重新加载入口，请求恢复后直接显示申论复盘列表。

### Testing

- TDD 红灯：失效复盘编号保存后显示“保存失败”，卡片库失败页不存在重新加载按钮；修复后两项回归测试通过。
- `npx vitest run tests/frontend/shenlun-page.test.tsx tests/frontend/shenlun-review-library.test.tsx tests/server/shenlun-reviews.test.ts`：通过，3 个文件 47 项测试全部通过。
- 实际接口与浏览器验证：`GET /api/shenlun-reviews`、记录详情和 PUT 保存均返回 200；卡片库申论页签成功显示现有记录。

### Notes

- `src/pages/ShenlunPage.tsx`：为失效复盘编号增加 404 后自动新建与新地址切换。
- `src/components/ShenlunReviewLibrary.tsx`：为列表加载失败增加可重复执行的重新加载状态。
- `tests/frontend/shenlun-page.test.tsx`：新增旧记录不存在时恢复保存的回归测试。
- `tests/frontend/shenlun-review-library.test.tsx`：新增失败后重新加载列表的回归测试。
- `docs/申论答题纸.md`：补充失效记录保存和卡片库重新加载行为。
- `progress.md`：追加本项实现、验证和回滚说明。
- 回滚方式：仅反向应用本节所列文件中的 404 自动新建、列表重试、对应测试和文档日志差异；不得整体还原这些包含其他未提交申论功能的文件。

## 2026-08-09 - Task: 修复申论页面放大后的完整展示

### What was done

- 将等效 200% 浏览器缩放范围纳入独立响应式规则，工具栏改为吸顶并保持模板按钮四列等宽。
- 放大后答题纸使用限定高度的双向滚动视口，横向滚动条不再藏在整张长稿纸底部；右侧功能区按完整宽度下移。
- 移除会破坏吸顶定位的页面根级裁切，页面保持无横向溢出，滚动只发生在答题纸内部。

### Testing

- TDD 红灯：760px 以下不存在缩放布局，新增页面根裁切后吸顶工具栏失效；修复后响应式约束通过。
- `npx vitest run tests/frontend/shenlun-styles.test.ts`：通过，10 项样式测试全部通过。
- Chromium 等效 200% 缩放验证：`720×450` 视口下文档 `scrollWidth` 等于 `clientWidth`，工具栏滚动后 `top` 为 0；答题纸水平和垂直滚动均可用，第 25 格可滚入可见区。

### Notes

- `src/styles/shenlun.css`：新增 760px 以下吸顶工具栏、四列模板切换、答题纸双向滚动和完整宽度右栏规则。
- `tests/frontend/shenlun-styles.test.ts`：新增浏览器放大适配及吸顶滚动约束。
- `docs/申论答题纸.md`：补充放大和窄屏下的操作行为。
- `progress.md`：追加本项实现、验证和回滚说明。
- 回滚方式：仅反向应用本节 760px 响应式媒体查询、对应样式测试、文档和日志差异，不触碰其他申论样式。

## 2026-08-09 - Task: 增强申论文字颜色与连续装饰线

### What was done

- 在现有格式区间中增加红、蓝、绿三种可持久化文字颜色，并以“墨色”作为移除颜色的操作；折叠光标设置颜色后，后续输入会继承该颜色。
- 将下划线和删除线改为贯穿字符容器的连续线段，英文和数字同格横排时仍保持左右衔接；加粗、颜色、下划线和删除线可以叠加使用。
- 颜色格式沿用现有 `marks_json` 字段保存，本地草稿、服务端校验、卡片库预览和撤销重做均同步支持，不新增数据库字段或迁移。

### Testing

- TDD 红灯覆盖颜色区间覆盖与拆分、折叠光标继承、跨格选区、草稿读写、服务端保存、复盘预览和连续线样式；实现后 `npx vitest run tests/frontend/shenlun-editor.test.ts tests/frontend/shenlun-page.test.tsx tests/frontend/shenlun-styles.test.ts tests/frontend/shenlun-draft-notes.test.ts tests/frontend/shenlun-review-library.test.tsx tests/server/shenlun-reviews.test.ts` 通过，6 个文件 109 项测试全部通过。
- `npm run typecheck`：通过，客户端与服务端 TypeScript 检查均无错误。
- Chromium 实测：跨格全选后叠加红色、下划线和删除线，两个同格数字的横向装饰线宽度分别约为 14.12px 并连续衔接；保存状态显示“已保存”，PUT 接口返回 200。

### Notes

- `src/shenlun/editor.ts`、`src/shenlun/draft.ts`：增加颜色区间、待输入颜色、撤销重做与草稿校验。
- `shared/contracts.ts`、`server/shenlunReviews/contracts.ts`、`server/shenlunReviews/routes.ts`：扩展格式契约和接口校验，继续复用原格式 JSON 字段。
- `src/pages/ShenlunPage.tsx`、`src/components/ShenlunGrid.tsx`、`src/components/ShenlunReviewLibrary.tsx`：增加颜色工具、答题格颜色渲染和复盘预览。
- `src/styles/shenlun.css`、`src/styles/shenlun-library.css`：增加颜色色板、文字颜色与连续下划线、删除线样式。
- `tests/frontend/shenlun-editor.test.ts`、`tests/frontend/shenlun-page.test.tsx`、`tests/frontend/shenlun-styles.test.ts`、`tests/frontend/shenlun-draft-notes.test.ts`、`tests/frontend/shenlun-review-library.test.tsx`、`tests/server/shenlun-reviews.test.ts`：覆盖本任务格式链路。
- `docs/申论答题纸.md`：补充颜色和连续装饰线使用说明。
- `progress.md`：追加本项实现、验证和回滚说明。
- 回滚方式：仅反向应用本节所列文件中的 `color` 格式区间、颜色工具、连续装饰线、对应测试和文档日志差异；不得整体还原这些包含其他未提交申论功能的文件。

## 2026-08-09 - Task: 重设计申论右侧 Apple 玻璃功能区

### What was done

- 将右侧外层、标准答案、普通备注、批注列表和批注卡片改为不同透明度的中性玻璃，移除原有绿色与蓝色实体背景。
- 统一各功能区 8px 曲线圆角、亮边、柔和内高光和分层阴影；文本框同步使用半透明白色材质，批注仅保留低饱和冷灰蓝边界用于识别。
- 保留降低透明度和高对比度系统偏好的回退规则，不改变标准答案、备注链接、批注排序和独立滚动行为。

### Testing

- TDD 红灯确认右栏仍使用旧浅绿、浅蓝背景；实现后 `npx vitest run tests/frontend/shenlun-styles.test.ts tests/frontend/shenlun-page.test.tsx` 通过，2 个文件 35 项测试全部通过。
- Chromium 桌面 `1440×1000` 与等效放大 `720×450` 视觉验证通过：右栏层次与圆角清晰，工具栏完整换行，答题纸可独立横向滚动，文档无横向溢出，控制台 0 错误。

### Notes

- `src/styles/shenlun.css`：重做右侧功能区五级玻璃透明度、圆角、边界、阴影和无障碍回退样式。
- `tests/frontend/shenlun-styles.test.ts`：将旧颜色区分契约更新为中性分层玻璃和紧凑圆角契约。
- `docs/申论答题纸.md`：更新备注与批注的玻璃材质说明。
- `output/playwright/shenlun-word-glass-desktop.png`、`output/playwright/shenlun-word-glass-zoom.png`：保存桌面与放大视口验证截图。
- `progress.md`：追加本项实现、验证和回滚说明。
- 回滚方式：仅反向应用本节 `src/styles/shenlun.css` 中右栏玻璃材质、对应样式测试、文档、截图和日志差异，不触碰答题纸布局与文字格式功能。

## 2026-08-09 - Task: 完成本轮申论修复最终回归

### What was done

- 对保存与卡片库、放大适配、文字颜色与连续装饰线、右侧玻璃功能区执行统一回归，确认四项需求在最新代码上共同成立。
- 从真实卡片库进入“申论复盘”页签，加载刚保存的记录并打开预览，复核加粗、颜色、下划线和删除线的组合展示。

### Testing

- `npx vitest run tests/frontend/shenlun-layout.test.ts tests/frontend/shenlun-editor.test.ts tests/frontend/shenlun-grid-layout.test.tsx tests/frontend/shenlun-draft-notes.test.ts tests/frontend/shenlun-styles.test.ts tests/frontend/shenlun-page.test.tsx tests/frontend/shenlun-review-library.test.tsx tests/frontend/shenlun-route.test.tsx tests/frontend/cards-page.test.tsx tests/frontend/app-shell.test.tsx tests/frontend/review-page.test.tsx tests/server/shenlun-reviews.test.ts tests/server/database.test.ts`：通过，13 个文件 272 项测试全部通过。
- `npm run typecheck`：通过；`npm run build`：通过，客户端与服务端构建成功，仅保留既有大包体积提示。
- Chromium 真实流程：PUT 保存返回 200，卡片库申论复盘列表与预览正常，组合格式预览计算颜色为 `rgb(180, 35, 24)`，桌面和等效放大页面控制台均为 0 错误。

### Notes

- `progress.md`：追加本轮最终回归证据与回滚说明。
- 回滚方式：删除本节最终回归日志即可；功能回滚点分别见前述四个任务记录，禁止整体还原包含其他用户改动的未提交文件。

## 2026-08-09 - Task: 修复申论正文行尾多余空列

### What was done

- 将正文默认排版改为逐格连续填满每行 25 格，取消中文分词在行尾预留整词空位的默认行为。
- 保留显式中文分词选项，并继续执行连续标点共格、闭合标点不落行首等现有申论标点规则。

### Testing

- `npx vitest run tests/frontend/shenlun-layout.test.ts -t "默认逐格排满行尾"`：修复前按预期失败，首行仅占 23 格，稳定复现多余空列。
- `npx vitest run tests/frontend/shenlun-layout.test.ts tests/frontend/shenlun-editor.test.ts`：通过，2 个文件 35 项测试全部通过。

### Notes

- `src/shenlun/layout.ts`：将中文分词换行改为仅显式启用。
- `tests/frontend/shenlun-layout.test.ts`：新增默认填满行尾回归测试，并保留显式分词覆盖。
- `tests/frontend/shenlun-editor.test.ts`：更新已失效的分词留空编辑场景，验证正文末尾连续输入。
- `docs/申论答题纸.md`：说明正文默认填满 25 格且继续保留标点规则。
- `progress.md`：追加本项实现、验证和回滚说明。
- 回滚方式：反向应用本节四个实现、测试与文档文件的对应差异，并删除本节日志；不要回退这些文件中的其他用户改动。

## 2026-08-09 - Task: 修复申论编辑区重复光标

### What was done

- 正文中的光标不再同时触发正文末尾空白格光标，只有光标确实位于全文末尾时才显示末尾光标。
- 隐藏输入法承载层的原生光标，仅保留方格编辑光标；中文输入法组合文本仍在当前方格附近显示。

### Testing

- `npx vitest run tests/frontend/shenlun-grid-layout.test.tsx tests/frontend/shenlun-styles.test.ts`：修复前按预期失败，稳定复现方格索引 0 与正文末尾索引 2 同时显示光标，并检出输入层仍绘制原生光标。
- `npx vitest run tests/frontend/shenlun-grid-layout.test.tsx tests/frontend/shenlun-styles.test.ts tests/frontend/shenlun-page.test.tsx`：通过，3 个文件 38 项测试全部通过。

### Notes

- `src/components/ShenlunGrid.tsx`：用正文长度约束末尾光标，只允许一个方格命中光标状态。
- `src/pages/ShenlunPage.tsx`：向方格组件传入当前正文长度。
- `src/styles/shenlun.css`：隐藏输入代理的原生光标。
- `tests/frontend/shenlun-grid-layout.test.tsx`：新增正文中与正文末尾单光标回归测试。
- `tests/frontend/shenlun-styles.test.ts`：新增输入代理透明光标样式契约。
- `docs/申论答题纸.md`：补充单光标与中文输入法显示说明。
- `progress.md`：追加本项实现、验证和回滚说明。
- 回滚方式：反向应用本节六个实现、测试与文档文件的对应差异，并删除本节日志；不要回退这些文件中的其他用户改动。

## 2026-08-09 - Task: 补充本轮最终回归记录顺序

### What was done

- 说明上方“完成本轮行尾、光标与批注修复回归”记录因机械插入位置早于批注任务记录；实际执行顺序为先完成批注修复，再执行该最终回归，验证结论不受影响。

### Testing

- 本项仅补充日志顺序说明，未改动运行时代码；最终验证证据仍以上方 74 项申论测试、类型检查、生产构建和 Chromium 真实流程为准。

### Notes

- `progress.md`：在末尾追加实际执行顺序说明，不改写既有历史记录。
- 回滚方式：删除本节顺序说明即可，不影响任何功能和验证结果。

## 2026-08-09 - Task: 完成本轮行尾、光标与批注修复回归

### What was done

- 在真实 Chromium 桌面视口复现输入、选区、创建批注完整流程，确认行尾填满、单光标、就近批注入口和连接箭头共同生效。
- 对本轮受影响模块执行最终测试、类型检查与客户端、服务端生产构建。

### Testing

- `npx vitest run tests/frontend/shenlun-layout.test.ts tests/frontend/shenlun-editor.test.ts tests/frontend/shenlun-grid-layout.test.tsx tests/frontend/shenlun-page.test.tsx tests/frontend/shenlun-styles.test.ts`：通过，5 个文件 74 项测试全部通过。
- `npm run typecheck`：通过；`npm run build`：通过，客户端与服务端构建成功，仅保留既有大包体积提示。
- Chromium `1440×1000` 真实流程：首行占满 25 格，方格光标数量为 1，输入代理光标透明；批注入口位于选区右侧 8px 且挂载于页面浮层，连接线箭身与箭头均使用可见浅灰蓝色，控制台 0 错误。
- 扩展执行 13 个相关页面和服务端测试文件时，275 项中 274 项通过；既有 `tests/frontend/review-page.test.tsx` 的“地址锚点会展开板块并定位非默认小板块中的图片”用例失败，单独重跑仍失败。该用例属于复盘图片锚点模块，不在本轮申论修复范围，本轮未改动其实现。

### Notes

- `output/playwright/shenlun-annotation-caret-fix.png`：保存行尾填满、就近批注入口和完整连接箭头的真实浏览器截图。
- `progress.md`：追加本轮最终回归证据、既有测试缺口和回滚说明。
- 回滚方式：删除本节截图与本节日志即可；三项功能回滚点分别见前述对应任务记录，不要整体还原包含其他用户改动的文件。

## 2026-08-09 - Task: 修复申论批注入口位置与连接箭头

### What was done

- 选中文字后，将“添加批注”入口从整张答题纸末尾移到选区末格旁边，并在页面滚动、答题纸滚动或缩放时重新定位。
- 恢复原文与右侧批注卡片之间的浅色连接箭头，箭身和箭头统一使用组件自身颜色，不再依赖已失效的主题变量。

### Testing

- `npx vitest run tests/frontend/shenlun-page.test.tsx tests/frontend/shenlun-styles.test.ts -t "批注|箭头|ribbon"`：修复前按预期失败，稳定检出批注入口仍位于答题纸内部且没有就近坐标、连接线仍引用失效颜色变量。
- 同一命令修复后通过，5 项目标测试通过；随后执行 `npx vitest run tests/frontend/shenlun-page.test.tsx tests/frontend/shenlun-styles.test.ts`，2 个文件 37 项测试全部通过。

### Notes

- `src/pages/ShenlunPage.tsx`：计算选区末格的视口坐标，以页面浮层呈现并持续同步批注入口。
- `src/components/ShenlunConnectors.tsx`：箭身与箭头改用统一的当前颜色。
- `src/styles/shenlun.css`：补充批注浮层定位与玻璃样式，并为连接线设置可见层级和浅色。
- `tests/frontend/shenlun-page.test.tsx`：新增批注入口就近定位与连接箭头颜色回归测试。
- `tests/frontend/shenlun-styles.test.ts`：新增批注浮层和连接线可见性样式契约。
- `docs/申论答题纸.md`：更新就近批注入口及箭头行为说明。
- `progress.md`：追加本项实现、验证和回滚说明。
- 回滚方式：反向应用本节六个实现、测试与文档文件的对应差异，并删除本节日志；不要回退这些文件中的其他用户改动。

## 2026-08-09 - Task: 确认本轮任务实际执行顺序

### What was done

- 确认本轮实际执行顺序为行尾空列、重复光标、批注入口与箭头、最终统一回归；上方最终回归记录的显示位置早于批注任务记录，是日志补丁命中同名回滚行所致，不代表实际施工顺序。

### Testing

- 本项仅追加记录顺序说明，未改动运行时代码；功能验证仍以 74 项申论测试、类型检查、生产构建和 Chromium 真实流程结果为准。

### Notes

- `progress.md`：在文件末尾追加实际执行顺序说明，保留此前全部历史记录。
- 回滚方式：删除本节顺序说明即可，不影响功能与验证结果。

## 2026-08-09 - Task: 修复申论失联批注导致保存失败

### What was done

- 定位并修复失联批注的保存边界：批注对应原文被删除或改写后，允许保留历史起止位置和批注内容，不再因为历史区间超出当前正文而拒绝整篇申论稿。
- 继续严格校验仍与当前正文关联的有效批注，越界或原文不一致的有效批注仍会被拒绝。

### Testing

- TDD 红灯：提交正文为空、批注 `detached: true` 且历史区间为 `0..4` 的请求，修复前服务端稳定返回 `400`。
- `npx vitest run tests/server/shenlun-reviews.test.ts`：通过，20 项测试全部通过；有效批注越界拒绝用例仍通过。
- `npx vitest run tests/server/shenlun-reviews.test.ts tests/frontend/shenlun-page.test.tsx tests/frontend/shenlun-draft-notes.test.ts tests/frontend/shenlun-review-library.test.tsx tests/server/database.test.ts`：通过，5 个文件 102 项测试全部通过。
- `npm run typecheck`：通过；`npm run build`：通过，客户端与服务端构建成功，仅保留既有大包体积提示。
- Chromium 真实流程：添加批注后删除原文，批注变为失联状态；点击“保存回顾”显示“已保存”，POST 返回 `201`，卡片库列表返回 `200` 并包含该记录。

### Notes

- `server/shenlunReviews/routes.ts`：只对非失联批注执行当前正文区间上限校验。
- `tests/server/shenlun-reviews.test.ts`：新增失联批注可保存回归测试，并保留有效批注越界拒绝测试。
- `docs/申论答题纸.md`：补充失联批注不阻止保存的行为说明。
- `progress.md`：追加本项实现、验证和回滚说明。
- 回滚方式：反向应用本节服务端、测试与文档差异并删除本节日志；不要整体还原包含其他用户改动的文件。

## 2026-08-09 - Task: 重启过期生产服务恢复申论保存与卡片库

### What was done

- 根据用户截图确认申论保存和卡片库列表同时失败，定位为 `8787` 旧生产进程未加载最新申论路由：旧实例对 `/api/shenlun-reviews` 返回 `404`，而最新开发实例返回 `200`。
- 停止旧生产进程，使用最新 `dist-server` 在项目目录重新启动 `8787` 服务；生产端申论新建、详情、列表和卡片库预览均恢复。
- 补充生产服务更新说明，明确服务端源码或构建产物更新后必须重启进程，避免页面与 API 版本错配。

### Testing

- 重启前：`GET http://127.0.0.1:8787/api/shenlun-reviews` 返回 `404`；同一接口在最新开发服务 `8791` 返回 `200`。
- 重启后：`GET /api/health`、`GET /api/shenlun-reviews` 均返回 `200`，申论新建返回 `201`、详情返回 `200`。
- Chromium 生产端真实流程：在 `8787` 页面写入正文并保存，页面显示“已保存”；进入卡片库申论页签后错误提示数量为 0，复盘卡片与预览详情正常显示，控制台 0 错误。
- `npx vitest run tests/server/shenlun-reviews.test.ts tests/frontend/shenlun-page.test.tsx tests/frontend/shenlun-review-library.test.tsx`：通过，3 个文件 51 项测试全部通过。
- `npm run typecheck`：通过。
- 生产端浏览器与接口验证生成的两条临时申论记录均按精确编号删除，只删除本轮测试数据，未触碰用户记录。

### Notes

- `docs/本地运行与数据管理.md`：补充生产构建更新后必须停止旧服务并重新启动的说明。
- `output/playwright/shenlun-production-save-recovered.png`：保存生产端保存、卡片库和预览恢复后的浏览器截图。
- `progress.md`：追加故障根因、服务重启、验证和回滚说明。
- 回滚方式：文档与截图可反向应用本节差异并删除本节日志；服务重启不产生源码回滚点，如需恢复旧运行态需停止当前 `npm start` 并显式启动目标旧构建，但会重新引入申论接口 `404`。

## 2026-08-09 - Task: 为申论卡片库增加模糊搜索并降低卡片透明度

### What was done

- 在卡片库“申论复盘”页签增加本地即时搜索，支持按标题、正文摘要和字数模板匹配，多个关键词可用空格组合。
- 搜索无结果时保留搜索框并显示明确状态，输入框内的清空按钮可恢复全部申论卡片，不新增服务端请求。
- 将申论卡片白色玻璃底的不透明度从 `0.58` 提高到 `0.78`，并提升选择器优先级，避免被通用嵌套玻璃规则覆盖。

### Testing

- TDD 红灯：新增测试后，现有页面因缺少“搜索申论复盘”输入框而失败，样式测试因卡片仍为 `0.58` 且缺少抗覆盖选择器而失败。
- `npx vitest run tests/frontend/shenlun-styles.test.ts tests/frontend/shenlun-review-library.test.tsx tests/frontend/cards-page.test.tsx`：通过，3 个文件 91 项测试全部通过。
- `npm run typecheck`：通过；`npm run build`：通过，客户端与服务端构建成功，仅保留既有大包体积提示。
- Chromium 生产端 `1440×1000`：验证 `400字` 模板搜索、无结果状态与清空恢复；卡片最终计算背景为 `rgba(255, 255, 255, 0.78)`，控制台 0 错误。

### Notes

- `src/components/ShenlunReviewLibrary.tsx`：增加搜索状态、组合关键词匹配、搜索框、清空按钮与无结果状态。
- `src/styles/shenlun-library.css`：增加搜索控件样式并提高申论卡片玻璃底实度与选择器优先级。
- `tests/frontend/shenlun-review-library.test.tsx`、`tests/frontend/shenlun-styles.test.ts`：增加搜索行为、清空恢复和最终透明度回归测试。
- `docs/申论答题纸.md`：补充申论复盘搜索范围、组合方式和卡片材质说明。
- `output/playwright/shenlun-library-search-glass.png`：保存生产端搜索框与低透明度申论卡片验收截图。
- `progress.md`：追加本项实现、验证和回滚说明。
- 回滚方式：反向应用本节组件、样式、测试与文档差异，删除本节截图和日志；不要整体还原包含其他用户改动的文件。

## 2026-08-09 - Task: 新建独立空白申论纸且不覆盖旧稿

### What was done

- 在申论工具栏增加“新建申论”命令，可从本地草稿或已保存复盘直接切换到全新的 400 字空白答题纸。
- 新建时同步解除旧复盘编号，重置标题、正文、格式、标准答案、备注、批注和编辑状态；旧服务端记录不删除、不更新。
- 新稿第一次保存固定使用创建请求，保存后才绑定新的复盘编号，后续编辑仍更新新记录。

### Testing

- TDD 红灯：从已保存稿进入页面后找不到“新建申论”按钮，稳定复现只能继续覆盖旧记录的操作缺口。
- `npx vitest run tests/frontend/shenlun-page.test.tsx tests/frontend/shenlun-draft-notes.test.ts tests/frontend/shenlun-route.test.tsx`：通过，3 个文件 63 项测试全部通过。
- 回归用例确认新稿首次保存请求为 `POST /api/shenlun-reviews`，且没有向旧编号发送 `PUT`。
- `npm run typecheck`：通过。

### Notes

- `src/pages/ShenlunPage.tsx`：增加新建命令与完整工作台状态重置逻辑。
- `tests/frontend/shenlun-page.test.tsx`：增加从已保存稿新建并另存为新记录的回归测试。
- `docs/申论答题纸.md`：补充新建空白答题纸与旧稿保护行为说明。
- `progress.md`：追加本项实现、验证和回滚说明。
- 回滚方式：反向应用本节页面、测试与文档差异并删除本节日志；不要删除或修改数据库中已经保存的申论记录。
## 2026-08-09 - Task: 补齐申论卡片置顶与归档管理

### What was done

- 申论卡片库新增“当前/已归档”视图，并补齐置顶、取消置顶、归档和恢复操作；预览继续可用，当前稿可进入编辑，归档稿只提供预览与恢复，避免误改历史内容。
- 当前列表按“已置顶优先、最近更新优先”排序；置顶或归档操作完成后就地刷新列表，失败时保留当前内容并显示操作错误。
- 服务端和数据库增加申论复盘的置顶、归档状态，列表接口支持归档筛选，状态更新接口仅接受布尔值且拒绝空更新。
- 延续申论卡片库的玻璃材质，增加紧凑分段视图、固定尺寸图标按钮和置顶卡片提示，同时保留本轮已完成的模糊搜索。

### Testing

- TDD 红灯：数据库迁移版本、状态字段与索引缺失，状态更新接口返回 `404`，前端缺少置顶按钮和归档视图，样式契约缺失；实现后上述用例全部转绿。
- `npx vitest run tests/frontend/shenlun-layout.test.ts tests/frontend/shenlun-editor.test.ts tests/frontend/shenlun-grid-layout.test.tsx tests/frontend/shenlun-draft-notes.test.ts tests/frontend/shenlun-styles.test.ts tests/frontend/shenlun-page.test.tsx tests/frontend/shenlun-review-library.test.tsx tests/frontend/shenlun-route.test.tsx tests/frontend/cards-page.test.tsx tests/server/shenlun-reviews.test.ts tests/server/database.test.ts`：通过，11 个文件 231 项测试全部通过。
- `npm run typecheck`：通过；`npm run build`：通过，客户端与服务端生产构建成功，仅保留既有大包体积提示。
- 生产数据库已增量迁移到版本 `9`，确认 `pinned`、`archived` 字段和归档排序索引存在；现有 1 条用户申论记录保持未置顶、未归档，归档区为空。
- Chromium 生产端验证：当前/已归档切换、搜索、预览、置顶和归档入口正常显示；从旧稿点击“新建申论”后进入 0/400 空白稿，网络中没有覆盖旧稿的写请求，控制台 0 错误。

### Notes

- `server/db/migrations/009_shenlun_review_library_state.sql`：为申论复盘增量增加置顶、归档字段及列表索引。
- `server/db/migrations.ts`：注册第 9 版申论卡片管理迁移。
- `server/shenlunReviews/contracts.ts`、`server/shenlunReviews/repository.ts`、`server/shenlunReviews/service.ts`、`server/shenlunReviews/routes.ts`：增加状态契约、归档筛选排序、状态更新和接口校验。
- `shared/contracts.ts`：向前后端共享的申论摘要与详情补充置顶、归档状态。
- `src/components/ShenlunReviewLibrary.tsx`：增加当前/归档视图、置顶、归档、恢复及列表就地更新。
- `src/styles/shenlun-library.css`：增加分段视图、操作按钮和置顶卡片的 Apple 风格玻璃样式。
- `tests/server/shenlun-reviews.test.ts`、`tests/server/database.test.ts`：覆盖状态接口、筛选排序、迁移字段和索引。
- `tests/frontend/shenlun-review-library.test.tsx`、`tests/frontend/shenlun-styles.test.ts`：覆盖卡片管理交互与样式契约。
- `docs/申论答题纸.md`：补充申论卡片库状态管理和数据库版本说明。
- `output/playwright/shenlun-library-management.png`、`output/playwright/shenlun-new-blank.png`：保存卡片管理与独立新建空白稿的真实浏览器验收截图。
- `progress.md`：追加本项实现、验证和回滚说明。
- 回滚方式：反向应用本节应用代码、测试与文档差异并删除本节截图和日志；数据库迁移为增量字段，回滚应用时可保留字段，若确需移除必须先备份并重建表，禁止直接破坏现有申论记录。
## 2026-08-10 - Task: 修复卡片库发送 Anki 后无可见反馈

### What was done

- 复现并定位“点击发送后没反应”：请求实际发出且返回失败，但原提示位于卡片列表上方，滚动到卡片按钮后提示落在视口外；同时服务端丢弃了 cc-connect 的真实失败原因。
- 将卡片发送的处理中、成功和失败状态改为挂载到页面根节点的固定玻璃提示，始终出现在当前视口右下角，并提供关闭按钮。
- 前端直接展示服务端返回的安全错误消息；服务端识别本次实际出现的微信 `expired context_token`，提示先给 cc-connect 机器人发送一条消息刷新会话后重试。
- 保持 Anki 生成、发送命令、卡片内容和每日自动发送计时逻辑不变。

### Testing

- 根因证据：修复前真实浏览器 POST 返回 `502`，失败提示顶部坐标为 `-8.7px`，位于当前视口外；手工执行同一 cc-connect 命令返回微信 `expired context_token` 与“user must send a new message”。
- TDD 红灯：新增测试后，前端找不到处理中状态和固定反馈样式，服务端仍返回笼统连接错误，共 3 项按预期失败。
- `npx vitest run tests/frontend/cards-page.test.tsx tests/server/anki-routes.test.ts -t "Anki|微信会话"`：通过，15 项相关测试全部通过。
- `npx vitest run tests/frontend/cards-page.test.tsx tests/frontend/settings-page.test.tsx tests/server/anki-apkg.test.ts tests/server/anki-auto-send.test.ts tests/server/anki-daily.test.ts tests/server/anki-library-exports.test.ts tests/server/anki-routes.test.ts tests/server/anki-sender.test.ts tests/server/anki-source.test.ts`：通过，9 个文件 132 项测试全部通过。
- `npm run typecheck`：通过；`npm run build`：通过，客户端与服务端生产构建成功，仅保留既有大包体积提示。
- Chromium 生产端验证：失败提示计算样式为 `position: fixed`，在 `1036×905` 视口中位于 `x=570.7..1000.7`、`y=826..885.3`，完整可见；关闭后页面中相关提示元素为 0。控制台仅记录预期的接口 `502`，没有前端运行时异常。
- 诊断生成的 6 组 `.apkg`/Markdown 临时文件已按精确路径删除，未修改数据库、卡片内容或既有导出记录。

### Notes

- `server/anki/daily.ts`：允许发送结果携带安全错误诊断字段。
- `server/anki/routes.ts`：将微信会话令牌过期映射为可执行的中文恢复提示。
- `src/pages/CardsPage.tsx`：增加固定视口的发送进度、成功、失败反馈，并显示接口具体消息和关闭入口。
- `src/styles/cards-glass.css`：增加 Anki 发送提示的固定玻璃样式、稳定尺寸与移动端适配。
- `tests/server/anki-routes.test.ts`：覆盖微信会话令牌过期的接口消息。
- `tests/frontend/cards-page.test.tsx`：覆盖处理中状态、具体失败原因、关闭操作与固定视口样式。
- `docs/anki-cc-connect.md`：补充卡片库发送反馈和微信会话恢复说明。
- `output/playwright/anki-send-feedback.png`：保存真实浏览器中固定失败提示的验收截图。
- `progress.md`：追加本项根因、实现、验证和回滚说明。
- 回滚方式：反向应用本节代码、测试与文档差异，并删除本节截图和日志；本轮没有数据库结构或卡片数据变更，不需要数据回滚。

## 2026-08-12 - Task: 背诵按不会、熟练与上次抽取时间加权

### What was done

- 将背诵随机抽取改为无放回加权抽取：不会次数提高权重，熟练次数降低权重，距上次抽取越久逐步恢复权重；新卡权重为 `2.0`，卡片总权重下限锁定为 `0.25`。
- 同一卡片的多个题面均分卡片总权重，避免题面数量放大整张卡片的抽取概率；固定顺序、到期优先和现有筛选行为保持不变。
- 数据库第 10 版为卡片增加可空的上次抽取时间与索引；会话题面成功组装后仅更新实际抽中卡片，同一张卡片一轮只写回一次。
- 已在线备份并将生产数据库增量升级到第 10 版，现有 494 张卡片数量不变；生产服务已使用最终构建重新启动。

### Testing

- `npx vitest run tests/server/database.test.ts tests/server/study-session.test.ts tests/server/card-folders.test.ts tests/server/backups.test.ts tests/frontend/study-joystick.test.tsx tests/frontend/study-known-flow.test.tsx tests/frontend/study-page.test.tsx tests/frontend/study-random-original.test.tsx tests/frontend/study-range-preview.test.tsx tests/frontend/study-range.test.tsx tests/frontend/study-shortcuts.test.tsx`：通过，11 个测试文件共 150 项测试全部通过。
- `npm run typecheck`：通过。
- `npm run build`：通过，客户端与服务端构建成功；仅保留既有的大包体积提示。
- `npm test`：本次迁移造成的备份恢复与文件夹迁移旧版本断言已修正；全量 848 项中 847 项通过，剩余 1 项为既有知识图谱 CSS 浮层规则测试，与本次背诵及数据库改动无关。
- 生产核验：`/api/health` 返回 `ok`；数据库版本为 `10`，`last_drawn_at` 为可空 `TEXT` 且索引列正确，`PRAGMA integrity_check` 为 `ok`，卡片数量为 494。
- 上线前 SQLite 在线备份完整性为 `ok`，备份文件为 `data/backups/gongkao-pre-study-weight-20260812-221000.db`，备份卡片数量同为 494。

### Notes

- `server/db/migrations/010_card_last_drawn_at.sql`：新增卡片上次抽取时间与索引。
- `server/db/migrations.ts`：注册第 10 版迁移，并沿用当前未提交迁移链。
- `server/study/service.ts`：汇总熟练记录、计算卡片与题面权重、执行无放回加权抽取并写回抽取时间。
- `tests/server/database.test.ts`：验证迁移版本、字段可空性和目标索引列。
- `tests/server/study-session.test.ts`：验证新卡、不熟练、熟练、时间恢复、权重下限、题面均分、写回去重和失败不写回。
- `tests/server/card-folders.test.ts`、`tests/server/backups.test.ts`：将迁移链预期同步到第 10 版。
- `docs/背诵加权抽取.md`：记录正式权重规则、数据来源和迁移行为。
- `docs/superpowers/specs/2026-08-12-背诵加权抽取设计.md`、`docs/superpowers/plans/2026-08-12-背诵加权抽取实施计划.md`：记录本轮中文设计与实施计划。
- `progress.md`：追加本轮实现、验证、上线与回滚说明。
- 回滚方式：先停止 `8787` 的当前 `node dist-server/index.js` 服务，使用 `data/backups/gongkao-pre-study-weight-20260812-221000.db` 恢复升级前数据库，再反向应用本节代码、测试与文档差异并重新构建启动；不要直接删除生产数据库字段或覆盖其他未提交改动。
- `data/backups/gongkao-pre-study-weight-20260812-221000.db`：保存第 10 版迁移前的完整 SQLite 在线备份，供精确数据回滚使用。

## 2026-08-15 - Task: 开启同一局域网的手机访问

### What was done

- 新增可配置的服务监听地址，仓库默认继续使用 `127.0.0.1`，本机 `.env` 设为 `0.0.0.0` 以接收同一局域网的访问。
- 重新构建并启动生产服务，当前进程监听 `0.0.0.0:8787`，手机可使用电脑 Wi-Fi IPv4 和端口 `8787` 访问。
- 检查 Windows 防火墙：当前公用网络配置下已有针对 `D:\node\node.exe` 的入站允许规则，因此没有新增或扩大系统防火墙规则。

### Testing

- TDD 红灯：新增 `HOST` 默认值和 `0.0.0.0` 配置测试后，原实现因没有返回 `host` 产生 2 项预期失败。
- `npm test -- --run tests/server/health.test.ts`：通过，13 项测试全部通过。
- `npx tsc -p tsconfig.server.json --noEmit`：通过。
- `npm run build:server`：通过，生产服务端构建成功。
- 运行验证：新进程监听 `0.0.0.0:8787`；`http://127.0.0.1:8787/api/health` 与 `http://192.168.5.35:8787/api/health` 均返回 `200` 和 `{"status":"ok"}`，`http://192.168.5.35:8787/cards` 返回 `200` 及 HTML。
- 防火墙验证：确认当前 WLAN 为 Public，系统已启用两条 `Node.js JavaScript Runtime` 的 Public 入站 Allow 规则，程序路径为 `D:\node\node.exe`。

### Notes

- `server/config.ts`：增加 `HOST` 读取及默认本机监听地址。
- `server/index.ts`：使用配置的主机地址启动 HTTP 服务。
- `tests/server/health.test.ts`：覆盖默认主机和局域网监听配置。
- `.env.example`：记录安全的默认 `HOST` 和局域网配置含义。
- `.env`：本机私有配置启用 `HOST=0.0.0.0`，未读取、修改或记录其他敏感值。
- `docs/本地运行与数据管理.md`：补充监听参数、手机访问地址、防火墙边界和浏览器本地数据差异。
- `progress.md`：追加本轮实现、验证与回滚说明。
- 回滚方式：把本机 `.env` 的 `HOST` 改回 `127.0.0.1`，反向应用本节服务、测试和文档差异，执行 `npm run build:server` 后停止当前 `8787` 进程并重新运行 `node dist-server/index.js`。本轮未创建防火墙规则，无需回滚系统规则。

## 2026-08-15 - Task: 卡片库支持输入页码跳转

### What was done

- 将卡片库分页栏的当前页改为可编辑页码，支持按 `Enter` 或失焦跳转，并继续通过现有 URL `page` 参数加载目标页。
- 支持 `Escape` 取消、空值和非法值恢复当前页、`0` 与超出总页数的输入自动收敛到有效范围；输入当前页不会重复请求，加载期间输入框暂时禁用。
- 为页码输入补充与现有卡片库一致的浅色玻璃、44 像素操作高度、红色聚焦环和稳定宽度，并保留上一页、下一页按钮。

### Testing

- TDD 红灯：新增 5 项页码交互用例后，原页面因不存在页码输入框产生预期失败。
- `npx vitest run tests/frontend/cards-page.test.tsx`：通过，83 项测试全部通过，覆盖 Enter、失焦、上下界、非数字拦截、空值、Escape、当前页不重复请求、四位页码宽度和加载禁用。
- `npm run typecheck`：通过。
- `npm run build`：通过，客户端与服务端生产构建成功；仅保留既有的大包体积提示。
- Chromium 真实流程：在 `http://127.0.0.1:8787/cards?page=1&pageSize=20` 输入页码 `3` 并按 Enter，地址更新为 `page=3`，卡片列表同步换页，分页栏显示“第 3 / 21 页”。
- `git diff --check -- src/pages/CardsPage.tsx tests/frontend/cards-page.test.tsx src/styles/cards-glass.css`：通过，无空白错误。

### Notes

- `src/pages/CardsPage.tsx`：增加页码草稿、提交和取消逻辑，并将分页状态改为可输入控件。
- `src/styles/cards-glass.css`：增加页码输入的玻璃材质、焦点、禁用和尺寸样式。
- `tests/frontend/cards-page.test.tsx`：增加页码交互与样式回归测试。
- `docs/卡片库分页.md`：记录页码输入、快捷操作、边界和加载行为。
- `docs/superpowers/specs/2026-08-15-卡片库页码跳转设计.md`、`docs/superpowers/plans/2026-08-15-卡片库页码跳转实施计划.md`：记录确认后的设计与实施计划。
- `output/playwright/cards-page-number-jump.png`：保存真实浏览器分页控件验收截图。
- `progress.md`：追加本轮实现、验证与回滚说明。
- 回滚方式：仅反向应用本节 `CardsPage`、分页样式、测试和文档差异，并删除本节截图与日志；本轮未修改接口、数据库或卡片数据，无需数据回滚。

## 2026-08-15 - Task: 修复横向图谱卡片搜索区域视口限高

### What was done

- 将横向图谱子节点弹窗中的卡片搜索区接入既有搜索浮层样式，并按浏览器视口限制最大高度。
- 搜索结果继续在区域内部滚动，避免顶部表单占用空间时搜索内容被弹窗裁切。

### Testing

- 全量测试首次运行稳定复现 1 项失败：搜索区域缺少 `.graphs-horizontal-card-search` 样式规则，CSS 契约匹配结果为空。
- `npx vitest run tests/frontend/liquid-glass-styles.test.ts tests/frontend/graphs-page.test.tsx`：通过，2 个文件共 47 项测试全部通过。

### Notes

- `src/pages/GraphsPage.tsx`：为实际横向卡片搜索区域增加浮层类名。
- `src/styles/graphs.css`：增加基于 `100dvh` 的最大高度与溢出约束。
- `docs/知识图谱.md`：补充搜索区域视口限高行为。
- `progress.md`：追加本轮根因、实现、验证和回滚说明。
- 回滚方式：反向应用本节组件、图谱样式与文档差异并删除本节日志；本轮不涉及接口、数据库或图谱数据变更。

## 2026-08-15 - Task: GitHub 同步前全量验证

### What was done

- 对当前功能分支累计完成的申论、卡片库、Anki、知识图谱、背诵加权和运行配置改动执行统一发布前验证。
- 保持 Git 忽略边界，`.env`、数据库、备份、构建产物、浏览器输出和运行日志不进入版本库。

### Testing

- `npm test -- --run`：通过，60 个测试文件共 858 项测试全部通过。
- `npm run typecheck`：通过。
- `npm run build`：通过，客户端与服务端生产构建成功；仅保留既有的大包体积提示。

### Notes

- `progress.md`：追加本次 GitHub 同步前的全量验证与范围说明。
- 回滚方式：删除本节追加日志即可；验证和 Git 推送操作不修改数据库、用户卡片或本机私有配置。

## 2026-08-19 - Task: 设计 AI 公考教练的老师分工与接入边界

### What was done

- 确认判断推理、资料分析和数量关系使用花生十三 MCP，言语理解使用张弓 Skill，DeepSeek 只负责对话编排与训练计划。
- 设计独立 AI 公考教练页面、连续追问、卡片上下文、联网题源、结构化答复和各外部能力的独立降级状态。
- 明确花生 MCP 是方法库而非联网题库，张弓 Skill 以本机私有资料加载，不把无明确许可证的课程蒸馏内容提交到项目。

### Testing

- 只读核对现有前后端入口、DeepSeek 卡片整理服务和卡片数据契约，确认教练功能需要独立服务边界且首期无需修改数据库结构。
- 核对 `huasheng-mcp` 公开说明，确认其提供题型识别、方法搜索、方法卡和解题脚手架，不提供联网题库搜索工具。
- 对设计文档执行人工自检：未保留待定项，老师分工、接口、降级、隐私、版权边界和验收标准一致。

### Notes

- `docs/superpowers/specs/2026-08-19-AI公考教练设计.md`：新增已确认的 AI 公考教练业务与技术设计。
- `progress.md`：追加本轮设计、核查依据和回滚说明。
- 回滚方式：删除本节日志和 `docs/superpowers/specs/2026-08-19-AI公考教练设计.md`；本轮未修改运行代码、依赖、数据库或私有配置。

## 2026-08-19 - Task: 编写 AI 公考教练实施计划

### What was done

- 将已确认设计拆分为共享契约与配置、三类外部适配器、DeepSeek 教练提供者、服务编排、教练页面、应用入口和完整验收七项任务。
- 为每项任务明确 TDD 红绿验证、文件责任边界、固定请求与响应契约、降级规则和安全约束。

### Testing

- `npm test -- --run`：基线通过，60 个测试文件全部通过。
- 人工复核计划与设计规格：老师分工、连续追问、卡片上下文、联网来源、快捷键、响应式布局、隐私和版权边界均有对应实施与验证步骤。
- 计划占位词检查：未保留 `TBD`、`TODO` 或未定义的后续补充项。

### Notes

- `docs/superpowers/plans/2026-08-19-AI公考教练实施计划.md`：新增可逐项执行的中文实施计划。
- `progress.md`：追加本轮计划、验证和回滚说明。
- 回滚方式：删除本节日志和 `docs/superpowers/plans/2026-08-19-AI公考教练实施计划.md`；本轮未修改运行代码、依赖、数据库或私有配置。

## 2026-08-19 - Task: 增加 AI 公考教练共享契约与配置

### What was done

- 增加教练模式、能力状态、消息、方法来源、联网来源和结构化答复的前后端共享契约，并在类型层锁定花生十三与张弓各自负责的模块。
- 增加花生 MCP、张弓 Skill 和 Tavily 的服务端环境配置；花生默认连接本机 SSE 地址，张弓目录和 Tavily Key 留空时不启用。
- 引入官方 MCP TypeScript SDK，并将 Zod 升级到 SDK 兼容的 3.x 版本。

### Testing

- TDD 红灯：新增默认与显式教练配置测试后，原配置因没有 `coach` 字段产生 2 项预期失败。
- `npx vitest run tests/server/health.test.ts`：通过，覆盖默认值、显式值、HTTP/HTTPS 协议限制、空白规范化和老师来源类型约束。
- `npm run typecheck`：通过。
- `npm ls @modelcontextprotocol/sdk zod`：SDK `1.30.0` 与 Zod `3.25.76` 正常去重，无无效或多余依赖。
- `npx vitest run tests/frontend/cards-page.test.tsx`：通过，83 项测试全部通过；全量运行中曾出现的一次分页失败无法在目标重跑中复现。
- `git diff --check`：通过。

### Notes

- `shared/contracts.ts`：增加教练共享契约和模块—老师判别联合。
- `server/config.ts`：增加三项教练配置、HTTP 协议限制和空白规范化。
- `.env.example`：补充花生 MCP、张弓 Skill 和 Tavily 的中文配置说明。
- `package.json`、`package-lock.json`：加入官方 MCP SDK并更新兼容的 Zod 版本。
- `tests/server/health.test.ts`：增加配置和类型约束回归测试。
- `progress.md`：追加本轮实现、验证与回滚说明。
- 回滚方式：反向应用本节共享契约、配置、环境示例、依赖与测试差异，执行 `npm install` 恢复锁文件，并删除本节日志；本轮未修改数据库、用户卡片或本机私有 `.env`。

## 2026-08-19 - Task: 接入公考教练外部能力适配器
### What was done

- 接入花生十三 MCP、张弓本地 Skill 与 Tavily 联网搜索适配器，统一输出方法上下文、能力状态和来源信息。
- 花生适配器按真实工具契约调用 `question_text`、`module_guess`、方法搜索与方法卡，并对自动路由不确定、上游异常和敏感正文进行安全降级。
- 外部来源均设置内容截断、HTTPS 来源过滤、去重和独立失败状态，确保单项能力故障不泄露上游细节。

### Testing

- TDD 红灯：新增真实花生 MCP 参数契约后，旧实现出现 3 项预期失败。
- `npx vitest run tests/server/coach-adapters.test.ts`：通过，9 项测试全部通过。
- `npm run typecheck`：通过。
- `git diff --check`：通过。

### Notes

- `server/coach/huasheng.ts`：实现花生 MCP SSE 客户端、路由、解题脚手架、方法卡和安全降级。
- `server/coach/zhangGong.ts`：按题型读取张弓 Skill 及对应引用，并限制上下文范围。
- `server/coach/webSearch.ts`：实现 Tavily 搜索、来源清洗、HTTPS 约束和最多三条结果。
- `tests/server/coach-adapters.test.ts`：覆盖真实花生参数、教师路由、错误脱敏、Skill 读取和联网搜索失败行为。
- 回滚方式：反向应用提交 `68b7e19`、`cdd0fc4`，删除上述三个适配器及测试文件；本轮未修改数据库、用户卡片或本机私有 `.env`。

## 2026-08-19 - Task: 增加 AI 公考教练 DeepSeek 提供者
### What was done

- 增加独立教练系统提示词，明确花生十三与张弓的模块边界、卡片上下文可信度、联网内容不可信和 AI 原创练习标记规则。
- 增加教练 DeepSeek Chat Completions 提供者，固定 JSON 响应、关闭思考、低温度和 60 秒超时；用户输入整体作为独立 JSON 消息传递。
- 对老师与模块、方法引用、联网来源、数组数量和文本长度执行严格 schema 校验，所有请求异常统一脱敏。

### Testing

- TDD 红灯：教练提供者文件不存在时目标测试无法加载。
- `npx vitest run tests/server/coach-deepseek.test.ts`：通过，12 项测试全部通过。
- `npm run typecheck`：通过。
- `git diff --check`：通过。

### Notes

- `server/coach/prompt.ts`：新增教练系统提示词。
- `server/coach/deepseek.ts`：新增教练专用请求、响应校验和错误类型。
- `tests/server/coach-deepseek.test.ts`：覆盖配置、请求载荷、合法 JSON、代码块 JSON 及错误边界。
- 回滚方式：反向应用提交 `f04f9e4` 并删除本轮超时修正提交，移除上述教练提供者与测试文件；本轮未修改数据库、用户卡片或本机私有 `.env`。

## 2026-08-19 - Task: 接入 AI 公考教练服务与接口
### What was done

- 完成自动与手动模块路由、老师固定分工、连续追问上下文、卡片最小上下文和联网来源编排。
- 增加 `/api/coach/status` 与 `/api/coach/messages`，严格校验消息数量、长度、角色和未知字段，并使用固定安全错误响应。
- 在生产入口创建独立教练提供者及三类外部适配器，未改变现有卡片整理 DeepSeek 链路。

### Testing

- TDD 红灯：服务和路由文件不存在时两组目标测试无法加载。
- `npx vitest run tests/server/coach-service.test.ts tests/server/coach-routes.test.ts`：通过，24 项测试全部通过。
- `npx vitest run tests/server/coach-service.test.ts tests/server/coach-routes.test.ts tests/server/coach-deepseek.test.ts tests/server/deepseek.test.ts tests/server/health.test.ts`：通过，77 项测试全部通过。
- `npm run typecheck`：通过。
- `git diff --check`：通过。

### Notes

- `server/coach/service.ts`：新增老师路由、卡片与搜索上下文编排及稳定错误类型。
- `server/coach/routes.ts`、`server/coach/index.ts`：新增严格 HTTP 契约与模块出口。
- `server/app.ts`、`server/index.ts`：挂载教练路由并创建生产依赖。
- `tests/server/coach-service.test.ts`、`tests/server/coach-routes.test.ts`：覆盖路由分工、上下文边界、降级和接口错误映射。
- 回滚方式：反向应用提交 `27d5ec0`，恢复服务端入口并删除教练服务、路由与测试；本轮未修改数据库、用户卡片或本机私有 `.env`。

## 2026-08-19 - Task: 完成 AI 公考教练页面
### What was done

- 新增 Apple 风格玻璃教练工作区，支持五种模块模式、四项能力状态、连续对话、卡片模糊搜索、联网开关和结构化训练辅助。
- 支持 `Ctrl+Enter` 发送、输入法组合态保护、`Escape` 中止并保留草稿、请求期间防重复提交，以及窄屏单列布局和透明度/动效降级。
- 来源、方法卡、易错点、训练计划和联网失败状态分别呈现，外链保留可点击地址。

### Testing

- TDD 红灯：页面文件不存在时目标测试无法解析组件。
- `npx vitest run tests/frontend/coach-page.test.tsx`：通过，6 项测试全部通过。
- `npx vitest run tests/frontend/app-shell.test.tsx tests/frontend/coach-route.test.tsx`：通过，27 项测试全部通过。
- `npm test -- --run`：通过，66 个测试文件、914 项测试全部通过。
- `npm run typecheck`：通过；`npm run build`：客户端与服务端构建通过，仅保留既有大包体积提示；`git diff --check`：通过。

### Notes

- `src/pages/CoachPage.tsx`：新增教练对话与训练辅助页面。
- `src/styles/coach.css`：新增玻璃界面、响应式布局和可访问性降级样式。
- `tests/frontend/coach-page.test.tsx`：覆盖页面状态、快捷键、卡片搜索、响应展示和 CSS 契约。
- 回滚方式：反向应用提交 `6c4bfaa`，删除教练页面、样式和页面测试；本轮未修改数据库、用户卡片或本机私有 `.env`。

## 2026-08-19 - Task: 接入 AI 公考教练导航与文档
### What was done

- 在背诵入口之后增加“教练”导航和 `/coach` 路由，保持其他页面路径与顺序不变。
- 新增中文使用文档，说明老师分工、配置、花生 MCP 启动、状态降级、快捷键、卡片边界、联网题源和局域网部署边界。

### Testing

- TDD 红灯：新增路由测试在入口尚未接入时无法匹配 `/coach`。
- `npx vitest run tests/frontend/app-shell.test.tsx tests/frontend/coach-route.test.tsx`：通过，27 项测试全部通过。
- `npm run typecheck`：通过；`git diff --check`：通过。

### Notes

- `src/App.tsx`：增加 `/coach` 路由。
- `src/components/AppShell.tsx`：增加“教练”导航和 `MessagesSquare` 图标。
- `tests/frontend/app-shell.test.tsx`、`tests/frontend/coach-route.test.tsx`：覆盖导航顺序、链接和路由渲染。
- `docs/AI公考教练.md`：新增中文配置与使用说明。
- 回滚方式：反向应用提交 `74c5820`，恢复入口文件并删除路由测试与使用文档；本轮未修改数据库、用户卡片或本机私有 `.env`。

## 2026-08-19 - Task: 完成 AI 公考教练浏览器验收
### What was done

- 在临时后端端口启动本分支服务，确认教练状态接口可被前端代理读取。
- 验收桌面端与移动端响应式布局，确认导航高亮、能力状态、题型切换、题目输入和发送按钮状态正常。
- 保存桌面端与移动端验收截图，确认页面在窄屏下不产生横向溢出。

### Testing

- `npm test -- --run`：66 个测试文件、914 项测试全部通过。
- `npm run typecheck`：通过。
- `npm run build`：客户端与服务端构建通过，仅保留既有大包体积提示。
- Playwright 桌面端 `1280px`：`document.body.scrollWidth === document.body.clientWidth`，教练导航高亮且 `/api/coach/status` 返回 200。
- Playwright 移动端 `390px`：文档宽度与视口一致，题型切换为“言语理解”并成功填入题目。
- `git diff --check`：通过。

### Notes

- `output/playwright/coach-desktop.png`：保存桌面端教练页面验收截图。
- `output/playwright/coach-mobile.png`：保存移动端教练页面验收截图。
- `progress.md`：追加本轮浏览器验收证据与回滚说明。
- 回滚方式：反向应用提交 `cdbbc0f` 及其之前本轮教练功能提交，删除教练页面、服务、适配器、测试与文档；本轮未修改数据库、用户卡片或本机私有 `.env`。

## 2026-08-19 - Task: 修复 AI 公考教练外部契约与连续追问边界
### What was done

- 按花生十三 MCP 真实契约修正数量关系零参数脚手架、判断推理子类型脚手架和嵌套方法卡解析，并为 MCP 连接、工具调用、状态探测和关闭增加 15 秒上限。
- 为 DeepSeek 增加精确 JSON 输出契约；模型只负责生成解析正文，模块、老师、方法引用、联网来源和搜索状态由服务端可信上下文覆盖。
- 为 Tavily 增加 15 秒请求上限；前端连续追问裁剪至服务端 20 条消息限制，并在当前能力未就绪时禁用发送并显示原因。
- 更新教练使用文档，说明判断子类型、请求上限和连续对话边界。

### Testing

- TDD 定向回归：花生适配器 15 项、DeepSeek 14 项、服务与路由 24 项、前端教练页 8 项，共 61 项全部通过。
- `npm run typecheck`：通过。
- `npm test -- --run`：通过，66 个测试文件、924 项测试全部通过；首次全量运行中出现的既有复盘图片锚点时序失败在独立重跑与第二次全量运行中均通过。
- `git diff --check`：通过（仅保留 Windows 换行提示）。

### Notes

- `server/coach/huasheng.ts`、`tests/server/coach-adapters.test.ts`：修正真实花生 MCP 工具参数、脚手架映射、方法卡响应和超时关闭。
- `server/coach/deepseek.ts`、`server/coach/prompt.ts`、`tests/server/coach-deepseek.test.ts`：增加模型输出契约与可信元数据归一化。
- `server/coach/webSearch.ts`：增加 Tavily 请求超时。
- `src/pages/CoachPage.tsx`、`tests/frontend/coach-page.test.tsx`：限制连续消息并禁用不可用能力。
- `docs/AI公考教练.md`：补充新增边界和使用说明。
- `progress.md`：追加本轮修复、验证与回滚说明。
- 回滚方式：反向应用本轮修复提交，恢复此前教练适配器、模型提供者、联网搜索和页面行为；本轮未修改数据库、用户卡片或本机私有 `.env`。

## 2026-08-19 - Task: 将公考教练依赖拉取到项目本地并提供安装启动脚本

### What was done

- 将花生十三 Skill 与花生 MCP 浅克隆到项目 `local-tools/`，创建项目专用 Python 虚拟环境并安装 SSE 扩展。
- 增加幂等安装脚本和 Windows MCP 启动脚本；安装脚本会快进更新两个来源，并对当前上游 `question_text` 路由参数做已知形态兼容修正。
- 更新教练使用文档，明确一条命令安装方式、能力状态和张弓 Skill 的来源边界；未使用未经确认的言语资料替代张弓方法。

### Testing

- `npx vitest run tests/server/coach-local-setup.test.ts`：3/3 通过。
- `npm run typecheck`：通过。
- 两个 PowerShell 脚本解析检查：通过。
- 实际执行 `scripts/setup-coach-local.ps1`：退出码 0，依赖安装完成。
- 本地 MCP 清单：标准 SSE 服务启动，返回 15 个工具。
- 实际 `/api/coach/messages` 数量题：返回数量模块、花生十三老师、`B.6天`、7 个步骤和 4 项训练计划。
- `git diff --check`：通过，仅有 Windows 换行提示。

### Notes

- `.gitignore`：忽略项目本地 `local-tools/` 依赖目录。
- `scripts/setup-coach-local.ps1`：新增本地 Skill/MCP 安装、更新和兼容修正脚本。
- `scripts/start-huasheng-mcp.ps1`：新增本地花生 MCP SSE 启动脚本。
- `tests/server/coach-local-setup.test.ts`：覆盖浅克隆、虚拟环境、SSE 安装和幂等修正契约。
- `docs/AI公考教练.md`：改为一条命令安装，并记录张弓 Skill 未找到可确认公开仓库的边界。
- `progress.md`：追加本轮实现、验证和回滚记录。
- 回滚点：本轮提交完成后执行 `git revert <本轮提交SHA>`；停止 MCP 后可删除明确路径 `local-tools/`，不会影响数据库、卡片内容或 `.env`。

## 2026-08-20 - Task: 配置张弓言语 Skill 与联网搜索

### What was done

- 将指定的张弓言语 Skill 浅克隆到项目本地，并让教练在未显式配置目录时自动发现该 Skill；显式 `ZHANG_GONG_SKILL_DIR` 仍保持最高优先级。
- 安装脚本新增张弓仓库的首次拉取和快进更新，言语理解按题型读取中心理解、选词填空或语句表达参考文件。
- 按 Tavily 官方接口改为 Bearer 鉴权，密钥不再放入请求正文；保留未配置、失败和超时的独立降级。
- 更新使用文档，说明张弓默认目录、联网搜索密钥配置与状态判断。

### Testing

- 张弓适配器与本地安装定向测试：20/20 通过。
- 联网搜索、教练适配器与服务定向测试：28/28 通过。
- `npm run typecheck`：通过。
- PowerShell 安装脚本解析：通过。
- 真实张弓仓库适配器：状态 `ready`，加载 `02-选词填空SOP.md`，提示上下文长度 7992。
- `8787` 真实言语请求：返回模块 `verbal`、老师 `zhang_gong`、方法“中心理解SOP”和 5 个解析步骤。
- `git diff --check`：通过，仅有 Windows 换行提示。
- 当前机器未提供 `TAVILY_API_KEY`，因此未执行真实 Tavily 成功请求；请求契约已用模拟 200、401 和未配置场景验证。

### Notes

- `scripts/setup-coach-local.ps1`：新增张弓言语仓库的浅克隆与快进更新。
- `server/coach/zhangGong.ts`：增加项目本地张弓 Skill 的默认发现。
- `server/coach/webSearch.ts`：切换为 Tavily Bearer 鉴权并从正文移除密钥。
- `tests/server/coach-adapters.test.ts`：覆盖张弓默认目录发现。
- `tests/server/coach-local-setup.test.ts`：覆盖张弓仓库安装位置。
- `tests/server/coach-web-search.test.ts`：覆盖 Tavily 配置、鉴权正文和降级。
- `docs/AI公考教练.md`：补充张弓与联网搜索的安装和配置说明。
- `progress.md`：追加本轮实现、验证和回滚记录。
- 回滚点：本轮提交完成后执行 `git revert <本轮提交SHA>`；停止服务后可删除明确目录 `local-tools/skills/zhang-gong-yanyu`。本轮未修改数据库或用户卡片；`.env` 因没有 Tavily 密钥未写入该项。

## 2026-08-20 - Task: 启用 Tavily 联网搜索并验收 8787

### What was done

- 读取本机 `.env` 中用户已填写的 `TAVILY_API_KEY`，未输出、提交或写入前端代码。
- 重启 `8787` 使服务加载新密钥；张弓言语与联网搜索均纳入当前生产进程。

### Testing

- `.env` 密钥存在性和 `tvly-` 格式检查通过，实际值未显示。
- `GET /api/coach/status`：DeepSeek、花生十三、张弓言语、联网搜索均为 `ready`。
- 真实 `POST /api/coach/messages` 联网请求：返回 `webSearchStatus=ready`、2 个 HTTPS 来源，并完成结构化回答。
- Playwright 访问 `http://127.0.0.1:8787/coach`：确认四项能力均显示“可用”。

### Notes

- `.env`：用户本地配置 Tavily Key，仍被 Git 忽略。
- `progress.md`：追加本轮启用与实链路验收记录。
- 回滚点：停止当前 `8787` Node 进程并恢复此前构建；删除 `.env` 中的 `TAVILY_API_KEY` 可关闭联网搜索，不影响本地教练能力。
