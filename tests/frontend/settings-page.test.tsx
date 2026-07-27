// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsPage } from '../../src/pages/SettingsPage';
import { shouldReduceMotion } from '../../src/theme/experienceSettings';

const projectFile = (path: string) => resolve(process.cwd(), path);

const settingsResponse = {
  defaultSessionSize: 20,
  defaultOrder: 'random',
  dueFirst: true,
  defaultFocusMinutes: 25,
  qqMusicPath: '',
  qqMusicAvailable: false,
  deepseekConfigured: false,
};

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute('data-motion');
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('体验设置', () => {
  it('以分级白色玻璃呈现设置区域和薄玻璃控件', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify(settingsResponse),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )));

    render(<SettingsPage />);

    const themeSection = screen.getByRole('heading', { name: 'DIY 主题' }).closest('section');
    const experienceSection = screen.getByRole('heading', { name: '体验设置' }).closest('section');
    const musicSection = (await screen.findByRole('textbox', { name: 'QQ 音乐路径' }))
      .closest('.experience-settings__music');

    for (const section of [themeSection, experienceSection, musicSection]) {
      expect(section).toHaveClass('liquid-glass', 'liquid-glass--regular');
    }

    const themeOption = screen.getAllByRole('radio', { name: '默认' })[0].closest('label');
    const focusSegment = screen.getByRole('radio', { name: '25 分钟' }).nextElementSibling;
    const motionSegment = screen.getByRole('radio', { name: '标准动效' }).nextElementSibling;
    const musicPath = screen.getByRole('textbox', { name: 'QQ 音乐路径' });
    const fadeSlider = screen.getByRole('slider', { name: /右侧背景淡化强度/ });

    for (const control of [themeOption, focusSegment, motionSegment, musicPath, fadeSlider]) {
      expect(control).toHaveClass('liquid-glass--thin', 'liquid-glass__nested');
    }

    for (const button of screen.getAllByRole('button')) {
      expect(button).toHaveClass('liquid-pressable');
    }
  });

  it('设置页材质遵循紧凑圆角、触控尺寸和辅助功能回退', async () => {
    const css = await readFile(projectFile('src/styles/settings-glass.css'), 'utf8').catch(() => '');

    expect(css).toMatch(/\.settings-page \.settings-section\s*\{[^}]*border-radius:\s*8px/);
    expect(css).toMatch(/\.settings-page \.button,[^{]*\{[^}]*min-height:\s*44px/);
    expect(css).toContain('@media (prefers-reduced-transparency: reduce)');
    expect(css).toContain('@media (prefers-contrast: more)');
    expect(css).toMatch(
      /prefers-reduced-transparency:[^{]*\{[^}]*\.settings-page \.liquid-glass__nested[^{]*\{[^}]*backdrop-filter:\s*none/s,
    );
    expect(css).not.toMatch(/\.settings-page \.liquid-glass__nested\s*\{[^}]*backdrop-filter:\s*blur/s);
  });

  it('隐藏单选框在键盘聚焦时为两个分段组显示清晰焦点环', async () => {
    const css = await readFile(projectFile('src/styles/settings-glass.css'), 'utf8');

    expect(css).toMatch(
      /\.settings-page \.experience-settings__focus input:focus-visible \+ span,\s*\.settings-page \.experience-settings__motion input:focus-visible \+ span\s*\{[^}]*outline:\s*2px solid var\(--color-accent\)[^}]*outline-offset:\s*2px/s,
    );
  });

  it('应用内减弱动效同时停止主题卡片和预览图的悬浮位移', async () => {
    const css = await readFile(projectFile('src/styles/settings-glass.css'), 'utf8');

    expect(css).toMatch(
      /html\[data-motion='reduced'\] \.settings-page \.theme-picker__option:hover,\s*html\[data-motion='reduced'\] \.settings-page \.theme-picker__option:hover \.theme-picker__preview\s*\{[^}]*transform:\s*none/s,
    );
  });

  it('即时预览的减弱动效会同步给依赖逻辑的交互', () => {
    document.documentElement.dataset.motion = 'reduced';
    expect(shouldReduceMotion()).toBe(true);
  });

  it('即时预览的标准动效会覆盖尚未保存的旧减弱偏好', () => {
    window.localStorage.setItem('gongkao-experience-v1', JSON.stringify({
      version: 1,
      motionLevel: 'reduced',
    }));
    document.documentElement.dataset.motion = 'standard';
    expect(shouldReduceMotion()).toBe(false);
  });
  it('选择 DIY 背景后立即保存并在重新挂载时恢复', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify(settingsResponse),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )));
    const user = userEvent.setup();
    const view = render(<SettingsPage />);

    await screen.findByRole('heading', { name: 'DIY 主题' });
    const themeOptions = screen.getAllByRole('radio', { name: '人民英雄' });
    await user.click(themeOptions[0]);
    await user.click(themeOptions[1]);
    fireEvent.change(screen.getByRole('slider', { name: '右侧背景淡化强度 86%' }), {
      target: { value: '74' },
    });

    expect(JSON.parse(window.localStorage.getItem('gongkao-diy-theme') ?? '{}')).toEqual({
      sidebarImage: 'renmin-yingxiong',
      mainImage: 'renmin-yingxiong',
      sidebarCustomImage: '',
      mainCustomImage: '',
      mainFade: 74,
    });

    view.unmount();
    render(<SettingsPage />);
    const restoredOptions = await screen.findAllByRole('radio', { name: '人民英雄' });
    expect(restoredOptions[0]).toBeChecked();
    expect(restoredOptions[1]).toBeChecked();
    expect(screen.getByRole('slider', { name: '右侧背景淡化强度 74%' })).toHaveValue('74');
  });

  it('DIY 背景支持文件选择、外部拖入和剪贴板粘贴并立即持久化', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify(settingsResponse),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )));
    const user = userEvent.setup();
    render(<SettingsPage />);

    const sidebarPicker = screen.getByRole('group', { name: '导航栏背景' });
    const mainPicker = screen.getByRole('group', { name: '右侧整体背景' });
    const sidebarInput = screen.getByLabelText('选择导航栏背景自定义图片');
    const sidebarFile = new File(['sidebar'], '导航.png', { type: 'image/png' });

    await user.upload(sidebarInput, sidebarFile);

    await waitFor(() => {
      expect(within(sidebarPicker).getByRole('radio', { name: '自定义图片' })).toBeChecked();
    });
    expect(document.documentElement.style.getPropertyValue('--diy-sidebar-background-image'))
      .toContain('data:image/png;base64');

    const mainDropzone = within(mainPicker).getByRole('group', { name: '右侧整体背景自定义图片' });
    const mainFile = new File(['main'], '主背景.webp', { type: 'image/webp' });
    fireEvent.drop(mainDropzone, {
      dataTransfer: { files: [mainFile], types: ['Files'] },
    });

    await waitFor(() => {
      expect(within(mainPicker).getByRole('radio', { name: '自定义图片' })).toBeChecked();
    });
    expect(document.documentElement.style.getPropertyValue('--diy-main-background-image'))
      .toContain('data:image/webp;base64');

    const sidebarDropzone = within(sidebarPicker).getByRole('group', { name: '导航栏背景自定义图片' });
    const pastedFile = new File(['pasted'], '微信粘贴.jpg', { type: 'image/jpeg' });
    fireEvent.paste(sidebarDropzone, {
      clipboardData: {
        files: [pastedFile],
        items: [{ kind: 'file', type: pastedFile.type, getAsFile: () => pastedFile }],
      },
    });

    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem('gongkao-diy-theme') ?? '{}');
      expect(stored).toMatchObject({
        sidebarImage: 'custom',
        mainImage: 'custom',
      });
      expect(stored.sidebarCustomImage).toContain('data:image/jpeg;base64');
      expect(stored.mainCustomImage).toContain('data:image/webp;base64');
    });
    expect(screen.getByRole('status')).toHaveTextContent('已应用导航栏自定义图片');
  });

  it('读取并保存默认专注时长', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
      new Response(
        JSON.stringify(
          init?.method === 'PATCH'
            ? { ...settingsResponse, defaultFocusMinutes: 45 }
            : settingsResponse,
        ),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();

    render(<SettingsPage />);

    expect(await screen.findByRole('heading', { name: '体验设置' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '25 分钟' })).toBeChecked();
    expect(screen.getByRole('radio', { name: '标准动效' })).toBeChecked();
    await user.click(screen.getByRole('radio', { name: '45 分钟' }));
    await user.click(screen.getByRole('radio', { name: '减弱动效' }));
    expect(document.documentElement).toHaveAttribute('data-motion', 'reduced');
    await user.click(screen.getByRole('button', { name: '保存体验设置' }));

    expect(fetchMock).toHaveBeenLastCalledWith('/api/settings', expect.objectContaining({
      method: 'PATCH',
      body: JSON.stringify({ defaultFocusMinutes: 45, qqMusicPath: '' }),
    }));
    expect(JSON.parse(window.localStorage.getItem('gongkao-experience-v1') ?? '{}')).toEqual({
      version: 1,
      motionLevel: 'reduced',
    });
    expect(document.documentElement).toHaveAttribute('data-motion', 'reduced');
    expect(screen.getByRole('status')).toHaveTextContent('体验设置已保存');
  });

  it('重新进入设置页时恢复已保存的减弱动效并立即应用到全站', async () => {
    window.localStorage.setItem('gongkao-experience-v1', JSON.stringify({
      version: 1,
      motionLevel: 'reduced',
    }));
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify(settingsResponse),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )));

    render(<SettingsPage />);

    expect(await screen.findByRole('radio', { name: '减弱动效' })).toBeChecked();
    expect(document.documentElement).toHaveAttribute('data-motion', 'reduced');
  });

  it('保存受控 QQ 音乐路径并从固定入口启动，失败时显示稳定提示', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      if (path === '/api/local-apps/qq-music/open') {
        return new Response(JSON.stringify({
          code: 'qq_music_not_found',
          message: '请在设置中填写 QQMusic.exe 路径',
        }), { status: 404, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(
        JSON.stringify(
          init?.method === 'PATCH'
            ? { ...settingsResponse, qqMusicPath: 'C:\\Apps\\QQMusic.exe' }
            : settingsResponse,
        ),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<SettingsPage />);

    const pathInput = await screen.findByRole('textbox', { name: 'QQ 音乐路径' });
    expect(screen.getByText('未检测到 QQ 音乐')).toBeInTheDocument();
    await user.type(pathInput, 'C:\\Apps\\QQMusic.exe');
    await user.click(screen.getByRole('button', { name: '保存体验设置' }));

    expect(fetchMock).toHaveBeenCalledWith('/api/settings', expect.objectContaining({
      method: 'PATCH',
      body: JSON.stringify({
        defaultFocusMinutes: 25,
        qqMusicPath: 'C:\\Apps\\QQMusic.exe',
      }),
    }));

    await user.click(screen.getByRole('button', { name: '打开音乐' }));
    expect(fetchMock).toHaveBeenCalledWith('/api/local-apps/qq-music/open', expect.objectContaining({
      method: 'POST',
    }));
    expect(await screen.findByRole('alert')).toHaveTextContent('请在设置中填写 QQMusic.exe 路径');
  });
});
