import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive,
  ChevronLeft,
  ChevronRight,
  Eye,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import type {
  AiStatus,
  BulkCardUpdateInput,
  CardDetail,
  CardSearchResult,
} from '../../shared/contracts';
import { api } from '../api/client';
import { StatusNotice } from '../components/StatusNotice';

type LoadState = 'loading' | 'ready' | 'error';
interface FilterState {
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

const aiStatusLabels: Record<AiStatus, string> = {
  processing: '整理中',
  ready: '已整理',
  pending: '待整理',
  needs_input: '待完善',
};

export function CardsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => readFilters(searchParams), [searchParams]);
  const [queryDraft, setQueryDraft] = useState(filters.query);
  const [result, setResult] = useState<CardSearchResult>();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [detail, setDetail] = useState<CardDetail>();
  const [bulkTags, setBulkTags] = useState('');
  const [actionName, setActionName] = useState('');
  const [actionError, setActionError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const requestVersion = useRef(0);
  const detailTrigger = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    setQueryDraft(filters.query);
  }, [filters.query]);

  useEffect(() => {
    if (queryDraft === filters.query) return;
    const timer = window.setTimeout(() => {
      updateSearchParams(setSearchParams, filters, { query: queryDraft, page: 1 });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [filters, queryDraft, setSearchParams]);

  useEffect(() => {
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
  }, [filters, reloadKey, setSearchParams]);

  const setFilter = (patch: Partial<FilterState>) => {
    updateSearchParams(setSearchParams, filters, { ...patch, page: patch.page ?? 1 });
  };

  const refresh = () => setReloadKey((current) => current + 1);

  const openDetail = (card: CardDetail, trigger: HTMLButtonElement) => {
    detailTrigger.current = trigger;
    setDetail(card);
  };

  const closeDetail = useCallback(() => {
    setDetail(undefined);
    detailTrigger.current?.focus();
    detailTrigger.current = null;
  }, []);

  const runAction = async (name: string, action: () => Promise<unknown>) => {
    if (actionName) return;
    setActionName(name);
    setActionError('');
    try {
      await action();
      setSelected(new Set());
      refresh();
    } catch {
      setActionError('操作失败，请稍后重试');
    } finally {
      setActionName('');
    }
  };

  const bulkUpdate = (name: string, update: BulkCardUpdateInput) =>
    runAction(name, () =>
      api<{ updated: number }>('/api/cards/bulk', {
        method: 'PATCH',
        body: JSON.stringify({ ids: [...selected], ...update }),
      }),
    );

  const archiveCard = (cardId: string) =>
    runAction(`archive:${cardId}`, () =>
      api<CardDetail>(`/api/cards/${cardId}`, {
        method: 'PATCH',
        body: JSON.stringify({ archived: true }),
      }),
    );

  const deleteCard = (card: CardDetail) => {
    if (!window.confirm(`确认永久删除“${card.normalizedStatement || '待生成知识点'}”？此操作不可撤销。`)) return;
    void runAction(`delete:${card.id}`, () =>
      api<void>(`/api/cards/${card.id}`, { method: 'DELETE' }),
    );
  };

  const totalPages = Math.max(1, Math.ceil((result?.total ?? 0) / filters.pageSize));

  return (
    <section className="page cards-page">
      <header className="page__header cards-page__header">
        <div>
          <h1 className="page__title">卡片库</h1>
          <span className="cards-page__count">共 {result?.total ?? 0} 张</span>
        </div>
        <button
          aria-label="重新加载"
          className="cards-icon-button"
          disabled={loadState === 'loading'}
          onClick={refresh}
          title="重新加载"
          type="button"
        >
          <RefreshCw aria-hidden="true" className={loadState === 'loading' ? 'is-spinning' : undefined} size={17} />
        </button>
      </header>

      <div className="cards-filters" aria-label="卡片筛选">
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

      {selected.size > 0 ? (
        <div className="cards-bulk" aria-label="批量操作">
          <strong>已选 {selected.size} 张</strong>
          <label>
            <span className="sr-only">批量标签</span>
            <input aria-label="批量标签" disabled={Boolean(actionName)} onChange={(event) => setBulkTags(event.target.value)} placeholder="逗号分隔标签" value={bulkTags} />
          </label>
          <button disabled={Boolean(actionName) || splitNames(bulkTags).length === 0} onClick={() => void bulkUpdate('bulk-tags', { tags: splitNames(bulkTags) })} type="button">批量添加标签</button>
          <button disabled={Boolean(actionName)} onClick={() => void bulkUpdate('bulk-archive', { archived: true })} type="button">批量归档</button>
        </div>
      ) : null}

      {actionError ? <div className="cards-action-error" role="alert">{actionError}</div> : null}

      {loadState === 'loading' ? <StatusNotice state="loading" message="正在加载卡片" /> : null}
      {loadState === 'error' ? (
        <div className="cards-state">
          <StatusNotice state="error" message="卡片加载失败，请稍后重试" />
          <button className="button button--secondary" onClick={refresh} type="button">重新加载</button>
        </div>
      ) : null}
      {loadState === 'ready' && result?.items.length === 0 ? <StatusNotice state="empty" message="暂无符合条件的卡片" /> : null}
      {loadState === 'ready' && result && result.items.length > 0 ? (
        <CardTable
          actionName={actionName}
          cards={result.items}
          onArchive={archiveCard}
          onDelete={deleteCard}
          onDetail={openDetail}
          onSelect={(cardId, checked) => setSelected((current) => toggleSet(current, cardId, checked))}
          selected={selected}
        />
      ) : null}

      <div className="cards-pagination" aria-label="卡片分页">
        <button
          aria-label="上一页"
          className="cards-icon-button"
          disabled={filters.page <= 1 || loadState === 'loading'}
          onClick={() => setFilter({ page: filters.page - 1 })}
          title="上一页"
          type="button"
        >
          <ChevronLeft aria-hidden="true" size={18} />
        </button>
        <span>{loadState === 'loading' ? '加载中' : `第 ${filters.page} / ${totalPages} 页`}</span>
        <button
          aria-label="下一页"
          className="cards-icon-button"
          disabled={filters.page >= totalPages || loadState === 'loading'}
          onClick={() => setFilter({ page: filters.page + 1 })}
          title="下一页"
          type="button"
        >
          <ChevronRight aria-hidden="true" size={18} />
        </button>
      </div>

      {detail ? <CardDetailDrawer card={detail} onClose={closeDetail} /> : null}
    </section>
  );
}

function CardTable({
  actionName,
  cards,
  onArchive,
  onDelete,
  onDetail,
  onSelect,
  selected,
}: {
  actionName: string;
  cards: CardDetail[];
  onArchive: (cardId: string) => void;
  onDelete: (card: CardDetail) => void;
  onDetail: (card: CardDetail, trigger: HTMLButtonElement) => void;
  onSelect: (cardId: string, selected: boolean) => void;
  selected: Set<string>;
}) {
  return (
    <div className="cards-table-wrap">
      <table className="cards-table">
        <colgroup>
          <col className="cards-table__select" />
          <col className="cards-table__knowledge" />
          <col className="cards-table__category" />
          <col className="cards-table__wrong" />
          <col className="cards-table__due" />
          <col className="cards-table__actions" />
        </colgroup>
        <thead>
          <tr>
            {['选择', '知识点', '板块', '不会标注', '下次复习', '操作'].map((label) => <th key={label} scope="col">{label}</th>)}
          </tr>
        </thead>
        <tbody>
          {cards.map((card) => {
            const title = card.normalizedStatement || '待生成知识点';
            return (
              <tr key={card.id}>
                <td>
                  <input
                    aria-label={`选择${title}`}
                    checked={selected.has(card.id)}
                    onChange={(event) => onSelect(card.id, event.target.checked)}
                    type="checkbox"
                  />
                </td>
                <td>
                  <div className="cards-table__knowledge-main" title={title}>{title}</div>
                  {card.aiStatus !== 'ready' ? <span className={`cards-status cards-status--${card.aiStatus}`}>{aiStatusLabels[card.aiStatus]}</span> : null}
                </td>
                <td>{primaryCategoryNames(card).join('、') || '未分类'}</td>
                <td><span aria-label={`不会标注 ${card.wrongCount} 次`}>{card.wrongCount}</span></td>
                <td>{nextDueText(card)}</td>
                <td>
                  <div className="cards-row-actions">
                    <button aria-label={`查看${title}详情`} onClick={(event) => onDetail(card, event.currentTarget)} title="查看详情" type="button"><Eye aria-hidden="true" size={16} /></button>
                    <Link aria-label={`编辑${title}`} title="编辑" to={`/entry?edit=${encodeURIComponent(card.id)}`}><Pencil aria-hidden="true" size={16} /></Link>
                    <button aria-label={`归档${title}`} disabled={Boolean(actionName)} onClick={() => onArchive(card.id)} title="归档" type="button"><Archive aria-hidden="true" size={16} /></button>
                    <button aria-label={`删除${title}`} disabled={Boolean(actionName)} onClick={() => onDelete(card)} title="删除" type="button"><Trash2 aria-hidden="true" size={16} /></button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CardDetailDrawer({ card, onClose }: { card: CardDetail; onClose: () => void }) {
  const dialogRef = useRef<HTMLElement>(null);

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
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="cards-drawer-layer" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside aria-label="卡片详情" aria-modal="true" className="cards-drawer" ref={dialogRef} role="dialog" tabIndex={-1}>
        <header>
          <div>
            <span className={`cards-status cards-status--${card.aiStatus}`}>{aiStatusLabels[card.aiStatus]}</span>
            <h2>{card.normalizedStatement || '未生成规范知识'}</h2>
          </div>
          <button aria-label="关闭详情" className="cards-icon-button" onClick={onClose} title="关闭详情" type="button"><X aria-hidden="true" size={18} /></button>
        </header>
        <DetailField label="原始输入" value={card.rawInput} />
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
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <section className="cards-drawer__field">
      <h3>{label}</h3>
      <p>{value || '未填写'}</p>
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

function toggleSet(current: Set<string>, value: string, selected: boolean) {
  const next = new Set(current);
  if (selected) next.add(value);
  else next.delete(value);
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

function positiveInteger(value: string | null, fallback: number) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError';
}
