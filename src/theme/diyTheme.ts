export interface DiyTheme {
  sidebarImage: string;
  mainImage: string;
  sidebarCustomImage: string;
  mainCustomImage: string;
  mainFade: number;
}

export interface DiyThemeImage {
  id: string;
  label: string;
  url: string;
}

export const diyThemeStorageKey = 'gongkao-diy-theme';
export const diyThemeCustomImageId = 'custom';
export const diyThemeAcceptedImageTypes = ['image/png', 'image/jpeg', 'image/webp'] as const;

const maxSourceImageBytes = 10 * 1024 * 1024;
const maxStoredImageCharacters = 900_000;
const invalidImageTypeMessage = '仅支持 PNG、JPEG 或 WebP 图片';
const oversizedImageMessage = '图片不能超过 10MB';
const unsafeImageMessage = '图片过大，无法安全保存，请选择更小的图片';
const dataImagePattern = /^data:image\/(?:png|jpeg|webp);base64,(?=[A-Za-z0-9+/])(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

export const diyThemeImages: DiyThemeImage[] = [
  { id: 'renmin-yingxiong', label: '人民英雄', url: '/diy/人民英雄.jpg' },
  { id: 'guohui', label: '国徽', url: '/diy/国徽.jpg' },
  { id: 'kaiguo-dadian', label: '开国大典', url: '/diy/开国大典.jpg' },
];

export const defaultDiyTheme: DiyTheme = {
  sidebarImage: '',
  mainImage: '',
  sidebarCustomImage: '',
  mainCustomImage: '',
  mainFade: 86,
};

export function readDiyTheme(): DiyTheme {
  try {
    const rawValue = window.localStorage.getItem(diyThemeStorageKey);
    if (!rawValue) return defaultDiyTheme;
    return normalizeTheme(JSON.parse(rawValue));
  } catch {
    return defaultDiyTheme;
  }
}

export function saveDiyTheme(theme: DiyTheme): boolean {
  const normalized = normalizeTheme(theme);
  try {
    window.localStorage.setItem(diyThemeStorageKey, JSON.stringify(normalized));
    applyDiyTheme(normalized);
    return true;
  } catch {
    return false;
  }
}

export function resetDiyTheme() {
  window.localStorage.removeItem(diyThemeStorageKey);
  applyDiyTheme(defaultDiyTheme);
}

export function applyDiyTheme(theme: DiyTheme) {
  const normalized = normalizeTheme(theme);
  const root = document.documentElement;
  root.style.setProperty(
    '--diy-sidebar-background-image',
    toCssImage(normalized.sidebarImage, normalized.sidebarCustomImage),
  );
  root.style.setProperty(
    '--diy-main-background-image',
    toCssImage(normalized.mainImage, normalized.mainCustomImage),
  );
  root.style.setProperty('--diy-main-overlay-alpha', String(normalized.mainFade / 100));
}

export async function prepareDiyThemeImage(file: File): Promise<string> {
  if (!diyThemeAcceptedImageTypes.includes(file.type as typeof diyThemeAcceptedImageTypes[number])) {
    throw new Error(invalidImageTypeMessage);
  }
  if (file.size > maxSourceImageBytes) {
    throw new Error(oversizedImageMessage);
  }

  const dataUrl = await readFileAsDataUrl(file);
  if (isSafeStoredImage(dataUrl)) return dataUrl;

  return compressDiyThemeImage(file);
}

function normalizeTheme(value: unknown): DiyTheme {
  if (typeof value !== 'object' || value === null) return defaultDiyTheme;
  const record = value as Record<string, unknown>;
  const sidebarCustomImage = normalizeCustomImage(record.sidebarCustomImage);
  const mainCustomImage = normalizeCustomImage(record.mainCustomImage);
  const sidebarImage = normalizeImageId(record.sidebarImage, sidebarCustomImage);
  const mainImage = normalizeImageId(record.mainImage, mainCustomImage);
  const mainFade = normalizeFade(Number(record.mainFade));
  return { sidebarImage, mainImage, sidebarCustomImage, mainCustomImage, mainFade };
}

function normalizeImageId(value: unknown, customImage: string) {
  if (typeof value !== 'string') return '';
  if (value === diyThemeCustomImageId) return customImage ? value : '';
  return diyThemeImages.some((image) => image.id === value) ? value : '';
}

function normalizeCustomImage(value: unknown) {
  return typeof value === 'string' && isSafeStoredImage(value) ? value : '';
}

function normalizeFade(value: number) {
  return Number.isFinite(value) ? Math.min(96, Math.max(68, Math.round(value))) : defaultDiyTheme.mainFade;
}

function toCssImage(imageId: string, customImage: string) {
  if (imageId === diyThemeCustomImageId && customImage) return `url("${customImage}")`;
  const image = diyThemeImages.find((item) => item.id === imageId);
  return image ? `url("${encodeURI(image.url)}")` : 'none';
}

function isSafeStoredImage(value: string) {
  return value.length <= maxStoredImageCharacters && dataImagePattern.test(value);
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      if (typeof reader.result === 'string' && dataImagePattern.test(reader.result)) {
        resolve(reader.result);
        return;
      }
      reject(new Error(invalidImageTypeMessage));
    });
    reader.addEventListener('error', () => reject(new Error('图片读取失败，请重新尝试')));
    reader.readAsDataURL(file);
  });
}

async function compressDiyThemeImage(file: File): Promise<string> {
  if (typeof createImageBitmap !== 'function') throw new Error(unsafeImageMessage);

  let image: ImageBitmap | null = null;
  try {
    image = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error(unsafeImageMessage);

    const longestSide = Math.max(image.width, image.height);
    let scale = Math.min(1, 1920 / longestSide);
    for (const quality of [0.82, 0.68, 0.54, 0.42]) {
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const compressed = canvas.toDataURL('image/webp', quality);
      if (isSafeStoredImage(compressed)) return compressed;
      scale *= 0.74;
    }
  } catch (error) {
    if (error instanceof Error && error.message === unsafeImageMessage) throw error;
  } finally {
    image?.close();
  }

  throw new Error(unsafeImageMessage);
}
