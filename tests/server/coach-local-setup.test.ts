import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const scriptPath = resolve(process.cwd(), 'scripts/setup-coach-local.ps1');

function readSetupScript() {
  return readFileSync(scriptPath, 'utf8');
}

describe('本地公考教练依赖安装脚本', () => {
  it('将花生 Skill 与 MCP 浅克隆到项目本地并仅快进更新', () => {
    const script = readSetupScript();

    expect(script).toContain('https://github.com/WangJunqing-coder/huasheng13-skill.git');
    expect(script).toContain('https://github.com/heihei999/huasheng-mcp.git');
    expect(script).toMatch(/git clone --depth 1 --branch \$Branch \$RepositoryUrl \$Destination/);
    expect(script).toMatch(/git -C \$Destination pull --ff-only origin \$Branch/);
    expect(script).toMatch(/-Branch 'master'[\s\S]*skills\\huasheng13/);
    expect(script).toMatch(/-Branch 'main'[\s\S]*huasheng-mcp/);
  });

  it('将张弓言语 Skill 浅克隆到适配器可读取的项目本地目录', () => {
    const script = readSetupScript();

    expect(script).toContain('https://github.com/su8023/zhang-gong-yanyu-master.git');
    expect(script).toMatch(/-Branch 'main'[\s\S]*skills\\zhang-gong-yanyu/);
  });

  it('按需创建本地虚拟环境并从 MCP 源码安装 SSE 扩展', () => {
    const script = readSetupScript();

    expect(script).toContain("local-tools\\.venv\\Scripts\\python.exe");
    expect(script).toMatch(/if \(-not \(Test-Path -LiteralPath \$venvPython\)\)/);
    expect(script).toContain("py -m venv $venvRoot");
    expect(script).toContain("-m pip install --editable \"$mcpRoot[sse]\"");
  });

  it('幂等修正 runtime_adapter 的 question_text 路由参数', () => {
    const script = readSetupScript();

    expect(script).toContain('src\\mcp_server\\runtime_adapter.py');
    expect(script).toContain('def route_xingce_question(self, question: str):');
    expect(script).toContain('def route_xingce_question(');
    expect(script).toContain('question_text: str,');
    expect(script).toContain('question_text=question_text,');
    expect(script).toMatch(/if \(\$content\.Contains\(\$compatibleRoute\)\)[\s\S]*return/);
    expect(script).toContain("throw 'Unable to locate the expected Huasheng route adapter implementation.'");
  });
});
