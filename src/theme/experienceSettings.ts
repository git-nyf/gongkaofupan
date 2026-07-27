export type MotionLevel = 'standard' | 'reduced';

export const experienceSettingsStorageKey = 'gongkao-experience-v1';

export function readMotionLevel(): MotionLevel {
  try {
    const parsed: unknown = JSON.parse(
      window.localStorage.getItem(experienceSettingsStorageKey) ?? 'null',
    );
    if (
      typeof parsed === 'object'
      && parsed !== null
      && Reflect.get(parsed, 'version') === 1
      && Reflect.get(parsed, 'motionLevel') === 'reduced'
    ) {
      return 'reduced';
    }
  } catch {
    // 损坏的本机偏好按标准动效处理。
  }
  return 'standard';
}

export function saveMotionLevel(motionLevel: MotionLevel) {
  window.localStorage.setItem(
    experienceSettingsStorageKey,
    JSON.stringify({ version: 1, motionLevel }),
  );
}

export function applyMotionLevel(motionLevel: MotionLevel) {
  document.documentElement.dataset.motion = motionLevel;
}

export function shouldReduceMotion() {
  if (
    typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) return true;
  const appliedMotion = document.documentElement.dataset.motion;
  if (appliedMotion === 'reduced') return true;
  if (appliedMotion === 'standard') return false;
  return readMotionLevel() === 'reduced';
}
