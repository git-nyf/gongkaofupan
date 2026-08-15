import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Archive,
  ArchiveRestore,
  Eye,
  FilePlus2,
  Link2,
  LoaderCircle,
  Pencil,
  Pin,
  PinOff,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ShenlunReviewDetail, ShenlunReviewSummary } from '../../shared/contracts';
import { api } from '../api/client';
import { parseShenlunNotes } from '../shenlun/notes';
import '../styles/shenlun-library.css';

export function ShenlunReviewLibrary() {
  const [reviews, setReviews] = useState<ShenlunReviewSummary[] | null>(null);
  const [listError, setListError] = useState(false);
  const [selectedReview, setSelectedReview] = useState<ShenlunReviewSummary | null>(null);
  const [detail, setDetail] = useState<ShenlunReviewDetail | null>(null);
  const [detailError, setDetailError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [query, setQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [actionKey, setActionKey] = useState('');
  const [actionError, setActionError] = useState('');
  const previewRequestRef = useRef(0);
  const previewTriggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    let active = true;
    const path = showArchived
      ? '/api/shenlun-reviews?archived=true'
      : '/api/shenlun-reviews';
    void api<ShenlunReviewSummary[]>(path)
      .then((nextReviews) => {
        if (active) setReviews(nextReviews);
      })
      .catch(() => {
        if (active) setListError(true);
      });
    return () => {
      active = false;
    };
  }, [reloadKey, showArchived]);

  const closePreview = useCallback(() => {
    previewRequestRef.current += 1;
    setSelectedReview(null);
    setDetail(null);
    setDetailError(false);
  }, []);

  const openPreview = useCallback(async (
    review: ShenlunReviewSummary,
    trigger: HTMLButtonElement,
  ) => {
    const requestId = previewRequestRef.current + 1;
    previewRequestRef.current = requestId;
    previewTriggerRef.current = trigger;
    setSelectedReview(review);
    setDetail(null);
    setDetailError(false);
    try {
      const nextDetail = await api<ShenlunReviewDetail>(`/api/shenlun-reviews/${review.id}`);
      if (previewRequestRef.current === requestId) setDetail(nextDetail);
    } catch {
      if (previewRequestRef.current === requestId) setDetailError(true);
    }
  }, []);

  const filteredReviews = useMemo(() => {
    const terms = query.trim().toLocaleLowerCase('zh-CN').split(/\s+/u).filter(Boolean);
    if (terms.length === 0) return reviews ?? [];
    return (reviews ?? []).filter((review) => {
      const searchableText = `${review.title} ${review.excerpt} ${review.template}字模板`
        .toLocaleLowerCase('zh-CN')
        .replace(/\s+/gu, '');
      return terms.every((term) => searchableText.includes(term));
    });
  }, [query, reviews]);

  const selectArchiveView = useCallback((archived: boolean) => {
    if (archived === showArchived) return;
    setShowArchived(archived);
    setReviews(null);
    setListError(false);
    setQuery('');
    setActionError('');
  }, [showArchived]);

  const updateReviewState = useCallback(async (
    review: ShenlunReviewSummary,
    patch: { pinned?: boolean; archived?: boolean },
  ) => {
    const key = `${Object.keys(patch)[0]}:${review.id}`;
    setActionKey(key);
    setActionError('');
    try {
      const updated = await api<ShenlunReviewDetail>(`/api/shenlun-reviews/${review.id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      setReviews((current) => {
        if (!current) return current;
        const next = current
          .map((item) => item.id === review.id ? {
            ...item,
            pinned: updated.pinned,
            archived: updated.archived,
            updatedAt: updated.updatedAt,
          } : item)
          .filter((item) => item.archived === showArchived);
        return sortReviewSummaries(next);
      });
    } catch {
      setActionError('申论复盘操作失败，请重试');
    } finally {
      setActionKey('');
    }
  }, [showArchived]);

  if (listError) {
    return (
      <div className="shenlun-library__status" role="alert">
        <span>暂时无法加载申论复盘</span>
        <button
          aria-label="重新加载申论复盘"
          className="button button--secondary liquid-pressable"
          onClick={() => {
            setListError(false);
            setReviews(null);
            setReloadKey((current) => current + 1);
          }}
          type="button"
        >
          <RefreshCw aria-hidden="true" size={16} />
          重新加载
        </button>
      </div>
    );
  }

  if (reviews === null) {
    return (
      <div className="shenlun-library__status" role="status">
        正在加载申论复盘…
      </div>
    );
  }

  return (
    <section aria-label="申论复盘卡片库" className="shenlun-library">
      <div className="shenlun-library__controls">
        <div aria-label="申论归档视图" className="shenlun-library__view-switch" role="group">
          <button
            aria-pressed={!showArchived}
            className={!showArchived ? 'is-active' : ''}
            onClick={() => selectArchiveView(false)}
            type="button"
          >
            当前
          </button>
          <button
            aria-pressed={showArchived}
            className={showArchived ? 'is-active' : ''}
            onClick={() => selectArchiveView(true)}
            type="button"
          >
            已归档
          </button>
        </div>
        {reviews.length > 0 ? (
          <div className="shenlun-library__search">
            <Search aria-hidden="true" size={18} />
            <input
              aria-label="搜索申论复盘"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索标题、正文或字数模板"
              type="search"
              value={query}
            />
            {query ? (
              <button
                aria-label="清空申论搜索"
                className="shenlun-library__search-clear liquid-pressable"
                onClick={() => setQuery('')}
                title="清空搜索"
                type="button"
              >
                <X aria-hidden="true" size={16} />
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      {actionError ? <div className="shenlun-library__action-error" role="alert">{actionError}</div> : null}
      {reviews.length === 0 ? (
        <div className="shenlun-library__empty liquid-glass liquid-glass--thin">
          <FilePlus2 aria-hidden="true" size={24} strokeWidth={1.7} />
          <div>
            <strong>{showArchived ? '还没有归档申论' : '还没有申论复盘'}</strong>
            <span>{showArchived ? '归档后的申论会出现在这里。' : '完成一篇答题后保存，复盘会出现在这里。'}</span>
          </div>
          {!showArchived ? (
            <Link className="button liquid-pressable" to="/shenlun">
              新建申论
            </Link>
          ) : null}
        </div>
      ) : filteredReviews.length > 0 ? (
        <div className="shenlun-library__grid">
          {filteredReviews.map((review) => (
            <article
              className={`shenlun-library__card liquid-glass liquid-glass--thin${review.pinned ? ' is-pinned' : ''}`}
              key={review.id}
            >
              <header className="shenlun-library__card-header">
                <h3>{review.title}</h3>
                <span>{review.template} 字模板</span>
              </header>
              <p className="shenlun-library__excerpt">{review.excerpt}</p>
              <div className="shenlun-library__meta">
                <span>实际 {review.characterCount} 字</span>
                <time dateTime={review.updatedAt}>更新于 {formatUpdatedAt(review.updatedAt)}</time>
              </div>
              <div className="shenlun-library__actions">
                <button
                  aria-label={`预览${review.title}`}
                  className="button button--secondary liquid-pressable"
                  onClick={(event) => void openPreview(review, event.currentTarget)}
                  type="button"
                >
                  <Eye aria-hidden="true" size={17} />
                  预览
                </button>
                <div className="shenlun-library__action-tools">
                  <button
                    aria-label={`${review.pinned ? '取消置顶' : '置顶'}${review.title}`}
                    className="shenlun-library__icon-action liquid-pressable"
                    disabled={Boolean(actionKey)}
                    onClick={() => void updateReviewState(review, { pinned: !review.pinned })}
                    title={review.pinned ? '取消置顶' : '置顶'}
                    type="button"
                  >
                    {actionKey === `pinned:${review.id}`
                      ? <LoaderCircle aria-hidden="true" className="is-spinning" size={16} />
                      : review.pinned ? <PinOff aria-hidden="true" size={16} /> : <Pin aria-hidden="true" size={16} />}
                  </button>
                  {!showArchived ? (
                    <Link
                      aria-label={`编辑${review.title}`}
                      className="button liquid-pressable"
                      to={`/shenlun/${review.id}`}
                    >
                      <Pencil aria-hidden="true" size={16} />
                      编辑
                    </Link>
                  ) : null}
                  <button
                    aria-label={`${review.archived ? '恢复归档' : '归档'}${review.title}`}
                    className="shenlun-library__icon-action liquid-pressable"
                    disabled={Boolean(actionKey)}
                    onClick={() => void updateReviewState(review, { archived: !review.archived })}
                    title={review.archived ? '恢复归档' : '归档'}
                    type="button"
                  >
                    {actionKey === `archived:${review.id}`
                      ? <LoaderCircle aria-hidden="true" className="is-spinning" size={16} />
                      : review.archived
                        ? <ArchiveRestore aria-hidden="true" size={16} />
                        : <Archive aria-hidden="true" size={16} />}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="shenlun-library__no-results" role="status">
          没有匹配的申论复盘
        </div>
      )}
      {selectedReview ? (
        <ReviewPreviewDrawer
          detail={detail}
          error={detailError}
          onClose={closePreview}
          review={selectedReview}
          triggerRef={previewTriggerRef}
        />
      ) : null}
    </section>
  );
}

function ReviewPreviewDrawer({
  detail,
  error,
  onClose,
  review,
  triggerRef,
}: {
  detail: ShenlunReviewDetail | null;
  error: boolean;
  onClose: () => void;
  review: ShenlunReviewSummary;
  triggerRef: React.RefObject<HTMLButtonElement>;
}) {
  const dialogRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const titleId = `shenlun-preview-title-${review.id}`;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not(:disabled), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      triggerRef.current?.focus();
    };
  }, [onClose, triggerRef]);

  return (
    <div
      className="shenlun-library__drawer-layer"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside
        aria-labelledby={titleId}
        aria-modal="true"
        className="shenlun-library__drawer liquid-glass liquid-glass--thick"
        ref={dialogRef}
        role="dialog"
      >
        <header className="shenlun-library__drawer-header">
          <div>
            <span>{review.template} 字模板</span>
            <h2 id={titleId}>复盘预览：{review.title}</h2>
          </div>
          <button
            aria-label="关闭复盘预览"
            className="shenlun-library__close liquid-pressable"
            onClick={onClose}
            ref={closeButtonRef}
            title="关闭"
            type="button"
          >
            <X aria-hidden="true" size={20} />
          </button>
        </header>

        {error ? (
          <div className="shenlun-library__detail-status" role="alert">
            暂时无法加载复盘详情
          </div>
        ) : detail ? (
          <div className="shenlun-library__drawer-content">
            <PreviewSection title="正文">
              <div className="shenlun-library__body">{renderMarkedText(detail)}</div>
            </PreviewSection>
            <PreviewSection title="标准答案">
              <p>{detail.standardAnswer || '未填写'}</p>
            </PreviewSection>
            <PreviewSection title="备注">
              <p>{detail.notes ? parseShenlunNotes(detail.notes).map((part, index) => (
                part.type === 'link' ? (
                  <a className="shenlun-library__note-link" href={part.href} key={`${part.href}-${index}`}>
                    <Link2 aria-hidden="true" size={13} />
                    {part.text}
                  </a>
                ) : <Fragment key={`${part.text}-${index}`}>{part.text}</Fragment>
              )) : '未填写'}</p>
            </PreviewSection>
            <PreviewSection title="批注">
              {detail.annotations.length > 0 ? (
                <ol className="shenlun-library__annotations">
                  {detail.annotations.map((annotation) => (
                    <li key={annotation.id}>
                      <span>“{annotation.quote}”</span>
                      <p>{annotation.body}</p>
                      {annotation.detached ? <small>原文位置已变化</small> : null}
                    </li>
                  ))}
                </ol>
              ) : (
                <p>无批注</p>
              )}
            </PreviewSection>
          </div>
        ) : (
          <div className="shenlun-library__detail-status" role="status">
            正在加载复盘详情…
          </div>
        )}
      </aside>
    </div>
  );
}

function PreviewSection({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="shenlun-library__preview-section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function renderMarkedText(detail: ShenlunReviewDetail) {
  if (!detail.text) return '未填写正文';
  const boundaries = new Set([0, detail.text.length]);
  for (const mark of detail.marks) {
    boundaries.add(mark.start);
    boundaries.add(mark.end);
  }
  const points = [...boundaries].sort((left, right) => left - right);

  return points.slice(0, -1).map((start, index) => {
    const end = points[index + 1];
    const activeMarks = detail.marks.filter((mark) => mark.start < end && mark.end > start);
    const activeTypes = new Set(activeMarks.map((mark) => mark.type));
    const color = activeMarks.find((mark) => mark.type === 'color')?.color;
    let content: ReactNode = detail.text.slice(start, end).replace(/\uE000/gu, ' ');
    if (activeTypes.has('strike')) content = <s>{content}</s>;
    if (activeTypes.has('underline')) content = <u>{content}</u>;
    if (activeTypes.has('bold')) content = <strong>{content}</strong>;
    if (color) {
      content = (
        <span className={`shenlun-library__text--${color}`} data-text-color={color}>
          {content}
        </span>
      );
    }
    return <Fragment key={`${start}-${end}`}>{content}</Fragment>;
  });
}

function formatUpdatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}/${month}/${day} ${hours}:${minutes}`;
}

function sortReviewSummaries(reviews: ShenlunReviewSummary[]) {
  return [...reviews].sort((left, right) => (
    Number(right.pinned) - Number(left.pinned)
    || right.updatedAt.localeCompare(left.updatedAt)
    || left.id.localeCompare(right.id)
  ));
}
