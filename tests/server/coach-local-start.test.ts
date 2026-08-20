import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const scriptPath = resolve(process.cwd(), 'scripts/start-coach-local.ps1');
const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8')) as {
  scripts?: Record<string, string>;
};

describe('本地公考教练一键启动脚本', () => {
  it('通过单一命令启动并检查 MCP 与 8787 后端', () => {
    const script = readFileSync(scriptPath, 'utf8');

    expect(script).toContain('scripts\\setup-coach-local.ps1');
    expect(script).toContain('scripts\\start-huasheng-mcp.ps1');
    expect(script).toContain('Start-Process');
    expect(script).toContain('-WindowStyle Hidden');
    expect(script).toContain('/.well-known/mcp.json');
    expect(script).toContain('/api/coach/status');
    expect(script).toContain("'zhangGong'");
    expect(script).toContain("'webSearch'");
  });

  it('启动命令只在本地依赖缺失时安装，并支持显式同步', () => {
    const script = readFileSync(scriptPath, 'utf8');

    expect(script).toContain('[switch]$Sync');
    expect(script).toContain('if ($Sync -or $missingDependency)');
    expect(script).toContain("dist-server\\index.js");
  });

  it('package.json 提供 start:coach 入口', () => {
    expect(packageJson.scripts?.['start:coach']).toContain('scripts/start-coach-local.ps1');
  });
});
