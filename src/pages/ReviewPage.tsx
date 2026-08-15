import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent as ReactClipboardEvent,
  type CSSProperties,
  type DragEvent as ReactDragEvent,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { animate } from 'motion';
import {
  Archive,
  ArchiveRestore,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  ImagePlus,
  Images,
  LoaderCircle,
  Minus,
  Plus,
  RotateCcw,
  Settings2,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import { api, apiForm } from '../api/client';
import {
  criticalSpring,
  momentumSpring,
  rubberBand,
  selectProjectedSnap,
} from '../motion/liquidMotion';
import '../styles/review.css';

interface ReviewImage {
  id: string;
  sectionId: string;
  url: string;
  originalName: string;
  mimeType: string;
  byteSize: number;
  createdAt: string;
}

interface ReviewSection {
  id: string;
  name: string;
  hidden: boolean;
  createdAt: string;
}

interface ReviewBoard {
  id: string;
  name: string;
  hidden: boolean;
  createdAt: string;
  sections: ReviewSection[];
}

interface ReviewImageResponse {
  items: ReviewImage[];
  boards: ReviewBoard[];
}

const acceptedImageTypes = new Set(['image/png', 'image/jpeg', 'image/webp']);
const emptyReviewImages: ReviewImage[] = [];
const carouselHysteresis = 10;
const velocityHistoryWindow = 120;
const carouselSettleTimeout = 1000;

type CarouselGestureState = 'idle' | 'pressed' | 'dragging' | 'settling';

interface CarouselPointer {
  id: number;
  startX: number;
  originX: number;
  lastX: number;
  step: number;
  committed: boolean;
  history: Array<{ x: number; time: number }>;
}

export function ReviewPage() {
  const [{ items, activeBySection }, setLibrary] = useState<{
    items: ReviewImage[];
    activeBySection: Record<string, string | null>;
  }>({ items: [], activeBySection: {} });
  const [boards, setBoards] = useState<ReviewBoard[]>([]);
  const [selectedByBoard, setSelectedByBoard] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [reviewAnchorId, setReviewAnchorId] = useState<string | null>(null);
  const reviewAnchorHandledRef = useRef<string | null>(null);
  const [loadError, setLoadError] = useState('');
  const [uploadingSectionId, setUploadingSectionId] = useState<string | null>(null);
  const [deletingImageIds, setDeletingImageIds] = useState<Set<string>>(() => new Set());
  const deletingImageIdsRef = useRef<Set<string>>(new Set());
  const [sectionErrors, setSectionErrors] = useState<Record<string, string>>({});
  const [boardError, setBoardError] = useState('');
  const [newBoardName, setNewBoardName] = useState('');
  const [newSectionNames, setNewSectionNames] = useState<Record<string, string>>({});
  const [pendingMutations, setPendingMutations] = useState<Set<string>>(() => new Set());
  const [boardOrderPending, setBoardOrderPending] = useState(false);
  const [sectionOrderPendingBoardIds, setSectionOrderPendingBoardIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [collapsedBoardIds, setCollapsedBoardIds] = useState<Set<string>>(() => new Set());
  const [managerOpen, setManagerOpen] = useState(false);
  const [managerFocusVersion, setManagerFocusVersion] = useState(0);
  const managerToggleRef = useRef<HTMLButtonElement | null>(null);
  const boardOrderFocusRef = useRef<HTMLButtonElement | null>(null);
  const sectionOrderFocusRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [viewerItem, setViewerItem] = useState<ReviewImage | null>(null);
  const [viewerScale, setViewerScale] = useState(1);
  const viewerTriggerRef = useRef<HTMLElement | null>(null);

  const closeViewer = useCallback(() => setViewerItem(null), []);

  useEffect(() => {
    let cancelled = false;

    api<ReviewImageResponse>('/api/review-images')
      .then(({ items: loadedItems, boards: loadedBoards }) => {
        if (cancelled) return;
        setLibrary({
          items: loadedItems,
          activeBySection: firstImageBySection(loadedItems),
        });
        setBoards(loadedBoards);
        setSelectedByBoard(firstVisibleSectionByBoard(loadedBoards));
      })
      .catch(() => {
        if (!cancelled) setLoadError('错题图片加载失败，请稍后重试');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (loading) return;
    const imageId = reviewImageIdFromHash();
    if (!imageId || reviewAnchorHandledRef.current === imageId) return;
    const targetItem = items.find(({ id }) => id === imageId);
    if (!targetItem) return;
    const targetBoard = boards.find((board) => (
      !board.hidden && board.sections.some((section) => (
        section.id === targetItem.sectionId && !section.hidden
      ))
    ));
    const targetSection = targetBoard?.sections.find(({ id, hidden }) => (
      id === targetItem.sectionId && !hidden
    ));
    if (!targetBoard || !targetSection) return;

    reviewAnchorHandledRef.current = imageId;
    setCollapsedBoardIds((current) => {
      if (!current.has(targetBoard.id)) return current;
      const next = new Set(current);
      next.delete(targetBoard.id);
      return next;
    });
    setSelectedByBoard((current) => (
      current[targetBoard.id] === targetSection.id
        ? current
        : { ...current, [targetBoard.id]: targetSection.id }
    ));
    setLibrary((current) => (
      current.activeBySection[targetSection.id] === targetItem.id
        ? current
        : {
            ...current,
            activeBySection: {
              ...current.activeBySection,
              [targetSection.id]: targetItem.id,
            },
          }
    ));
    setReviewAnchorId(imageId);
  }, [boards, items, loading]);

  useEffect(() => {
    if (!reviewAnchorId) return undefined;
    const frame = requestAnimationFrame(() => {
      document.getElementById(`review-item-${reviewAnchorId}`)?.scrollIntoView?.({
        behavior: 'smooth',
        block: 'center',
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [activeBySection, collapsedBoardIds, reviewAnchorId, selectedByBoard]);

  useEffect(() => {
    if (!viewerItem) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeViewer();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
      viewerTriggerRef.current?.focus();
    };
  }, [closeViewer, viewerItem]);

  useEffect(() => {
    if (managerFocusVersion > 0) managerToggleRef.current?.focus();
  }, [managerFocusVersion]);

  useEffect(() => {
    if (boardOrderPending) return;
    const control = boardOrderFocusRef.current;
    boardOrderFocusRef.current = null;
    if (document.activeElement === document.body) focusOrderControl(control);
  }, [boardOrderPending]);

  useEffect(() => {
    let controlToRestore: HTMLButtonElement | null = null;
    for (const [boardId, control] of sectionOrderFocusRefs.current) {
      if (sectionOrderPendingBoardIds.has(boardId)) continue;
      controlToRestore = control;
      sectionOrderFocusRefs.current.delete(boardId);
    }
    if (document.activeElement === document.body) focusOrderControl(controlToRestore);
  }, [sectionOrderPendingBoardIds]);

  const visibleBoards = useMemo(() => boards.filter(({ hidden }) => !hidden), [boards]);
  const archivedBoards = useMemo(() => boards.filter(({ hidden }) => hidden), [boards]);
  const itemsBySection = useMemo(() => indexImagesBySection(items), [items]);
  const archivedSections = useMemo(() => boards.flatMap((board) => (
    board.hidden
      ? []
      : board.sections
        .filter(({ hidden }) => hidden)
        .map((section) => ({ board, section }))
  )), [boards]);

  const setSectionError = (sectionId: string, message: string) => {
    setSectionErrors((current) => ({ ...current, [sectionId]: message }));
  };

  const selectSection = (boardId: string, sectionId: string) => {
    setSelectedByBoard((current) => ({ ...current, [boardId]: sectionId }));
  };

  const toggleBoard = (boardId: string) => {
    setCollapsedBoardIds((current) => {
      const next = new Set(current);
      if (next.has(boardId)) next.delete(boardId);
      else next.add(boardId);
      return next;
    });
  };

  const setActiveImage = (sectionId: string, imageId: string | null) => {
    setLibrary((current) => ({
      ...current,
      activeBySection: { ...current.activeBySection, [sectionId]: imageId },
    }));
  };

  const beginMutation = (key: string) => {
    setPendingMutations((current) => {
      const next = new Set(current);
      next.add(key);
      return next;
    });
  };

  const endMutation = (key: string) => {
    setPendingMutations((current) => {
      if (!current.has(key)) return current;
      const next = new Set(current);
      next.delete(key);
      return next;
    });
  };

  const focusManager = () => setManagerFocusVersion((current) => current + 1);

  const moveBoard = async (boardId: string, direction: -1 | 1) => {
    if (boardOrderPending) return;
    const reorderedBoards = moveActiveItem(boards, boardId, direction);
    if (!reorderedBoards) return;
    const previousIds = boards.map(({ id }) => id);
    setBoardOrderPending(true);
    setBoardError('');
    setBoards(reorderedBoards);
    try {
      const { boards: updatedBoards } = await api<{ boards: ReviewBoard[] }>(
        '/api/review-boards/order',
        {
          method: 'PUT',
          body: JSON.stringify({ ids: reorderedBoards.map(({ id }) => id) }),
        },
      );
      setBoards(updatedBoards);
    } catch {
      setBoards((current) => orderItemsByIds(current, previousIds));
      setBoardError('大板块排序失败，请稍后重试');
    } finally {
      setBoardOrderPending(false);
    }
  };

  const moveSection = async (boardId: string, sectionId: string, direction: -1 | 1) => {
    if (sectionOrderPendingBoardIds.has(boardId)) return;
    const board = boards.find(({ id }) => id === boardId);
    if (!board) return;
    const reorderedSections = moveActiveItem(board.sections, sectionId, direction);
    if (!reorderedSections) return;
    const previousIds = board.sections.map(({ id }) => id);
    setSectionOrderPendingBoardIds((current) => new Set(current).add(boardId));
    setBoardError('');
    setBoards((current) => current.map((candidate) => (
      candidate.id === boardId ? { ...candidate, sections: reorderedSections } : candidate
    )));
    try {
      const { board: updatedBoard } = await api<{ board: ReviewBoard }>(
        `/api/review-boards/${boardId}/sections/order`,
        {
          method: 'PUT',
          body: JSON.stringify({ ids: reorderedSections.map(({ id }) => id) }),
        },
      );
      setBoards((current) => current.map((candidate) => (
        candidate.id === boardId ? updatedBoard : candidate
      )));
    } catch {
      setBoards((current) => current.map((candidate) => (
        candidate.id === boardId
          ? { ...candidate, sections: orderItemsByIds(candidate.sections, previousIds) }
          : candidate
      )));
      setBoardError('小板块排序失败，请稍后重试');
    } finally {
      setSectionOrderPendingBoardIds((current) => {
        const next = new Set(current);
        next.delete(boardId);
        return next;
      });
    }
  };

  const uploadFiles = useCallback(async (sectionId: string, files: File[]) => {
    if (uploadingSectionId) return;
    const supportedFiles = files.filter(({ type }) => acceptedImageTypes.has(type));
    if (supportedFiles.length === 0) {
      setSectionError(sectionId, '仅支持 PNG、JPEG 或 WebP 图片');
      return;
    }

    setUploadingSectionId(sectionId);
    setSectionError(sectionId, '');
    const formData = new FormData();
    for (const file of supportedFiles) formData.append('image', file);

    try {
      const response = await apiForm<{ items: ReviewImage[] }>(
        `/api/review-images?sectionId=${encodeURIComponent(sectionId)}`,
        formData,
      );
      setLibrary((current) => {
        const currentIds = new Set(current.items.map(({ id }) => id));
        const newActive = response.items.find(({ id }) => !currentIds.has(id)) ?? response.items[0];
        return {
          items: mergeImages(current.items, response.items),
          activeBySection: newActive
            ? { ...current.activeBySection, [sectionId]: newActive.id }
            : current.activeBySection,
        };
      });
    } catch {
      setSectionError(sectionId, '图片上传失败，请稍后重试');
    } finally {
      setUploadingSectionId(null);
    }
  }, [uploadingSectionId]);

  const deleteImage = async (sectionId: string, imageId: string) => {
    if (deletingImageIdsRef.current.size > 0) return;
    deletingImageIdsRef.current.add(imageId);
    setDeletingImageIds(new Set(deletingImageIdsRef.current));
    setSectionError(sectionId, '');
    try {
      await api<void>(`/api/review-images/${imageId}`, { method: 'DELETE' });
      setLibrary((current) => {
        const sectionItems = current.items.filter((item) => item.sectionId === sectionId);
        const deletedIndex = sectionItems.findIndex(({ id }) => id === imageId);
        const nextItems = current.items.filter(({ id }) => id !== imageId);
        const remainingInSection = nextItems.filter((item) => item.sectionId === sectionId);
        const currentActiveId = current.activeBySection[sectionId];
        const currentActiveSurvives = remainingInSection.some(({ id }) => id === currentActiveId);
        return {
          items: nextItems,
          activeBySection: {
            ...current.activeBySection,
            [sectionId]: currentActiveSurvives
              ? currentActiveId ?? null
              : remainingInSection[
                Math.min(Math.max(0, deletedIndex), remainingInSection.length - 1)
              ]?.id ?? null,
          },
        };
      });
    } catch {
      setSectionError(sectionId, '删除失败，请稍后重试');
    } finally {
      deletingImageIdsRef.current.delete(imageId);
      setDeletingImageIds(new Set(deletingImageIdsRef.current));
    }
  };

  const createBoard = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = newBoardName.trim();
    if (!name) {
      setBoardError('请输入大板块名称');
      return;
    }
    const mutationKey = 'new-board';
    beginMutation(mutationKey);
    setBoardError('');
    try {
      const { board } = await api<{ board: ReviewBoard }>('/api/review-boards', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      setBoards((current) => [...current, board]);
      setNewBoardName('');
    } catch {
      setBoardError('新增大板块失败，请检查名称后重试');
    } finally {
      endMutation(mutationKey);
    }
  };

  const createSection = async (board: ReviewBoard, event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = (newSectionNames[board.id] ?? '').trim();
    if (!name) {
      setBoardError(`请输入${board.name}的小板块名称`);
      return;
    }
    const mutationKey = `new-section:${board.id}`;
    beginMutation(mutationKey);
    setBoardError('');
    try {
      const { section } = await api<{ section: ReviewSection }>(
        `/api/review-boards/${board.id}/sections`,
        { method: 'POST', body: JSON.stringify({ name }) },
      );
      setBoards((current) => current.map((candidate) => (
        candidate.id === board.id
          ? { ...candidate, sections: [...candidate.sections, section] }
          : candidate
      )));
      setNewSectionNames((current) => ({ ...current, [board.id]: '' }));
      selectSection(board.id, section.id);
    } catch {
      setBoardError('新增小板块失败，请检查名称后重试');
    } finally {
      endMutation(mutationKey);
    }
  };

  const setBoardHidden = async (board: ReviewBoard, hidden: boolean) => {
    const mutationKey = `board:${board.id}`;
    beginMutation(mutationKey);
    setBoardError('');
    try {
      const { board: updatedBoard } = await api<{ board: ReviewBoard }>(
        `/api/review-boards/${board.id}`,
        { method: 'PATCH', body: JSON.stringify({ hidden }) },
      );
      setBoards((current) => current.map((candidate) => (
        candidate.id === updatedBoard.id ? updatedBoard : candidate
      )));
      focusManager();
    } catch {
      setBoardError('大板块归档状态更新失败，请稍后重试');
    } finally {
      endMutation(mutationKey);
    }
  };

  const setSectionHidden = async (
    board: ReviewBoard,
    section: ReviewSection,
    hidden: boolean,
  ) => {
    const mutationKey = `section:${section.id}`;
    beginMutation(mutationKey);
    setBoardError('');
    try {
      const { section: updatedSection } = await api<{ section: ReviewSection }>(
        `/api/review-sections/${section.id}`,
        { method: 'PATCH', body: JSON.stringify({ hidden }) },
      );
      setBoards((current) => current.map((candidate) => (
        candidate.id === board.id
          ? {
              ...candidate,
              sections: candidate.sections.map((existing) => (
                existing.id === updatedSection.id ? updatedSection : existing
              )),
            }
          : candidate
      )));
      if (hidden) {
        setSelectedByBoard((current) => {
          if (current[board.id] !== section.id) return current;
          const replacement = board.sections.find(({ id, hidden: sectionHidden }) => (
            id !== section.id && !sectionHidden
          ));
          if (replacement) return { ...current, [board.id]: replacement.id };
          const next = { ...current };
          delete next[board.id];
          return next;
        });
      }
      focusManager();
    } catch {
      setBoardError('小板块归档状态更新失败，请稍后重试');
    } finally {
      endMutation(mutationKey);
    }
  };

  const openViewer = (item: ReviewImage) => {
    viewerTriggerRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    setViewerScale(1);
    setViewerItem(item);
  };

  return (
    <section className="page review-page">
      <header className="review-page__header">
        <div>
          <span>REVIEW ARCHIVE</span>
          <h1>错题积累</h1>
        </div>
        <p>{items.length} 张错题</p>
      </header>

      <form className="review-page__add-board liquid-glass liquid-glass--thin" onSubmit={(event) => void createBoard(event)}>
        <label>
          <span>新大板块名称</span>
          <input
            aria-label="新大板块名称"
            className="liquid-glass__nested"
            maxLength={20}
            placeholder="例如：数量关系"
            value={newBoardName}
            onChange={(event) => setNewBoardName(event.currentTarget.value)}
          />
        </label>
        <button className="liquid-glass__nested liquid-pressable" disabled={pendingMutations.has('new-board')} type="submit">
          <Plus aria-hidden="true" size={16} />
          新增大板块
        </button>
      </form>

      {boardError ? <p className="review-page__error" role="alert">{boardError}</p> : null}

      {loading ? (
        <div className="review-page__loading" role="status">
          <LoaderCircle aria-hidden="true" className="is-spinning" size={24} />
          正在整理错题影像
        </div>
      ) : loadError ? (
        <div className="review-page__loading review-page__loading--error" role="alert">
          {loadError}
        </div>
      ) : visibleBoards.length === 0 ? (
        <div className="review-page__no-boards">
          暂无使用中的大板块，可在管理板块的已归档区恢复或新建
        </div>
      ) : (
        <div className="review-board-list">
          {visibleBoards.map((board) => {
            const visibleSections = board.sections.filter(({ hidden }) => !hidden);
            const selectedSection = visibleSections.find(
              ({ id }) => id === selectedByBoard[board.id],
            ) ?? visibleSections[0] ?? null;
            const boardImageCount = board.sections.reduce((count, section) => (
              count + (itemsBySection.get(section.id)?.length ?? 0)
            ), 0);
            const expanded = !collapsedBoardIds.has(board.id);
            const contentId = `review-board-content-${board.id}`;

            return (
              <article className="review-board liquid-glass liquid-glass--regular" key={board.id}>
                <header className="review-board__header">
                  <div>
                    <span>REVIEW BOARD</span>
                    <h2>{board.name}</h2>
                  </div>
                  <div className="review-board__header-actions">
                    <small>{boardImageCount} 张</small>
                    <button
                      aria-controls={contentId}
                      aria-expanded={expanded}
                      aria-label={`${expanded ? '收起' : '展开'}板块 ${board.name}`}
                      className="review-board__collapse liquid-pressable"
                      title={`${expanded ? '收起' : '展开'}${board.name}`}
                      type="button"
                      onClick={() => toggleBoard(board.id)}
                    >
                      {expanded
                        ? <ChevronUp aria-hidden="true" size={20} />
                        : <ChevronDown aria-hidden="true" size={20} />}
                    </button>
                  </div>
                </header>

                <div className="review-board__content" hidden={!expanded} id={contentId}>
                  {expanded ? (
                    <>
                      <form
                        className="review-board__add-section"
                        onSubmit={(event) => void createSection(board, event)}
                      >
                        <label>
                          <span>{board.name}的新小板块名称</span>
                          <input
                            aria-label={`${board.name}的新小板块名称`}
                            maxLength={20}
                            placeholder="新增小板块"
                            value={newSectionNames[board.id] ?? ''}
                            onChange={(event) => {
                              const value = event.currentTarget.value;
                              setNewSectionNames((current) => ({ ...current, [board.id]: value }));
                            }}
                          />
                        </label>
                        <button
                          className="liquid-pressable"
                          disabled={pendingMutations.has(`new-section:${board.id}`)}
                          type="submit"
                        >
                          <Plus aria-hidden="true" size={15} />
                          为{board.name}新增小板块
                        </button>
                      </form>

                      {visibleSections.length === 0 ? (
                        <div className="review-board__empty">
                          <strong>暂无可见小板块</strong>
                          <span>可直接在上方新增，或到管理板块的已归档区恢复。</span>
                        </div>
                      ) : (
                        <>
                          <div
                            aria-label={`${board.name}小板块`}
                            className="review-section-tabs"
                            role="tablist"
                          >
                            {visibleSections.map((section) => (
                              <button
                                aria-selected={selectedSection?.id === section.id}
                                className={`liquid-pressable${selectedSection?.id === section.id ? ' is-selected' : ''}`}
                                key={section.id}
                                role="tab"
                                type="button"
                                onClick={() => selectSection(board.id, section.id)}
                              >
                                {section.name}
                              </button>
                            ))}
                          </div>

                          {selectedSection ? (
                            <ReviewCarousel
                              linkTargetId={reviewAnchorId}
                              activeId={activeBySection[selectedSection.id] ?? null}
                              boardName={board.name}
                              deletingImageIds={deletingImageIds}
                              error={sectionErrors[selectedSection.id] ?? ''}
                              items={itemsBySection.get(selectedSection.id) ?? emptyReviewImages}
                              section={selectedSection}
                              uploading={uploadingSectionId === selectedSection.id}
                              uploadLocked={uploadingSectionId !== null}
                              onActiveChange={(imageId) => setActiveImage(selectedSection.id, imageId)}
                              onDelete={(imageId) => void deleteImage(selectedSection.id, imageId)}
                              onOpenViewer={openViewer}
                              onUpload={(files) => void uploadFiles(selectedSection.id, files)}
                            />
                          ) : null}
                        </>
                      )}
                    </>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <section className="review-manager liquid-glass liquid-glass--regular" aria-labelledby="review-manager-title">
        <button
          aria-expanded={managerOpen}
          className="review-manager__toggle liquid-pressable"
          ref={managerToggleRef}
          type="button"
          onClick={() => setManagerOpen((current) => !current)}
        >
          <Settings2 aria-hidden="true" size={17} />
          <span id="review-manager-title">管理板块</span>
        </button>
        {managerOpen ? (
          <div className="review-manager__content liquid-glass__nested">
            <section aria-label="使用中的板块">
              <h3>使用中的板块</h3>
              {visibleBoards.length === 0 ? <p>暂无使用中的板块</p> : visibleBoards.map((board, boardIndex) => {
                const activeSections = board.sections.filter(({ hidden }) => !hidden);
                const sectionOrderPending = sectionOrderPendingBoardIds.has(board.id);
                return (
                  <div className="review-manager__board liquid-glass__nested" key={board.id}>
                    <div>
                      <strong>{board.name}</strong>
                      <div className="review-manager__actions">
                        <div className="review-manager__order-controls">
                          <button
                            aria-label={`上移大板块 ${board.name}`}
                            className="review-manager__order-button liquid-pressable"
                            disabled={boardOrderPending || boardIndex === 0}
                            title="上移"
                            type="button"
                            onClick={(event) => {
                              boardOrderFocusRef.current = event.currentTarget;
                              void moveBoard(board.id, -1);
                            }}
                          >
                            <ArrowUp aria-hidden="true" size={17} />
                          </button>
                          <button
                            aria-label={`下移大板块 ${board.name}`}
                            className="review-manager__order-button liquid-pressable"
                            disabled={boardOrderPending || boardIndex === visibleBoards.length - 1}
                            title="下移"
                            type="button"
                            onClick={(event) => {
                              boardOrderFocusRef.current = event.currentTarget;
                              void moveBoard(board.id, 1);
                            }}
                          >
                            <ArrowDown aria-hidden="true" size={17} />
                          </button>
                        </div>
                        <button
                          aria-label={`归档大板块 ${board.name}`}
                          className="liquid-pressable"
                          disabled={pendingMutations.has(`board:${board.id}`)}
                          type="button"
                          onClick={() => void setBoardHidden(board, true)}
                        >
                          <Archive aria-hidden="true" size={15} />
                          归档
                        </button>
                      </div>
                    </div>
                    <ul aria-label={`${board.name}小板块管理`}>
                      {activeSections.map((section, sectionIndex) => (
                        <li key={section.id}>
                          <span>{section.name}</span>
                          <div className="review-manager__actions">
                            <div className="review-manager__order-controls">
                              <button
                                aria-label={`上移小板块 ${board.name}/${section.name}`}
                                className="review-manager__order-button liquid-pressable"
                                disabled={sectionOrderPending || sectionIndex === 0}
                                title="上移"
                                type="button"
                                onClick={(event) => {
                                  sectionOrderFocusRefs.current.set(board.id, event.currentTarget);
                                  void moveSection(board.id, section.id, -1);
                                }}
                              >
                                <ArrowUp aria-hidden="true" size={16} />
                              </button>
                              <button
                                aria-label={`下移小板块 ${board.name}/${section.name}`}
                                className="review-manager__order-button liquid-pressable"
                                disabled={sectionOrderPending || sectionIndex === activeSections.length - 1}
                                title="下移"
                                type="button"
                                onClick={(event) => {
                                  sectionOrderFocusRefs.current.set(board.id, event.currentTarget);
                                  void moveSection(board.id, section.id, 1);
                                }}
                              >
                                <ArrowDown aria-hidden="true" size={16} />
                              </button>
                            </div>
                            <button
                              aria-label={`归档小板块 ${board.name}/${section.name}`}
                              className="liquid-pressable"
                              disabled={pendingMutations.has(`section:${section.id}`)}
                              type="button"
                              onClick={() => void setSectionHidden(board, section, true)}
                            >
                              <Archive aria-hidden="true" size={14} />
                              归档
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </section>

            <section aria-label="已归档板块">
              <h3>已归档</h3>
              {archivedBoards.length === 0 && archivedSections.length === 0 ? (
                <p>暂无已归档板块</p>
              ) : null}
              {archivedBoards.map((board) => (
                <div className="review-manager__board liquid-glass__nested" key={board.id}>
                  <div>
                    <strong>{board.name}</strong>
                    <button
                      aria-label={`恢复大板块 ${board.name}`}
                      className="liquid-pressable"
                      disabled={pendingMutations.has(`board:${board.id}`)}
                      type="button"
                      onClick={() => void setBoardHidden(board, false)}
                    >
                      <ArchiveRestore aria-hidden="true" size={15} />
                      恢复
                    </button>
                  </div>
                </div>
              ))}
              {archivedSections.map(({ board, section }) => (
                <div className="review-manager__board liquid-glass__nested" key={section.id}>
                  <div>
                    <strong>{board.name} / {section.name}</strong>
                    <button
                      aria-label={`恢复小板块 ${board.name}/${section.name}`}
                      className="liquid-pressable"
                      disabled={pendingMutations.has(`section:${section.id}`)}
                      type="button"
                      onClick={() => void setSectionHidden(board, section, false)}
                    >
                      <ArchiveRestore aria-hidden="true" size={14} />
                      恢复
                    </button>
                  </div>
                </div>
              ))}
            </section>
          </div>
        ) : null}
      </section>

      {viewerItem ? createPortal(
        <ImageViewer
          item={viewerItem}
          scale={viewerScale}
          onClose={closeViewer}
          onScaleChange={setViewerScale}
        />,
        document.body,
      ) : null}
    </section>
  );
}

interface ReviewCarouselProps {
  activeId: string | null;
  boardName: string;
  deletingImageIds: ReadonlySet<string>;
  error: string;
  items: ReviewImage[];
  linkTargetId: string | null;
  section: ReviewSection;
  uploading: boolean;
  uploadLocked: boolean;
  onActiveChange: (imageId: string | null) => void;
  onDelete: (imageId: string) => void;
  onOpenViewer: (item: ReviewImage) => void;
  onUpload: (files: File[]) => void;
}

function ReviewCarousel({
  activeId,
  boardName,
  deletingImageIds,
  error,
  items,
  linkTargetId,
  section,
  uploading,
  uploadLocked,
  onActiveChange,
  onDelete,
  onOpenViewer,
  onUpload,
}: ReviewCarouselProps) {
  const [dragActive, setDragActive] = useState(false);
  const [carouselDragX, setCarouselDragX] = useState(0);
  const [gestureState, setGestureState] = useState<CarouselGestureState>('idle');
  const [pageInput, setPageInput] = useState('');
  const dragDepthRef = useRef(0);
  const carouselPointerRef = useRef<CarouselPointer | null>(null);
  const carouselDragXRef = useRef(0);
  const carouselAnimationRef = useRef<{ stop: () => void } | null>(null);
  const carouselSettleTimerRef = useRef<number | null>(null);
  const carouselSettleVersionRef = useRef(0);
  const suppressViewerClickRef = useRef(false);
  const activeIndex = Math.max(0, items.findIndex(({ id }) => id === activeId));
  const activeItem = items[activeIndex] ?? null;
  const label = `${boardName}/${section.name}`;

  const setCarouselPosition = (position: number) => {
    carouselDragXRef.current = position;
    setCarouselDragX(position);
  };

  const stopCarouselMotion = () => {
    carouselSettleVersionRef.current += 1;
    carouselAnimationRef.current?.stop();
    carouselAnimationRef.current = null;
    if (carouselSettleTimerRef.current !== null) {
      window.clearTimeout(carouselSettleTimerRef.current);
      carouselSettleTimerRef.current = null;
    }
  };

  useEffect(() => () => {
    carouselPointerRef.current = null;
    stopCarouselMotion();
  }, []);

  useEffect(() => {
    setPageInput(activeItem ? String(activeIndex + 1) : '');
  }, [activeIndex, activeItem, items.length]);

  const move = (direction: -1 | 1) => {
    if (items.length < 2) return;
    const nextIndex = (activeIndex + direction + items.length) % items.length;
    onActiveChange(items[nextIndex].id);
  };

  const commitPageInput = () => {
    if (items.length === 0) return;
    const numericPage = Number(pageInput);
    const requestedPage = Number.isFinite(numericPage) ? Math.trunc(numericPage) : 1;
    const nextPage = Math.min(items.length, Math.max(1, requestedPage));
    setPageInput(String(nextPage));
    const nextItem = items[nextPage - 1];
    if (nextItem.id !== activeId) onActiveChange(nextItem.id);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    onUpload(Array.from(event.currentTarget.files ?? []));
    event.currentTarget.value = '';
  };

  const resetDrag = () => {
    dragDepthRef.current = 0;
    setDragActive(false);
  };

  const handleDragEnter = (event: ReactDragEvent<HTMLDivElement>) => {
    if (!hasFileTransfer(event.dataTransfer)) return;
    event.preventDefault();
    dragDepthRef.current += 1;
    setDragActive(true);
  };

  const handleDragOver = (event: ReactDragEvent<HTMLDivElement>) => {
    if (!hasFileTransfer(event.dataTransfer)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  };

  const handleDragLeave = () => {
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setDragActive(false);
  };

  const handleDrop = (event: ReactDragEvent<HTMLDivElement>) => {
    if (!hasFileTransfer(event.dataTransfer)) return;
    event.preventDefault();
    resetDrag();
    onUpload(Array.from(event.dataTransfer.files));
  };

  const handlePaste = (event: ReactClipboardEvent<HTMLDivElement>) => {
    const files = filesFromClipboard(event.clipboardData);
    if (!files.some(({ type }) => acceptedImageTypes.has(type))) return;
    event.preventDefault();
    onUpload(files);
  };

  const handleCarouselPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const button = event.target instanceof Element ? event.target.closest('button') : null;
    if (
      items.length < 2
      || carouselPointerRef.current !== null
      || event.isPrimary === false
      || event.button !== 0
      || button && !button.classList.contains('review-card__view')
    ) return;
    stopCarouselMotion();
    suppressViewerClickRef.current = false;
    const now = performance.now();
    const step = measureCarouselStep(event.currentTarget);
    carouselPointerRef.current = {
      id: event.pointerId,
      startX: event.clientX,
      originX: carouselDragXRef.current,
      lastX: event.clientX,
      step,
      committed: false,
      history: [{ x: event.clientX, time: now }],
    };
    setGestureState('pressed');
  };

  const handleCarouselPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const pointer = carouselPointerRef.current;
    if (!pointer || (event.pointerId !== undefined && event.pointerId !== 0 && pointer.id !== event.pointerId)) return;
    pointer.lastX = event.clientX;
    const now = performance.now();
    pointer.history.push({ x: event.clientX, time: now });
    pointer.history = pointer.history.filter(({ time }) => time >= now - velocityHistoryWindow);
    const delta = event.clientX - pointer.startX;
    if (!pointer.committed) {
      if (Math.abs(delta) < carouselHysteresis) return;
      pointer.committed = true;
      event.currentTarget.setPointerCapture?.(pointer.id);
    }
    suppressViewerClickRef.current = true;
    setGestureState('dragging');
    const desiredPosition = pointer.originX + delta;
    const dimension = event.currentTarget.clientWidth || pointer.step * 2;
    setCarouselPosition(rubberBandCarouselPosition(desiredPosition, pointer.step, dimension));
  };

  const finishCarouselPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const pointer = carouselPointerRef.current;
    if (!pointer || (event.pointerId !== undefined && event.pointerId !== 0 && pointer.id !== event.pointerId)) return;
    const now = performance.now();
    pointer.history.push({ x: event.clientX, time: now });
    const recentHistory = pointer.history.filter(({ time }) => time >= now - velocityHistoryWindow);
    const velocity = carouselVelocity(recentHistory);
    carouselPointerRef.current = null;
    const projectedSnap = pointer.committed
      ? selectProjectedSnap(
        carouselDragXRef.current,
        velocity,
        [-pointer.step, 0, pointer.step],
      )
      : 0;
    settleCarousel(projectedSnap, velocity, pointer.step);
  };

  const cancelCarouselPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const pointer = carouselPointerRef.current;
    if (!pointer || (event.pointerId !== undefined && event.pointerId !== 0 && pointer.id !== event.pointerId)) return;
    carouselPointerRef.current = null;
    suppressViewerClickRef.current = false;
    settleCarousel(0, 0, pointer.step);
  };

  const settleCarousel = (snapPoint: number, velocity: number, step: number) => {
    stopCarouselMotion();
    const settleVersion = carouselSettleVersionRef.current;
    let completed = false;
    const complete = () => {
      if (completed || settleVersion !== carouselSettleVersionRef.current) return;
      completed = true;
      stopCarouselMotion();
      setCarouselPosition(0);
      setGestureState('idle');
      window.setTimeout(() => {
        suppressViewerClickRef.current = false;
      }, 0);
    };
    const direction: -1 | 0 | 1 = snapPoint === 0 ? 0 : snapPoint < 0 ? 1 : -1;
    let presentationPosition = carouselDragXRef.current;
    setGestureState('settling');
    if (direction !== 0) {
      suppressViewerClickRef.current = true;
      move(direction);
      presentationPosition += direction * step;
      setCarouselPosition(presentationPosition);
    }
    if (reducedMotionRequested()) {
      complete();
      return;
    }
    try {
      carouselAnimationRef.current = animate(presentationPosition, 0, {
        ...(direction !== 0 && Math.abs(velocity) >= 120 ? momentumSpring : criticalSpring),
        velocity,
        onUpdate: (position) => {
          if (settleVersion === carouselSettleVersionRef.current) {
            setCarouselPosition(position);
          }
        },
        onComplete: complete,
      });
      carouselSettleTimerRef.current = window.setTimeout(complete, carouselSettleTimeout);
    } catch {
      complete();
    }
  };

  return (
    <div className="review-board__carousel-shell">
      <div className="review-board__toolbar liquid-glass liquid-glass--thin liquid-glass__nested">
        <span className="review-page__collection-mark">
          <Images aria-hidden="true" size={16} />
          {section.name} · {items.length} 张
        </span>
        <label className={`review-upload liquid-pressable${uploading ? ' is-uploading' : ''}`}>
          {uploading ? <LoaderCircle aria-hidden="true" size={16} /> : <ImagePlus aria-hidden="true" size={16} />}
          <span>{uploading ? '上传中' : '添加图片'}</span>
          <input
            aria-label={`选择${label}错题图片`}
            accept="image/png,image/jpeg,image/webp"
            disabled={uploadLocked}
            multiple
            type="file"
            onChange={handleFileChange}
          />
        </label>
      </div>

      {error ? <p className="review-page__error" role="alert">{error}</p> : null}

      <div
        aria-label={`${boardName} / ${section.name} 错题图片拖放与粘贴区域`}
        className={`review-stage liquid-glass liquid-glass--thin${dragActive ? ' is-drag-active' : ''}`}
        role="group"
        tabIndex={0}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft') {
            event.preventDefault();
            move(-1);
          }
          if (event.key === 'ArrowRight') {
            event.preventDefault();
            move(1);
          }
        }}
        onPaste={handlePaste}
      >
        {items.length === 0 ? (
          <div className="review-stage__state review-stage__state--empty">
            <UploadCloud aria-hidden="true" size={32} />
            <strong>拖入第一张错题</strong>
            <span>也可直接粘贴图片</span>
          </div>
        ) : (
          <>
            <div
              aria-label={`${label}错题图片轮播`}
              className={`review-carousel${gestureState === 'dragging' ? ' is-dragging' : ''}`}
              data-gesture-state={gestureState}
              style={{ '--review-carousel-drag-x': `${carouselDragX}px` } as CSSProperties}
              onPointerCancel={cancelCarouselPointer}
              onPointerDown={handleCarouselPointerDown}
              onPointerMove={handleCarouselPointerMove}
              onPointerUp={finishCarouselPointer}
              onLostPointerCapture={cancelCarouselPointer}
            >
              {items.map((item, index) => {
                const slot = carouselSlot(index, activeIndex, items.length);
                if (slot === null) return null;
                const isActive = slot === 0;
                return (
                  <figure
                    aria-label={`复盘条目 ${item.originalName}`}
                    className={`review-card${item.id === linkTargetId ? ' is-link-target' : ''}`}
                    data-active={isActive ? 'true' : 'false'}
                    data-slot={slot}
                    id={`review-item-${item.id}`}
                    key={item.id}
                    style={{ zIndex: 10 - Math.abs(slot) }}
                  >
                    <div className="review-card__photo">
                      <button
                        aria-label={`放大查看 ${item.originalName}`}
                        className="review-card__view"
                        type="button"
                        onClick={() => {
                          if (!suppressViewerClickRef.current) onOpenViewer(item);
                        }}
                      >
                        <img alt={`错题图片 ${item.originalName}`} draggable={false} src={item.url} />
                      </button>
                      {isActive ? (
                        <span className="review-card__polaroid" aria-hidden="true">
                          <img alt="" draggable={false} src={item.url} />
                        </span>
                      ) : null}
                    </div>
                    <figcaption>
                      <span>ARCHIVE {String(index + 1).padStart(2, '0')}</span>
                      <strong>{isActive ? 'STUDY WHAT YOU MISSED' : 'KEEP LOOKING'}</strong>
                    </figcaption>
                    {isActive ? (
                      <button
                        aria-label={`删除${label}当前错题图片`}
                        className="review-card__delete liquid-pressable"
                        disabled={deletingImageIds.size > 0}
                        title="删除当前图片"
                        type="button"
                        onClick={() => onDelete(item.id)}
                      >
                        {deletingImageIds.has(item.id)
                          ? <LoaderCircle aria-hidden="true" className="is-spinning" size={16} />
                          : <Trash2 aria-hidden="true" size={16} />}
                      </button>
                    ) : null}
                  </figure>
                );
              })}
            </div>

            {items.length > 1 ? (
              <>
                <button
                  aria-label={`上一张${label}错题图片`}
                  className="review-nav review-nav--side review-nav--left liquid-pressable"
                  title="上一张"
                  type="button"
                  onClick={() => move(-1)}
                >
                  <ArrowLeft aria-hidden="true" size={24} strokeWidth={1.3} />
                </button>
                <button
                  aria-label={`下一张${label}错题图片`}
                  className="review-nav review-nav--side review-nav--right liquid-pressable"
                  title="下一张"
                  type="button"
                  onClick={() => move(1)}
                >
                  <ArrowRight aria-hidden="true" size={24} strokeWidth={1.3} />
                </button>
              </>
            ) : null}
          </>
        )}

        {uploading ? (
          <div className="review-stage__uploading" role="status">
            <LoaderCircle aria-hidden="true" className="is-spinning" size={17} />
            图片上传中
          </div>
        ) : null}
      </div>

      {activeItem ? (
        <footer className="review-page__footer">
          <button
            aria-label={`底部上一张${label}错题图片`}
            className="liquid-pressable"
            disabled={items.length < 2}
            title="上一张"
            type="button"
            onClick={() => move(-1)}
          >
            <ArrowLeft aria-hidden="true" size={20} strokeWidth={1.25} />
          </button>
          <label className="review-page__page-jump">
            <input
              aria-label={`跳转到${label}错题图片页码，共${items.length}页`}
              inputMode="numeric"
              max={items.length}
              min={1}
              step={1}
              type="number"
              value={pageInput}
              onBlur={commitPageInput}
              onChange={(event) => setPageInput(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                commitPageInput();
              }}
            />
            <span aria-hidden="true">/ {items.length}</span>
          </label>
          <button
            aria-label={`底部下一张${label}错题图片`}
            className="liquid-pressable"
            disabled={items.length < 2}
            title="下一张"
            type="button"
            onClick={() => move(1)}
          >
            <ArrowRight aria-hidden="true" size={20} strokeWidth={1.25} />
          </button>
        </footer>
      ) : null}
    </div>
  );
}

interface ImageViewerProps {
  item: ReviewImage;
  scale: number;
  onClose: () => void;
  onScaleChange: (scale: number) => void;
}

function ImageViewer({ item, scale, onClose, onScaleChange }: ImageViewerProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const [imageLayoutSize, setImageLayoutSize] = useState<{ width: number; height: number } | null>(null);
  const scaledImageSize = imageLayoutSize
    ? {
      width: imageLayoutSize.width * scale,
      height: imageLayoutSize.height * scale,
    }
    : null;

  useEffect(() => {
    closeButtonRef.current?.focus();
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const controls = Array.from(dialog.querySelectorAll<HTMLButtonElement>('button:not([disabled])'));
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', trapFocus);
    return () => document.removeEventListener('keydown', trapFocus);
  }, []);

  return (
    <div className="review-viewer liquid-glass liquid-glass--thick" ref={dialogRef} role="dialog" aria-label="放大查看错题图片" aria-modal="true">
      <header className="review-viewer__header liquid-glass liquid-glass--thin liquid-glass__nested">
        <div>
          <strong>{item.originalName}</strong>
          <span>{Math.round(scale * 100)}%</span>
        </div>
        <div className="review-viewer__tools">
          <button
            aria-label="缩小图片"
            className="liquid-pressable"
            disabled={scale <= 1}
            title="缩小"
            type="button"
            onClick={() => onScaleChange(Math.max(1, scale - 0.5))}
          >
            <Minus aria-hidden="true" size={19} />
          </button>
          <button
            aria-label="放大图片"
            className="liquid-pressable"
            disabled={scale >= 3}
            title="放大"
            type="button"
            onClick={() => onScaleChange(Math.min(3, scale + 0.5))}
          >
            <Plus aria-hidden="true" size={19} />
          </button>
          <button
            aria-label="恢复原始比例"
            className="liquid-pressable"
            disabled={scale === 1}
            title="恢复 100%"
            type="button"
            onClick={() => onScaleChange(1)}
          >
            <RotateCcw aria-hidden="true" size={18} />
          </button>
          <button aria-label="关闭放大查看" className="liquid-pressable" ref={closeButtonRef} title="关闭" type="button" onClick={onClose}>
            <X aria-hidden="true" size={21} />
          </button>
        </div>
      </header>
      <div className="review-viewer__canvas">
        <div
          className="review-viewer__content"
          data-measured={imageLayoutSize ? 'true' : 'false'}
          style={scaledImageSize ? {
            '--review-viewer-image-width': `${scaledImageSize.width}px`,
            '--review-viewer-image-height': `${scaledImageSize.height}px`,
          } as CSSProperties : undefined}
        >
          <img
            alt={`放大后的错题图片 ${item.originalName}`}
            data-measured={imageLayoutSize ? 'true' : 'false'}
            src={item.url}
            style={scaledImageSize ? {
              width: `${scaledImageSize.width}px`,
              height: `${scaledImageSize.height}px`,
            } : undefined}
            onLoad={(event) => {
              if (imageLayoutSize) return;
              const rect = event.currentTarget.getBoundingClientRect();
              const width = rect.width || event.currentTarget.naturalWidth;
              const height = rect.height || event.currentTarget.naturalHeight;
              if (width > 0 && height > 0) setImageLayoutSize({ width, height });
            }}
          />
        </div>
      </div>
    </div>
  );
}

function firstImageBySection(items: ReviewImage[]) {
  const result: Record<string, string> = {};
  for (const item of items) result[item.sectionId] ??= item.id;
  return result;
}

function reviewImageIdFromHash() {
  const prefix = '#review-item-';
  if (!window.location.hash.startsWith(prefix)) return null;
  const encodedId = window.location.hash.slice(prefix.length);
  if (!encodedId) return null;
  try {
    return decodeURIComponent(encodedId);
  } catch {
    return encodedId;
  }
}

function measureCarouselStep(carousel: HTMLElement) {
  const activeCard = carousel.querySelector<HTMLElement>('.review-card[data-active="true"]');
  const adjacentCard = carousel.querySelector<HTMLElement>('.review-card[data-slot="1"]')
    ?? carousel.querySelector<HTMLElement>('.review-card[data-slot="-1"]');
  if (activeCard && adjacentCard) {
    const activeRect = activeCard.getBoundingClientRect();
    const adjacentRect = adjacentCard.getBoundingClientRect();
    const activeCenter = activeRect.left + activeRect.width / 2;
    const adjacentCenter = adjacentRect.left + adjacentRect.width / 2;
    const measuredStep = Math.abs(adjacentCenter - activeCenter);
    if (measuredStep > 0) return measuredStep;
  }
  return Math.max(1, (carousel.clientWidth || carousel.getBoundingClientRect().width) / 3);
}

function rubberBandCarouselPosition(position: number, bound: number, dimension: number) {
  if (position < -bound) {
    return -bound + rubberBand(
      position + bound,
      dimension,
    );
  }
  if (position > bound) {
    return bound + rubberBand(
      position - bound,
      dimension,
    );
  }
  return position;
}

function carouselVelocity(history: Array<{ x: number; time: number }>) {
  if (history.length < 2) return 0;
  const first = history[0];
  const last = history[history.length - 1];
  const elapsed = last.time - first.time;
  return elapsed > 0 ? (last.x - first.x) / (elapsed / 1000) : 0;
}

function reducedMotionRequested() {
  if (document.documentElement.dataset.motion === 'reduced') return true;
  return typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function indexImagesBySection(items: ReviewImage[]) {
  const result = new Map<string, ReviewImage[]>();
  for (const item of items) {
    const sectionItems = result.get(item.sectionId);
    if (sectionItems) sectionItems.push(item);
    else result.set(item.sectionId, [item]);
  }
  return result;
}

function firstVisibleSectionByBoard(boards: ReviewBoard[]) {
  const result: Record<string, string> = {};
  for (const board of boards) {
    const section = board.sections.find(({ hidden }) => !hidden);
    if (section) result[board.id] = section.id;
  }
  return result;
}

function moveActiveItem<T extends { hidden: boolean; id: string }>(
  items: T[],
  itemId: string,
  direction: -1 | 1,
) {
  const activePositions = items.flatMap((item, index) => (item.hidden ? [] : [index]));
  const activeItems = activePositions.map((index) => items[index]);
  const activeIndex = activeItems.findIndex(({ id }) => id === itemId);
  const targetIndex = activeIndex + direction;
  if (activeIndex < 0 || targetIndex < 0 || targetIndex >= activeItems.length) return null;
  [activeItems[activeIndex], activeItems[targetIndex]] = [activeItems[targetIndex], activeItems[activeIndex]];
  const reordered = [...items];
  activePositions.forEach((position, index) => {
    reordered[position] = activeItems[index];
  });
  return reordered;
}

function orderItemsByIds<T extends { id: string }>(items: T[], ids: string[]) {
  const itemsById = new Map(items.map((item) => [item.id, item]));
  const knownIds = new Set(ids);
  return [
    ...ids.map((id) => itemsById.get(id)).filter((item): item is T => Boolean(item)),
    ...items.filter(({ id }) => !knownIds.has(id)),
  ];
}

function focusOrderControl(control: HTMLButtonElement | null) {
  if (!control) return;
  const focusTarget = control.disabled
    ? control.closest('.review-manager__actions')?.querySelector<HTMLButtonElement>('button:not(:disabled)')
    : control;
  focusTarget?.focus();
}

function mergeImages(current: ReviewImage[], incoming: ReviewImage[]) {
  const imagesById = new Map(current.map((item) => [item.id, item]));
  for (const item of incoming) imagesById.set(item.id, item);
  return [...imagesById.values()];
}

function carouselSlot(index: number, activeIndex: number, total: number) {
  let distance = index - activeIndex;
  if (distance > total / 2) distance -= total;
  if (distance < -total / 2) distance += total;
  return Math.abs(distance) <= 3 ? distance : null;
}

function hasFileTransfer(dataTransfer: DataTransfer) {
  return dataTransfer.files.length > 0 || Array.from(dataTransfer.types).includes('Files');
}

function filesFromClipboard(dataTransfer: DataTransfer) {
  const files = Array.from(dataTransfer.files ?? []);
  if (files.length > 0) return files;
  return Array.from(dataTransfer.items ?? [])
    .filter(({ kind }) => kind === 'file')
    .map((item) => item.getAsFile())
    .filter((file): file is File => file !== null);
}
