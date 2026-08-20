# AI 公考教练

## 功能定位

AI 公考教练位于主导航的“教练”入口，页面地址为 `/coach`。它用于输入行测题目、连续追问、关联一张现有卡片，并生成结构化解析与训练计划。

首期不保存聊天记录，也不会把答案自动写回卡片。刷新页面后当前会话会清空。

## 老师分工

| 模块 | 方法来源 |
| --- | --- |
| 判断推理 | 花生十三 MCP |
| 资料分析 | 花生十三 MCP |
| 数量关系 | 花生十三 MCP |
| 言语理解 | 张弓 Skill |

DeepSeek 负责组织连续对话、解释方法和整理训练计划，不冒充老师提供新的方法内容。自动识别不确定时，应手动选择模块。

判断推理自动识别到图形、定义、类比或分析子类型时，会加载花生十三对应的解题脚手架；手动选择判断推理时使用通用判断推理脚手架。

## 服务端配置

在本机 `.env` 中按需配置以下变量，不要把 API Key 或本机绝对路径提交到 Git：

```dotenv
DEEPSEEK_API_KEY=你的密钥
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
HUASHENG_MCP_URL=http://127.0.0.1:8000/sse
ZHANG_GONG_SKILL_DIR=张弓Skill所在目录
TAVILY_API_KEY=你的密钥
```

- DeepSeek 是对话编排能力，缺少 `DEEPSEEK_API_KEY` 时无法生成教练回答。
- 花生十三 MCP 提供判断、资料和数量的方法卡及解题脚手架。
- 张弓 Skill 使用项目本地 `local-tools/skills/zhang-gong-yanyu`；项目只读取必要的 `SKILL.md` 和对应题型参考文件，不复制、提交或向前端暴露课程原文与本机路径。也可以通过 `ZHANG_GONG_SKILL_DIR` 指向你自己的授权目录，显式目录优先。
- Tavily 提供可选的联网题源搜索。未配置时仍可使用核心解析。

## 启动花生十三 MCP

项目已经预留本地目录：

```text
local-tools/skills/huasheng13/   花生十三 Skill 本地副本
local-tools/skills/zhang-gong-yanyu/ 张弓言语 Skill 本地副本
local-tools/huasheng-mcp/        花生十三 MCP 源码本地副本
local-tools/.venv/               项目专用 Python 环境
```

首次安装或更新时，在项目根目录执行：

```powershell
.\scripts\setup-coach-local.ps1
```

该脚本会把花生十三 Skill、花生 MCP 和张弓言语 Skill 浅克隆到 `local-tools/`，创建项目专用 Python 环境并安装 SSE 依赖。再次运行时只做快进更新，不覆盖来源不明的同名目录；同时会幂等修正当前上游版本的 `question_text` 路由兼容问题。

日常启动推荐使用一键入口：

```powershell
npm run start:coach
```

它会自动检查本地 Skill、Python 环境、花生 MCP、DeepSeek、张弓和 Tavily 状态；缺少本地依赖时自动安装，`8000` 或 `8787` 未启动时自动拉起，发现旧进程配置不完整时自动重启。需要主动同步三个 GitHub 来源并重新构建时，使用：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-coach-local.ps1 -Sync
```

本项目提供了 Windows 启动脚本，推荐直接运行：

```powershell
.\scripts\start-huasheng-mcp.ps1
```

脚本默认只监听 `127.0.0.1:8000`，并提供标准 SSE 地址 `http://127.0.0.1:8000/sse`。如果需要手动启动，也可以使用：

```powershell
local-tools/.venv/Scripts/python.exe -m uvicorn mcp_server.server:app --host 127.0.0.1 --port 8000
```

默认配置连接 `http://127.0.0.1:8000/sse`。如果 MCP 使用其他地址，应同步修改 `HUASHENG_MCP_URL`，然后重启本项目服务端。上游包的命令入口在当前版本声明不完整，因此使用项目脚本直接启动 `uvicorn` 应用。

## 张弓 Skill

项目已支持并默认拉取 [张弓言语 Skill](https://github.com/su8023/zhang-gong-yanyu-master) 到 `local-tools/skills/zhang-gong-yanyu`。该目录包含根部 `SKILL.md` 和 `references/` 下的中心理解、选词填空、语句表达等方法文件。未设置 `ZHANG_GONG_SKILL_DIR` 时，服务会自动发现这个项目本地目录；显式配置目录时则优先使用显式目录。

执行安装脚本并重启服务后，页面状态中的“张弓言语”应显示为“可用”。如果目录缺少 `SKILL.md`，状态会保持“未配置”，不会用花生十三方法替代言语理解。

## 联网搜索

联网搜索使用 Tavily 官方搜索接口。先在 `.env` 写入你自己的密钥，不要提交到 Git：

```dotenv
TAVILY_API_KEY=tvly-你的密钥
```

服务会使用 `Authorization: Bearer <密钥>` 请求 `https://api.tavily.com/search`，密钥不会放进请求正文。配置后重启服务，页面状态中的“联网搜索”显示“可用”；搜索失败或超时只会降级为无联网来源，不影响花生十三和张弓的本地方法解析。

## 能力状态

页面顶部会分别显示四项能力状态：

- `可用`：配置存在，且该能力当前可连接或可读取。
- `未配置`：缺少对应的密钥、目录或必要文件，需要先完成本机配置。
- `暂不可用`：已经配置，但外部服务未启动、超时或当前连接失败。

各能力独立降级。Tavily 失败不会中断核心回答；花生十三不可用时不应冒充花生方法回答判断、资料或数量题；张弓 Skill 不可用时不应切换成花生言语方法。

教练发送前会检查 DeepSeek 以及当前模块对应的方法源；已知未配置或暂不可用时，页面会禁用发送并显示原因。连续对话最多向服务端保留 20 条消息，同时保留第一条原题和最近追问。花生 MCP 与联网搜索请求各有 15 秒上限，超时按能力不可用或搜索失败处理。

花生 MCP 曾经掉线后，状态检查会重新连接探测；重新启动 `scripts/start-huasheng-mcp.ps1` 后无需重启整个项目，刷新教练页面即可恢复发送。

## 快捷键

- `Ctrl+Enter`：发送当前题目或追问。
- `Escape`：停止正在进行的请求，并保留输入草稿和当前会话。
- 模块选项可通过鼠标点击，也可用键盘聚焦后切换。

## 卡片与题源边界

关联卡片时，教练只读取用户初始稿、板块和标签作为本轮上下文。卡片内容是用户自己的理解，不视为标准答案；教练不会修改卡片原文或 AI 优化稿。

“联网来源”展示 Tavily 检索到的公开页面标题、摘要、域名和原始链接。它与“AI 原创练习”是两类内容：联网来源可追溯到外部网页；AI 原创练习由模型基于本轮方法生成，必须保持原创标记，不能标成真题或联网题源。

## 局域网使用边界

浏览器只访问本项目服务端，不直接连接 DeepSeek、花生十三 MCP、张弓 Skill 或 Tavily。密钥和本机资料路径只保留在服务端环境中。

默认 `HOST=127.0.0.1` 仅允许本机访问。需要同一局域网设备访问时，可明确把本项目服务端设置为 `HOST=0.0.0.0`，并使用防火墙限制可信局域网；这不会自动把花生 MCP 暴露到局域网。不要在公网直接开放项目端口，也不要把 `.env`、Skill 目录或 MCP 端口共享给不可信设备。
