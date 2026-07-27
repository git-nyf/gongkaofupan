import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  ArrowRight,
  BookOpenCheck,
  CalendarClock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Target,
  TimerReset,
  Trash2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import type {
  AppSettings,
  CardSearchResult,
  DashboardSummary,
  FocusMinutes,
} from '../../shared/contracts';
import { api } from '../api/client';
import { StatusNotice } from '../components/StatusNotice';
import '../styles/dashboard-glass.css';

type LoadState = 'loading' | 'ready' | 'error';
type TimerState = 'idle' | 'running' | 'paused' | 'completed';
type CalendarFlip = 'next' | 'previous' | null;

const focusOptions: FocusMinutes[] = [5, 15, 25, 45];
const calendarWeekdays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'] as const;
export const dashboardMemoStorageKey = 'gongkao-dashboard-memos-v1';
export const dashboardCountdownStorageKey = 'gongkao-dashboard-countdown-v1';
export const dashboardFocusTimerStorageKey = 'gongkao-dashboard-focus-timer-v1';

type LocalDateString = `${number}-${number}-${number}`;

interface DashboardCountdown {
  version: 1;
  title: string;
  targetDate: LocalDateString;
}

interface DashboardMemo {
  id: string;
  text: string;
  completed: boolean;
}

interface DashboardFocusTimer {
  version: 1;
  selectedMinutes: FocusMinutes;
  remainingSeconds: number;
  state: TimerState;
  endsAt: number | null;
}

interface QuestionBarrageItem {
  id: string;
  question: string;
  lane: number;
  duration: number;
  delay: number;
}

export function DashboardPage() {
  const [initialFocusTimer] = useState(readDashboardFocusTimer);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [selectedMinutes, setSelectedMinutes] = useState<FocusMinutes>(
    initialFocusTimer?.selectedMinutes ?? 25,
  );
  const [remainingSeconds, setRemainingSeconds] = useState(
    initialFocusTimer?.remainingSeconds ?? 25 * 60,
  );
  const [timerState, setTimerState] = useState<TimerState>(initialFocusTimer?.state ?? 'idle');
  const [timerEndsAt, setTimerEndsAt] = useState<number | null>(initialFocusTimer?.endsAt ?? null);
  const [memoDraft, setMemoDraft] = useState('');
  const [memos, setMemos] = useState<DashboardMemo[]>(readDashboardMemos);
  const [countdown, setCountdown] = useState<DashboardCountdown | null>(readDashboardCountdown);
  const [countdownTitleDraft, setCountdownTitleDraft] = useState(countdown?.title ?? '');
  const [countdownDateDraft, setCountdownDateDraft] = useState(countdown?.targetDate ?? '');
  const [aiQuestions, setAiQuestions] = useState<string[]>([]);
  const [questionLoadState, setQuestionLoadState] = useState<'loading' | 'ready'>('loading');
  const [calendarDate, setCalendarDate] = useState(() => startOfMonth(new Date()));
  const [calendarFlip, setCalendarFlip] = useState<CalendarFlip>(null);
  const calendarMonth = useMemo(
    () => createCalendarMonth(calendarDate, new Date()),
    [calendarDate],
  );
  const reduceDashboardMotion = shouldReduceDashboardMotion();
  const questionBarrage = useMemo(() => createQuestionBarrage(aiQuestions), [aiQuestions]);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      api<DashboardSummary>('/api/dashboard', { signal: controller.signal }),
      api<AppSettings>('/api/settings', { signal: controller.signal }),
    ])
      .then(([dashboard, appSettings]) => {
        setSummary(dashboard);
        setSettings(appSettings);
        if (!initialFocusTimer) {
          setSelectedMinutes(appSettings.defaultFocusMinutes);
          setRemainingSeconds(appSettings.defaultFocusMinutes * 60);
        }
        setLoadState('ready');
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadState('error');
      });

    void api<CardSearchResult>(
      '/api/cards?contentVersion=optimized&archived=false&page=1&pageSize=100',
      { signal: controller.signal },
    )
      .then((cards) => {
        setAiQuestions(extractAiQuestions(cards));
        setQuestionLoadState('ready');
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setQuestionLoadState('ready');
      });

    return () => {
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (!calendarFlip) return undefined;
    const timeout = window.setTimeout(() => setCalendarFlip(null), 520);
    return () => window.clearTimeout(timeout);
  }, [calendarFlip, calendarDate]);

  useEffect(() => {
    if (timerState !== 'running' || timerEndsAt === null) return undefined;
    const syncRemainingTime = () => {
      const nextRemaining = remainingSecondsUntil(timerEndsAt);
      setRemainingSeconds(nextRemaining);
      if (nextRemaining === 0) {
        setTimerState('completed');
        setTimerEndsAt(null);
      }
    };
    syncRemainingTime();
    const interval = window.setInterval(syncRemainingTime, 1_000);
    return () => window.clearInterval(interval);
  }, [timerEndsAt, timerState]);

  useEffect(() => {
    const focusTimer: DashboardFocusTimer = {
      version: 1,
      selectedMinutes,
      remainingSeconds,
      state: timerState,
      endsAt: timerEndsAt,
    };
    window.localStorage.setItem(dashboardFocusTimerStorageKey, JSON.stringify(focusTimer));
  }, [remainingSeconds, selectedMinutes, timerEndsAt, timerState]);

  useEffect(() => {
    window.localStorage.setItem(
      dashboardMemoStorageKey,
      JSON.stringify({ version: 1, items: memos }),
    );
  }, [memos]);

  const totalSeconds = selectedMinutes * 60;
  const progress = Math.max(0, Math.min(100, ((totalSeconds - remainingSeconds) / totalSeconds) * 100));
  const studyPath = useMemo(() => {
    if (!settings) return '/study';
    const params = new URLSearchParams({
      count: String(settings.defaultSessionSize),
      order: settings.defaultOrder,
      dueFirst: String(settings.dueFirst),
    });
    return `/study?${params.toString()}`;
  }, [settings]);

  const selectMinutes = (minutes: FocusMinutes) => {
    setSelectedMinutes(minutes);
    setRemainingSeconds(minutes * 60);
    setTimerState('idle');
    setTimerEndsAt(null);
  };

  const resetTimer = () => {
    setRemainingSeconds(selectedMinutes * 60);
    setTimerState('idle');
    setTimerEndsAt(null);
  };

  const startTimer = () => {
    setTimerEndsAt(Date.now() + remainingSeconds * 1_000);
    setTimerState('running');
  };

  const pauseTimer = () => {
    const nextRemaining = timerEndsAt === null
      ? remainingSeconds
      : remainingSecondsUntil(timerEndsAt);
    setRemainingSeconds(nextRemaining);
    setTimerEndsAt(null);
    setTimerState(nextRemaining === 0 ? 'completed' : 'paused');
  };

  const addMemo = () => {
    const text = memoDraft.trim();
    if (!text) return;
    setMemos((current) => [
      ...current,
      { id: createMemoId(), text, completed: false },
    ]);
    setMemoDraft('');
  };

  const saveCountdown = () => {
    const title = countdownTitleDraft.trim();
    if (!title || !isLocalDateString(countdownDateDraft)) return;
    const nextCountdown: DashboardCountdown = {
      version: 1,
      title,
      targetDate: countdownDateDraft,
    };
    window.localStorage.setItem(dashboardCountdownStorageKey, JSON.stringify(nextCountdown));
    setCountdown(nextCountdown);
    setCountdownTitleDraft(title);
  };

  const clearCountdown = () => {
    window.localStorage.removeItem(dashboardCountdownStorageKey);
    setCountdown(null);
    setCountdownTitleDraft('');
    setCountdownDateDraft('');
  };

  const changeCalendarMonth = (direction: Exclude<CalendarFlip, null>) => {
    setCalendarFlip(shouldReduceDashboardMotion() ? null : direction);
    setCalendarDate((current) => new Date(
      current.getFullYear(),
      current.getMonth() + (direction === 'next' ? 1 : -1),
      1,
    ));
  };

  return (
    <section className="page dashboard-page dashboard-page--liquid">
      <header className="page__header dashboard-page__header">
        <div>
          <h1 className="page__title">总览</h1>
          <p>为人民服务</p>
        </div>
        <Link className="button button--primary dashboard-page__study-link liquid-pressable" to={studyPath}>
          <BookOpenCheck aria-hidden="true" size={18} />
          开始背诵
          <ArrowRight aria-hidden="true" size={16} />
        </Link>
      </header>

      {loadState === 'loading' ? <StatusNotice state="loading" message="正在准备今日学习状态" /> : null}
      {loadState === 'error' ? <StatusNotice state="error" message="学习概览加载失败，请刷新后重试" /> : null}

      {loadState === 'ready' && summary ? (
        <>
          <div className="dashboard-grid">
            <section
              className="focus-console liquid-glass liquid-glass--regular"
              aria-labelledby="focus-console-title"
            >
              <div className="focus-console__heading">
                <div>
                  <span>学习倒计时</span>
                  <h2 id="focus-console-title">给这一轮留一段完整时间</h2>
                </div>
                <TimerReset aria-hidden="true" size={24} />
              </div>

              <div className="focus-console__display" aria-live="off" role="timer">
                {formatTime(remainingSeconds)}
              </div>
              <div className="focus-console__progress" aria-hidden="true">
                <span style={{ width: `${progress}%` }} />
              </div>

              <div className="focus-console__presets" aria-label="常用专注时长">
                {focusOptions.map((minutes) => (
                  <button
                    aria-label={`${minutes} 分钟`}
                    aria-pressed={selectedMinutes === minutes}
                    className={`liquid-glass liquid-glass--thin liquid-pressable${
                      selectedMinutes === minutes ? ' is-selected' : ''
                    }`}
                    disabled={timerState === 'running'}
                    key={minutes}
                    onClick={() => selectMinutes(minutes)}
                    type="button"
                  >
                    {minutes}
                  </button>
                ))}
              </div>

              <div className="focus-console__actions">
                {timerState === 'running' ? (
                  <button className="button button--secondary liquid-glass liquid-glass--thin liquid-pressable" onClick={pauseTimer} type="button">
                    <Pause aria-hidden="true" size={17} />
                    暂停专注
                  </button>
                ) : (
                  <button
                    className="button button--primary liquid-glass liquid-glass--thin liquid-pressable"
                    onClick={startTimer}
                    type="button"
                  >
                    <Play aria-hidden="true" size={17} />
                    {timerState === 'paused' ? '继续专注' : '开始专注'}
                  </button>
                )}
                <button className="button button--secondary liquid-glass liquid-glass--thin liquid-pressable" onClick={resetTimer} type="button">
                  <RotateCcw aria-hidden="true" size={17} />
                  重置专注
                </button>
              </div>

              {timerState === 'completed' ? (
                <div className="focus-console__complete" role="status">
                  <CircleCheck aria-hidden="true" size={19} />
                  <span><strong>本轮专注完成</strong>，现在很适合开始背诵。</span>
                </div>
              ) : null}
            </section>

            <section
              className="dashboard-status dashboard-status--briefing liquid-glass liquid-glass--regular"
              aria-labelledby="dashboard-status-title"
            >
              <div className="dashboard-status__heading">
                <div>
                  <span>随机抽查</span>
                  <h2 id="dashboard-status-title">AI 衍生问题</h2>
                </div>
                <Sparkles aria-hidden="true" size={22} />
              </div>

              <div
                aria-label="AI 衍生问题随机弹幕"
                className={`dashboard-question-barrage${reduceDashboardMotion ? ' is-motion-reduced' : ''}`}
                tabIndex={reduceDashboardMotion ? 0 : undefined}
              >
                {questionLoadState === 'loading' ? (
                  <p className="dashboard-question-barrage__empty">正在整理 AI 衍生问题...</p>
                ) : questionBarrage.length === 0 ? (
                  <p className="dashboard-question-barrage__empty" role="status">
                    暂无 AI 衍生问题，先去录入并完成 AI 优化吧。
                  </p>
                ) : (
                  <div className="dashboard-question-barrage__track" role="list">
                    {questionBarrage.map((item) => <QuestionBarrageItem item={item} key={item.id} />)}
                  </div>
                )}
              </div>

              <div className="dashboard-status__stats" aria-label="今日学习统计">
                <DashboardCompactStat count={summary.dueToday} label="今日待复习" />
                <DashboardCompactStat count={summary.addedToday} label="已新增" />
                <DashboardCompactStat count={summary.conquestPending} label="待攻克" />
              </div>
            </section>
            <section
              className="dashboard-calendar dashboard-calendar--flip liquid-glass liquid-glass--regular"
              aria-labelledby="dashboard-calendar-title"
            >
              <div className="dashboard-calendar__toolbar">
                <button
                  aria-label="上一个月"
                  className="dashboard-calendar__nav liquid-glass liquid-glass--thin liquid-pressable"
                  onClick={() => changeCalendarMonth('previous')}
                  title="上一个月"
                  type="button"
                >
                  <ChevronLeft aria-hidden="true" size={18} />
                </button>
                <div className="dashboard-calendar__heading">
                  <div>
                    <span>翻页月历</span>
                    <h2 id="dashboard-calendar-title">
                      <time dateTime={calendarMonth.monthDateTime}>{calendarMonth.label}</time>
                    </h2>
                  </div>
                  <CalendarDays aria-hidden="true" size={22} />
                </div>
                <button
                  aria-label="下一个月"
                  className="dashboard-calendar__nav liquid-glass liquid-glass--thin liquid-pressable"
                  onClick={() => changeCalendarMonth('next')}
                  title="下一个月"
                  type="button"
                >
                  <ChevronRight aria-hidden="true" size={18} />
                </button>
              </div>

              <div className={`dashboard-calendar__flip-stage liquid-glass__nested${
                calendarFlip ? ` is-flipping-${calendarFlip}` : ''
              }`}>
                <table
                  aria-label={`${calendarMonth.label}月历`}
                  className="dashboard-calendar__table"
                  key={calendarMonth.monthDateTime}
                >
                  <thead>
                    <tr>
                      {calendarWeekdays.map((weekday) => <th key={weekday} scope="col">{weekday}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {calendarMonth.weeks.map((week) => (
                      <tr key={week[0].dateTime}>
                        {week.map((day) => (
                          <td
                            className={day.isCurrentMonth ? undefined : 'is-outside-month'}
                            key={day.dateTime}
                          >
                            <time
                              aria-current={day.isToday ? 'date' : undefined}
                              aria-label={day.isToday ? `${day.label}，今天` : day.label}
                              className="liquid-glass liquid-glass--thin"
                              dateTime={day.dateTime}
                            >
                              {day.day}
                            </time>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section
              className="dashboard-date-countdown liquid-glass liquid-glass--regular"
              aria-labelledby="dashboard-date-countdown-title"
            >
              <div className="dashboard-date-countdown__heading">
                <div>
                  <span>重要日期</span>
                  <h2 id="dashboard-date-countdown-title">目标日倒计时</h2>
                </div>
                <CalendarClock aria-hidden="true" size={22} />
              </div>

              <div className="dashboard-date-countdown__display" aria-live="polite">
                {countdown ? (
                  <>
                    <span>距离 {countdown.title}</span>
                    <strong className="dashboard-date-countdown__days">
                      {formatCountdownDays(countdown.targetDate, new Date())}
                    </strong>
                  </>
                ) : (
                  <p className="dashboard-date-countdown__empty">尚未设置目标日</p>
                )}
              </div>

              <form
                className="dashboard-date-countdown__form"
                onSubmit={(event) => {
                  event.preventDefault();
                  saveCountdown();
                }}
              >
                <label className="dashboard-date-countdown__field">
                  <span>倒计时名称</span>
                  <input
                    aria-label="倒计时名称"
                    className="liquid-glass liquid-glass--thin"
                    maxLength={30}
                    onChange={(event) => setCountdownTitleDraft(event.target.value)}
                    placeholder="例如：国考笔试"
                    required
                    value={countdownTitleDraft}
                  />
                </label>
                <label className="dashboard-date-countdown__field">
                  <span>目标日期</span>
                  <input
                    aria-label="目标日期"
                    className="liquid-glass liquid-glass--thin"
                    onChange={(event) => setCountdownDateDraft(event.target.value)}
                    required
                    type="date"
                    value={countdownDateDraft}
                  />
                </label>
                <div className="dashboard-date-countdown__actions">
                  <button className="button button--primary liquid-glass liquid-glass--thin liquid-pressable" type="submit">
                    <Save aria-hidden="true" size={17} />
                    保存倒计时
                  </button>
                  {countdown ? (
                    <button className="button button--secondary liquid-glass liquid-glass--thin liquid-pressable" onClick={clearCountdown} type="button">
                      <Trash2 aria-hidden="true" size={17} />
                      清除倒计时
                    </button>
                  ) : null}
                </div>
              </form>
            </section>
          </div>

          {summary.weakness.length > 0 ? (
            <section
              className="dashboard-weakness liquid-glass liquid-glass--thin"
              aria-labelledby="dashboard-weakness-title"
            >
              <div>
                <Target aria-hidden="true" size={20} />
                <h2 id="dashboard-weakness-title">优先关注</h2>
              </div>
              <p>{summary.weakness[0].categoryName}还有提升空间，下一轮可以从这里开始。</p>
            </section>
          ) : null}

          <section
            className="dashboard-memo liquid-glass liquid-glass--regular"
            aria-labelledby="dashboard-memo-title"
          >
            <div className="dashboard-memo__heading">
              <div>
                <span>轻量备忘</span>
                <h2 id="dashboard-memo-title">这一轮别忘了</h2>
              </div>
              <small>{memos.filter(({ completed }) => !completed).length} 项待办</small>
            </div>
            <form
              className="dashboard-memo__form"
              onSubmit={(event) => {
                event.preventDefault();
                addMemo();
              }}
            >
              <label className="dashboard-memo__input">
                <span className="sr-only">新备忘</span>
                <input
                  aria-label="新备忘"
                  className="liquid-glass liquid-glass--thin"
                  maxLength={80}
                  onChange={(event) => setMemoDraft(event.target.value)}
                  placeholder="记下这一轮要处理的小事"
                  value={memoDraft}
                />
              </label>
              <button className="button button--primary liquid-glass liquid-glass--thin liquid-pressable" type="submit">
                <Plus aria-hidden="true" size={17} />
                添加备忘
              </button>
            </form>
            {memos.length === 0 ? (
              <p className="dashboard-memo__empty">暂无备忘</p>
            ) : (
              <ul className="dashboard-memo__list">
                {memos.map((memo) => (
                  <li
                    className={`liquid-glass__nested${memo.completed ? ' is-completed' : ''}`}
                    key={memo.id}
                  >
                    <label className="liquid-pressable">
                      <input
                        aria-label={`完成${memo.text}`}
                        checked={memo.completed}
                        onChange={(event) => setMemos((current) => current.map((item) => (
                          item.id === memo.id ? { ...item, completed: event.target.checked } : item
                        )))}
                        type="checkbox"
                      />
                      <span>{memo.text}</span>
                    </label>
                    <button
                      aria-label={`删除${memo.text}`}
                      className="liquid-glass liquid-glass--thin liquid-pressable"
                      onClick={() => setMemos((current) => current.filter(({ id }) => id !== memo.id))}
                      title="删除备忘"
                      type="button"
                    >
                      <Trash2 aria-hidden="true" size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </section>
  );
}

function QuestionBarrageItem({ item }: { item: QuestionBarrageItem }) {
  const style = {
    '--question-top': `${8 + item.lane * 54}px`,
    '--question-duration': `${item.duration}s`,
    '--question-delay': `${item.delay}s`,
  } as CSSProperties;
  return (
    <article
      className="dashboard-question-barrage__item liquid-glass liquid-glass--thin"
      role="listitem"
      style={style}
    >
      <small>AI 题面</small>
      <span>{item.question}</span>
    </article>
  );
}

function DashboardCompactStat({ count, label }: { count: number; label: string }) {
  return <span className="liquid-glass__nested"><strong>{count}</strong><small>{label}</small></span>;
}

function extractAiQuestions(cards: CardSearchResult) {
  const questions = new Set<string>();
  cards.items.forEach((card) => {
    card.quizItems.forEach(({ question }) => {
      const normalized = question.trim();
      if (normalized) questions.add(normalized);
    });
  });
  return [...questions];
}

function createQuestionBarrage(questions: string[]): QuestionBarrageItem[] {
  return questions
    .map((question) => ({ question, order: Math.random() }))
    .sort((left, right) => left.order - right.order)
    .slice(0, 4)
    .map(({ question }, lane) => {
      const duration = 22 + Math.random() * 10;
      return {
        id: `${lane}-${question}`,
        question,
        lane,
        duration,
        delay: -(Math.random() * duration),
      };
    });
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function createCalendarMonth(displayMonth: Date, today: Date) {
  const year = displayMonth.getFullYear();
  const month = displayMonth.getMonth();
  const mondayOffset = (new Date(year, month, 1).getDay() + 6) % 7;
  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(year, month, index - mondayOffset + 1);
    const dateYear = date.getFullYear();
    const dateMonth = date.getMonth();
    const dateDay = date.getDate();
    return {
      dateTime: `${dateYear}-${padDatePart(dateMonth + 1)}-${padDatePart(dateDay)}`,
      day: dateDay,
      isCurrentMonth: dateMonth === month,
      isToday:
        dateYear === today.getFullYear()
        && dateMonth === today.getMonth()
        && dateDay === today.getDate(),
      label: `${dateYear}年${dateMonth + 1}月${dateDay}日`,
    };
  });

  return {
    label: `${year}年${month + 1}月`,
    monthDateTime: `${year}-${padDatePart(month + 1)}`,
    weeks: Array.from({ length: 6 }, (_, index) => days.slice(index * 7, index * 7 + 7)),
  };
}

function padDatePart(value: number) {
  return String(value).padStart(2, '0');
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

function remainingSecondsUntil(endsAt: number) {
  return Math.max(0, Math.ceil((endsAt - Date.now()) / 1_000));
}

function readDashboardFocusTimer(): DashboardFocusTimer | null {
  try {
    const parsed: unknown = JSON.parse(
      window.localStorage.getItem(dashboardFocusTimerStorageKey) ?? 'null',
    );
    if (
      !isRecord(parsed)
      || parsed.version !== 1
      || !isFocusMinutes(parsed.selectedMinutes)
      || !isTimerState(parsed.state)
      || typeof parsed.remainingSeconds !== 'number'
      || !Number.isInteger(parsed.remainingSeconds)
      || parsed.remainingSeconds < 0
      || parsed.remainingSeconds > parsed.selectedMinutes * 60
      || (parsed.endsAt !== null && (typeof parsed.endsAt !== 'number' || !Number.isFinite(parsed.endsAt)))
    ) return null;

    if (parsed.state === 'running') {
      if (typeof parsed.endsAt !== 'number') return null;
      const remainingSeconds = remainingSecondsUntil(parsed.endsAt);
      return {
        version: 1,
        selectedMinutes: parsed.selectedMinutes,
        remainingSeconds,
        state: remainingSeconds === 0 ? 'completed' : 'running',
        endsAt: remainingSeconds === 0 ? null : parsed.endsAt,
      };
    }

    return {
      version: 1,
      selectedMinutes: parsed.selectedMinutes,
      remainingSeconds: parsed.remainingSeconds,
      state: parsed.state,
      endsAt: null,
    };
  } catch {
    return null;
  }
}

function isFocusMinutes(value: unknown): value is FocusMinutes {
  return typeof value === 'number' && focusOptions.some((minutes) => minutes === value);
}

function isTimerState(value: unknown): value is TimerState {
  return value === 'idle' || value === 'running' || value === 'paused' || value === 'completed';
}

function formatCountdownDays(targetDate: LocalDateString, today: Date) {
  const [year, month, day] = targetDate.split('-').map(Number);
  const targetDay = Date.UTC(year, month - 1, day);
  const currentDay = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const days = Math.round((targetDay - currentDay) / 86_400_000);
  if (days > 0) return `还有 ${days} 天`;
  if (days < 0) return `已过去 ${Math.abs(days)} 天`;
  return '就是今天';
}

function readDashboardCountdown(): DashboardCountdown | null {
  try {
    const parsed: unknown = JSON.parse(
      window.localStorage.getItem(dashboardCountdownStorageKey) ?? 'null',
    );
    if (
      !isRecord(parsed)
      || parsed.version !== 1
      || typeof parsed.title !== 'string'
      || parsed.title.trim().length === 0
      || parsed.title.length > 30
      || !isLocalDateString(parsed.targetDate)
    ) return null;
    return {
      version: 1,
      title: parsed.title,
      targetDate: parsed.targetDate,
    };
  } catch {
    return null;
  }
}

function isLocalDateString(value: unknown): value is LocalDateString {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function readDashboardMemos(): DashboardMemo[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(dashboardMemoStorageKey) ?? 'null');
    if (!isRecord(parsed) || parsed.version !== 1 || !Array.isArray(parsed.items)) return [];
    return parsed.items.filter(isDashboardMemo);
  } catch {
    return [];
  }
}

function isDashboardMemo(value: unknown): value is DashboardMemo {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.text === 'string'
    && typeof value.completed === 'boolean';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function createMemoId() {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function shouldReduceDashboardMotion() {
  return document.documentElement.dataset.motion === 'reduced'
    || (typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}
