import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, BadgeCheck, Check, CircleCheck, Eye, Gamepad2, Hand, LoaderCircle, Play, RotateCcw, Shuffle } from 'lucide-react';
import { animate } from 'motion';
import { useSearchParams } from 'react-router-dom';
import type {
  CardDetail,
  ReviewResult,
  StudyItem,
  StudySessionInput,
  StudySessionResult,
} from '../../shared/contracts';
import { categoryCatalog } from '../../server/catalog/categories';
import { api } from '../api/client';
import { MathText } from '../components/MathText';
import { RichTextPreview } from '../components/RichTextPreview';
import { StatusNotice } from '../components/StatusNotice';
import { criticalSpring, momentumSpring, rubberBand } from '../motion/liquidMotion';
import { shouldReduceMotion } from '../theme/experienceSettings';
import '../styles/study-glass.css';

type LoadState = 'loading' | 'ready' | 'empty' | 'error';
type SubmitState = 'idle' | 'submitting' | 'error';
type ReviewChoice = 'unknown' | 'known';
type RollState = 'idle' | 'rolling' | 'settled';
type StudyStage = 'cover' | 'session' | 'summary';
type JoystickGestureState = 'idle' | 'pressed' | 'dragging' | 'returning';
type RandomOriginalState = 'idle' | 'drawing' | 'ready' | 'empty' | 'error';
type ScopePreview = {
  key: string;
  status: 'loading' | 'ready' | 'error';
  total: number | null;
};

interface SessionDraft {
  count: number;
  categoryIds: string[];
  createdFrom: string;
  createdTo: string;
}

type OriginalScopeDraft = Omit<SessionDraft, 'count'>;

const ROLL_TICKS = 5;
const ROLL_INTERVAL_MS = 58;
const JOYSTICK_MAX_PULL = 42;
const JOYSTICK_TRIGGER_PULL = 26;
const JOYSTICK_HYSTERESIS = 10;
const JOYSTICK_VELOCITY_WINDOW_MS = 120;
const CATEGORY_ENTRIES = Object.entries(categoryCatalog) as Array<[string, readonly string[]]>;

interface PointerSample {
  time: number;
  y: number;
}

interface ItemProgress {
  wrongCount: number;
  result?: ReviewChoice;
  message?: string;
}

export function StudyPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const searchKey = searchParams.toString();
  const sessionInput = useMemo(() => readSessionInput(searchParams), [searchKey]);
  const [sessionDraft, setSessionDraft] = useState<SessionDraft>(() => toSessionDraft(sessionInput));
  const [items, setItems] = useState<StudyItem[]>([]);
  const [totalAvailable, setTotalAvailable] = useState(0);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [loadKey, setLoadKey] = useState(0);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [progress, setProgress] = useState<Record<string, ItemProgress>>({});
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [stage, setStage] = useState<StudyStage>('cover');
  const [shouldRefreshSession, setShouldRefreshSession] = useState(false);
  const [scopePreview, setScopePreview] = useState<ScopePreview | null>(null);
  const [knownStreak, setKnownStreak] = useState(0);
  const [bestKnownStreak, setBestKnownStreak] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const reviewControllerRef = useRef<AbortController | null>(null);
  const scopePreviewRequestRef = useRef(0);

  useEffect(() => () => reviewControllerRef.current?.abort(), []);

  useEffect(() => {
    setSessionDraft(toSessionDraft(sessionInput));
  }, [searchKey, sessionInput]);

  const draftCategoryIds = useMemo(
    () => normalizeCategoryIds(sessionDraft.categoryIds),
    [sessionDraft.categoryIds],
  );
  const appliedCategoryIds = useMemo(
    () => normalizeCategoryIds(sessionInput.categoryIds ?? []),
    [sessionInput],
  );
  const draftScopeKey = JSON.stringify([
    draftCategoryIds,
    sessionDraft.createdFrom,
    sessionDraft.createdTo,
  ]);
  const appliedScopeKey = JSON.stringify([
    appliedCategoryIds,
    dateInputValue(sessionInput.createdFrom),
    dateInputValue(sessionInput.createdTo),
  ]);
  const draftScopeChanged = draftScopeKey !== appliedScopeKey;
  const invalidDraftDateRange = Boolean(
    sessionDraft.createdFrom
    && sessionDraft.createdTo
    && sessionDraft.createdFrom > sessionDraft.createdTo,
  );

  useEffect(() => {
    const requestId = scopePreviewRequestRef.current + 1;
    scopePreviewRequestRef.current = requestId;
    if (stage !== 'cover' || !draftScopeChanged || invalidDraftDateRange) {
      setScopePreview(null);
      return undefined;
    }

    const controller = new AbortController();
    setScopePreview((current) => ({
      key: draftScopeKey,
      status: 'loading',
      total: current?.total ?? null,
    }));
    const previewInput: StudySessionInput = {
      categoryIds: draftCategoryIds,
      cardIds: [...(sessionInput.cardIds ?? [])],
      tagIds: [...(sessionInput.tagIds ?? [])],
      ...(sessionDraft.createdFrom ? { createdFrom: sessionDraft.createdFrom } : {}),
      ...(sessionDraft.createdTo ? { createdTo: sessionDraft.createdTo } : {}),
      count: 1,
      order: 'fixed',
      dueFirst: false,
    };

    api<StudySessionResult>('/api/study/sessions', {
      method: 'POST',
      body: JSON.stringify(previewInput),
      signal: controller.signal,
    })
      .then((result) => {
        if (scopePreviewRequestRef.current !== requestId) return;
        setScopePreview({
          key: draftScopeKey,
          status: 'ready',
          total: result.totalAvailable ?? result.items.length,
        });
      })
      .catch((error: unknown) => {
        if (
          (error instanceof DOMException && error.name === 'AbortError')
          || scopePreviewRequestRef.current !== requestId
        ) return;
        setScopePreview({ key: draftScopeKey, status: 'error', total: null });
      });

    return () => controller.abort();
  }, [
    appliedScopeKey,
    draftCategoryIds,
    draftScopeChanged,
    draftScopeKey,
    invalidDraftDateRange,
    sessionDraft.createdFrom,
    sessionDraft.createdTo,
    sessionInput,
    stage,
  ]);

  useEffect(() => {
    const controller = new AbortController();
    setLoadState('loading');
    setSubmitState('idle');
    setKnownStreak(0);
    setBestKnownStreak(0);
    api<StudySessionResult>('/api/study/sessions', {
      method: 'POST',
      body: JSON.stringify(sessionInput),
      signal: controller.signal,
      })
      .then((result) => {
        setItems(result.items);
        setTotalAvailable(result.totalAvailable ?? result.items.length);
        setIndex(0);
        setRevealed(false);
        setProgress(Object.fromEntries(
          result.items.map((item) => [item.quizItemId, { wrongCount: item.wrongCount }]),
        ));
        setLoadState(result.items.length === 0 ? 'empty' : 'ready');
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadState('error');
      });
    return () => controller.abort();
  }, [loadKey, sessionInput]);

  useEffect(() => {
    if (loadState === 'ready' && stage === 'session') headingRef.current?.focus();
  }, [index, loadState, stage]);

  const current = items[index];
  const currentProgress = current ? progress[current.quizItemId] : undefined;
  const completedCount = Object.values(progress).filter(({ result }) => result !== undefined).length;
  const unknownCount = Object.values(progress).filter(({ result }) => result === 'unknown').length;
  const knownCount = Object.values(progress).filter(({ result }) => result === 'known').length;
  const scopePreviewActive = stage === 'cover' && draftScopeChanged && !invalidDraftDateRange;
  const displayedTotalAvailable = scopePreviewActive && scopePreview?.total !== null
    ? scopePreview?.total ?? totalAvailable
    : totalAvailable;
  const scopePreviewStatus = scopePreviewActive
    ? scopePreview?.key !== draftScopeKey || scopePreview.status === 'loading'
      ? '正在更新匹配题面'
      : scopePreview.status === 'error'
        ? '范围预览失败，已显示当前范围'
        : ''
    : '';
  const startSessionWithDraft = () => {
    const activeDraft = sessionDraft;
    const categoryIds = normalizeCategoryIds(activeDraft.categoryIds);
    const currentCategoryIds = normalizeCategoryIds(sessionInput.categoryIds ?? []);
    const invalidDateRange = Boolean(
      activeDraft.createdFrom
      && activeDraft.createdTo
      && activeDraft.createdFrom > activeDraft.createdTo,
    );
    const activeDraftChanged = activeDraft.count !== sessionInput.count
      || !sameStringArray(categoryIds, currentCategoryIds)
      || activeDraft.createdFrom !== dateInputValue(sessionInput.createdFrom)
      || activeDraft.createdTo !== dateInputValue(sessionInput.createdTo);
    if (activeDraft.count < 1 || activeDraft.count > 100 || invalidDateRange) return;

    setStage('session');

    if (!activeDraftChanged) {
      if (shouldRefreshSession) {
        setShouldRefreshSession(false);
        setLoadKey((value) => value + 1);
      }
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('count', String(activeDraft.count));
    nextParams.delete('categoryIds');
    categoryIds.forEach((categoryId) => nextParams.append('categoryIds', categoryId));
    setOptionalSearchParam(nextParams, 'createdFrom', activeDraft.createdFrom);
    setOptionalSearchParam(nextParams, 'createdTo', activeDraft.createdTo);
    nextParams.delete('order');
    nextParams.delete('dueFirst');
    setShouldRefreshSession(false);
    setSearchParams(nextParams);
  };

  const returnToCover = () => {
    setStage('cover');
    setShouldRefreshSession(true);
    setKnownStreak(0);
    setBestKnownStreak(0);
    setRevealed(false);
    setSubmitState('idle');
  };

  const moveTo = (nextIndex: number) => {
    setIndex(Math.min(Math.max(nextIndex, 0), items.length - 1));
    setRevealed(false);
    setSubmitState('idle');
  };
  const submitReview = async (result: ReviewChoice) => {
    if (
      !current
      || currentProgress?.result
      || submitState === 'submitting'
      || reviewControllerRef.current
    ) return;
    const controller = new AbortController();
    reviewControllerRef.current = controller;
    setSubmitState('submitting');
    try {
      const review = await api<ReviewResult>('/api/reviews', {
        method: 'POST',
        body: JSON.stringify({ quizItemId: current.quizItemId, result }),
        signal: controller.signal,
      });
      setRevealed(true);
      setProgress((currentProgressMap) => {
        const next = { ...currentProgressMap };
        for (const item of items) {
          if (item.cardId === review.cardId) {
            next[item.quizItemId] = {
              ...next[item.quizItemId],
              wrongCount: review.wrongCount,
            };
          }
        }
        next[review.quizItemId] = {
          ...next[review.quizItemId],
          wrongCount: review.wrongCount,
          result,
          message: result === 'unknown'
            ? `已标注不会，本卡共 ${review.wrongCount} 次`
            : `已记录记住了，本卡仍为 ${review.wrongCount} 次`,
        };
        return next;
      });
      if (result === 'known') {
        setKnownStreak((currentStreak) => {
          const nextStreak = currentStreak + 1;
          setBestKnownStreak((currentBest) => Math.max(currentBest, nextStreak));
          return nextStreak;
        });
        if (index === items.length - 1) {
          setSubmitState('idle');
          setStage('summary');
        } else {
          moveTo(index + 1);
        }
      } else {
        setKnownStreak(0);
        setSubmitState('idle');
      }
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setSubmitState('error');
    } finally {
      if (reviewControllerRef.current === controller) reviewControllerRef.current = null;
    }
  };

  useEffect(() => {
    if (loadState !== 'ready' || stage !== 'session' || !current) return undefined;

    const handleShortcut = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented
        || event.isComposing
        || event.repeat
        || event.ctrlKey
        || event.metaKey
        || event.altKey
        || event.shiftKey
        || submitState === 'submitting'
        || isKeyboardShortcutTarget(event.target)
      ) return;

      if ((event.code === 'Space' || event.key === ' ') && !revealed) {
        event.preventDefault();
        setRevealed(true);
        return;
      }
      if (event.key === 'ArrowLeft' && index > 0) {
        event.preventDefault();
        moveTo(index - 1);
        return;
      }
      if (event.key === 'ArrowRight' && index < items.length - 1) {
        event.preventDefault();
        moveTo(index + 1);
        return;
      }

      const reviewChoice = event.key.toLowerCase() === 'y'
        ? 'known'
        : event.key.toLowerCase() === 'n'
          ? 'unknown'
          : undefined;
      if (
        reviewChoice
        && currentProgress?.result === undefined
        && reviewControllerRef.current === null
      ) {
        event.preventDefault();
        void submitReview(reviewChoice);
      }
    };

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [current, currentProgress?.result, index, items.length, loadState, revealed, stage, submitState]);

  if (loadState === 'loading') {
    return (
      <StudyShell controls={(
        <StudySessionControls
          disabled
          draft={sessionDraft}
          totalAvailable={displayedTotalAvailable}
          onChange={setSessionDraft}
          onStart={startSessionWithDraft}
        />
      )}>
        <StatusNotice state="loading" message="正在准备背诵卡组" />
      </StudyShell>
    );
  }

  if (loadState === 'error') {
    return (
      <StudyShell controls={(
        <StudySessionControls
          draft={sessionDraft}
          totalAvailable={displayedTotalAvailable}
          onChange={setSessionDraft}
          onStart={startSessionWithDraft}
        />
      )}>
        <StatusNotice state="error" message="背诵卡组加载失败，请稍后重试" />
        <button className="button button--secondary liquid-pressable study-page__retry" onClick={() => setLoadKey((value) => value + 1)} type="button">
          <RotateCcw aria-hidden="true" size={17} />
          重新加载
        </button>
      </StudyShell>
    );
  }

  if (loadState === 'empty') {
    return (
      <StudyShell controls={(
        <StudySessionControls
          draft={sessionDraft}
          totalAvailable={displayedTotalAvailable}
          onChange={setSessionDraft}
          onStart={startSessionWithDraft}
        />
      )}>
        <StatusNotice state="empty" message="暂无可背诵卡组" />
      </StudyShell>
    );
  }

  if (stage === 'cover') {
    return (
      <StudyShell aside={(
        <span aria-live="polite" className="study-page__counter">
          可用 {displayedTotalAvailable} 张{scopePreviewStatus ? ` · ${scopePreviewStatus}` : ''}
        </span>
      )}>
        <StudyCover
          count={sessionDraft.count}
          previewStatus={scopePreviewStatus}
          totalAvailable={displayedTotalAvailable}
        />
        <StudySessionControls
          draft={sessionDraft}
          totalAvailable={displayedTotalAvailable}
          onChange={setSessionDraft}
          onStart={startSessionWithDraft}
        />
      </StudyShell>
    );
  }

  if (stage === 'summary' || !current || !currentProgress) {
    return (
      <StudyShell>
        <div className="study-summary liquid-glass liquid-glass--regular">
          <h2>本轮完成</h2>
          <dl>
            <div className="liquid-glass__nested"><dt>已记录题面</dt><dd>{completedCount}</dd></div>
            <div className="liquid-glass__nested"><dt>不会标注</dt><dd>{unknownCount}</dd></div>
            <div className="liquid-glass__nested"><dt>记住了</dt><dd>{knownCount}</dd></div>
            <div className="liquid-glass__nested"><dt>最佳连续记住</dt><dd>{bestKnownStreak}</dd></div>
          </dl>
          <p className="study-summary__result" role="status">
            <CircleCheck aria-hidden="true" size={18} />
            {roundFeedback(completedCount, knownCount, unknownCount)}
          </p>
          <button className="button button--primary liquid-pressable" onClick={returnToCover} type="button">
            下一页
            <ArrowRight aria-hidden="true" size={17} />
          </button>
        </div>
      </StudyShell>
    );
  }

  const reviewed = currentProgress.result !== undefined;

  return (
    <StudyShell
      aside={<span className="study-page__counter">第 {index + 1} / {items.length} 张</span>}
    >
      <article className="study-card liquid-glass liquid-glass--regular">
        <header className="study-card__header">
          <div>
            <span className="study-card__category">
              {current.categories.map(({ name }) => name).join(' / ') || '未分类'}
            </span>
            <h2 ref={headingRef} tabIndex={-1}>背诵题面</h2>
          </div>
          <div className="study-mark liquid-glass__nested" aria-live="polite">
            <span>不会标注</span>
            <strong>{currentProgress.wrongCount} 次</strong>
          </div>
        </header>

        <section className="study-card__question liquid-glass__nested" aria-label="题目">
          <h3>题目</h3>
          <p><MathText text={current.question} /></p>
        </section>

        {revealed ? (
          <section className="study-card__answer liquid-glass__nested" aria-label="答案">
            <h3>答案</h3>
            <p><MathText text={current.answer} /></p>
            {current.rawInput ? <DetailBlock renderMath={false} title="原始输入" value={current.rawInput} /> : null}
            {current.normalizedStatement ? <DetailBlock title="知识点" value={current.normalizedStatement} /> : null}
            {current.analysis ? <DetailBlock title="解析" value={current.analysis} /> : null}
            {current.mnemonic ? <DetailBlock title="速记" value={current.mnemonic} /> : null}
          </section>
        ) : null}

        {currentProgress.message ? (
          <div className="study-card__message" aria-live="polite">{currentProgress.message}</div>
        ) : null}
        {knownStreak >= 2 ? (
          <div className="study-card__streak">
            <BadgeCheck aria-hidden="true" size={18} />
            <span>{`连续记住 ${knownStreak} 题`}</span>
          </div>
        ) : null}
        {submitState === 'error' ? (
          <div className="study-card__error" role="alert">记录失败，请重试</div>
        ) : null}

        <div className="study-card__actions">
          <button
            className="button button--primary liquid-pressable"
            disabled={reviewed || submitState === 'submitting'}
            onClick={() => void submitReview('unknown')}
            type="button"
          >
            {submitState === 'submitting' ? <LoaderCircle aria-hidden="true" className="is-spinning" size={17} /> : <RotateCcw aria-hidden="true" size={17} />}
            不会 +1
          </button>
          {!revealed ? (
            <button className="button button--secondary liquid-pressable" onClick={() => setRevealed(true)} type="button">
              <Eye aria-hidden="true" size={17} />
              查看答案
            </button>
          ) : (
            <button
              className="button button--secondary liquid-pressable"
              disabled={reviewed || submitState === 'submitting'}
              onClick={() => void submitReview('known')}
              type="button"
            >
              <Check aria-hidden="true" size={17} />
              记住了
            </button>
          )}
        </div>

        <footer className="study-card__nav">
          <button className="button button--secondary liquid-pressable" disabled={index === 0 || submitState === 'submitting'} onClick={() => moveTo(index - 1)} type="button">
            <ArrowLeft aria-hidden="true" size={17} />
            上一张
          </button>
          <button className="button button--secondary liquid-pressable" disabled={submitState === 'submitting'} onClick={() => setStage('summary')} type="button">
            结束本轮
          </button>
          <button className="button button--secondary liquid-pressable" disabled={index === items.length - 1 || submitState === 'submitting'} onClick={() => moveTo(index + 1)} type="button">
            下一张
            <ArrowRight aria-hidden="true" size={17} />
          </button>
        </footer>
      </article>
    </StudyShell>
  );
}

function StudyShell({
  aside,
  children,
  controls,
}: {
  aside?: ReactNode;
  children: ReactNode;
  controls?: ReactNode;
}) {
  return (
    <section className="page study-page">
      <header className="page__header study-page__header liquid-glass liquid-glass--thin">
        <h1 className="page__title">背诵</h1>
        {aside}
      </header>
      {controls}
      {children}
      <RandomOriginalDraft />
    </section>
  );
}

function RandomOriginalDraft() {
  const [state, setState] = useState<RandomOriginalState>('idle');
  const [card, setCard] = useState<CardDetail | null>(null);
  const [drawKey, setDrawKey] = useState(0);
  const [rememberedCount, setRememberedCount] = useState(0);
  const [forgottenCount, setForgottenCount] = useState(0);
  const [countPreview, setCountPreview] = useState<{
    status: 'loading' | 'ready' | 'error';
    total: number | null;
  }>({ status: 'loading', total: null });
  const [scope, setScope] = useState<OriginalScopeDraft>({
    categoryIds: [],
    createdFrom: '',
    createdTo: '',
  });
  const requestControllerRef = useRef<AbortController | null>(null);
  const requestInFlightRef = useRef(false);
  const countRequestRef = useRef(0);
  const invalidDateRange = Boolean(
    scope.createdFrom
    && scope.createdTo
    && scope.createdFrom > scope.createdTo,
  );

  useEffect(() => () => requestControllerRef.current?.abort(), []);

  const scopeKey = JSON.stringify([
    normalizeCategoryIds(scope.categoryIds),
    scope.createdFrom,
    scope.createdTo,
  ]);

  useEffect(() => {
    const requestId = countRequestRef.current + 1;
    countRequestRef.current = requestId;
    if (invalidDateRange) return undefined;

    const controller = new AbortController();
    setCountPreview((current) => ({ status: 'loading', total: current.total }));
    api<{ totalAvailable: number }>(randomOriginalRequestPath(scope, '/count'), {
      signal: controller.signal,
    })
      .then((result) => {
        if (countRequestRef.current !== requestId) return;
        setCountPreview({ status: 'ready', total: result.totalAvailable });
      })
      .catch((error: unknown) => {
        if (
          (error instanceof DOMException && error.name === 'AbortError')
          || countRequestRef.current !== requestId
        ) return;
        setCountPreview({ status: 'error', total: null });
      });

    return () => controller.abort();
  }, [invalidDateRange, scopeKey]);

  const updateScope = (nextScope: OriginalScopeDraft) => {
    if (requestInFlightRef.current) return;
    setScope({
      ...nextScope,
      categoryIds: normalizeCategoryIds(nextScope.categoryIds),
    });
    setCard(null);
    setState('idle');
  };

  const drawRandomOriginal = async () => {
    if (requestInFlightRef.current || invalidDateRange) return;
    const controller = new AbortController();
    requestInFlightRef.current = true;
    requestControllerRef.current = controller;
    setCard(null);
    setState('drawing');

    try {
      const result = await api<{ card: CardDetail | null }>(randomOriginalRequestPath(scope), {
        signal: controller.signal,
      });
      if (requestControllerRef.current !== controller) return;
      setCard(result.card);
      setDrawKey((current) => current + 1);
      setState(result.card ? 'ready' : 'empty');
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      if (requestControllerRef.current !== controller) return;
      setCard(null);
      setState('error');
    } finally {
      if (requestControllerRef.current === controller) {
        requestControllerRef.current = null;
        requestInFlightRef.current = false;
      }
    }
  };

  const submitOriginalFeedback = (result: ReviewChoice) => {
    if (state !== 'ready' || !card || requestInFlightRef.current) return;
    if (result === 'known') setRememberedCount((current) => current + 1);
    else setForgottenCount((current) => current + 1);
    void drawRandomOriginal();
  };

  const buttonLabel = state === 'drawing'
    ? '正在抽取用户初始稿'
    : state === 'ready' || state === 'empty'
      ? '再次抽取用户初始稿'
      : state === 'error'
        ? '重新抽取用户初始稿'
        : '随机抽取用户初始稿';

  return (
    <section
      aria-labelledby="study-random-original-title"
      className="study-random-original liquid-glass liquid-glass--regular"
      data-state={state}
    >
      <header className="study-random-original__header">
        <div>
          <span>随机回看</span>
          <h2 id="study-random-original-title">用户初始稿</h2>
        </div>
        <div className="study-random-original__header-actions">
          <p aria-live="polite" className="study-random-original__counts">
            <span>本次</span>
            <strong>记住 {rememberedCount}</strong>
            <span aria-hidden="true">/</span>
            <strong>没记住 {forgottenCount}</strong>
          </p>
          <button
            className="button button--secondary liquid-pressable study-random-original__draw"
            disabled={state === 'drawing' || invalidDateRange}
            onClick={() => void drawRandomOriginal()}
            type="button"
          >
            {state === 'drawing'
              ? <LoaderCircle aria-hidden="true" className="is-spinning" size={18} />
              : <Shuffle aria-hidden="true" size={18} />}
            {buttonLabel}
          </button>
        </div>
      </header>

      <div
        aria-label="初始稿抽取范围"
        className="study-random-original__scope"
        role="group"
      >
        <div className="study-random-original__scope-categories">
          <div className="study-scope__heading">
            <div>
              <span>初始稿板块范围</span>
              <strong>{categorySelectionSummary(scope.categoryIds)}</strong>
            </div>
            {scope.categoryIds.length > 0 ? (
              <button
                className="button button--secondary liquid-pressable study-scope__reset"
                disabled={state === 'drawing'}
                onClick={() => updateScope({ ...scope, categoryIds: [] })}
                type="button"
              >
                全部板块
              </button>
            ) : null}
          </div>
          <p aria-live="polite" className="study-scope__date-summary">
            {invalidDateRange
              ? ''
              : countPreview.status === 'loading'
                ? '正在统计匹配初始稿…'
                : countPreview.status === 'error'
                  ? '匹配数量加载失败，仍可手动抽取'
                  : `匹配初始稿 ${countPreview.total ?? 0} 份`}
          </p>
          <div className="study-scope__category-list">
            {CATEGORY_ENTRIES.map(([parentName, childNames]) => {
              const parentSelected = scope.categoryIds.includes(parentName);
              const selectedChildCount = childNames.filter((childName) => (
                scope.categoryIds.includes(`${parentName}/${childName}`)
              )).length;
              return (
                <details className="study-scope__category" key={parentName}>
                  <summary>
                    <span>{parentName}</span>
                    <small>
                      {parentSelected
                        ? '整个板块'
                        : selectedChildCount > 0
                          ? `${selectedChildCount} 个细分`
                          : '未单独选择'}
                    </small>
                  </summary>
                  <div className="study-scope__category-options">
                    <label className="study-scope__category-option study-scope__category-option--parent">
                      <input
                        aria-label={`初始稿范围：${parentName}`}
                        checked={parentSelected}
                        disabled={state === 'drawing'}
                        onChange={(event) => updateScope({
                          ...scope,
                          categoryIds: toggleParentCategory(
                            scope.categoryIds,
                            parentName,
                            childNames,
                            event.target.checked,
                          ),
                        })}
                        type="checkbox"
                      />
                      整个{parentName}
                    </label>
                    {childNames.map((childName) => {
                      const childId = `${parentName}/${childName}`;
                      return (
                        <label className="study-scope__category-option" key={childId}>
                          <input
                            aria-label={`初始稿范围：${childName}`}
                            checked={scope.categoryIds.includes(childId)}
                            disabled={state === 'drawing'}
                            onChange={(event) => updateScope({
                              ...scope,
                              categoryIds: toggleChildCategory(
                                scope.categoryIds,
                                parentName,
                                childId,
                                event.target.checked,
                              ),
                            })}
                            type="checkbox"
                          />
                          {childName}
                        </label>
                      );
                    })}
                  </div>
                </details>
              );
            })}
          </div>
        </div>

        <fieldset className="study-scope__dates">
          <legend>初始稿录入时间</legend>
          <div className="study-scope__date-fields">
            <label>
              <span>初始稿开始日期</span>
              <input
                aria-label="初始稿范围开始日期"
                disabled={state === 'drawing'}
                max={scope.createdTo || undefined}
                onChange={(event) => updateScope({ ...scope, createdFrom: event.target.value })}
                type="date"
                value={scope.createdFrom}
              />
            </label>
            <label>
              <span>初始稿结束日期</span>
              <input
                aria-label="初始稿范围结束日期"
                disabled={state === 'drawing'}
                min={scope.createdFrom || undefined}
                onChange={(event) => updateScope({ ...scope, createdTo: event.target.value })}
                type="date"
                value={scope.createdTo}
              />
            </label>
          </div>
          {invalidDateRange ? (
            <p className="study-scope__error" role="alert">开始日期不能晚于结束日期</p>
          ) : (
            <p className="study-scope__date-summary">{dateRangeSummary(scope.createdFrom, scope.createdTo)}</p>
          )}
        </fieldset>
      </div>

      <div className="study-random-original__table">
        <div className="study-random-original__deck">
          <span aria-hidden="true" className="study-random-original__deck-card" />
          <span aria-hidden="true" className="study-random-original__deck-card" />
          <span className="study-random-original__deck-card study-random-original__deck-card--top">
            <img
              alt="开国大典牌面"
              className="study-random-original__cover"
              src="/diy/开国大典.jpg"
            />
          </span>
          {state === 'drawing' ? <span aria-hidden="true" className="study-random-original__dealt-card" /> : null}
        </div>

        {card && state === 'ready' ? (
          <article className="study-random-original__result" key={`${card.id}-${drawKey}`}>
            <div className="study-random-original__content">
              <RichTextPreview
                contentJson={card.rawContentJson}
                fallback={card.rawInput || '未填写原始内容'}
              />
            </div>
            <dl className="study-random-original__meta">
              <div>
                <dt>分类</dt>
                <dd>{card.categories.map(({ name }) => name).join(' / ') || '未分类'}</dd>
              </div>
              <div>
                <dt>录入时间</dt>
                <dd><time dateTime={card.createdAt}>{formatOriginalCreatedAt(card.createdAt)}</time></dd>
              </div>
            </dl>
            <div aria-label="初始稿记忆反馈" className="study-random-original__feedback" role="group">
              <button
                aria-label="没记住"
                className="button liquid-pressable study-random-original__feedback-button study-random-original__feedback-button--forgotten"
                onClick={() => submitOriginalFeedback('unknown')}
                type="button"
              >
                <RotateCcw aria-hidden="true" size={18} />
                没记住
              </button>
              <button
                aria-label="记住了"
                className="button liquid-pressable study-random-original__feedback-button study-random-original__feedback-button--remembered"
                onClick={() => submitOriginalFeedback('known')}
                type="button"
              >
                <Check aria-hidden="true" size={18} />
                记住了
              </button>
            </div>
          </article>
        ) : (
          <p
            aria-live="polite"
            className={`study-random-original__status study-random-original__status--${state}`}
            role={state === 'error' ? 'alert' : 'status'}
          >
            {state === 'drawing' && '正在洗牌并抽取初始稿…'}
            {state === 'empty' && '还没有可抽取的用户初始稿。'}
            {state === 'error' && '抽取失败，请检查连接后重试。'}
            {state === 'idle' && '等待抽取'}
          </p>
        )}
      </div>
    </section>
  );
}

function formatOriginalCreatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function randomOriginalRequestPath(scope: OriginalScopeDraft, suffix = '') {
  const searchParams = new URLSearchParams();
  normalizeCategoryIds(scope.categoryIds).forEach((categoryId) => {
    searchParams.append('categoryIds', categoryId);
  });
  setOptionalSearchParam(searchParams, 'createdFrom', scope.createdFrom);
  setOptionalSearchParam(searchParams, 'createdTo', scope.createdTo);
  const query = searchParams.toString();
  return `/api/cards/random-original${suffix}${query ? `?${query}` : ''}`;
}

function StudyCover({
  count,
  previewStatus,
  totalAvailable,
}: {
  count: number;
  previewStatus: string;
  totalAvailable: number;
}) {
  return (
    <section className="study-cover liquid-glass liquid-glass--thick" aria-labelledby="study-cover-title">
      <div className="study-cover__book" aria-hidden="true">
        <span className="study-cover__book-spine" />
        <img alt="" className="study-cover__image" src="/diy/开国大典.jpg" />
      </div>
      <div className="study-cover__content">
        <h2 id="study-cover-title">开始本轮背诵</h2>
        <dl className="liquid-glass__nested">
          <div><dt>可用题面</dt><dd>{totalAvailable}</dd></div>
          <div><dt>本轮题数</dt><dd>{totalAvailable === 0 ? 0 : Math.min(count, totalAvailable)}</dd></div>
        </dl>
        {previewStatus ? <p aria-live="polite">{previewStatus}</p> : null}
      </div>
    </section>
  );
}

function StudySessionControls({
  disabled = false,
  draft,
  totalAvailable,
  onChange,
  onStart,
}: {
  disabled?: boolean;
  draft: SessionDraft;
  totalAvailable: number;
  onChange: (next: SessionDraft) => void;
  onStart: () => void;
}) {
  const rollMax = Math.max(1, Math.min(100, totalAvailable));
  const countMax = totalAvailable > 0 ? rollMax : 100;
  const invalidCount = draft.count < 1 || draft.count > countMax;
  const invalidDateRange = Boolean(
    draft.createdFrom
    && draft.createdTo
    && draft.createdFrom > draft.createdTo,
  );
  const canRoll = !disabled && totalAvailable > 0;
  const reduceMotion = shouldReduceMotion();
  const [rollState, setRollState] = useState<RollState>('idle');
  const [displayCount, setDisplayCount] = useState(draft.count);
  const [rollResult, setRollResult] = useState('');
  const [pullY, setPullY] = useState(0);
  const [gestureState, setGestureState] = useState<JoystickGestureState>('idle');
  const pointerIdRef = useRef<number | null>(null);
  const pointerStartYRef = useRef(0);
  const gestureStartPullRef = useRef(0);
  const pullYRef = useRef(0);
  const pointerMovedRef = useRef(false);
  const velocityHistoryRef = useRef<PointerSample[]>([]);
  const returnAnimationRef = useRef<{ stop: () => void } | null>(null);
  const rollIntervalRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);
  const rollPendingRef = useRef(false);
  const rolling = rollState === 'rolling';
  const dragging = gestureState === 'dragging';

  const setJoystickPull = (nextPull: number) => {
    pullYRef.current = nextPull;
    setPullY(nextPull);
  };

  const addVelocitySample = (y: number, time: number) => {
    velocityHistoryRef.current = [
      ...velocityHistoryRef.current.filter((sample) => time - sample.time <= JOYSTICK_VELOCITY_WINDOW_MS),
      { time, y },
    ].slice(-6);
  };

  const releaseVelocity = () => {
    const first = velocityHistoryRef.current[0];
    const last = velocityHistoryRef.current[velocityHistoryRef.current.length - 1];
    if (!first || !last || last.time <= first.time) return 0;
    return ((last.y - first.y) / (last.time - first.time)) * 1000;
  };

  const returnJoystickToRest = (velocity: number) => {
    returnAnimationRef.current?.stop();
    returnAnimationRef.current = null;
    if (reduceMotion || pullYRef.current === 0) {
      setJoystickPull(0);
      setGestureState('idle');
      return;
    }

    const spring = Math.abs(velocity) > 20 ? momentumSpring : criticalSpring;
    setGestureState('returning');
    try {
      returnAnimationRef.current = animate(pullYRef.current, 0, {
        ...spring,
        velocity,
        onUpdate: setJoystickPull,
        onComplete: () => {
          returnAnimationRef.current = null;
          setJoystickPull(0);
          setGestureState('idle');
        },
      });
    } catch {
      returnAnimationRef.current = null;
      setJoystickPull(0);
      setGestureState('idle');
    }
  };

  const startRollAnimation = (finalCount: number) => {
    if (rollIntervalRef.current !== null) window.clearInterval(rollIntervalRef.current);
    let tick = 0;
    setRollState('rolling');
    rollIntervalRef.current = window.setInterval(() => {
      tick += 1;
      setDisplayCount(tick >= ROLL_TICKS ? finalCount : randomCount(rollMax));
      if (tick >= ROLL_TICKS) {
        if (rollIntervalRef.current !== null) window.clearInterval(rollIntervalRef.current);
        rollIntervalRef.current = null;
        setRollState('settled');
        setRollResult(`已抽取 ${finalCount} 题`);
      }
    }, ROLL_INTERVAL_MS);
  };

  const activateRoll = () => {
    if (!canRoll || rollPendingRef.current) return;
    rollPendingRef.current = true;
    setRollResult('');
    const finalCount = randomCount(rollMax);
    const nextDraft = { ...draft, count: finalCount };
    if (reduceMotion) {
      setDisplayCount(finalCount);
      setRollState('settled');
      setRollResult(`已抽取 ${finalCount} 题`);
    } else {
      startRollAnimation(finalCount);
    }
    onChange(nextDraft);
    window.setTimeout(() => {
      rollPendingRef.current = false;
    }, 0);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!canRoll || rolling || pointerIdRef.current !== null) return;
    returnAnimationRef.current?.stop();
    returnAnimationRef.current = null;
    pointerIdRef.current = event.pointerId;
    pointerStartYRef.current = event.clientY;
    gestureStartPullRef.current = pullYRef.current;
    pointerMovedRef.current = false;
    velocityHistoryRef.current = [];
    addVelocitySample(event.clientY, event.timeStamp);
    suppressClickRef.current = false;
    setGestureState('pressed');
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (pointerIdRef.current !== event.pointerId) return;
    event.preventDefault();
    const pointerDelta = event.clientY - pointerStartYRef.current;
    if (!pointerMovedRef.current && Math.abs(pointerDelta) < JOYSTICK_HYSTERESIS) return;
    pointerMovedRef.current = true;
    addVelocitySample(event.clientY, event.timeStamp);
    setGestureState('dragging');
    const directPull = Math.max(0, gestureStartPullRef.current + pointerDelta);
    const nextPull = directPull <= JOYSTICK_MAX_PULL
      ? directPull
      : JOYSTICK_MAX_PULL + rubberBand(
        directPull - JOYSTICK_MAX_PULL,
        JOYSTICK_MAX_PULL,
      );
    setJoystickPull(nextPull);
  };

  const finishPointer = (event: ReactPointerEvent<HTMLButtonElement>, mayActivate: boolean) => {
    if (pointerIdRef.current !== event.pointerId) return;
    pointerIdRef.current = null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    addVelocitySample(event.clientY, event.timeStamp);
    const velocity = releaseVelocity();
    const pulledFarEnough = pointerMovedRef.current && pullYRef.current >= JOYSTICK_TRIGGER_PULL;
    suppressClickRef.current = pointerMovedRef.current;
    if (mayActivate && pulledFarEnough) {
      suppressClickRef.current = true;
      activateRoll();
    }
    returnJoystickToRest(velocity);
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
  };

  const visualPullY = pullY;
  const pullProgress = Math.min(1, visualPullY / JOYSTICK_MAX_PULL);
  const joystickStyle = {
    '--joystick-pull-y': `${visualPullY}px`,
    '--joystick-stick-scale': String(1 - pullProgress * 0.56),
    '--joystick-pull-progress': String(pullProgress),
    '--joystick-knob-rotate': `${pullProgress * -8}deg`,
    '--joystick-shadow-y': `${8 - pullProgress * 3}px`,
    '--joystick-shadow-opacity': String(0.5 - pullProgress * 0.22),
    '--joystick-shadow-scale': String(1 - pullProgress * 0.16),
    '--joystick-hand-rotate': `${-15 + pullProgress * 5}deg`,
  } as CSSProperties;

  useEffect(() => {
    if (!rolling) setDisplayCount(totalAvailable === 0 ? 0 : Math.min(draft.count, countMax));
  }, [countMax, draft.count, rolling, totalAvailable]);

  useEffect(() => {
    if (!rolling && totalAvailable > 0 && draft.count > countMax) {
      onChange({ ...draft, count: countMax });
    }
  }, [countMax, draft, onChange, rolling, totalAvailable]);

  useEffect(() => () => {
    returnAnimationRef.current?.stop();
    if (rollIntervalRef.current !== null) window.clearInterval(rollIntervalRef.current);
  }, []);

  return (
    <section className="study-controls liquid-glass liquid-glass--thick" aria-label="本轮设置">
      <div className="study-controls__scope">
        <div className="study-scope__categories">
          <div className="study-scope__heading">
            <div>
              <span>板块范围</span>
              <strong>{categorySelectionSummary(draft.categoryIds)}</strong>
            </div>
            {draft.categoryIds.length > 0 ? (
              <button
                className="button button--secondary liquid-pressable study-scope__reset"
                disabled={disabled}
                onClick={() => onChange({ ...draft, categoryIds: [] })}
                type="button"
              >
                全部板块
              </button>
            ) : null}
          </div>
          <div className="study-scope__category-list">
            {CATEGORY_ENTRIES.map(([parentName, childNames]) => {
              const parentSelected = draft.categoryIds.includes(parentName);
              const selectedChildCount = childNames.filter((childName) => (
                draft.categoryIds.includes(`${parentName}/${childName}`)
              )).length;
              return (
                <details className="study-scope__category" key={parentName}>
                  <summary>
                    <span>{parentName}</span>
                    <small>
                      {parentSelected
                        ? '整个板块'
                        : selectedChildCount > 0
                          ? `${selectedChildCount} 个细分`
                          : '未单独选择'}
                    </small>
                  </summary>
                  <div className="study-scope__category-options">
                    <label className="study-scope__category-option study-scope__category-option--parent">
                      <input
                        aria-label={parentName}
                        checked={parentSelected}
                        disabled={disabled}
                        onChange={(event) => onChange({
                          ...draft,
                          categoryIds: toggleParentCategory(
                            draft.categoryIds,
                            parentName,
                            childNames,
                            event.target.checked,
                          ),
                        })}
                        type="checkbox"
                      />
                      整个{parentName}
                    </label>
                    {childNames.map((childName) => {
                      const childId = `${parentName}/${childName}`;
                      return (
                        <label className="study-scope__category-option" key={childId}>
                          <input
                            checked={draft.categoryIds.includes(childId)}
                            disabled={disabled}
                            onChange={(event) => onChange({
                              ...draft,
                              categoryIds: toggleChildCategory(
                                draft.categoryIds,
                                parentName,
                                childId,
                                event.target.checked,
                              ),
                            })}
                            type="checkbox"
                          />
                          {childName}
                        </label>
                      );
                    })}
                  </div>
                </details>
              );
            })}
          </div>
        </div>

        <fieldset className="study-scope__dates">
          <legend>录入时间</legend>
          <div className="study-scope__date-fields">
            <label>
              <span>开始日期</span>
              <input
                disabled={disabled}
                max={draft.createdTo || undefined}
                onChange={(event) => onChange({ ...draft, createdFrom: event.target.value })}
                type="date"
                value={draft.createdFrom}
              />
            </label>
            <label>
              <span>结束日期</span>
              <input
                disabled={disabled}
                min={draft.createdFrom || undefined}
                onChange={(event) => onChange({ ...draft, createdTo: event.target.value })}
                type="date"
                value={draft.createdTo}
              />
            </label>
          </div>
          {invalidDateRange ? (
            <p className="study-scope__error" role="alert">开始日期不能晚于结束日期</p>
          ) : (
            <p className="study-scope__date-summary">{dateRangeSummary(draft.createdFrom, draft.createdTo)}</p>
          )}
        </fieldset>
      </div>
      <div className="study-controls__arcade">
        <div className="study-slot liquid-glass__nested">
          <span className="study-slot__label">本轮题数</span>
          <strong className={rolling ? 'is-rolling' : rollState === 'settled' ? 'is-settled' : ''}>{displayCount}</strong>
          <span className="study-slot__unit">题</span>
          <span className="study-slot__range">
            {totalAvailable === 0
              ? '暂无可抽题面'
              : totalAvailable > 100
                ? `总题面 ${totalAvailable} · 单轮可抽 1-${rollMax}`
                : `可抽题面 1-${rollMax}`}
          </span>
        </div>
        <button
          aria-busy={rolling}
          aria-label="下拉摇杆随机抽取题数"
          data-gesture-state={rolling ? 'rolling' : gestureState}
          className={[
            'study-joystick',
            dragging ? 'is-dragging' : '',
            rolling ? 'is-pulled' : '',
            rollState === 'settled' ? 'is-settled' : '',
          ].filter(Boolean).join(' ')}
          disabled={!canRoll}
          onBlur={() => {
            if (pointerIdRef.current === null && gestureState !== 'returning') setJoystickPull(0);
          }}
          onClick={() => {
            if (suppressClickRef.current) {
              suppressClickRef.current = false;
              return;
            }
            activateRoll();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setJoystickPull(0);
              return;
            }
            if (!event.repeat && (event.key === 'Enter' || event.key === ' ')) {
              setJoystickPull(JOYSTICK_MAX_PULL);
            }
          }}
          onKeyUp={(event) => {
            if (event.key === 'Enter' || event.key === ' ') setJoystickPull(0);
          }}
          onPointerCancel={(event) => finishPointer(event, false)}
          onPointerDown={handlePointerDown}
          onLostPointerCapture={(event) => finishPointer(event, false)}
          onPointerMove={handlePointerMove}
          onPointerUp={(event) => finishPointer(event, true)}
          style={joystickStyle}
          type="button"
        >
          <span className="study-joystick__hand" aria-hidden="true">
            <Hand size={34} strokeWidth={1.8} />
          </span>
          <span className="study-joystick__stick" aria-hidden="true" />
          <span className="study-joystick__base" aria-hidden="true">
            <Gamepad2 aria-hidden="true" size={18} />
          </span>
        </button>
        {rollResult ? <span className="study-controls__result" role="status">{rollResult}</span> : null}
      </div>
      <div className="study-controls__manual liquid-glass__nested">
        <div className="study-controls__field">
          <label htmlFor="study-count">手动数量</label>
          <input
            disabled={disabled}
            id="study-count"
            inputMode="numeric"
            max={countMax}
            min={1}
            onChange={(event) => {
              const nextCount = Number(event.target.value);
              onChange({
                ...draft,
                count: Number.isInteger(nextCount) ? nextCount : draft.count,
              });
            }}
            type="number"
            value={draft.count}
          />
        </div>
        <button
          className="button button--primary liquid-pressable study-controls__start"
          disabled={disabled || totalAvailable === 0 || invalidCount || invalidDateRange}
          onClick={() => onStart()}
          type="button"
        >
          <Play aria-hidden="true" size={17} />
          开始背诵
        </button>
      </div>
    </section>
  );
}

function DetailBlock({ renderMath = true, title, value }: {
  renderMath?: boolean;
  title: string;
  value: string;
}) {
  return (
    <div className="study-card__detail">
      <h4>{title}</h4>
      <p>{renderMath ? <MathText text={value} /> : value}</p>
    </div>
  );
}

function readSessionInput(searchParams: URLSearchParams): StudySessionInput {
  return {
    categoryIds: searchParams.getAll('categoryIds').filter(Boolean),
    cardIds: searchParams.getAll('cardIds').filter(Boolean),
    tagIds: searchParams.getAll('tagIds').filter(Boolean),
    createdFrom: searchParams.get('createdFrom') || undefined,
    createdTo: searchParams.get('createdTo') || undefined,
    count: positiveInteger(searchParams.get('count'), 20),
    order: 'random',
    dueFirst: false,
  };
}

function toSessionDraft(input: StudySessionInput): SessionDraft {
  return {
    count: input.count,
    categoryIds: normalizeCategoryIds(input.categoryIds ?? []),
    createdFrom: dateInputValue(input.createdFrom),
    createdTo: dateInputValue(input.createdTo),
  };
}

function normalizeCategoryIds(categoryIds: readonly string[]) {
  const selectedIds = new Set(categoryIds);
  return CATEGORY_ENTRIES.flatMap(([parentName, childNames]) => {
    if (selectedIds.has(parentName)) return [parentName];
    return childNames
      .map((childName) => `${parentName}/${childName}`)
      .filter((childId) => selectedIds.has(childId));
  });
}

function toggleParentCategory(
  categoryIds: readonly string[],
  parentName: string,
  childNames: readonly string[],
  checked: boolean,
) {
  const familyIds = new Set([
    parentName,
    ...childNames.map((childName) => `${parentName}/${childName}`),
  ]);
  const nextIds = categoryIds.filter((categoryId) => !familyIds.has(categoryId));
  return normalizeCategoryIds(checked ? [...nextIds, parentName] : nextIds);
}

function toggleChildCategory(
  categoryIds: readonly string[],
  parentName: string,
  childId: string,
  checked: boolean,
) {
  const nextIds = categoryIds.filter((categoryId) => (
    categoryId !== parentName && categoryId !== childId
  ));
  return normalizeCategoryIds(checked ? [...nextIds, childId] : nextIds);
}

function categorySelectionSummary(categoryIds: readonly string[]) {
  if (categoryIds.length === 0) return '全部板块';
  if (categoryIds.length === 1) return categoryIds[0].split('/').at(-1) ?? categoryIds[0];
  return `已选 ${categoryIds.length} 个范围`;
}

function dateRangeSummary(createdFrom: string, createdTo: string) {
  if (createdFrom && createdTo) return `${createdFrom} 至 ${createdTo}`;
  if (createdFrom) return `${createdFrom} 起`;
  if (createdTo) return `截至 ${createdTo}`;
  return '全部录入时间';
}

function dateInputValue(value: string | undefined) {
  return value?.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? '';
}

function sameStringArray(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function setOptionalSearchParam(searchParams: URLSearchParams, key: string, value: string) {
  if (value) searchParams.set(key, value);
  else searchParams.delete(key);
}

function isKeyboardShortcutTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest([
    'input',
    'textarea',
    'select',
    'button',
    'a[href]',
    '[contenteditable]:not([contenteditable="false"])',
    '[role="textbox"]',
    '[role="combobox"]',
    '[role="spinbutton"]',
    '[role="slider"]',
  ].join(',')));
}

function positiveInteger(value: string | null, fallback: number) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 && number <= 100 ? number : fallback;
}

function roundFeedback(completedCount: number, knownCount: number, unknownCount: number) {
  if (completedCount === 0) return '本轮暂未记录题面，可以调整数量后再来一轮。';
  if (unknownCount === 0) return '本轮全部记住，状态很稳。';
  if (knownCount > unknownCount) return '本轮记住的题目更多，继续保持。';
  return `已找到 ${unknownCount} 道待攻克题，下轮目标更明确。`;
}

function randomCount(max: number) {
  return Math.floor(Math.random() * max) + 1;
}
