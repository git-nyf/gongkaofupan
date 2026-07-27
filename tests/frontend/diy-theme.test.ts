// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyDiyTheme,
  defaultDiyTheme,
  diyThemeAcceptedImageTypes,
  diyThemeCustomImageId,
  diyThemeStorageKey,
  prepareDiyThemeImage,
  readDiyTheme,
  saveDiyTheme,
  type DiyTheme,
} from '../../src/theme/diyTheme';

const pngDataUrl = 'data:image/png;base64,AQID';
const jpegDataUrl = 'data:image/jpeg;base64,BAUG';

const customTheme: DiyTheme = {
  sidebarImage: diyThemeCustomImageId,
  mainImage: diyThemeCustomImageId,
  sidebarCustomImage: pngDataUrl,
  mainCustomImage: jpegDataUrl,
  mainFade: 82,
};

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.style.removeProperty('--diy-sidebar-background-image');
  document.documentElement.style.removeProperty('--diy-main-background-image');
  document.documentElement.style.removeProperty('--diy-main-overlay-alpha');
  vi.restoreAllMocks();
});

describe('DIY 主题图片持久化', () => {
  it('兼容不含自定义图片字段的旧主题数据', () => {
    window.localStorage.setItem(diyThemeStorageKey, JSON.stringify({
      sidebarImage: 'guohui',
      mainImage: 'kaiguo-dadian',
      mainFade: 92,
    }));

    expect(readDiyTheme()).toEqual({
      sidebarImage: 'guohui',
      mainImage: 'kaiguo-dadian',
      sidebarCustomImage: '',
      mainCustomImage: '',
      mainFade: 92,
    });
  });

  it('读取后能同步恢复侧栏和主区域的自定义图片', () => {
    window.localStorage.setItem(diyThemeStorageKey, JSON.stringify(customTheme));

    const restored = readDiyTheme();
    applyDiyTheme(restored);

    expect(restored).toEqual(customTheme);
    expect(document.documentElement.style.getPropertyValue('--diy-sidebar-background-image'))
      .toBe(`url("${pngDataUrl}")`);
    expect(document.documentElement.style.getPropertyValue('--diy-main-background-image'))
      .toBe(`url("${jpegDataUrl}")`);
  });

  it('清空伪造、非 base64 或不支持格式的自定义图片', () => {
    const invalidValues = [
      'javascript:alert(1)',
      'data:image/svg+xml;base64,PHN2Zz4=',
      'data:image/png,<svg onload=alert(1)>',
      'data:image/png;base64,***',
    ];

    for (const invalidValue of invalidValues) {
      window.localStorage.setItem(diyThemeStorageKey, JSON.stringify({
        ...customTheme,
        sidebarCustomImage: invalidValue,
      }));

      expect(readDiyTheme()).toEqual({
        ...customTheme,
        sidebarImage: '',
        sidebarCustomImage: '',
      });
    }
  });

  it('只接受 PNG、JPEG 和 WebP 小图并直接返回严格 base64 Data URL', async () => {
    expect(diyThemeAcceptedImageTypes).toEqual(['image/png', 'image/jpeg', 'image/webp']);

    for (const type of diyThemeAcceptedImageTypes) {
      const result = await prepareDiyThemeImage(new File([new Uint8Array([1, 2, 3])], 'theme', { type }));
      expect(result).toMatch(new RegExp(`^data:${type};base64,[A-Za-z0-9+/]+={0,2}$`));
    }
  });

  it('拒绝非图片格式和超过 10MB 的源文件', async () => {
    await expect(prepareDiyThemeImage(new File(['text'], 'theme.txt', { type: 'text/plain' })))
      .rejects.toThrow('仅支持 PNG、JPEG 或 WebP 图片');

    const oversized = new File(
      [new Uint8Array(10 * 1024 * 1024 + 1)],
      'large.png',
      { type: 'image/png' },
    );
    await expect(prepareDiyThemeImage(oversized)).rejects.toThrow('图片不能超过 10MB');
  });

  it('持久化字符串过大时缩放压缩并释放位图资源', async () => {
    const close = vi.fn();
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 2400, height: 1200, close })));
    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      clearRect: vi.fn(),
      drawImage,
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(pngDataUrl);

    const large = new File([new Uint8Array(700_000)], 'large.png', { type: 'image/png' });
    await expect(prepareDiyThemeImage(large)).resolves.toBe(pngDataUrl);

    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 1920, 960);
    expect(close).toHaveBeenCalledOnce();
  });

  it('存储配额失败时返回 false 且不应用未保存的主题', () => {
    document.documentElement.style.setProperty('--diy-sidebar-background-image', 'url("before")');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });

    expect(saveDiyTheme(customTheme)).toBe(false);
    expect(document.documentElement.style.getPropertyValue('--diy-sidebar-background-image'))
      .toBe('url("before")');
  });

  it('默认主题包含空的自定义图片字段', () => {
    expect(defaultDiyTheme.sidebarCustomImage).toBe('');
    expect(defaultDiyTheme.mainCustomImage).toBe('');
  });
});
