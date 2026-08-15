import { ImagePlus, Music2, RotateCcw, Save, Send, TimerReset } from 'lucide-react';
import {
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
} from 'react';
import type { AppSettings, FocusMinutes } from '../../shared/contracts';
import { ApiError, api } from '../api/client';
import '../styles/settings-glass.css';
import {
  applyMotionLevel,
  readMotionLevel,
  saveMotionLevel,
  type MotionLevel,
} from '../theme/experienceSettings';
import {
  defaultDiyTheme,
  diyThemeAcceptedImageTypes,
  diyThemeCustomImageId,
  diyThemeImages,
  prepareDiyThemeImage,
  readDiyTheme,
  resetDiyTheme,
  saveDiyTheme,
  type DiyTheme,
} from '../theme/diyTheme';

export function SettingsPage() {
  const [theme, setTheme] = useState<DiyTheme>(() => readDiyTheme());
  const [message, setMessage] = useState('');
  const [defaultFocusMinutes, setDefaultFocusMinutes] = useState<FocusMinutes>(25);
  const [experienceState, setExperienceState] = useState<'loading' | 'ready' | 'saving' | 'error'>('loading');
  const [experienceMessage, setExperienceMessage] = useState('');
  const [motionLevel, setMotionLevel] = useState<MotionLevel>(readMotionLevel);
  const [qqMusicPath, setQqMusicPath] = useState('');
  const [qqMusicAvailable, setQqMusicAvailable] = useState(false);
  const [musicState, setMusicState] = useState<'idle' | 'opening' | 'ready' | 'error'>('idle');
  const [musicMessage, setMusicMessage] = useState('');
  const [ankiState, setAnkiState] = useState<'idle' | 'running' | 'ready' | 'error'>('idle');
  const [ankiMessage, setAnkiMessage] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    api<AppSettings>('/api/settings', { signal: controller.signal })
      .then((settings) => {
        setDefaultFocusMinutes(settings.defaultFocusMinutes);
        setQqMusicPath(settings.qqMusicPath);
        setQqMusicAvailable(settings.qqMusicAvailable);
        setExperienceState('ready');
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setExperienceState('error');
        setExperienceMessage('体验设置加载失败，请刷新后重试');
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    applyMotionLevel(motionLevel);
  }, [motionLevel]);

  const updateTheme = (patch: Partial<DiyTheme>, successMessage = '') => {
    const next = { ...theme, ...patch };
    if (!saveDiyTheme(next)) {
      setMessage('本机主题存储空间不足，请更换较小的图片');
      return false;
    }
    setTheme(next);
    setMessage(successMessage);
    return true;
  };

  const saveTheme = () => {
    setMessage(
      saveDiyTheme(theme)
        ? 'DIY 主题已保存'
        : '本机主题存储空间不足，请更换较小的图片',
    );
  };

  const resetTheme = () => {
    resetDiyTheme();
    setTheme(defaultDiyTheme);
    setMessage('已恢复默认主题');
  };

  const saveExperienceSettings = async () => {
    if (experienceState === 'saving') return;
    setExperienceState('saving');
    setExperienceMessage('');
    try {
      const settings = await api<AppSettings>('/api/settings', {
        method: 'PATCH',
        body: JSON.stringify({ defaultFocusMinutes, qqMusicPath }),
      });
      setDefaultFocusMinutes(settings.defaultFocusMinutes);
      setQqMusicPath(settings.qqMusicPath);
      setQqMusicAvailable(settings.qqMusicAvailable);
      saveMotionLevel(motionLevel);
      setExperienceState('ready');
      setExperienceMessage('体验设置已保存');
    } catch {
      setExperienceState('error');
      setExperienceMessage('体验设置保存失败，请稍后重试');
    }
  };

  const openMusic = async () => {
    if (musicState === 'opening') return;
    setMusicState('opening');
    setMusicMessage('');
    try {
      await api<{ opened: true }>('/api/local-apps/qq-music/open', { method: 'POST' });
      setMusicState('ready');
      setMusicMessage('已发送 QQ 音乐启动请求');
    } catch (error) {
      setMusicState('error');
      setMusicMessage(
        error instanceof ApiError
          ? error.message
          : 'QQ 音乐启动失败，请检查配置后重试',
      );
    }
  };

  const generateDailyAnki = async () => {
    if (ankiState === 'running') return;
    setAnkiState('running');
    setAnkiMessage('');
    try {
      const result = await api<{
        status: 'generated' | 'empty';
        count: number;
        sent: boolean;
      }>('/api/anki/daily', {
        method: 'POST',
        body: JSON.stringify({ count: 10, send: true }),
      });
      setAnkiState('ready');
      setAnkiMessage(
        result.status === 'empty'
          ? '暂无可生成的用户初始稿'
          : result.sent
            ? `今日 ${result.count} 张 Anki 复习卡已发送`
            : `今日 ${result.count} 张 Anki 复习卡已生成，cc-connect 尚未完成发送`,
      );
    } catch {
      setAnkiState('error');
      setAnkiMessage('今日 Anki 复习卡生成失败，请稍后重试');
    }
  };

  return (
    <section className="page settings-page">
      <header className="page__header settings-page__header">
        <div>
          <h1 className="page__title">设置</h1>
          <p>主题与学习体验</p>
        </div>
        <div className="settings-page__actions">
          <button className="button button--secondary liquid-pressable" onClick={resetTheme} type="button">
            <RotateCcw aria-hidden="true" size={17} />
            恢复默认
          </button>
          <button className="button button--primary liquid-pressable" onClick={saveTheme} type="button">
            <Save aria-hidden="true" size={17} />
            保存主题
          </button>
        </div>
      </header>

      <section
        className="settings-section settings-section--theme liquid-glass liquid-glass--regular"
        aria-labelledby="theme-settings-title"
      >
        <h2 id="theme-settings-title">DIY 主题</h2>
        <div className="theme-settings">
        <ThemeImagePicker
          customImage={theme.sidebarCustomImage}
          label="导航栏背景"
          name="sidebar-image"
          onChange={(sidebarImage) => updateTheme({ sidebarImage })}
          onCustomImage={(sidebarCustomImage) => updateTheme(
            { sidebarImage: diyThemeCustomImageId, sidebarCustomImage },
            '已应用导航栏自定义图片',
          )}
          onStatus={setMessage}
          value={theme.sidebarImage}
        />
        <ThemeImagePicker
          customImage={theme.mainCustomImage}
          label="右侧整体背景"
          name="main-image"
          onChange={(mainImage) => updateTheme({ mainImage })}
          onCustomImage={(mainCustomImage) => updateTheme(
            { mainImage: diyThemeCustomImageId, mainCustomImage },
            '已应用右侧整体背景自定义图片',
          )}
          onStatus={setMessage}
          value={theme.mainImage}
        />

        <label className="theme-settings__fade">
          <span>右侧背景淡化强度</span>
          <input
            className="liquid-glass--thin liquid-glass__nested"
            max="96"
            min="68"
            onChange={(event) => updateTheme({ mainFade: Number(event.target.value) })}
            type="range"
            value={theme.mainFade}
          />
          <strong>{theme.mainFade}%</strong>
        </label>
        </div>
      </section>

      {message ? <div className="settings-page__message" role="status">{message}</div> : null}

      <section
        className="settings-section experience-settings liquid-glass liquid-glass--regular"
        aria-labelledby="experience-settings-title"
      >
        <div className="settings-section__heading">
          <div>
            <h2 id="experience-settings-title">体验设置</h2>
            <p>调整默认专注时间、全站动效和本机音乐入口。</p>
          </div>
          <TimerReset aria-hidden="true" size={22} />
        </div>
        <fieldset className="experience-settings__focus" disabled={experienceState === 'loading' || experienceState === 'saving'}>
          <legend>默认专注时长</legend>
          <div>
            {([5, 15, 25, 45] as FocusMinutes[]).map((minutes) => (
              <label key={minutes}>
                <input
                  checked={defaultFocusMinutes === minutes}
                  name="default-focus-minutes"
                  onChange={() => setDefaultFocusMinutes(minutes)}
                  type="radio"
                  value={minutes}
                />
                <span className="liquid-glass--thin liquid-glass__nested liquid-pressable">
                  {minutes} 分钟
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="experience-settings__motion" disabled={experienceState === 'saving'}>
          <legend>动效强度</legend>
          <div>
            {([
              { value: 'standard', label: '标准动效' },
              { value: 'reduced', label: '减弱动效' },
            ] as const).map((option) => (
              <label key={option.value}>
                <input
                  checked={motionLevel === option.value}
                  name="motion-level"
                  onChange={() => setMotionLevel(option.value)}
                  type="radio"
                  value={option.value}
                />
                <span className="liquid-glass--thin liquid-glass__nested liquid-pressable">
                  {option.label}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="experience-settings__music liquid-glass liquid-glass--regular">
          <div className="experience-settings__music-heading">
            <Music2 aria-hidden="true" size={19} />
            <div>
              <strong>音乐入口</strong>
              <span>{qqMusicAvailable ? '已检测到 QQ 音乐' : '未检测到 QQ 音乐'}</span>
            </div>
          </div>
          <label htmlFor="qq-music-path">
            <span>QQ 音乐路径</span>
            <input
              className="liquid-glass--thin liquid-glass__nested"
              disabled={experienceState === 'loading' || experienceState === 'saving'}
              id="qq-music-path"
              onChange={(event) => {
                setQqMusicPath(event.target.value);
                setMusicMessage('');
              }}
              placeholder="例如 C:\Program Files (x86)\Tencent\QQMusic\QQMusic.exe"
              spellCheck="false"
              type="text"
              value={qqMusicPath}
            />
          </label>
          <button
            className="button button--secondary liquid-pressable"
            disabled={musicState === 'opening'}
            onClick={() => void openMusic()}
            type="button"
          >
            <Music2 aria-hidden="true" size={17} />
            {musicState === 'opening' ? '正在打开' : '打开音乐'}
          </button>
          {musicMessage ? (
            <div className="experience-settings__music-message" role={musicState === 'error' ? 'alert' : 'status'}>
              {musicMessage}
            </div>
          ) : null}
        </div>
        <div className="experience-settings__actions">
          <button
            className="button button--primary liquid-pressable"
            disabled={experienceState === 'loading' || experienceState === 'saving'}
            onClick={() => void saveExperienceSettings()}
            type="button"
          >
            <Save aria-hidden="true" size={17} />
            {experienceState === 'saving' ? '正在保存' : '保存体验设置'}
          </button>
        </div>
        {experienceMessage ? (
          <div className="settings-page__message" role={experienceState === 'error' ? 'alert' : 'status'}>
            {experienceMessage}
          </div>
        ) : null}
      </section>

      <section
        className="settings-section liquid-glass liquid-glass--regular"
        aria-labelledby="anki-settings-title"
      >
        <div className="settings-section__heading">
          <div>
            <h2 id="anki-settings-title">每日 Anki 复习卡</h2>
            <p>随机抽取 10 张用户初始稿，生成 Markdown 与 Anki 卡组并通过 cc-connect 发送。</p>
          </div>
          <Send aria-hidden="true" size={22} />
        </div>
        <div className="experience-settings__actions">
          <button
            className="button button--primary liquid-pressable"
            disabled={ankiState === 'running'}
            onClick={() => void generateDailyAnki()}
            type="button"
          >
            <Send aria-hidden="true" size={17} />
            {ankiState === 'running' ? '正在生成' : '生成并发送今日 Anki'}
          </button>
        </div>
        {ankiMessage ? (
          <div className="settings-page__message" role={ankiState === 'error' ? 'alert' : 'status'}>
            {ankiMessage}
          </div>
        ) : null}
      </section>
    </section>
  );
}

function ThemeImagePicker({
  customImage,
  label,
  name,
  onChange,
  onCustomImage,
  onStatus,
  value,
}: {
  customImage: string;
  label: string;
  name: string;
  onChange: (value: string) => boolean;
  onCustomImage: (value: string) => boolean;
  onStatus: (message: string) => void;
  value: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);

  const acceptImage = async (file: File | undefined) => {
    if (!file || isPreparing) return;
    setIsPreparing(true);
    onStatus('');
    try {
      const image = await prepareDiyThemeImage(file);
      onCustomImage(image);
    } catch (error) {
      onStatus(error instanceof Error ? error.message : '自定义图片处理失败，请更换图片重试');
    } finally {
      setIsPreparing(false);
    }
  };

  const hasDraggedFiles = (event: DragEvent<HTMLElement>) => (
    Array.from(event.dataTransfer.types).includes('Files')
  );

  const handlePaste = (event: ClipboardEvent<HTMLElement>) => {
    const itemFile = Array.from(event.clipboardData.items)
      .find((item) => item.kind === 'file' && item.type.startsWith('image/'))
      ?.getAsFile();
    const file = itemFile
      ?? Array.from(event.clipboardData.files).find((candidate) => candidate.type.startsWith('image/'));
    if (!file) return;
    event.preventDefault();
    void acceptImage(file);
  };

  return (
    <fieldset className="theme-picker">
      <legend>{label}</legend>
      <label className="theme-picker__option theme-picker__option--plain liquid-glass liquid-glass--thin liquid-glass__nested liquid-pressable">
        <input
          checked={value === ''}
          name={name}
          onChange={() => onChange('')}
          type="radio"
          value=""
        />
        <span>默认</span>
      </label>
      {diyThemeImages.map((image) => (
        <label
          className="theme-picker__option liquid-glass liquid-glass--thin liquid-glass__nested liquid-pressable"
          key={image.id}
        >
          <input
            checked={value === image.id}
            name={name}
            onChange={() => onChange(image.id)}
            type="radio"
            value={image.id}
          />
          <span
            aria-hidden="true"
            className="theme-picker__preview"
            style={{ backgroundImage: `url("${image.url}")` }}
          />
          <span>{image.label}</span>
        </label>
      ))}
      {customImage ? (
        <label className="theme-picker__option liquid-glass liquid-glass--thin liquid-glass__nested liquid-pressable">
          <input
            checked={value === diyThemeCustomImageId}
            name={name}
            onChange={() => onChange(diyThemeCustomImageId)}
            type="radio"
            value={diyThemeCustomImageId}
          />
          <span
            aria-hidden="true"
            className="theme-picker__preview"
            style={{ backgroundImage: `url("${customImage}")` }}
          />
          <span>自定义图片</span>
        </label>
      ) : null}
      <div
        aria-busy={isPreparing}
        aria-label={`${label}自定义图片`}
        className="theme-picker__custom liquid-glass--thin liquid-glass__nested"
        data-dragging={isDragging ? 'true' : 'false'}
        onDragEnter={(event) => {
          if (!hasDraggedFiles(event)) return;
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDragOver={(event) => {
          if (!hasDraggedFiles(event)) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = 'copy';
          setIsDragging(true);
        }}
        onDrop={(event) => {
          if (!hasDraggedFiles(event)) return;
          event.preventDefault();
          setIsDragging(false);
          void acceptImage(Array.from(event.dataTransfer.files)[0]);
        }}
        onPaste={handlePaste}
        role="group"
        tabIndex={0}
      >
        <ImagePlus aria-hidden="true" size={22} />
        <strong>{isPreparing ? '正在处理图片' : '添加自定义图片'}</strong>
        <span>拖入、粘贴或选择图片</span>
        <button
          aria-label={`打开${label}图片选择器`}
          className="button button--secondary theme-picker__upload-button liquid-pressable"
          disabled={isPreparing}
          onClick={() => inputRef.current?.click()}
          type="button"
        >
          <ImagePlus aria-hidden="true" size={16} />
          选择图片
        </button>
        <input
          accept={diyThemeAcceptedImageTypes.join(',')}
          aria-label={`选择${label}自定义图片`}
          hidden
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = '';
            void acceptImage(file);
          }}
          ref={inputRef}
          type="file"
        />
      </div>
    </fieldset>
  );
}
