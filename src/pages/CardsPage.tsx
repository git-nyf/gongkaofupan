import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Archive,
  ArchiveRestore,
  ArrowDownToLine,
  ArrowUpToLine,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Download,
  Eye,
  FolderCheck,
  FolderPlus,
  History,
  LoaderCircle,
  Pencil,
  RefreshCw,
  Search,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { animate } from 'motion';
import { createPortal } from 'react-dom';
import { Link, useSearchParams } from 'react-router-dom';
import type {
  AiStatus,
  BulkCardUpdateInput,
  CardDetail,
  CardFolderContents,
  CardFolderSummary,
  CardSearchResult,
} from '../../shared/contracts';
import { api, apiBlob, ApiError } from '../api/client';
import {
  CARD_GROUP_DRAG_TYPE,
  CardFolderShelf,
  type CardFolderCardGroup,
} from '../components/CardFolderShelf';
import { MathText } from '../components/MathText';
import { RichTextPreview } from '../components/RichTextPreview';
import { StatusNotice } from '../components/StatusNotice';
import { ShenlunReviewLibrary } from '../components/ShenlunReviewLibrary';
import {
  criticalSpring,
  momentumSpring,
  projectMomentum,
  rubberBand,
  selectProjectedSnap,
} from '../motion/liquidMotion';
import '../styles/cards-glass.css';

type LoadState = 'loading' | 'ready' | 'error';
type CardContentVersion = 'optimized' | 'original';

const DRAWER_EXIT_VELOCITY_LIMIT = 1200;
type CardGroup = CardFolderCardGroup;

interface FilterState {
  contentVersion: CardContentVersion;
  query: string;
  categoryIds: string[];
  tagIds: string[];
  aiStatus: string;
  archived: string;
  createdFrom: string;
  createdTo: string;
  page: number;
  pageSize: number;
}

interface AnkiExportSummary {
  id: string;
  createdAt: string;
  count: number;
  apkgFileName: string;
  markdownFileName: string;
}

interface AnkiExportDetail extends AnkiExportSummary {
  cards: Array<{
    id: string;
    category: string;
    question: string;
    answer: string;
  }>;
}

interface AnkiCardSendResult {
  status: 'sent';
  count: number;
  cardId: string;
}

type AnkiExportResult =
  | { status: 'created'; export: AnkiExportSummary }
  | { status: 'empty' };

const aiStatusLabels: Record<AiStatus, string> = {
  processing: '整理中',
  ready: '已整理',
  pending: '待整理',
  needs_input: '待完善',
};

export function CardsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const isShenlunLibrary = searchParams.get('contentVersion') === 'shenlun';

  if (!isShenlunLibrary) return <CardContentLibraryPage />;

  const selectVersion = (version: CardContentVersion | 'shenlun') => {
    const next = new URLSearchParams();
    next.set('contentVersion', version);
    setSearchParams(next);
  };

  return (
    <section className="page cards-page">
      <header className="page__header cards-page__header">
        <div>
          <span className="page__eyebrow">REVIEW LIBRARY</span>
          <h1 className="page__title">卡片库</h1>
          <span className="cards-page__count">申论复盘</span>
        </div>
      </header>
      <div aria-label="内容版本" className="cards-content-version liquid-glass liquid-glass--thin" role="group">
        <button aria-pressed="false" className="liquid-pressable" onClick={() => selectVersion('optimized')} type="button">AI 优化稿</button>
        <button aria-pressed="false" className="liquid-pressable" onClick={() => selectVersion('original')} type="button">用户初始稿</button>
        <button aria-pressed="true" className="liquid-pressable is-selected" onClick={() => selectVersion('shenlun')} type="button">申论复盘</button>
      </div>
      <ShenlunReviewLibrary />
    </section>
  );
}

function CardContentLibraryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const hasDeprecatedFilters = searchParams.has('rating') || searchParams.has('mastery');
  const filters = useMemo(() => readFilters(searchParams), [searchParams]);
  const [queryDraft, setQueryDraft] = useState(filters.query);
  const contentVersion = filters.contentVersion;
  const [result, setResult] = useState<CardSearchResult>();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [pageDraft, setPageDraft] = useState(String(filters.page));
  const [folders, setFolders] = useState<CardFolderSummary[]>([]);
  const [folderListState, setFolderListState] = useState<LoadState>('loading');
  const [folderListError, setFolderListError] = useState('');
  const [activeFolderId, setActiveFolderId] = useState<string>();
  const [activeFolderContents, setActiveFolderContents] = useState<CardFolderContents>();
  const [folderContentState, setFolderContentState] = useState<LoadState>('ready');
  const [folderContentError, setFolderContentError] = useState('');
  const [folderActionName, setFolderActionName] = useState('');
  const [folderActionError, setFolderActionError] = useState('');
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [detailGroup, setDetailGroup] = useState<CardGroup>();
  const [bulkTags, setBulkTags] = useState('');
  const [actionName, setActionName] = useState('');
  const [actionError, setActionError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [ankiExporting, setAnkiExporting] = useState(false);
  const [ankiExportNotice, setAnkiExportNotice] = useState('');
  const [ankiExportError, setAnkiExportError] = useState('');
  const [ankiSendingCardId, setAnkiSendingCardId] = useState('');
  const [ankiSendNotice, setAnkiSendNotice] = useState('');
  const [ankiSendError, setAnkiSendError] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [archiveUndo, setArchiveUndo] = useState<{ ids: string[]; message: string }>();
  const [locateTargetIds, setLocateTargetIds] = useState<string[]>();
  const [locatedCardIds, setLocatedCardIds] = useState<Set<string>>(() => new Set());
  const [reloadKey, setReloadKey] = useState(0);
  const requestVersion = useRef(0);
  const folderRequestVersion = useRef(0);
  const folderContentRequestVersion = useRef(0);
  const activeFolderIdRef = useRef<string>();
  const detailTrigger = useRef<HTMLButtonElement | null>(null);
  const historyTrigger = useRef<HTMLButtonElement | null>(null);
  const locateHighlightTimer = useRef<number>();
  const suppressPageBlur = useRef(false);

  const loadFolders = useCallback(async (signal?: AbortSignal) => {
    const version = ++folderRequestVersion.current;
    setFolderListState('loading');
    setFolderListError('');
    try {
      const nextFolders = await api<CardFolderSummary[]>('/api/cards/folders', { signal });
      if (version !== folderRequestVersion.current) return;
      setFolders(nextFolders);
      setFolderListState('ready');
    } catch (error: unknown) {
      if (version !== folderRequestVersion.current || isAbortError(error)) return;
      setFolderListState('error');
      setFolderListError('文件夹加载失败，请稍后重试');
    }
  }, []);

  const loadFolderContents = useCallback(async (folderId: string, signal?: AbortSignal) => {
    const version = ++folderContentRequestVersion.current;
    setFolderContentState('loading');
    setFolderContentError('');
    try {
      const contents = await api<CardFolderContents>(`/api/cards/folders/${folderId}/cards`, { signal });
      if (version !== folderContentRequestVersion.current || activeFolderIdRef.current !== folderId) return;
      setActiveFolderContents(contents);
      setFolderContentState('ready');
    } catch (error: unknown) {
      if (
        version !== folderContentRequestVersion.current
        || activeFolderIdRef.current !== folderId
        || isAbortError(error)
      ) return;
      setFolderContentState('error');
      setFolderContentError('文件夹内容加载失败，请稍后重试');
    }
  }, []);

  useEffect(() => {
    if (contentVersion !== 'original') {
      folderRequestVersion.current += 1;
      folderContentRequestVersion.current += 1;
      activeFolderIdRef.current = undefined;
      setActiveFolderId(undefined);
      setActiveFolderContents(undefined);
      setFolderContentState('ready');
      setFolderContentError('');
      return;
    }

    activeFolderIdRef.current = undefined;
    setActiveFolderId(undefined);
    setActiveFolderContents(undefined);
    const controller = new AbortController();
    void loadFolders(controller.signal);
    return () => controller.abort();
  }, [contentVersion, loadFolders]);

  useEffect(() => {
    if (!hasDeprecatedFilters) return;
    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.delete('rating');
    nextSearchParams.delete('mastery');
    setSearchParams(nextSearchParams, { replace: true });
  }, [hasDeprecatedFilters, searchParams, setSearchParams]);

  useEffect(() => {
    setQueryDraft(filters.query);
  }, [filters.query]);

  useEffect(() => {
    setPageDraft(String(filters.page));
  }, [filters.page]);

  useEffect(() => {
    if (queryDraft === filters.query) return;
    const timer = window.setTimeout(() => {
      updateSearchParams(setSearchParams, filters, { query: queryDraft, page: 1 });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [filters, queryDraft, setSearchParams]);

  useEffect(() => {
    if (hasDeprecatedFilters) return;
    const version = ++requestVersion.current;
    const controller = new AbortController();
    setLoadState('loading');
    setActionError('');
    setSelected(new Set());

    api<CardSearchResult>(buildSearchPath(filters), { signal: controller.signal })
      .then((nextResult) => {
        if (version !== requestVersion.current) return;
        const maximumPage = Math.max(1, Math.ceil(nextResult.total / filters.pageSize));
        if (filters.page > maximumPage) {
          updateSearchParams(setSearchParams, filters, { page: maximumPage });
          return;
        }
        setResult(nextResult);
        setLoadState('ready');
      })
      .catch((error: unknown) => {
        if (version !== requestVersion.current || isAbortError(error)) return;
        setLoadState('error');
      });

    return () => controller.abort();
  }, [filters, hasDeprecatedFilters, reloadKey, setSearchParams]);

  const setFilter = (patch: Partial<FilterState>) => {
    updateSearchParams(setSearchParams, filters, { ...patch, page: patch.page ?? 1 });
  };

  const submitPageDraft = (draft = pageDraft) => {
    if (!/^\d+$/.test(draft)) {
      setPageDraft(String(filters.page));
      return;
    }
    const nextPage = Math.min(totalPages, Math.max(1, Number(draft)));
    setPageDraft(String(nextPage));
    if (nextPage !== filters.page) setFilter({ page: nextPage });
  };

  const selectContentVersion = (nextVersion: CardContentVersion) => {
    if (nextVersion === contentVersion) return;
    updateSearchParams(setSearchParams, filters, { contentVersion: nextVersion, page: 1 });
  };

  const refresh = () => setReloadKey((current) => current + 1);

  const exportExcel = async () => {
    if (exporting) return;
    setExporting(true);
    setExportError('');
    try {
      const blob = await apiBlob('/api/cards/export');
      downloadBlob(blob, `gongkao-original-content-${timestampForFileName(new Date())}.xlsx`);
    } catch {
      setExportError('导出失败，请稍后重试');
    } finally {
      setExporting(false);
    }
  };

  const openDetail = (group: CardGroup, trigger: HTMLButtonElement) => {
    detailTrigger.current = trigger;
    setDetailGroup(group);
  };

  const closeDetail = useCallback(() => {
    setDetailGroup(undefined);
    detailTrigger.current?.focus();
    detailTrigger.current = null;
  }, []);

  const runAction = async (name: string, action: () => Promise<unknown>, onSuccess?: () => void) => {
    if (actionName) return;
    setActionName(name);
    setActionError('');
    try {
      await action();
      onSuccess?.();
      setSelected(new Set());
      refresh();
    } catch {
      setActionError('操作失败，请稍后重试');
    } finally {
      setActionName('');
    }
  };

  const bulkUpdate = (name: string, update: BulkCardUpdateInput, onSuccess?: () => void) =>
    runAction(name, () =>
      api<{ updated: number }>('/api/cards/bulk', {
        method: 'PATCH',
        body: JSON.stringify({ ids: [...selected], ...update }),
      }),
      onSuccess,
    );

  const setCardArchived = (cardId: string, archived: boolean) =>
    runAction(`${archived ? 'archive' : 'restore'}:${cardId}`, () =>
      api<CardDetail>(`/api/cards/${cardId}`, {
        method: 'PATCH',
        body: JSON.stringify({ archived }),
      }),
      () => {
        setArchiveUndo(archived ? { ids: [cardId], message: '已归档 1 张卡片' } : undefined);
      },
    );

  const retryCardAi = (cardId: string) =>
    runAction(`retry-ai:${cardId}`, () =>
      api<CardDetail>(`/api/cards/${cardId}/retry-ai`, {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    );

  const bulkSetArchived = (archived: boolean) => {
    const ids = [...selected];
    return bulkUpdate(
      archived ? 'bulk-archive' : 'bulk-restore',
      { archived },
      () => {
        setArchiveUndo(archived ? { ids, message: `已归档 ${ids.length} 张卡片` } : undefined);
      },
    );
  };

  const undoArchive = (ids: string[]) =>
    runAction('undo-archive', () =>
      api<{ updated: number }>('/api/cards/bulk', {
        method: 'PATCH',
        body: JSON.stringify({ ids, archived: false }),
      }),
      () => setArchiveUndo(undefined),
    );

  const setCardsArchived = (cards: CardDetail[], archived: boolean) => {
    const ids = cards.map(({ id }) => id);
    if (ids.length === 1) return setCardArchived(ids[0], archived);
    return runAction(
      (archived ? 'archive' : 'restore') + ':' + ids[0],
      () => api<{ updated: number }>('/api/cards/bulk', {
        method: 'PATCH',
        body: JSON.stringify({ ids, archived }),
      }),
      () => setArchiveUndo(archived ? { ids, message: '已归档 ' + ids.length + ' 张卡片' } : undefined),
    );
  };

  const exportAnki = async () => {
    if (ankiExporting) return;
    setAnkiExporting(true);
    setAnkiExportNotice('');
    setAnkiExportError('');
    try {
      const result = await api<AnkiExportResult>('/api/anki/exports', {
        method: 'POST',
        body: JSON.stringify(selected.size > 0 ? { cardIds: [...selected] } : {}),
      });
      if (result.status === 'empty') {
        setAnkiExportNotice('当前没有可导出的卡片');
        return;
      }
      const blob = await apiBlob(`/api/anki/exports/${result.export.id}/apkg`);
      downloadBlob(blob, result.export.apkgFileName);
      setAnkiExportNotice(`已导出 ${result.export.count} 张卡片`);
    } catch {
      setAnkiExportError('Anki 导出失败，请稍后重试');
    } finally {
      setAnkiExporting(false);
    }
  };

  const sendCardAnki = async (card: CardDetail) => {
    if (ankiSendingCardId) return;
    setAnkiSendingCardId(card.id);
    setAnkiSendNotice('');
    setAnkiSendError('');
    try {
      const result = await api<AnkiCardSendResult>(`/api/anki/cards/${card.id}/send`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setAnkiSendNotice(`已发送“${card.normalizedStatement || '用户初始稿'}” Anki 到手机`);
      return result;
    } catch (error: unknown) {
      setAnkiSendError(
        error instanceof ApiError
          ? error.message
          : 'Anki 发送失败，请确认 cc-connect 已连接手机',
      );
    } finally {
      setAnkiSendingCardId('');
    }
  };

  const openHistory = (trigger: HTMLButtonElement) => {
    historyTrigger.current = trigger;
    setHistoryOpen(true);
  };

  const closeHistory = useCallback(() => {
    historyTrigger.current?.focus();
    historyTrigger.current = null;
    setHistoryOpen(false);
  }, []);

  const setCardsPosition = (cards: CardDetail[], position: 'top' | 'bottom') =>
    runAction(
      `position:${position}:${cards[0]?.id}`,
      () => api<{ updated: number }>('/api/cards/bulk', {
        method: 'PATCH',
        body: JSON.stringify({ ids: cards.map(({ id }) => id), position }),
      }),
    );

  const retryCardsAi = (cards: CardDetail[]) => {
    if (cards.length === 1) return retryCardAi(cards[0].id);
    return runAction(
      'retry-ai:' + cards[0].id,
      () => Promise.all(cards.map(({ id }) => api<CardDetail>('/api/cards/' + id + '/retry-ai', {
        method: 'POST',
        body: JSON.stringify({}),
      }))),
    );
  };

  const deleteCards = (cards: CardDetail[]) => {
    const title = cards[0]?.normalizedStatement || '待生成知识点';
    const suffix = cards.length > 1 ? '（连同 ' + (cards.length - 1) + ' 张衍生卡片）' : '';
    if (!window.confirm('确认彻底删除“' + title + '”' + suffix + '？此操作不可撤销。')) return;
    void runAction(
      'delete:' + cards[0]?.id,
      () => Promise.all(cards.map(({ id }) => api<void>('/api/cards/' + id, { method: 'DELETE' }))),
    );
  };
  const createFolder = async (name: string) => {
    if (folderActionName) return false;
    setFolderActionName('create-folder');
    setFolderActionError('');
    try {
      const created = await api<CardFolderSummary>('/api/cards/folders', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      setFolders((current) => [...current, created]);
      setFolderListState('ready');
      return true;
    } catch {
      setFolderActionError('创建文件夹失败，请稍后重试');
      return false;
    } finally {
      setFolderActionName('');
    }
  };

  const toggleFolder = (folderId: string) => {
    setFolderActionError('');
    if (activeFolderId === folderId) {
      folderContentRequestVersion.current += 1;
      activeFolderIdRef.current = undefined;
      setActiveFolderId(undefined);
      setActiveFolderContents(undefined);
      setFolderContentState('ready');
      setFolderContentError('');
      return;
    }
    activeFolderIdRef.current = folderId;
    setActiveFolderId(folderId);
    setActiveFolderContents(undefined);
    void loadFolderContents(folderId);
  };

  const deleteFolder = async (folder: CardFolderSummary) => {
    if (folderActionName) return;
    if (!window.confirm(`确认删除文件夹“${folder.name}”？只删除文件夹，不会删除卡片。`)) return;
    setFolderActionName('delete-folder:' + folder.id);
    setFolderActionError('');
    try {
      await api<void>('/api/cards/folders/' + folder.id, { method: 'DELETE' });
      setFolders((current) => current.filter(({ id }) => id !== folder.id));
      if (activeFolderId === folder.id) {
        folderContentRequestVersion.current += 1;
        activeFolderIdRef.current = undefined;
        setActiveFolderId(undefined);
        setActiveFolderContents(undefined);
        setFolderContentState('ready');
        setFolderContentError('');
      }
    } catch {
      setFolderActionError('删除文件夹失败，请稍后重试');
    } finally {
      setFolderActionName('');
    }
  };

  const addCardsToFolder = async (folderId: string, cardIds: string[]) => {
    if (folderActionName) return;
    setFolderActionName('add-folder:' + folderId);
    setFolderActionError('');
    try {
      await api<CardFolderSummary>(`/api/cards/folders/${folderId}/cards`, {
        method: 'POST',
        body: JSON.stringify({ cardIds }),
      });
      const refreshes: Array<Promise<void>> = [loadFolders()];
      const currentFolderId = activeFolderIdRef.current;
      if (currentFolderId) refreshes.push(loadFolderContents(currentFolderId));
      await Promise.all(refreshes);
    } catch {
      setFolderActionError('加入文件夹失败，请稍后重试');
    } finally {
      setFolderActionName('');
    }
  };

  const removeCardsFromFolder = async (folderId: string, cards: CardDetail[]) => {
    if (folderActionName || cards.length === 0) return;
    setFolderActionName('remove-folder-card:' + cards[0].id);
    setFolderActionError('');
    try {
      await api<CardFolderSummary>(`/api/cards/folders/${folderId}/cards`, {
        method: 'DELETE',
        body: JSON.stringify({ cardIds: cards.map(({ id }) => id) }),
      });
      await Promise.all([loadFolders(), loadFolderContents(folderId)]);
    } catch {
      setFolderActionError('移出文件夹失败，请稍后重试');
    } finally {
      setFolderActionName('');
    }
  };

  const totalPages = Math.max(1, Math.ceil((result?.total ?? 0) / filters.pageSize));
  const visibleGroups = useMemo(
    () => contentVersion === 'original'
      ? groupCards(result?.items ?? [])
      : (result?.items ?? []).map(cardToGroup),
    [contentVersion, result?.items],
  );
  const activeFolderGroups = useMemo(
    () => groupCards(activeFolderContents?.cards ?? []),
    [activeFolderContents?.cards],
  );

  useEffect(() => () => {
    if (locateHighlightTimer.current !== undefined) {
      window.clearTimeout(locateHighlightTimer.current);
    }
  }, []);

  useEffect(() => {
    if (!locateTargetIds || loadState !== 'ready') return;
    const targetIdSet = new Set(locateTargetIds);
    const targetGroup = visibleGroups.find((group) => group.cards.some(({ id }) => targetIdSet.has(id)));
    if (!targetGroup) return;
    const target = document.getElementById('card-library-' + targetGroup.card.id);
    if (!target) return;

    const nextLocatedIds = new Set(targetGroup.cards.map(({ id }) => id));
    setLocatedCardIds(nextLocatedIds);
    target.scrollIntoView({
      behavior: document.documentElement.dataset.motion === 'reduced' ? 'auto' : 'smooth',
      block: 'center',
    });
    target.focus({ preventScroll: true });
    if (locateHighlightTimer.current !== undefined) {
      window.clearTimeout(locateHighlightTimer.current);
    }
    locateHighlightTimer.current = window.setTimeout(() => {
      setLocatedCardIds(new Set());
      locateHighlightTimer.current = undefined;
    }, 1800);
    setLocateTargetIds(undefined);
  }, [loadState, locateTargetIds, visibleGroups]);

  const locateFolderGroup = (group: CardFolderCardGroup) => {
    const cardIds = group.cards.map(({ id }) => id);
    const visibleCardIds = new Set(visibleGroups.flatMap(({ cards }) => cards.map(({ id }) => id)));
    setLocateTargetIds(cardIds);
    if (cardIds.some((id) => visibleCardIds.has(id))) return;

    const query = group.card.rawInput.trim() || group.card.normalizedStatement.trim();
    setQueryDraft(query);
    setLoadState('loading');
    updateSearchParams(setSearchParams, filters, {
      aiStatus: '',
      archived: group.card.archived ? 'true' : 'false',
      categoryIds: [],
      contentVersion: 'original',
      createdFrom: '',
      createdTo: '',
      page: 1,
      query,
      tagIds: [],
    });
  };

  return (
    <section className="page cards-page">
      <header className="page__header cards-page__header">
        <div>
          <h1 className="page__title">卡片库</h1>
          <span className="cards-page__count">
            {contentVersion === 'original'
              ? `当前页 ${visibleGroups.length} 份初始稿 · 共 ${result?.total ?? 0} 份`
              : `共 ${result?.total ?? 0} 张`}
          </span>
        </div>
        <div className="cards-page__actions">
          <button
            className="button button--secondary cards-export-button liquid-pressable"
            disabled={exporting}
            onClick={() => void exportExcel()}
            type="button"
          >
            {exporting ? <LoaderCircle aria-hidden="true" className="is-spinning" size={17} /> : <Download aria-hidden="true" size={17} />}
            导出原始内容
          </button>
          <button
            aria-label={selected.size > 0 ? `导出 Anki，已选 ${selected.size} 张卡片` : '导出 Anki'}
            className="button button--secondary cards-export-button liquid-pressable"
            disabled={ankiExporting}
            onClick={() => void exportAnki()}
            type="button"
          >
            {ankiExporting ? <LoaderCircle aria-hidden="true" className="is-spinning" size={17} /> : <Download aria-hidden="true" size={17} />}
            导出 Anki
            {selected.size > 0 ? <span aria-hidden="true" className="cards-export-button__count">{selected.size}</span> : null}
          </button>
          <button
            className="button button--secondary cards-export-button liquid-pressable"
            onClick={(event) => openHistory(event.currentTarget)}
            type="button"
          >
            <History aria-hidden="true" size={17} />
            导出记录
          </button>
          <button
            aria-label="重新加载"
            className="cards-icon-button liquid-pressable"
            disabled={loadState === 'loading'}
            onClick={refresh}
            title="重新加载"
            type="button"
          >
            <RefreshCw aria-hidden="true" className={loadState === 'loading' ? 'is-spinning' : undefined} size={17} />
          </button>
        </div>
      </header>

      <div className="cards-filters liquid-glass liquid-glass--regular" aria-label="卡片筛选">
        <label className="cards-filter cards-filter--search">
          <span>搜索</span>
          <div className="cards-filter__search-control">
            <Search aria-hidden="true" size={16} />
            <input
              aria-label="搜索卡片"
              onChange={(event) => setQueryDraft(event.target.value)}
              placeholder="知识点、原文、解析或标签"
              value={queryDraft}
            />
          </div>
        </label>
        <FilterTextInput
          label="板块编号"
          onChange={(value) => setFilter({ categoryIds: splitNames(value) })}
          placeholder="逗号分隔"
          value={filters.categoryIds.join('，')}
        />
        <FilterTextInput
          label="标签编号"
          onChange={(value) => setFilter({ tagIds: splitNames(value) })}
          placeholder="逗号分隔精确 ID"
          value={filters.tagIds.join('，')}
        />
        <FilterSelect label="AI 状态筛选" onChange={(aiStatus) => setFilter({ aiStatus })} value={filters.aiStatus}>
          <option value="">全部 AI 状态</option>
          {Object.entries(aiStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </FilterSelect>
        <FilterSelect label="归档状态筛选" onChange={(archived) => setFilter({ archived })} value={filters.archived}>
          <option value="false">未归档</option>
          <option value="true">已归档</option>
        </FilterSelect>
        <FilterDate label="录入开始日期" onChange={(createdFrom) => setFilter({ createdFrom })} value={filters.createdFrom} />
        <FilterDate label="录入结束日期" onChange={(createdTo) => setFilter({ createdTo })} value={filters.createdTo} />
        <FilterSelect label="每页数量" onChange={(pageSize) => setFilter({ pageSize: Number(pageSize) })} value={String(filters.pageSize)}>
          {[20, 50, 100].map((size) => <option key={size} value={size}>{size} 条</option>)}
        </FilterSelect>
      </div>

      <div aria-label="内容版本" className="cards-content-version liquid-glass liquid-glass--thin" role="group">
        <button
          aria-pressed={contentVersion === 'optimized'}
          className={`liquid-pressable${contentVersion === 'optimized' ? ' is-selected' : ''}`}
          onClick={() => selectContentVersion('optimized')}
          type="button"
        >
          AI 优化稿
        </button>
        <button
          aria-pressed={contentVersion === 'original'}
          className={`liquid-pressable${contentVersion === 'original' ? ' is-selected' : ''}`}
          onClick={() => selectContentVersion('original')}
          type="button"
        >
          用户初始稿
        </button>
        <button
          aria-pressed="false"
          className="liquid-pressable"
          onClick={() => {
            const next = new URLSearchParams(searchParams);
            next.set('contentVersion', 'shenlun');
            setSearchParams(next);
          }}
          type="button"
        >
          申论复盘
        </button>
      </div>
      {contentVersion === 'original' ? (
        <CardFolderShelf
          actionError={folderActionError}
          actionName={folderActionName}
          activeFolderId={activeFolderId}
          activeGroups={activeFolderGroups}
          contentError={folderContentError}
          contentState={folderContentState}
          folders={folders}
          listError={folderListError}
          listState={folderListState}
          onAddCards={(folderId, cardIds) => void addCardsToFolder(folderId, cardIds)}
          onCreate={createFolder}
          onDelete={(folder) => void deleteFolder(folder)}
          onDetail={openDetail}
          onLocate={locateFolderGroup}
          onRemoveCards={(folderId, cardIds) => {
            const cards = activeFolderGroups
              .flatMap((group) => group.cards)
              .filter(({ id }) => cardIds.includes(id));
            void removeCardsFromFolder(folderId, cards);
          }}
          onToggle={toggleFolder}
        />
      ) : null}
      {selected.size > 0 ? (
        <div className="cards-bulk liquid-glass liquid-glass--regular" aria-label="批量操作">
          <strong>已选 {selected.size} 张</strong>
          <label className="cards-bulk__tags">
            <span className="sr-only">批量标签</span>
            <input aria-label="批量标签" disabled={Boolean(actionName)} onChange={(event) => setBulkTags(event.target.value)} placeholder="逗号分隔标签" value={bulkTags} />
          </label>
          <button className="liquid-pressable" disabled={Boolean(actionName) || splitNames(bulkTags).length === 0} onClick={() => void bulkUpdate('bulk-tags', { tags: splitNames(bulkTags) })} type="button">批量添加标签</button>
          <button className="liquid-pressable" disabled={Boolean(actionName)} onClick={() => void bulkSetArchived(filters.archived !== 'true')} type="button">
            {filters.archived === 'true' ? '批量恢复归档' : '批量归档'}
          </button>
        </div>
      ) : null}

      {archiveUndo ? (
        <div className="cards-action-success" role="status">
          <span>{archiveUndo.message}</span>
          <button className="liquid-pressable" disabled={Boolean(actionName)} onClick={() => void undoArchive(archiveUndo.ids)} type="button">撤销归档</button>
        </div>
      ) : null}

      {actionError ? <div className="cards-action-error" role="alert">{actionError}</div> : null}
      {exportError ? <div className="cards-action-error" role="alert">{exportError}</div> : null}
      {ankiExportError ? <div className="cards-action-error" role="alert">{ankiExportError}</div> : null}
      {ankiExportNotice ? <div className="cards-action-success" role="status">{ankiExportNotice}</div> : null}
      {ankiSendingCardId || ankiSendError || ankiSendNotice ? createPortal(
        <div
          aria-live={ankiSendError ? 'assertive' : 'polite'}
          className={`cards-anki-send-feedback liquid-glass liquid-glass--regular${ankiSendError ? ' cards-anki-send-feedback--error' : ''}`}
          role={ankiSendError ? 'alert' : 'status'}
        >
          {ankiSendingCardId ? (
            <LoaderCircle aria-hidden="true" className="is-spinning" size={19} />
          ) : ankiSendError ? (
            <CircleAlert aria-hidden="true" size={19} />
          ) : (
            <CircleCheck aria-hidden="true" size={19} />
          )}
          <span>
            {ankiSendingCardId
              ? '正在生成并发送 Anki 卡片…'
              : ankiSendError || ankiSendNotice}
          </span>
          {!ankiSendingCardId ? (
            <button
              aria-label="关闭 Anki 发送提示"
              className="cards-anki-send-feedback__close liquid-pressable"
              onClick={() => {
                setAnkiSendError('');
                setAnkiSendNotice('');
              }}
              title="关闭"
              type="button"
            >
              <X aria-hidden="true" size={17} />
            </button>
          ) : null}
        </div>,
        document.body,
      ) : null}

      {loadState === 'loading' ? <StatusNotice state="loading" message="正在加载卡片" /> : null}
      {loadState === 'error' ? (
        <div className="cards-state">
          <StatusNotice state="error" message="卡片加载失败，请稍后重试" />
          <button className="button button--secondary liquid-pressable" onClick={refresh} type="button">重新加载</button>
        </div>
      ) : null}
      {loadState === 'ready' && result?.items.length === 0 ? <StatusNotice state="empty" message="暂无符合条件的卡片" /> : null}
      {loadState === 'ready' && result && result.items.length > 0 ? (
        <CardGrid
          actionName={actionName}
          canDelete={filters.archived === 'true'}
          groups={visibleGroups}
          contentVersion={contentVersion}
          folderActionName={folderActionName}
          folders={folders}
          locatedCardIds={locatedCardIds}
          onAddToFolder={(folderId, cardIds) => void addCardsToFolder(folderId, cardIds)}
          onArchivedChange={setCardsArchived}
          onDelete={deleteCards}
          onDetail={openDetail}
          onPositionChange={setCardsPosition}
          onRetryAi={retryCardsAi}
          onSendAnki={(card) => void sendCardAnki(card)}
          onSelect={(cardIds, checked) => setSelected((current) => toggleSet(current, cardIds, checked))}
          ankiSendingCardId={ankiSendingCardId}
          selected={selected}
        />
      ) : null}

      <div className="cards-pagination liquid-glass liquid-glass--thin" aria-label="卡片分页">
        <button
          aria-label="上一页"
          className="cards-icon-button liquid-pressable"
          disabled={filters.page <= 1 || loadState === 'loading'}
          onClick={() => setFilter({ page: filters.page - 1 })}
          title="上一页"
          type="button"
        >
          <ChevronLeft aria-hidden="true" size={18} />
        </button>
        <span className="cards-pagination__status">
          <>
            <span>第 </span>
            <input
                aria-label="页码"
                className="cards-pagination__input"
                disabled={loadState === 'loading'}
                inputMode="numeric"
                onBlur={() => {
                  if (suppressPageBlur.current) {
                    suppressPageBlur.current = false;
                    return;
                  }
                  submitPageDraft();
                }}
                onChange={(event) => {
                  if (/^\d*$/.test(event.target.value)) setPageDraft(event.target.value);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    submitPageDraft(event.currentTarget.value);
                  } else if (event.key === 'Escape') {
                    event.preventDefault();
                    suppressPageBlur.current = true;
                    setPageDraft(String(filters.page));
                    event.currentTarget.blur();
                  }
                }}
                style={{ width: `calc(${Math.max(2, String(totalPages).length)}ch + 16px)` }}
                type="text"
                value={pageDraft}
            />
            {' / '}{totalPages} 页
            <span aria-hidden="true" style={{ display: 'none' }}>{`第 ${filters.page} / ${totalPages} 页`}</span>
          </>
        </span>
        <button
          aria-label="下一页"
          className="cards-icon-button liquid-pressable"
          disabled={filters.page >= totalPages || loadState === 'loading'}
          onClick={() => setFilter({ page: filters.page + 1 })}
          title="下一页"
          type="button"
        >
          <ChevronRight aria-hidden="true" size={18} />
        </button>
      </div>

      {detailGroup ? <CardDetailDrawer group={detailGroup} onClose={closeDetail} /> : null}
      {historyOpen ? <AnkiExportHistoryPanel onClose={closeHistory} /> : null}
    </section>
  );
}

function CardGrid({
  actionName,
  canDelete,
  groups,
  contentVersion,
  folderActionName,
  folders,
  locatedCardIds,
  onAddToFolder,
  onArchivedChange,
  onDelete,
  onDetail,
  onPositionChange,
  onRetryAi,
  onSendAnki,
  onSelect,
  ankiSendingCardId,
  selected,
}: {
  actionName: string;
  canDelete: boolean;
  groups: CardGroup[];
  contentVersion: CardContentVersion;
  folderActionName: string;
  folders: CardFolderSummary[];
  locatedCardIds: Set<string>;
  onAddToFolder: (folderId: string, cardIds: string[]) => void;
  onArchivedChange: (cards: CardDetail[], archived: boolean) => void;
  onDelete: (cards: CardDetail[]) => void;
  onDetail: (group: CardGroup, trigger: HTMLButtonElement) => void;
  onPositionChange: (cards: CardDetail[], position: 'top' | 'bottom') => void;
  onRetryAi: (cards: CardDetail[]) => void;
  onSendAnki: (card: CardDetail) => void;
  onSelect: (cardIds: string[], selected: boolean) => void;
  ankiSendingCardId: string;
  selected: Set<string>;
}) {
  return (
    <ul aria-label="卡片列表" className="cards-grid">
      {groups.map((group) => {
        const card = group.card;
        const title = card.normalizedStatement || '待生成知识点';
        const content = contentVersion === 'original'
          ? card.rawInput || '未填写原始内容'
          : title;
        const groupIds = group.cards.map(({ id }) => id);
        const groupIdSet = new Set(groupIds);
        const assignedFolders = contentVersion === 'original'
          ? folders.filter((folder) => folder.cardIds.some((id) => groupIdSet.has(id)))
          : [];
        const groupSelected = groupIds.every((id) => selected.has(id));
        const isLocated = groupIds.some((id) => locatedCardIds.has(id));
        const isDerivedGroup = group.cards.length > 1;
        const groupWrongCount = Math.max(...group.cards.map(({ wrongCount }) => wrongCount));
        const editPath = contentVersion === 'original'
          ? card.archived ? undefined : `/entry?editOriginal=${encodeURIComponent(card.id)}`
          : isDerivedGroup ? undefined : `/entry?edit=${encodeURIComponent(card.id)}`;
        const editLabel = contentVersion === 'original' ? '编辑初始稿' : '编辑';
        return (
          <li
            className={`cards-card liquid-glass liquid-glass--regular${isLocated ? ' is-located' : ''}`}
            draggable={contentVersion === 'original' ? true : undefined}
            id={'card-library-' + card.id}
            key={card.id}
            onDragStart={contentVersion === 'original'
              ? (event) => {
                event.dataTransfer.effectAllowed = 'copy';
                event.dataTransfer.setData(CARD_GROUP_DRAG_TYPE, JSON.stringify(groupIds));
              }
              : undefined}
            tabIndex={-1}
          >
            <div className="cards-card__preview">
              <div className="cards-card__status">
                <span>{contentVersion === 'original' ? '用户初始稿' : 'AI 优化稿'}</span>
                {isDerivedGroup ? <span className="cards-card__group-count">衍生 {group.cards.length} 个问题</span> : null}
                {card.aiStatus !== 'ready' ? <span className={'cards-status cards-status--' + card.aiStatus}>{aiStatusLabels[card.aiStatus]}</span> : null}
              </div>
              {assignedFolders.length > 0 ? (
                <div
                  aria-label={'已加入文件夹：' + assignedFolders.map(({ name }) => name).join('、')}
                  className="cards-card__folder-memberships"
                >
                  <FolderCheck aria-hidden="true" size={14} />
                  {assignedFolders.map((folder) => (
                    <span className="cards-card__folder-chip" key={folder.id}>{folder.name}</span>
                  ))}
                </div>
              ) : null}
              <h2 className="cards-card__title" title={content}>
                {contentVersion === 'optimized'
                  ? <MathText text={content} />
                  : <RichTextPreview contentJson={card.rawContentJson} fallback={content} />}
              </h2>
            </div>
            <dl className="cards-card__meta">
              <div>
                <dt>板块</dt>
                <dd>{primaryCategoryNames(card).join('、') || '未分类'}</dd>
              </div>
              <div>
                <dt>{isDerivedGroup ? '最高不会标注' : '不会标注'}</dt>
                <dd><span aria-label={'不会标注 ' + groupWrongCount + ' 次'}>{groupWrongCount} 次</span></dd>
              </div>
              <div>
                <dt>下次复习</dt>
                <dd>{nextDueText(card)}</dd>
              </div>
            </dl>
            <div className="cards-card__footer">
              <label className="cards-card__select liquid-pressable">
                <input
                  aria-label={'选择' + title}
                  checked={groupSelected}
                  onChange={(event) => onSelect(groupIds, event.target.checked)}
                  type="checkbox"
                />
                <span>选择</span>
              </label>
              {contentVersion === 'original' && folders.length > 0 ? (
                <label className="cards-folder-picker">
                  <FolderPlus aria-hidden="true" size={16} />
                  <select
                    aria-label={'将' + title + '加入文件夹'}
                    disabled={Boolean(folderActionName)}
                    onChange={(event) => {
                      const folderId = event.currentTarget.value;
                      if (folderId) onAddToFolder(folderId, groupIds);
                    }}
                    title="加入文件夹"
                    value=""
                  >
                    <option value="">加入文件夹</option>
                    {folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
                  </select>
                </label>
              ) : null}
              <div className="cards-row-actions">
                <button aria-label={'查看' + title + '详情'} className="liquid-pressable" onClick={(event) => onDetail(group, event.currentTarget)} title="查看详情" type="button"><Eye aria-hidden="true" size={16} /></button>
                {contentVersion === 'original' ? (
                  <button
                    aria-label={'发送' + title + ' Anki 到手机'}
                    className="liquid-pressable"
                    disabled={Boolean(actionName) || Boolean(ankiSendingCardId) || card.archived || card.aiStatus !== 'ready'}
                    onClick={() => onSendAnki(card)}
                    title={card.archived || card.aiStatus !== 'ready' ? '完成 AI 整理后可发送' : '发送 Anki 到手机'}
                    type="button"
                  >
                    {ankiSendingCardId === card.id ? <LoaderCircle aria-hidden="true" className="is-spinning" size={16} /> : <Send aria-hidden="true" size={16} />}
                  </button>
                ) : null}
                <button
                  aria-label={'置顶' + title}
                  className="liquid-pressable"
                  disabled={Boolean(actionName)}
                  onClick={() => onPositionChange(group.cards, 'top')}
                  title={'置顶' + title}
                  type="button"
                >
                  {actionName === 'position:top:' + card.id ? <LoaderCircle aria-hidden="true" className="is-spinning" size={16} /> : <ArrowUpToLine aria-hidden="true" size={16} />}
                </button>
                <button
                  aria-label={'置底' + title}
                  className="liquid-pressable"
                  disabled={Boolean(actionName)}
                  onClick={() => onPositionChange(group.cards, 'bottom')}
                  title={'置底' + title}
                  type="button"
                >
                  {actionName === 'position:bottom:' + card.id ? <LoaderCircle aria-hidden="true" className="is-spinning" size={16} /> : <ArrowDownToLine aria-hidden="true" size={16} />}
                </button>
                {!isDerivedGroup && canRetryAi(card) ? (
                  <button
                    aria-label={'AI 修复' + title}
                    className="liquid-pressable"
                    disabled={Boolean(actionName)}
                    onClick={() => onRetryAi(group.cards)}
                    title="AI 修复"
                    type="button"
                  >
                    {actionName === 'retry-ai:' + card.id ? <LoaderCircle aria-hidden="true" className="is-spinning" size={16} /> : <RefreshCw aria-hidden="true" size={16} />}
                  </button>
                ) : null}
                {editPath ? <Link aria-label={editLabel + title} className="liquid-pressable" title={editLabel} to={editPath}><Pencil aria-hidden="true" size={16} /></Link> : null}
                <button
                  aria-label={(card.archived ? '恢复归档' : '归档') + title}
                  className="liquid-pressable"
                  disabled={Boolean(actionName)}
                  onClick={() => onArchivedChange(group.cards, !card.archived)}
                  title={card.archived ? '恢复归档' : '归档'}
                  type="button"
                >
                  {card.archived ? <ArchiveRestore aria-hidden="true" size={16} /> : <Archive aria-hidden="true" size={16} />}
                </button>
                {canDelete ? <button aria-label={'彻底删除' + title} className="liquid-pressable" disabled={Boolean(actionName)} onClick={() => onDelete(group.cards)} title={'彻底删除' + title} type="button"><Trash2 aria-hidden="true" size={16} /></button> : null}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
function canRetryAi(card: CardDetail) {
  return card.aiStatus === 'pending' || card.aiStatus === 'needs_input';
}

function AnkiExportHistoryPanel({ onClose }: { onClose: () => void }) {
  const [historyState, setHistoryState] = useState<LoadState>('loading');
  const [exports, setExports] = useState<AnkiExportSummary[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const [detailState, setDetailState] = useState<LoadState>('ready');
  const [detail, setDetail] = useState<AnkiExportDetail>();
  const [selectedExport, setSelectedExport] = useState<AnkiExportSummary>();
  const [downloadingId, setDownloadingId] = useState('');
  const [downloadError, setDownloadError] = useState('');
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const entranceAnimationRef = useRef<{ stop: () => void } | null>(null);
  const detailRequestVersion = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    setHistoryState('loading');
    api<AnkiExportSummary[]>('/api/anki/exports', { signal: controller.signal })
      .then((items) => {
        setExports(items);
        setHistoryState('ready');
      })
      .catch((error: unknown) => {
        if (isAbortError(error)) return;
        setHistoryState('error');
      });
    return () => controller.abort();
  }, [reloadKey]);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const setOffset = (value: number) => {
      panel.style.transform = `translate3d(0, ${value}px, 0)`;
    };
    if (shouldReduceDrawerMotion()) {
      setOffset(0);
      panel.dataset.motionPhase = 'idle';
      return;
    }

    setOffset(48);
    let completed = false;
    const finish = () => {
      if (completed) return;
      completed = true;
      entranceAnimationRef.current = null;
      setOffset(0);
      panel.dataset.motionPhase = 'idle';
    };
    try {
      const controls = animate(48, 0, {
        ...momentumSpring,
        onUpdate: setOffset,
        onComplete: finish,
      });
      if (!completed) entranceAnimationRef.current = controls;
    } catch {
      finish();
    }
    return () => {
      entranceAnimationRef.current?.stop();
      entranceAnimationRef.current = null;
    };
  }, []);

  useEffect(() => {
    const dialog = panelRef.current;
    if (!dialog) return;
    const focusableElements = () => Array.from(dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ));
    const initialFocus = focusableElements()[0] ?? dialog;
    initialFocus.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const elements = focusableElements();
      if (elements.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = elements[0];
      const last = elements[elements.length - 1];
      const activeElement = document.activeElement;
      if (event.shiftKey && (activeElement === first || !dialog.contains(activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (activeElement === last || !dialog.contains(activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      detailRequestVersion.current += 1;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    const body = document.body;
    const previousOverflow = body.style.overflow;
    const previousPaddingRight = body.style.paddingRight;
    const viewportWidth = document.documentElement.clientWidth;
    const scrollbarWidth = viewportWidth > 0
      ? Math.max(0, window.innerWidth - viewportWidth)
      : 0;
    const currentPaddingRight = Number.parseFloat(window.getComputedStyle(body).paddingRight) || 0;

    body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${currentPaddingRight + scrollbarWidth}px`;
    }
    return () => {
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPaddingRight;
    };
  }, []);

  const loadDetail = async (summary: AnkiExportSummary) => {
    const version = ++detailRequestVersion.current;
    setSelectedExport(summary);
    setDetail(undefined);
    setDetailState('loading');
    setDownloadError('');
    try {
      const nextDetail = await api<AnkiExportDetail>(`/api/anki/exports/${summary.id}`);
      if (version !== detailRequestVersion.current) return;
      setDetail(nextDetail);
      setDetailState('ready');
    } catch {
      if (version !== detailRequestVersion.current) return;
      setDetailState('error');
    }
  };

  const downloadExport = async (summary: AnkiExportSummary) => {
    if (downloadingId) return;
    setDownloadingId(summary.id);
    setDownloadError('');
    try {
      const blob = await apiBlob(`/api/anki/exports/${summary.id}/apkg`);
      downloadBlob(blob, summary.apkgFileName);
    } catch {
      setDownloadError('下载失败，请稍后重试');
    } finally {
      setDownloadingId('');
    }
  };

  return createPortal(
    <div
      className="cards-anki-history-layer"
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <aside
        aria-label="Anki 导出记录"
        aria-modal="true"
        className="cards-anki-history-panel liquid-glass liquid-glass--thick"
        data-motion-phase="opening"
        ref={panelRef}
        role="dialog"
        tabIndex={-1}
      >
        <header className="cards-anki-history-panel__header">
          <div>
            <History aria-hidden="true" size={20} />
            <h2>导出记录</h2>
          </div>
          <button
            aria-label="关闭导出记录"
            className="cards-icon-button liquid-pressable"
            onClick={onClose}
            ref={closeButtonRef}
            title="关闭导出记录"
            type="button"
          >
            <X aria-hidden="true" size={18} />
          </button>
        </header>

        <div className="cards-anki-history-panel__content">
          <section aria-label="导出记录列表区" className="cards-anki-history-list-section">
            {historyState === 'loading' ? <StatusNotice state="loading" message="正在加载导出记录" /> : null}
            {historyState === 'error' ? (
              <div className="cards-anki-history-state">
                <StatusNotice state="error" message="导出记录加载失败，请稍后重试" />
                <button className="button button--secondary liquid-pressable" onClick={() => setReloadKey((value) => value + 1)} type="button">
                  重新加载导出记录
                </button>
              </div>
            ) : null}
            {historyState === 'ready' && exports.length === 0 ? <StatusNotice state="empty" message="暂无导出记录" /> : null}
            {historyState === 'ready' && exports.length > 0 ? (
              <ul aria-label="Anki 导出记录列表" className="cards-anki-history-list">
                {exports.map((item) => (
                  <li key={item.id}>
                    <button
                      aria-label={`查看${item.apkgFileName}详情`}
                      className={selectedExport?.id === item.id ? 'is-selected liquid-pressable' : 'liquid-pressable'}
                      onClick={() => void loadDetail(item)}
                      type="button"
                    >
                      <span>
                        <strong>{item.apkgFileName}</strong>
                        <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString('zh-CN')}</time>
                      </span>
                      <span>{item.count} 张卡片</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          <section aria-label="导出详情区" className="cards-anki-history-detail-section">
            {!selectedExport ? <p className="cards-anki-history-placeholder">选择一条记录查看导出内容</p> : null}
            {detailState === 'loading' ? <StatusNotice state="loading" message="正在加载导出详情" /> : null}
            {detailState === 'error' ? <StatusNotice state="error" message="导出详情加载失败，请稍后重试" /> : null}
            {detailState === 'ready' && detail ? (
              <section aria-label={`${detail.apkgFileName}详情`} className="cards-anki-history-detail">
                <header>
                  <div>
                    <h3>{detail.apkgFileName}</h3>
                    <span>{detail.count} 张卡片</span>
                  </div>
                  <button
                    aria-label={`再次下载${detail.apkgFileName}`}
                    className="button button--secondary liquid-pressable"
                    disabled={Boolean(downloadingId)}
                    onClick={() => void downloadExport(detail)}
                    type="button"
                  >
                    {downloadingId === detail.id ? <LoaderCircle aria-hidden="true" className="is-spinning" size={17} /> : <Download aria-hidden="true" size={17} />}
                    再次下载
                  </button>
                </header>
                {downloadError ? <div className="cards-action-error" role="alert">{downloadError}</div> : null}
                <ol>
                  {detail.cards.map((item) => (
                    <li key={item.id}>
                      <span className="cards-anki-history-detail__category">{item.category || '未分类'}</span>
                      <strong>{item.question}</strong>
                      <p>{item.answer}</p>
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}
          </section>
        </div>
      </aside>
    </div>,
    document.body,
  );
}

function CardDetailDrawer({ group, onClose }: { group: CardGroup; onClose: () => void }) {
  const card = group.card;
  const dialogRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const animationRef = useRef<{ stop: () => void } | null>(null);
  const closeTimerRef = useRef<number>();
  const closeCommittedRef = useRef(false);
  const offsetRef = useRef(0);
  const phaseRef = useRef<'opening' | 'idle' | 'dragging' | 'settling' | 'closing'>('opening');
  const dragRef = useRef<{
    committed: boolean;
    history: Array<{ position: number; time: number }>;
    pointerId: number;
    startOffset: number;
    startY: number;
  } | null>(null);

  const setDrawerOffset = useCallback((value: number) => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    offsetRef.current = value;
    dialog.style.transform = `translate3d(0, ${value}px, 0)`;
  }, []);

  const setPhase = (phase: typeof phaseRef.current) => {
    phaseRef.current = phase;
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.dataset.motionPhase = phase;
    if (dialog.parentElement) dialog.parentElement.dataset.motionPhase = phase;
  };

  const clearCloseTimer = () => {
    if (closeTimerRef.current === undefined) return;
    window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = undefined;
  };

  const stopAnimation = () => {
    animationRef.current?.stop();
    animationRef.current = null;
  };

  const drawerHeight = () => {
    const dialog = dialogRef.current;
    return Math.max(dialog?.getBoundingClientRect().height || dialog?.offsetHeight || 600, 1);
  };

  const animateDrawer = (
    target: number,
    velocity: number,
    phase: 'opening' | 'settling' | 'closing',
    onFinished: () => void,
  ) => {
    const currentOffset = offsetRef.current;
    stopAnimation();
    setPhase(phase);
    let completed = false;
    const finish = () => {
      if (completed) return;
      completed = true;
      animationRef.current = null;
      onFinished();
    };
    const spring = Math.abs(velocity) >= 80 ? momentumSpring : criticalSpring;
    try {
      const controls = animate(currentOffset, target, {
        ...spring,
        velocity,
        onUpdate: setDrawerOffset,
        onComplete: finish,
      });
      if (!completed) animationRef.current = controls;
    } catch {
      setDrawerOffset(target);
      finish();
    }
  };

  const releaseDragCapture = (pointerId: number) => {
    try {
      headerRef.current?.releasePointerCapture?.(pointerId);
    } catch {
      // 指针捕获可能已由浏览器释放。
    }
  };

  const finishClose = () => {
    if (closeCommittedRef.current) return;
    closeCommittedRef.current = true;
    clearCloseTimer();
    onClose();
  };

  const requestClose = (velocity = 0, height = drawerHeight()) => {
    const activeDrag = dragRef.current;
    dragRef.current = null;
    if (activeDrag) releaseDragCapture(activeDrag.pointerId);
    if (closeCommittedRef.current || phaseRef.current === 'closing') return;
    clearCloseTimer();
    stopAnimation();
    if (shouldReduceDrawerMotion()) {
      setDrawerOffset(height);
      finishClose();
      return;
    }

    const springVelocity = Math.max(-DRAWER_EXIT_VELOCITY_LIMIT, Math.min(velocity, DRAWER_EXIT_VELOCITY_LIMIT));
    animateDrawer(height, springVelocity, 'closing', finishClose);
    if (!closeCommittedRef.current) {
      closeTimerRef.current = window.setTimeout(finishClose, 520);
    }
  };

  const settleDrawer = (velocity: number, forceOpen = false) => {
    if (!dialogRef.current) return;
    const height = drawerHeight();
    const currentOffset = offsetRef.current;
    const projectedEndpoint = projectMomentum(currentOffset, velocity);
    const target = forceOpen
      ? 0
      : selectProjectedSnap(projectedEndpoint, 0, [0, height]);

    if (target === height) {
      requestClose(velocity, height);
      return;
    }
    if (shouldReduceDrawerMotion()) {
      setDrawerOffset(target);
      setPhase('idle');
      return;
    }

    animateDrawer(target, velocity, 'settling', () => {
      setDrawerOffset(0);
      setPhase('idle');
    });
  };

  const cancelActiveDrag = () => {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    releaseDragCapture(drag.pointerId);
    settleDrawer(0, true);
  };

  const beginDrag = (event: React.PointerEvent<HTMLElement>) => {
    if (!event.isPrimary || event.button !== 0 || dragRef.current || closeCommittedRef.current) return;
    if ((event.target as HTMLElement).closest('button, a, input, select, textarea, [contenteditable="true"]')) return;
    clearCloseTimer();
    stopAnimation();
    try {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    } catch {
      return;
    }
    setPhase('dragging');
    dragRef.current = {
      committed: false,
      history: [{ position: offsetRef.current, time: event.timeStamp }],
      pointerId: event.pointerId,
      startOffset: offsetRef.current,
      startY: event.clientY,
    };
  };

  const moveDrag = (event: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    const dialog = dialogRef.current;
    if (!drag || !dialog || event.pointerId !== drag.pointerId) return;
    const delta = event.clientY - drag.startY;
    if (!drag.committed) {
      if (Math.abs(delta) < 10) return;
      drag.committed = true;
    }

    event.preventDefault();
    const height = drawerHeight();
    const rawOffset = drag.startOffset + delta;
    const nextOffset = rawOffset < 0
      ? rubberBand(rawOffset, height)
      : rawOffset > height
        ? height + rubberBand(rawOffset - height, height)
        : rawOffset;
    setDrawerOffset(nextOffset);
    drag.history.push({ position: nextOffset, time: event.timeStamp });
    const cutoff = event.timeStamp - 120;
    drag.history = drag.history.filter(({ time }) => time >= cutoff).slice(-6);
  };

  const endDrag = (event: React.PointerEvent<HTMLElement>, cancelled = false) => {
    if (phaseRef.current === 'closing') return;
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    dragRef.current = null;
    releaseDragCapture(event.pointerId);

    if (!drag.committed) {
      settleDrawer(0, true);
      return;
    }
    const latestTime = event.timeStamp;
    drag.history.push({ position: offsetRef.current, time: latestTime });
    const recent = drag.history.filter(({ time }) => time >= latestTime - 120);
    const first = recent[0] ?? drag.history[0];
    const last = recent[recent.length - 1] ?? drag.history[drag.history.length - 1];
    const elapsed = Math.max(last.time - first.time, 16);
    const velocity = ((last.position - first.position) / elapsed) * 1000;
    settleDrawer(cancelled ? 0 : velocity, cancelled);
  };

  useLayoutEffect(() => {
    const height = drawerHeight();
    if (shouldReduceDrawerMotion()) {
      setDrawerOffset(0);
      setPhase('idle');
      return;
    }
    setDrawerOffset(height);
    animateDrawer(0, 0, 'opening', () => {
      setDrawerOffset(0);
      setPhase('idle');
    });
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const focusableElements = () => Array.from(dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ));
    const initialFocus = focusableElements()[0] ?? dialog;
    initialFocus.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        requestClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const elements = focusableElements();
      if (elements.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = elements[0];
      const last = elements[elements.length - 1];
      const activeElement = document.activeElement;
      if (event.shiftKey && (activeElement === first || !dialog.contains(activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (activeElement === last || !dialog.contains(activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };

    const handleWindowBlur = () => cancelActiveDrag();
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('blur', handleWindowBlur);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('blur', handleWindowBlur);
      const drag = dragRef.current;
      if (drag) releaseDragCapture(drag.pointerId);
      dragRef.current = null;
      clearCloseTimer();
      stopAnimation();
    };
  }, []);

  useEffect(() => {
    const body = document.body;
    const previousOverflow = body.style.overflow;
    const previousPaddingRight = body.style.paddingRight;
    const viewportWidth = document.documentElement.clientWidth;
    const scrollbarWidth = viewportWidth > 0
      ? Math.max(0, window.innerWidth - viewportWidth)
      : 0;
    const currentPaddingRight = Number.parseFloat(window.getComputedStyle(body).paddingRight) || 0;

    body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${currentPaddingRight + scrollbarWidth}px`;
    }
    return () => {
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPaddingRight;
    };
  }, []);

  return createPortal(
    <div className="cards-drawer-layer" data-motion-phase="opening" onMouseDown={(event) => { if (event.target === event.currentTarget) requestClose(); }}>
      <aside aria-label="卡片详情" aria-modal="true" className="cards-drawer liquid-glass liquid-glass--thick" data-motion-phase="opening" ref={dialogRef} role="dialog" tabIndex={-1}>
        <header
          className="cards-drawer__header"
          onLostPointerCapture={(event) => endDrag(event, true)}
          onPointerCancel={(event) => endDrag(event, true)}
          onPointerDown={beginDrag}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          ref={headerRef}
        >
          <div
            aria-hidden="true"
            className="cards-drawer__drag-handle"
          >
            <span />
          </div>
          <div className="cards-drawer__heading">
            <span className={`cards-status cards-status--${card.aiStatus}`}>{aiStatusLabels[card.aiStatus]}</span>
            <h2><MathText text={card.normalizedStatement || '未生成规范知识'} /></h2>
          </div>
          <button aria-label="关闭详情" className="cards-icon-button liquid-pressable" onClick={() => requestClose()} title="关闭详情" type="button"><X aria-hidden="true" size={18} /></button>
        </header>
        {group.cards.length > 1 ? (
          <section className="cards-drawer__group" aria-label="衍生问题">
            <strong>同一初始稿衍生 {group.cards.length} 个问题</strong>
            <ul>
              {group.cards.map(({ id, normalizedStatement }) => <li key={id}>{normalizedStatement || '待生成知识点'}</li>)}
            </ul>
          </section>
        ) : null}
        <QuizItemsPreview cards={group.cards} />
        <DetailField label="原始输入" renderMath={false} value={card.rawInput} />
        <DetailField label="错误选项或易错点" value={card.wrongPoint} />
        <DetailField label="正确解析" value={card.analysis} />
        <DetailField label="记忆速记口诀" value={card.mnemonic} />
        <DetailField label="同类拓展知识点" value={card.extension} />
        <DetailField label="补充笔记" value={card.notes} />
        <dl className="cards-drawer__meta">
          <div><dt>板块</dt><dd>{card.categories.map(({ name }) => name).join('、') || '未分类'}</dd></div>
          <div><dt>标签</dt><dd>{card.tags.map(({ name }) => name).join('、') || '无'}</dd></div>
          <div><dt>来源</dt><dd>{[card.sourceType, card.sourceDetail].filter(Boolean).join(' · ') || '未填写'}</dd></div>
          <div><dt>附件</dt><dd>{card.attachments.map(({ originalName }) => originalName).join('、') || '无'}</dd></div>
          <div><dt>不会标注次数</dt><dd>{card.wrongCount} 次</dd></div>
        </dl>
      </aside>
    </div>,
    document.body,
  );
}

function QuizItemsPreview({ cards }: { cards: CardDetail[] }) {
  const items = cards.flatMap(({ id: cardId, quizItems }) => quizItems.map((item) => ({ ...item, cardId })));
  if (items.length === 0) return null;

  return (
    <section aria-label="AI 优化题目与答案" className="cards-drawer__quiz">
      <h3>AI 优化题目与答案</h3>
      <ol>
        {items.map(({ answer, cardId, id, question }, index) => (
          <li key={`${cardId}:${id}`}>
            <div>
              <span>问题 {index + 1}</span>
              <p><MathText text={question} /></p>
            </div>
            <div className="cards-drawer__quiz-answer">
              <span>答案</span>
              <p><MathText text={answer} /></p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function shouldReduceDrawerMotion() {
  return document.documentElement.dataset.motion === 'reduced'
    || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

function DetailField({ label, renderMath = true, value }: {
  label: string;
  renderMath?: boolean;
  value: string;
}) {
  return (
    <section className="cards-drawer__field">
      <h3>{label}</h3>
      <p>{renderMath ? <MathText text={value || '未填写'} /> : value || '未填写'}</p>
    </section>
  );
}

function FilterTextInput({ label, onChange, placeholder, value }: { label: string; onChange: (value: string) => void; placeholder: string; value: string }) {
  const [draft, setDraft] = useState(value);
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setDraft(value);
  }, [value]);

  return (
    <label className="cards-filter">
      <span>{label}</span>
      <input
        aria-label={label}
        onBlur={(event) => {
          focused.current = false;
          setDraft(splitNames(event.currentTarget.value).join('，'));
        }}
        onChange={(event) => {
          setDraft(event.target.value);
          onChange(event.target.value);
        }}
        onFocus={() => { focused.current = true; }}
        placeholder={placeholder}
        value={draft}
      />
    </label>
  );
}

function FilterDate({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) {
  return (
    <label className="cards-filter cards-filter--date">
      <span>{label}</span>
      <input aria-label={label} onChange={(event) => onChange(event.target.value)} type="date" value={value} />
    </label>
  );
}

function FilterSelect({ children, label, onChange, value }: { children: React.ReactNode; label: string; onChange: (value: string) => void; value: string }) {
  return (
    <label className="cards-filter">
      <span>{label}</span>
      <select aria-label={label} onChange={(event) => onChange(event.target.value)} value={value}>{children}</select>
    </label>
  );
}

function readFilters(searchParams: URLSearchParams): FilterState {
  return {
    contentVersion: searchParams.get('contentVersion') === 'original' ? 'original' : 'optimized',
    query: searchParams.get('query') ?? '',
    categoryIds: searchParams.getAll('categoryIds').filter(Boolean),
    tagIds: searchParams.getAll('tagIds').filter(Boolean),
    aiStatus: searchParams.get('aiStatus') ?? '',
    archived: searchParams.get('archived') === 'true' ? 'true' : 'false',
    createdFrom: searchParams.get('createdFrom') ?? '',
    createdTo: searchParams.get('createdTo') ?? '',
    page: positiveInteger(searchParams.get('page'), 1),
    pageSize: positiveInteger(searchParams.get('pageSize'), 20),
  };
}

function updateSearchParams(
  setSearchParams: ReturnType<typeof useSearchParams>[1],
  current: FilterState,
  patch: Partial<FilterState>,
) {
  const next = { ...current, ...patch };
  const params = new URLSearchParams();
  params.set('contentVersion', next.contentVersion);
  if (next.query) params.set('query', next.query);
  next.categoryIds.forEach((id) => params.append('categoryIds', id));
  next.tagIds.forEach((id) => params.append('tagIds', id));
  if (next.aiStatus) params.set('aiStatus', next.aiStatus);
  params.set('archived', next.archived);
  if (next.createdFrom) params.set('createdFrom', next.createdFrom);
  if (next.createdTo) params.set('createdTo', next.createdTo);
  params.set('page', String(next.page));
  params.set('pageSize', String(next.pageSize));
  setSearchParams(params, { replace: true });
}

function buildSearchPath(filters: FilterState) {
  const params = new URLSearchParams();
  params.set('contentVersion', filters.contentVersion);
  params.set('query', filters.query);
  filters.categoryIds.forEach((id) => params.append('categoryIds', id));
  filters.tagIds.forEach((id) => params.append('tagIds', id));
  if (filters.aiStatus) params.set('aiStatus', filters.aiStatus);
  params.set('archived', filters.archived);
  if (filters.createdFrom) params.set('createdFrom', filters.createdFrom);
  if (filters.createdTo) params.set('createdTo', filters.createdTo);
  params.set('page', String(filters.page));
  params.set('pageSize', String(filters.pageSize));
  return `/api/cards?${params.toString()}`;
}

function splitNames(value: string) {
  return [...new Set(value.split(/[，,\n]/).map((item) => item.trim()).filter(Boolean))];
}

function cardToGroup(card: CardDetail): CardGroup {
  return { card, cards: [card] };
}

function groupCards(cards: CardDetail[]): CardGroup[] {
  const groups = new Map<string, CardGroup>();
  for (const card of cards) {
    const key = sourceGroupKey(card);
    const existing = groups.get(key);
    if (existing) {
      existing.cards.push(card);
    } else {
      groups.set(key, { card, cards: [card] });
    }
  }
  return [...groups.values()];
}

function sourceGroupKey(card: CardDetail) {
  const rawInput = card.rawInput.trim();
  if (card.rawContentJson?.trim()) {
    try {
      const parsed: unknown = JSON.parse(card.rawContentJson);
      if (typeof parsed === 'object' && parsed !== null) {
        return 'json:' + JSON.stringify(parsed);
      }
    } catch {
      // 无法解析富文本时回退到原始纯文本。
    }
  }
  if (rawInput) return 'text:' + rawInput;
  return 'card:' + card.id;
}

function toggleSet(current: Set<string>, values: string[], selected: boolean) {
  const next = new Set(current);
  for (const value of values) {
    if (selected) next.add(value);
    else next.delete(value);
  }
  return next;
}

function primaryCategoryNames(card: CardDetail) {
  return card.categories.filter(({ parentId }) => parentId === null).map(({ name }) => name);
}

function nextDueText(card: CardDetail) {
  if (card.quizItems.length === 0) return '无题面';
  const dueAt = card.quizItems.reduce((earliest, item) => item.dueAt < earliest ? item.dueAt : earliest, card.quizItems[0].dueAt);
  return new Date(dueAt).toLocaleDateString('zh-CN');
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function timestampForFileName(value: Date) {
  const iso = value.toISOString();
  return `${iso.slice(0, 10).replaceAll('-', '')}-${iso.slice(11, 19).replaceAll(':', '')}`;
}

function positiveInteger(value: string | null, fallback: number) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError';
}
