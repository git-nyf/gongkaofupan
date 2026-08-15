# 每日 Anki 复习卡推送

## 功能说明

系统每天从未归档、且已有可靠 AI 题面的用户初始稿中随机抽取最多 10 条，先生成中文 Markdown 复习文档，再生成可导入 Anki 的 `.apkg` 卡组。生成文件默认保存到 `output/anki/`，不会写入数据库中的用户原文之外的数据，也不会保存 DeepSeek 密钥。

每条卡片使用系统中已经由 DeepSeek 生成并校验的衍生问题作为正面，背面始终保留完整用户初始稿。没有可靠 AI 题面的内容不会被强行制作成弱题；相同初始稿衍生出的重复记录会在抽取阶段合并，保留最新代表记录。

## 手动生成

在项目目录执行：

```bash
npm run anki:daily
```

命令会输出 JSON 结果。即使 cc-connect 未安装或发送失败，已生成的 Markdown 与 `.apkg` 仍会保留在输出目录。

## 从卡片库导出

卡片库顶部提供“导出 Anki”和“导出记录”两个入口：

- 已勾选卡片时，仅导出当前选中的用户初始稿。
- 未勾选卡片时，导出全部符合条件的用户初始稿。
- 相同初始稿产生的多张衍生卡片只保留一张，避免重复。
- 导出成功后浏览器立即下载 `.apkg` 文件。
- “导出记录”从页面底部打开，可查看每次导出的题面、完整初始稿答案，并再次下载历史 `.apkg` 文件。
- 用户初始稿视图中的每张卡片都提供“发送 Anki 到手机”按钮；点击后只生成当前初始稿的一张卡组，并通过已连接的 cc-connect 直接发送到手机端，不会触发每日 24 小时自动发送计时。
- 点击发送后，卡片库右下角会固定显示“正在生成并发送 Anki 卡片”；发送完成或失败后，提示仍固定在当前视口内，可使用关闭按钮收起，不会因页面滚动而消失。
- 如果提示“微信会话已过期”，先在微信中给 cc-connect 机器人发送一条新消息刷新会话令牌，再回到卡片库重试。

历史文件保存在 `ANKI_OUTPUT_DIR/exports/`，默认是 `output/anki/exports/`。每次导出会生成 `.apkg`、Markdown 和 JSON 元数据；JSON 只记录稳定批次编号、文件名和卡片内容，不保存密钥或外部账号信息。

## 启动时自动发送

服务每次启动后会检查最近一次成功发送时间：

- 距离成功发送不足 24 小时时直接跳过。
- 没有成功记录或已经超过 24 小时时，随机抽取 3 张用户初始稿，生成 Anki 复习卡并调用 cc-connect 发送。
- 只有 cc-connect 明确返回成功后，才会把时间写入现有 `app_settings`。
- 空卡片库、cc-connect 未绑定、进程未启动或发送失败都不会阻止系统启动，也不会写入成功时间；下次启动仍会重试。

自动发送生成的文件名以 `auto-review-YYYYMMDD-HHmmss` 开头，仍保存在 `output/anki/`。

## 配置 cc-connect

先按照 cc-connect 的平台文档绑定接收账号，并确认 `cc-connect` 已加入系统 PATH。然后在项目目录创建每日任务：

```bash
cc-connect cron add --cron "30 7 * * *" --prompt "在项目目录运行 npm run anki:daily；生成今日 Anki 复习卡并发送生成的 apkg 和 Markdown 文件" --desc "每日公考初始稿 Anki"
```

任务每天 7:30 执行。cc-connect 的 cron 会在当前项目会话中触发命令；项目命令负责选卡、生成文件和调用 `cc-connect send --file` 发送两个附件。发送前必须存在 cc-connect 当前活动会话；只有历史会话而没有活动会话时，cc-connect 会返回 `no active session found`，项目会保留生成文件并等待下次启动重试。

## 环境变量

| 变量 | 默认值 | 作用 |
| --- | --- | --- |
| `ANKI_OUTPUT_DIR` | `./output/anki` | Markdown 与 `.apkg` 输出目录 |
| `CC_CONNECT_COMMAND` | `cc-connect` | cc-connect 可执行文件名或原生程序绝对路径；Windows 默认会自动定位全局安装包中的原生程序 |
| `CC_CONNECT_DATA_DIR` | 空 | cc-connect 消息数据目录；需要连接已有本地 daemon 时填写其 `data_dir` |

示例：

```env
ANKI_OUTPUT_DIR=./output/anki
CC_CONNECT_COMMAND=cc-connect
CC_CONNECT_DATA_DIR=D:\\cc-connect\\cc-connect-data
```

## 接口

网页或本地工具可以调用：

```http
POST /api/anki/daily
Content-Type: application/json

{}
```

默认生成 10 张但不发送；设置 `send` 为 `true` 会在生成后调用 cc-connect：

```json
{"send":true}
```

`count` 可在 1 到 10 之间调整。接口只接受本地服务请求，发送仍受 cc-connect 当前会话和平台绑定状态影响。

单张用户初始稿可直接发送：

```http
POST /api/anki/cards/:cardId/send
```

其中 `:cardId` 必须是用户初始稿卡片编号。成功返回 `status=sent`；卡片没有可用 AI 题面、cc-connect 未连接或发送失败时分别返回明确的 404 或 502 错误。微信会话令牌过期时，502 消息会直接指引刷新会话后重试。

卡片库导出与历史接口：

```http
POST /api/anki/exports
GET /api/anki/exports
GET /api/anki/exports/:id
GET /api/anki/exports/:id/apkg
```

创建导出时可以传入最多 500 个卡片编号；省略 `cardIds` 表示导出全部符合条件的用户初始稿。
