// @vitest-environment node

import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const projectFile = (path: string) => new URL(`../../${path}`, import.meta.url);

describe('液态玻璃基础样式', () => {
  it('定义薄、标准、厚和深色四级材质', async () => {
    const [tokens, css] = await Promise.all([
      readFile(projectFile('src/styles/tokens.css'), 'utf8'),
      readFile(projectFile('src/styles/liquid-glass.css'), 'utf8'),
    ]);

    expect(tokens).toMatch(/--glass-(thin|regular|thick|dark):/g);
    expect(tokens.match(/--glass-(thin|regular|thick|dark):/g)).toHaveLength(4);
    expect(css).toContain('.liquid-glass--thin');
    expect(css).toContain('.liquid-glass--regular');
    expect(css).toContain('.liquid-glass--thick');
    expect(css).toContain('.liquid-glass--dark');
    expect(css).toMatch(
      /\.liquid-glass--regular\s*\{[^}]*backdrop-filter:\s*blur\(var\(--glass-blur-regular\)\)/,
    );
  });

  it('嵌套控件复用父级材质且不叠加独立模糊', async () => {
    const css = await readFile(projectFile('src/styles/liquid-glass.css'), 'utf8');

    expect(css).toMatch(
      /\.liquid-glass__nested,\s*\.liquid-glass \.liquid-glass\s*\{[^}]*backdrop-filter:\s*none/,
    );
  });

  it('提供随指针移动的表面高光', async () => {
    const css = await readFile(projectFile('src/styles/liquid-glass.css'), 'utf8');

    expect(css).toMatch(/:where\(\.liquid-glass\)\s*\{[^}]*position:\s*relative/);
    expect(css).toContain('--glass-pointer-x');
    expect(css).toContain('--glass-pointer-y');
    expect(css).toMatch(/\.liquid-glass::before\s*\{[^}]*radial-gradient/);
  });

  it('仅为显式启用的控件提供按下反馈', async () => {
    const css = await readFile(projectFile('src/styles/liquid-glass.css'), 'utf8');

    expect(css).toMatch(/\.liquid-pressable\s*\{[^}]*transform-origin:\s*center/);
    expect(css).toMatch(
      /\.liquid-pressable:active[^\{]*\{[^}]*transform:\s*scale\(var\(--glass-press-scale\)\)/,
    );
    expect(css).not.toContain(":where(button, [role='button'], .button)");
  });

  it('为减少动态、减少透明度和高对比度提供独立回退', async () => {
    const css = await readFile(projectFile('src/styles/liquid-glass.css'), 'utf8');

    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('@media (prefers-reduced-transparency: reduce)');
    expect(css).toContain('@media (prefers-contrast: more)');
    expect(css).toMatch(
      /@media \(prefers-reduced-transparency: reduce\)\s*\{\s*\.liquid-glass,[^{]*\.liquid-glass__nested,[^{]*\{[^}]*backdrop-filter:\s*none/,
    );
    expect(css).toMatch(
      /@media \(prefers-contrast: more\)\s*\{\s*\.liquid-glass,[^{]*\.liquid-glass__nested,[^{]*\{[^}]*--glass-edge-current:\s*var\(--glass-edge-contrast\)/,
    );
  });

  it('系统和应用内减少动态模式都取消按压位移并保留静态反馈', async () => {
    const css = await readFile(projectFile('src/styles/liquid-glass.css'), 'utf8');

    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.liquid-pressable:active[^\{]*\{[^}]*transform:\s*none[^}]*filter:\s*brightness/,
    );
    expect(css).toMatch(
      /html\[data-motion='reduced'\] \.liquid-pressable:active[^\{]*\{[^}]*transform:\s*none[^}]*filter:\s*brightness/,
    );
  });

  it('不支持背景模糊时使用实色材质', async () => {
    const css = await readFile(projectFile('src/styles/liquid-glass.css'), 'utf8');

    expect(css).toContain('@supports not');
    expect(css).toContain('--glass-solid');
    expect(css).toMatch(
      /@supports not[^\{]*\{\s*\.liquid-glass,[^{]*\.liquid-glass__nested,[^{]*\{[^}]*backdrop-filter:\s*none/,
    );
  });

  it('嵌套控件在透明度和对比度回退中也切换为实色', async () => {
    const css = await readFile(projectFile('src/styles/liquid-glass.css'), 'utf8');

    const nestedSolidRules = css.match(
      /\.liquid-glass__nested,[^{]*\{[^}]*background:\s*var\(--glass-solid\)/g,
    );

    expect(nestedSolidRules).toHaveLength(3);
  });

  it('在全局样式之后加载玻璃材质样式', async () => {
    const main = await readFile(projectFile('src/main.tsx'), 'utf8');
    const globalImport = main.indexOf("import './styles/global.css';");
    const glassImport = main.indexOf("import './styles/liquid-glass.css';");

    expect(globalImport).toBeGreaterThan(-1);
    expect(glassImport).toBeGreaterThan(globalImport);
  });

  it('横向图谱搜索浮层使用视口高度而不会被顶部表单裁切', async () => {
    const css = await readFile(projectFile('src/styles/graphs.css'), 'utf8');
    const searchPanelRule = css.match(/\.graphs-horizontal-card-search\s*\{[^}]*\}/)?.[0] ?? '';

    expect(searchPanelRule).toMatch(/max-height:\s*min\(500px,\s*calc\(100dvh\s*-/);
    expect(searchPanelRule).not.toMatch(/max-height:[^;]*100%/);
  });
});
