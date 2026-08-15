// @vitest-environment node

import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const projectFile = (path: string) => new URL(`../../${path}`, import.meta.url);

async function readStyles(): Promise<string> {
  return readFile(projectFile('src/styles/shenlun.css'), 'utf8');
}

async function readLibraryStyles(): Promise<string> {
  return readFile(projectFile('src/styles/shenlun-library.css'), 'utf8');
}

function blockFor(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, 's'))?.[1] ?? '';
}

function atRuleBlock(css: string, prelude: string): string {
  const start = css.indexOf(prelude);
  if (start < 0) return '';

  const open = css.indexOf('{', start);
  if (open < 0) return '';

  let depth = 0;
  for (let index = open; index < css.length; index += 1) {
    if (css[index] === '{') depth += 1;
    if (css[index] === '}') {
      depth -= 1;
      if (depth === 0) return css.slice(open + 1, index);
    }
  }

  return '';
}

describe('shenlun workspace styles', () => {
  it('defines the complete Shenlun class contract', async () => {
    const css = await readStyles();
    const classes = [
      'shenlun-page',
      'shenlun-header',
      'shenlun-title-print',
      'shenlun-toolbar',
      'shenlun-template-switch',
      'shenlun-format-tools',
      'shenlun-tool-button',
      'shenlun-tool-button--active',
      'shenlun-workspace',
      'shenlun-sheet-scroll',
      'shenlun-sheet',
      'shenlun-marker',
      'shenlun-grid',
      'shenlun-cell',
      'shenlun-cell--overflow',
      'shenlun-cell__character',
      'shenlun-cell--caret',
      'shenlun-cell--caret-end',
      'shenlun-cell__character--bold',
      'shenlun-cell__character--underline',
      'shenlun-cell__character--strike',
      'shenlun-selection-action',
      'shenlun-annotation-editor',
      'shenlun-connectors',
      'shenlun-notes-rail',
      'shenlun-standard-answer',
      'shenlun-standard-answer__print',
      'shenlun-standard-answer__actions',
      'shenlun-note-editor',
      'shenlun-note-preview',
      'shenlun-note-link',
      'shenlun-annotation-list',
      'shenlun-annotation-card',
      'shenlun-annotation-card--detached',
      'shenlun-annotation-order',
    ];

    for (const className of classes) {
      expect(css).toContain(`.${className}`);
    }
  });

  it('uses the required desktop workspace and fixed 25-column sheet grid', async () => {
    const css = await readStyles();
    const workspace = blockFor(css, '.shenlun-workspace');
    const grid = blockFor(css, '.shenlun-grid');
    const cell = blockFor(css, '.shenlun-cell');

    expect(workspace).toMatch(
      /grid-template-columns:\s*minmax\(0,\s*2fr\)\s+minmax\(300px,\s*1fr\)/,
    );
    expect(grid).toMatch(/grid-template-columns:\s*repeat\(25,\s*var\(--shenlun-cell-size\)\)/);
    expect(grid).toMatch(/grid-auto-rows:\s*var\(--shenlun-cell-size\)/);
    expect(cell).toMatch(/width:\s*var\(--shenlun-cell-size\)/);
    expect(cell).toMatch(/height:\s*var\(--shenlun-cell-size\)/);
    expect(cell).toMatch(/aspect-ratio:\s*1\s*\/\s*1/);
  });

  it('uses layered neutral glass for the right rail with compact curved corners', async () => {
    const css = await readStyles();
    const rail = blockFor(css, '.shenlun-notes-rail');
    const standardAnswer = blockFor(css, '.shenlun-standard-answer');
    const noteEditor = blockFor(css, '.shenlun-note-editor');
    const note = blockFor(css, '.shenlun-note-preview');
    const annotationList = blockFor(css, '.shenlun-annotation-list');
    const annotation = blockFor(css, '.shenlun-annotation-card');
    const grid = blockFor(css, '.shenlun-grid');
    const overflow = blockFor(css, '.shenlun-cell--overflow');
    const curvedRules = [rail, standardAnswer, noteEditor, annotationList, annotation];

    expect(rail).toMatch(/background(?:-color)?:\s*rgba\(255,\s*255,\s*255,\s*0\.22\)/);
    expect(standardAnswer).toMatch(/background(?:-color)?:\s*rgba\(255,\s*255,\s*255,\s*0\.52\)/);
    expect(noteEditor).toMatch(/background(?:-color)?:\s*rgba\(255,\s*255,\s*255,\s*0\.38\)/);
    expect(annotationList).toMatch(/background(?:-color)?:\s*rgba\(255,\s*255,\s*255,\s*0\.28\)/);
    expect(annotation).toMatch(/background(?:-color)?:\s*rgba\(255,\s*255,\s*255,\s*0\.48\)/);
    expect(note).toMatch(/background(?:-color)?:\s*transparent/);
    expect(noteEditor).not.toMatch(/var\(--shenlun-note-bg\)/);
    expect(annotation).not.toMatch(/var\(--shenlun-annotation-bg\)/);
    expect(grid).toMatch(/background(?:-color)?:\s*(?:#f[0-9a-f]{5}|var\(--shenlun-grid-bg\))/i);
    expect(overflow).toMatch(/background(?:-color)?:\s*(?:#f[0-9a-f]{5}|var\(--shenlun-overflow-bg\))/i);
    expect(curvedRules.every((rule) => /border-radius:\s*8px/.test(rule))).toBe(true);
    expect(css).not.toMatch(/purple|violet|radial-gradient|conic-gradient/i);
  });

  it('gives the notes rail independent vertical scrolling', async () => {
    const css = await readStyles();
    const rail = blockFor(css, '.shenlun-notes-rail');

    expect(rail).toMatch(/min-height:\s*0/);
    expect(rail).toMatch(/overflow-y:\s*auto/);
    expect(rail).toMatch(/overscroll-behavior:\s*contain/);
    expect(rail).toMatch(/backdrop-filter:\s*blur/);
    expect(rail).toMatch(/background(?:-color)?:\s*rgba\(/);
  });

  it('keeps ribbon controls stable and exposes formatting and caret feedback', async () => {
    const css = await readStyles();
    const toolButton = blockFor(css, '.shenlun-tool-button');
    const activeToolButton = blockFor(css, '.shenlun-tool-button--active');
    const caretCell = blockFor(css, '.shenlun-cell--caret');
    const selectionAction = blockFor(css, '.shenlun-selection-action');
    const connectors = blockFor(css, '.shenlun-connectors');

    expect(toolButton).toMatch(/width:\s*var\(--tool-height\)/);
    expect(toolButton).toMatch(/height:\s*var\(--tool-height\)/);
    expect(activeToolButton).toMatch(/background(?:-color)?:/);
    expect(caretCell).toMatch(/box-shadow:/);
    expect(selectionAction).toMatch(/position:\s*fixed/);
    expect(selectionAction).toMatch(/z-index:/);
    expect(connectors).toMatch(/color:\s*rgba\(/);
    expect(connectors).toMatch(/z-index:/);
    expect(blockFor(css, '.shenlun-cell__character--bold')).toMatch(/font-weight:\s*700/);
    expect(blockFor(css, '.shenlun-cell__character')).toMatch(/flex:\s*1/);
    expect(blockFor(css, '.shenlun-cell__character--underline::after')).toMatch(/left:\s*0/);
    expect(blockFor(css, '.shenlun-cell__character--underline::after')).toMatch(/right:\s*0/);
    expect(blockFor(css, '.shenlun-cell__character--strike::before')).toMatch(/left:\s*0/);
    expect(blockFor(css, '.shenlun-cell__character--strike::before')).toMatch(/right:\s*0/);
    expect(blockFor(css, '.shenlun-cell__character--color-red')).toMatch(/color:/);
    expect(blockFor(css, '.shenlun-color-swatch')).toMatch(/border-radius:\s*50%/);
  });

  it('keeps preview colors visible through nested bold and decoration elements', async () => {
    const css = await readLibraryStyles();

    expect(blockFor(css, '.shenlun-library__text--red *')).toMatch(/color:\s*#b42318/);
    expect(blockFor(css, '.shenlun-library__text--blue *')).toMatch(/color:\s*#245b8f/);
    expect(blockFor(css, '.shenlun-library__text--green *')).toMatch(/color:\s*#276749/);
  });

  it('reduces background transparency on Shenlun library cards', async () => {
    const css = await readLibraryStyles();
    const card = blockFor(css, '.shenlun-library .shenlun-library__card.liquid-glass');

    expect(card).toMatch(/background:\s*rgba\(255,\s*255,\s*255,\s*0\.78\)/);
  });

  it('keeps Shenlun archive tabs and icon actions compact', async () => {
    const css = await readLibraryStyles();
    const viewSwitch = blockFor(css, '.shenlun-library__view-switch');
    const iconAction = blockFor(css, '.shenlun-library__icon-action');

    expect(viewSwitch).toMatch(/display:\s*inline-flex/);
    expect(viewSwitch).toMatch(/border-radius:\s*8px/);
    expect(iconAction).toMatch(/width:\s*40px/);
    expect(iconAction).toMatch(/height:\s*40px/);
  });

  it('keeps the native composition input visible beside the active grid cell', async () => {
    const css = await readStyles();
    const inputProxy = blockFor(css, '.shenlun-input-proxy');

    expect(inputProxy).toMatch(/position:\s*fixed/);
    expect(inputProxy).toMatch(/background(?:-color)?:\s*transparent/);
    expect(inputProxy).toMatch(/caret-color:\s*transparent/);
    expect(inputProxy).toMatch(/pointer-events:\s*none/);
    expect(inputProxy).not.toMatch(/left:\s*-9999px/);
    expect(inputProxy).not.toMatch(/opacity:\s*0/);
    expect(blockFor(css, '.shenlun-input-proxy:focus')).toMatch(/outline:\s*(?:0|none)/);
  });

  it('switches to a single column with a non-shrinking horizontal sheet below 1100px', async () => {
    const css = await readStyles();
    const responsive = atRuleBlock(css, '@media (max-width: 1100px)');

    expect(responsive).toMatch(/\.shenlun-workspace[^\{]*\{[\s\S]*grid-template-columns:\s*1fr/);
    expect(responsive).toMatch(/\.shenlun-sheet-scroll[^\{]*\{[\s\S]*overflow-x:\s*auto/);
    expect(responsive).toMatch(/\.shenlun-grid[^\{]*\{[\s\S]*width:\s*max-content/);
    expect(responsive).toMatch(/\.shenlun-grid[^\{]*\{[\s\S]*flex-shrink:\s*0/);
  });

  it('keeps the toolbar and both sheet axes reachable at browser zoom widths', async () => {
    const css = await readStyles();
    const zoomLayout = atRuleBlock(css, '@media (max-width: 760px)');
    const zoomPage = blockFor(zoomLayout, '.shenlun-page');

    expect(zoomPage).not.toMatch(/overflow:\s*hidden/);
    expect(zoomLayout).toMatch(/\.shenlun-toolbar[^\{]*\{[\s\S]*position:\s*sticky/);
    expect(zoomLayout).toMatch(/\.shenlun-template-switch[^\{]*\{[\s\S]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
    expect(zoomLayout).toMatch(/\.shenlun-sheet-scroll[^\{]*\{[\s\S]*max-height:/);
    expect(zoomLayout).toMatch(/\.shenlun-sheet-scroll[^\{]*\{[\s\S]*overflow:\s*auto/);
    expect(zoomLayout).toMatch(/\.shenlun-notes-rail[^\{]*\{[\s\S]*width:\s*100%/);
  });

  it('defines print output that keeps content and removes temporary chrome', async () => {
    const css = await readStyles();
    const print = atRuleBlock(css, '@media print');

    expect(print).toMatch(/\.app-shell__sidebar\s*,?[^\{]*\.shenlun-toolbar[^\{]*\{[\s\S]*display:\s*none/);
    expect(print).toMatch(/input|textarea|select/);
    expect(print).toMatch(/\.shenlun-selection-action|\.shenlun-connectors/);
    expect(print).toMatch(/\.shenlun-status|\.shenlun-file-import/);
    expect(print).toMatch(/\.app-shell__main[^\{]*\{[\s\S]*margin:\s*0/);
    expect(print).toMatch(/\.shenlun-grid|\.shenlun-notes-rail|\.shenlun-annotation-list/);
    expect(print).toMatch(/\.shenlun-workspace[^\{]*\{[\s\S]*grid-template-columns:\s*max-content\s+260px/);
    expect(print).toMatch(/\.shenlun-workspace[^\{]*\{[\s\S]*width:\s*max-content/);
    expect(print).toMatch(/svg/);
    expect(print).toMatch(/\.shenlun-note-link[^\{]*\{[\s\S]*color/);
    expect(print).toMatch(/\.shenlun-standard-answer__print[^\{]*\{[\s\S]*display:\s*block/);
    expect(print).toMatch(/\.shenlun-title-print[^\{]*\{[\s\S]*display:\s*block/);
    expect(css).toMatch(/@page\s*\{[\s\S]*size:\s*A4\s+landscape/);
  });

  it('provides reduced motion, transparency, and contrast fallbacks', async () => {
    const css = await readStyles();

    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('@media (prefers-reduced-transparency: reduce)');
    expect(css).toContain('@media (prefers-contrast: more)');
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce[\s\S]*?transition:\s*none/);
    expect(css).toMatch(/prefers-reduced-transparency:\s*reduce[\s\S]*?backdrop-filter:\s*none/);
    expect(css).toMatch(/prefers-reduced-transparency:\s*reduce[\s\S]*?\.shenlun-notes-rail[\s\S]*?background-color:\s*var\(--color-surface\)/);
    expect(css).toMatch(/prefers-contrast:\s*more[\s\S]*?border-color:\s*var\(--color-border-strong\)/);
  });
});
