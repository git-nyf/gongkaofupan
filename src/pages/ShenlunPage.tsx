import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Bold,
  FileDown,
  FilePlus2,
  MessageSquarePlus,
  Palette,
  Redo2,
  Save,
  Strikethrough,
  Underline,
  Undo2,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import type { ShenlunReviewDetail, ShenlunReviewWriteInput } from '../../shared/contracts';
import { api, ApiError } from '../api/client';
import { ShenlunConnectors } from '../components/ShenlunConnectors';
import { ShenlunGrid } from '../components/ShenlunGrid';
import { ShenlunNotesRail } from '../components/ShenlunNotesRail';
import {
  createEmptyShenlunDraft,
  readShenlunDraft,
  reconcileAnnotations,
  writeShenlunDraft,
  type ShenlunAnnotation,
} from '../shenlun/draft';
import {
  applyShenlunEditorOperation,
  createShenlunEditorState,
  SHENLUN_TEXT_COLORS,
  type ShenlunDecorationMarkType,
  type ShenlunEditorState,
  type ShenlunEditorOperation,
  type ShenlunSelection,
  type ShenlunTextColor,
} from '../shenlun/editor';
import {
  layoutShenlunText,
  SHENLUN_STRUCTURAL_BLANK,
  SHENLUN_TEMPLATES,
  shenlunVisibleText,
  type ShenlunLayout,
  type ShenlunTemplate,
} from '../shenlun/layout';
import { parseShenlunNotes } from '../shenlun/notes';
import '../styles/shenlun.css';

const defaultTitle = '未命名申论';
const inputProxyWidth = 144;
const selectionActionWidth = 118;
const selectionActionHeight = 38;
const selectionActionGap = 8;

interface InputProxyPosition {
  left: number;
  top: number;
  height: number;
}

interface SelectionActionPosition {
  left: number;
  top: number;
}

export function ShenlunPage() {
  const navigate = useNavigate();
  const { reviewId } = useParams();
  const initialDraft = useMemo(() => readShenlunDraft(), []);
  const [template, setTemplate] = useState<ShenlunTemplate>(initialDraft.template);
  const [title, setTitle] = useState(initialDraft.title);
  const [titleTouched, setTitleTouched] = useState(Boolean(initialDraft.titleTouched));
  const [editor, setEditor] = useState(() => createShenlunEditorState({
    text: initialDraft.text,
    marks: initialDraft.marks,
  }));
  const [standardAnswer, setStandardAnswer] = useState(initialDraft.standardAnswer);
  const [standardAnswerError, setStandardAnswerError] = useState('');
  const [notes, setNotes] = useState(initialDraft.notes);
  const [annotations, setAnnotations] = useState<ShenlunAnnotation[]>(initialDraft.annotations);
  const [currentReviewId, setCurrentReviewId] = useState<string | undefined>(reviewId ?? initialDraft.reviewId);
  const [loadError, setLoadError] = useState('');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [savePending, setSavePending] = useState(false);
  const [editingAnnotationId, setEditingAnnotationId] = useState<string | null>(null);
  const [annotationDraft, setAnnotationDraft] = useState('');
  const [inputProxyPosition, setInputProxyPosition] = useState<InputProxyPosition>({
    left: -9999,
    top: 0,
    height: 1,
  });
  const [selectionActionPosition, setSelectionActionPosition] = useState<SelectionActionPosition | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const workspaceRef = useRef<HTMLElement>(null);
  const loadedReviewIdRef = useRef<string>();
  const revisionRef = useRef(0);
  const composingRef = useRef(false);
  const ignorePostCompositionChangeRef = useRef(false);
  const layout = useMemo(() => layoutShenlunText(editor.text, template), [editor.text, template]);
  const noteParts = useMemo(() => parseShenlunNotes(notes), [notes]);
  const selectedQuote = useMemo(() => {
    if (editor.selection.start === editor.selection.end) return '';
    return shenlunVisibleText(editor.text.slice(editor.selection.start, editor.selection.end));
  }, [editor.selection, editor.text]);

  useEffect(() => {
    if (!reviewId || loadedReviewIdRef.current === reviewId) return;
    const controller = new AbortController();
    setLoadError('');
    void api<ShenlunReviewDetail>(`/api/shenlun-reviews/${reviewId}`, { signal: controller.signal })
      .then((detail) => {
        loadedReviewIdRef.current = detail.id;
        setCurrentReviewId(detail.id);
        setTitle(detail.title);
        setTitleTouched(true);
        setTemplate(detail.template);
        setEditor(createShenlunEditorState({ text: detail.text, marks: detail.marks }));
        setStandardAnswer(detail.standardAnswer);
        setNotes(detail.notes);
        setAnnotations(detail.annotations);
        revisionRef.current = 0;
        setSaveState('idle');
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setLoadError('无法加载这条申论复盘，已保留本地草稿');
        }
      });
    return () => controller.abort();
  }, [reviewId]);

  useEffect(() => {
    writeShenlunDraft({
      version: 2,
      template,
      title,
      titleTouched,
      text: editor.text,
      standardAnswer,
      marks: editor.marks,
      notes,
      annotations,
      ...(currentReviewId ? { reviewId: currentReviewId } : {}),
    });
  }, [annotations, currentReviewId, editor.marks, editor.text, notes, standardAnswer, template, title, titleTouched]);

  useEffect(() => {
    if (titleTouched) return;
    const visible = shenlunVisibleText(editor.text).replace(/\s+/gu, '').trim();
    setTitle(Array.from(visible).slice(0, 24).join(''));
  }, [editor.text, titleTouched]);

  useEffect(() => {
    setAnnotations((current) => reconcileAnnotations(editor.text, current));
  }, [editor.text]);

  const markDirty = useCallback(() => {
    revisionRef.current += 1;
    setSaveState('idle');
  }, []);

  const applyOperation = useCallback((operation: ShenlunEditorOperation) => {
    setEditor((current) => applyShenlunEditorOperation(current, operation));
    if (operation.type !== 'select' && operation.type !== 'selectAll') markDirty();
  }, [markDirty]);

  const syncInputProxyPosition = useCallback((targetCell?: HTMLElement, terminalEdge?: boolean) => {
    const caretCell = targetCell ?? gridRef.current?.querySelector<HTMLElement>('.shenlun-cell--caret');
    if (!caretCell) {
      const hiddenPosition = { left: -9999, top: 0, height: 1 };
      if (inputRef.current) {
        inputRef.current.style.left = `${hiddenPosition.left}px`;
        inputRef.current.style.top = `${hiddenPosition.top}px`;
        inputRef.current.style.height = `${hiddenPosition.height}px`;
      }
      setInputProxyPosition(hiddenPosition);
      return;
    }

    const rect = caretCell.getBoundingClientRect();
    const useTerminalEdge = terminalEdge ?? caretCell.classList.contains('shenlun-cell--caret-end');
    const desiredLeft = useTerminalEdge
      ? rect.right - 1
      : rect.left;
    const left = Math.max(0, Math.min(desiredLeft, window.innerWidth - inputProxyWidth));
    const top = Math.max(0, Math.min(rect.top, window.innerHeight - rect.height));
    const position = { left, top, height: rect.height };
    if (inputRef.current) {
      inputRef.current.style.left = `${position.left}px`;
      inputRef.current.style.top = `${position.top}px`;
      inputRef.current.style.height = `${position.height}px`;
    }
    setInputProxyPosition(position);
  }, []);

  const syncSelectionActionPosition = useCallback(() => {
    if (!selectedQuote) {
      setSelectionActionPosition((current) => current === null ? current : null);
      return;
    }

    const selectedCells = gridRef.current?.querySelectorAll<HTMLElement>('.shenlun-cell--selected');
    const anchorCell = selectedCells?.[selectedCells.length - 1];
    if (!anchorCell) return;
    const rect = anchorCell.getBoundingClientRect();
    const right = rect.right + selectionActionGap;
    const desiredLeft = right + selectionActionWidth <= window.innerWidth
      ? right
      : rect.left - selectionActionWidth - selectionActionGap;
    const left = Math.max(selectionActionGap, Math.min(
      desiredLeft,
      window.innerWidth - selectionActionWidth - selectionActionGap,
    ));
    const desiredTop = rect.top + (rect.height - selectionActionHeight) / 2;
    const top = Math.max(selectionActionGap, Math.min(
      desiredTop,
      window.innerHeight - selectionActionHeight - selectionActionGap,
    ));
    setSelectionActionPosition((current) => (
      current?.left === left && current.top === top ? current : { left, top }
    ));
  }, [selectedQuote]);

  const focusEditor = useCallback((targetCell?: HTMLElement) => {
    syncInputProxyPosition(targetCell, targetCell ? false : undefined);
    inputRef.current?.focus({ preventScroll: true });
  }, [syncInputProxyPosition]);

  useLayoutEffect(() => {
    syncInputProxyPosition();
    syncSelectionActionPosition();
  }, [editor.selection, layout, syncInputProxyPosition, syncSelectionActionPosition]);

  useEffect(() => {
    const handleViewportChange = () => {
      syncInputProxyPosition();
      syncSelectionActionPosition();
    };
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);
    return () => {
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [syncInputProxyPosition, syncSelectionActionPosition]);

  const toggleMark = useCallback((markType: ShenlunDecorationMarkType) => {
    applyOperation({ type: 'toggleMark', markType });
    focusEditor();
  }, [applyOperation, focusEditor]);

  const setTextColor = useCallback((color: ShenlunTextColor) => {
    applyOperation({ type: 'setColor', color });
    focusEditor();
  }, [applyOperation, focusEditor]);

  const startNewReview = useCallback(() => {
    const emptyDraft = createEmptyShenlunDraft();
    loadedReviewIdRef.current = undefined;
    revisionRef.current = 0;
    setCurrentReviewId(undefined);
    setTemplate(emptyDraft.template);
    setTitle(emptyDraft.title);
    setTitleTouched(false);
    setEditor(createShenlunEditorState());
    setStandardAnswer('');
    setStandardAnswerError('');
    setNotes('');
    setAnnotations([]);
    setEditingAnnotationId(null);
    setAnnotationDraft('');
    setSelectionActionPosition(null);
    setLoadError('');
    setSaveState('idle');
    writeShenlunDraft(emptyDraft);
    navigate('/shenlun');
  }, [navigate]);

  const saveReview = useCallback(async () => {
    if (savePending) return;
    const input: ShenlunReviewWriteInput = {
      title: title.trim() || autoTitle(editor.text),
      template,
      text: editor.text,
      marks: editor.marks,
      notes,
      standardAnswer,
      annotations,
    };
    const id = currentReviewId;
    const savedRevision = revisionRef.current;
    setSavePending(true);
    setSaveState('saving');
    try {
      let detail: ShenlunReviewDetail;
      try {
        detail = await api<ShenlunReviewDetail>(
          id ? `/api/shenlun-reviews/${id}` : '/api/shenlun-reviews',
          { method: id ? 'PUT' : 'POST', body: JSON.stringify(input) },
        );
      } catch (error) {
        if (!(id && error instanceof ApiError && error.status === 404)) throw error;
        detail = await api<ShenlunReviewDetail>('/api/shenlun-reviews', {
          method: 'POST',
          body: JSON.stringify(input),
        });
      }
      loadedReviewIdRef.current = detail.id;
      setCurrentReviewId(detail.id);
      if (revisionRef.current === savedRevision) {
        setTitle(detail.title);
        setTitleTouched(true);
        setSaveState('saved');
      } else {
        setSaveState('idle');
      }
      if (!id || detail.id !== id) navigate(`/shenlun/${detail.id}`, { replace: true });
    } catch {
      setSaveState('error');
    } finally {
      setSavePending(false);
    }
  }, [annotations, currentReviewId, editor.marks, editor.text, navigate, notes, savePending, standardAnswer, template, title]);

  const saveAnnotation = useCallback(() => {
    const body = annotationDraft.trim();
    if (!body) return;
    if (editingAnnotationId === 'new' && selectedQuote) {
      setAnnotations((current) => [...current, {
        id: `annotation-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        start: editor.selection.start,
        end: editor.selection.end,
        quote: selectedQuote,
        body,
        createdAt: new Date().toISOString(),
        detached: false,
      }]);
    } else if (editingAnnotationId) {
      setAnnotations((current) => current.map((annotation) => (
        annotation.id === editingAnnotationId ? { ...annotation, body } : annotation
      )));
    }
    setEditingAnnotationId(null);
    setAnnotationDraft('');
    markDirty();
  }, [annotationDraft, editingAnnotationId, editor.selection, markDirty, selectedQuote]);

  const writeSelectionToClipboard = useCallback((
    event: React.ClipboardEvent<HTMLTextAreaElement>,
    cut: boolean,
  ) => {
    if (editor.selection.start === editor.selection.end) return;
    event.preventDefault();
    event.clipboardData.setData(
      'text/plain',
      shenlunVisibleText(editor.text.slice(editor.selection.start, editor.selection.end)),
    );
    if (cut) applyOperation({ type: 'delete' });
  }, [applyOperation, editor.selection.end, editor.selection.start, editor.text]);

  const handleEditorKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (composingRef.current || event.nativeEvent.isComposing) return;
    if (event.altKey && !event.ctrlKey && !event.metaKey) {
      const next = SHENLUN_TEMPLATES[Number(event.key) - 1];
      if (next) {
        event.preventDefault();
        setTemplate(next);
        markDirty();
      }
      return;
    }
    const modifier = event.ctrlKey || event.metaKey;
    if (modifier) {
      const key = event.key.toLowerCase();
      if (key === 'a') applyOperation({ type: 'selectAll' });
      else if (key === 'z' && event.shiftKey) applyOperation({ type: 'redo' });
      else if (key === 'z') applyOperation({ type: 'undo' });
      else if (key === 'y') applyOperation({ type: 'redo' });
      else if (key === 'b') toggleMark('bold');
      else if (key === 'u') toggleMark('underline');
      else if (key === 'x' && event.shiftKey) toggleMark('strike');
      else if (key === 's') void saveReview();
      else if (key === 'enter' && selectedQuote) {
        setEditingAnnotationId('new');
        setAnnotationDraft('');
      }
      else if (key === 'p') window.print();
      else return;
      event.preventDefault();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      if (editingAnnotationId) {
        setEditingAnnotationId(null);
        setAnnotationDraft('');
      } else if (editor.selection.start !== editor.selection.end) {
        applyOperation({ type: 'select', selection: { start: editor.selection.end, end: editor.selection.end } });
      }
    } else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      applyOperation({
        type: 'select',
        selection: moveEditorSelection(editor, layout, event.key, event.shiftKey),
      });
    } else if (event.key === 'Backspace') {
      event.preventDefault();
      applyOperation({ type: 'backspace' });
    } else if (event.key === 'Delete') {
      event.preventDefault();
      applyOperation({ type: 'delete' });
    } else if (event.key === 'Enter') {
      event.preventDefault();
      applyOperation({ type: 'insert', text: '\n' });
    } else if (event.key === 'Tab') {
      event.preventDefault();
      applyOperation({ type: 'insert', text: SHENLUN_STRUCTURAL_BLANK.repeat(2) });
    } else if (event.key.length === 1) {
      event.preventDefault();
      applyOperation({ type: 'insert', text: event.key });
    }
  };

  useEffect(() => {
    const handleWindowKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      const editable = target instanceof HTMLElement && (
        target.matches('input, textarea, select, [contenteditable="true"]') || target.isContentEditable
      );
      if (editable) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'p') {
        event.preventDefault();
        window.print();
        return;
      }
      if (event.altKey) {
        const next = SHENLUN_TEMPLATES[Number(event.key) - 1];
        if (next) {
          event.preventDefault();
          setTemplate(next);
          markDirty();
        }
      }
    };
    window.addEventListener('keydown', handleWindowKeyDown);
    return () => window.removeEventListener('keydown', handleWindowKeyDown);
  }, [markDirty]);

  return (
    <div className="page shenlun-page">
      <header className="shenlun-header">
        <div>
          <span className="shenlun-eyebrow">WRITING WORKBENCH</span>
          <h1 className="page__title">申论</h1>
          <input
            aria-label="标题"
            className="shenlun-title-input"
            maxLength={80}
            placeholder={defaultTitle}
            value={title}
            onChange={(event) => {
              setTitleTouched(true);
              setTitle(event.currentTarget.value);
              markDirty();
            }}
          />
          <div className="shenlun-title-print">{title.trim() || defaultTitle}</div>
        </div>
        <strong className={layout.overflowCharacters > 0 ? 'is-over-limit' : ''}>
          {`已用 ${layout.usedCharacters} / ${template} 字`}
        </strong>
      </header>

      <div className="shenlun-toolbar" role="toolbar" aria-label="申论工具">
        <div className="shenlun-template-switch" role="group" aria-label="字数模板">
          {SHENLUN_TEMPLATES.map((value, index) => (
            <button aria-keyshortcuts={`Alt+${index + 1}`} aria-pressed={template === value} className={template === value ? 'is-active' : ''} key={value} type="button" onClick={() => { setTemplate(value); markDirty(); }}>{value}字</button>
          ))}
        </div>
        <div className="shenlun-format-tools" role="group" aria-label="文字格式">
          <FormatButton active={isMarkActive(editor, 'bold')} label="加粗" shortcut="Control+B Meta+B" onClick={() => toggleMark('bold')}><Bold aria-hidden="true" size={17} /></FormatButton>
          <FormatButton active={isMarkActive(editor, 'underline')} label="下划线" shortcut="Control+U Meta+U" onClick={() => toggleMark('underline')}><Underline aria-hidden="true" size={17} /></FormatButton>
          <FormatButton active={isMarkActive(editor, 'strike')} label="删除线" shortcut="Control+Shift+X Meta+Shift+X" onClick={() => toggleMark('strike')}><Strikethrough aria-hidden="true" size={17} /></FormatButton>
          <div className="shenlun-color-tools" role="group" aria-label="文字颜色">
            <Palette aria-hidden="true" size={16} />
            {SHENLUN_TEXT_COLORS.map((color) => {
              const label = textColorLabel(color);
              return (
                <button
                  aria-label={`文字颜色：${label}`}
                  aria-pressed={isTextColorActive(editor, color)}
                  className={`shenlun-color-swatch shenlun-color-swatch--${color}`}
                  key={color}
                  title={`文字颜色：${label}`}
                  type="button"
                  onClick={() => setTextColor(color)}
                />
              );
            })}
          </div>
          <button aria-label="撤销" className="shenlun-tool-button liquid-pressable" disabled={editor.undoStack.length === 0} title="撤销" type="button" onClick={() => applyOperation({ type: 'undo' })}><Undo2 aria-hidden="true" size={17} /></button>
          <button aria-label="重做" className="shenlun-tool-button liquid-pressable" disabled={editor.redoStack.length === 0} title="重做" type="button" onClick={() => applyOperation({ type: 'redo' })}><Redo2 aria-hidden="true" size={17} /></button>
        </div>
        <button className="button button--secondary liquid-pressable" disabled={savePending} type="button" onClick={startNewReview}><FilePlus2 aria-hidden="true" size={16} />新建申论</button>
        <button aria-keyshortcuts="Control+S Meta+S" className="button liquid-pressable" disabled={savePending} type="button" onClick={() => void saveReview()}><Save aria-hidden="true" size={16} />保存回顾</button>
        <button aria-keyshortcuts="Control+P Meta+P" className="button button--secondary liquid-pressable" type="button" onClick={() => window.print()}><FileDown aria-hidden="true" size={16} />导出 PDF</button>
      </div>

      {loadError ? <p className="shenlun-status" role="alert">{loadError}</p> : null}
      {saveState !== 'idle' ? <p className={`shenlun-status shenlun-status--${saveState}`} role="status">{saveStateLabel(saveState)}</p> : null}

      {createPortal(<textarea
        aria-label="申论正文编辑区"
        className="shenlun-input-proxy"
        ref={inputRef}
        style={{
          height: `${inputProxyPosition.height}px`,
          left: `${inputProxyPosition.left}px`,
          top: `${inputProxyPosition.top}px`,
        }}
        onChange={(event) => {
          if (composingRef.current) return;
          const text = event.currentTarget.value;
          event.currentTarget.value = '';
          if (ignorePostCompositionChangeRef.current) {
            ignorePostCompositionChangeRef.current = false;
            return;
          }
          if (text) applyOperation({ type: 'insert', text });
        }}
        onCompositionStart={() => { composingRef.current = true; }}
        onCopy={(event) => writeSelectionToClipboard(event, false)}
        onCompositionEnd={(event) => {
          composingRef.current = false;
          const text = event.currentTarget.value || event.data || '';
          event.currentTarget.value = '';
          if (!text) return;
          ignorePostCompositionChangeRef.current = true;
          queueMicrotask(() => { ignorePostCompositionChangeRef.current = false; });
          applyOperation({ type: 'insert', text });
        }}
        onCut={(event) => writeSelectionToClipboard(event, true)}
        onKeyDown={handleEditorKeyDown}
        onPaste={(event) => {
          event.preventDefault();
          applyOperation({ type: 'insert', text: event.clipboardData.getData('text/plain') });
        }}
      />, document.body)}

      {selectedQuote && selectionActionPosition ? createPortal(
        <div
          className="shenlun-selection-action"
          style={{
            left: `${selectionActionPosition.left}px`,
            top: `${selectionActionPosition.top}px`,
          }}
        >
          <MessageSquarePlus aria-hidden="true" size={15} />
          <button type="button" onClick={() => { setEditingAnnotationId('new'); setAnnotationDraft(''); }}>添加批注</button>
        </div>,
        document.body,
      ) : null}

      <main className="shenlun-workspace" ref={workspaceRef}>
        <section className="shenlun-sheet-scroll" aria-label="申论答题区域">
          <div className="shenlun-sheet">
            <ShenlunGrid
              annotations={annotations}
              gridRef={gridRef}
              layout={layout}
              marks={editor.marks}
              selection={editor.selection}
              textLength={editor.text.length}
              onFocusEditor={focusEditor}
              onPadToCell={(cellIndex) => applyOperation({ type: 'padToCell', cellIndex })}
              onSelect={(selection) => applyOperation({ type: 'select', selection })}
            />
          </div>
        </section>
        <ShenlunNotesRail
          annotationDraft={annotationDraft}
          annotations={annotations}
          editingAnnotationId={editingAnnotationId}
          noteParts={noteParts}
          notes={notes}
          selectionQuote={selectedQuote}
          standardAnswer={standardAnswer}
          standardAnswerError={standardAnswerError}
          onAnnotationDraftChange={setAnnotationDraft}
          onCancelAnnotation={() => { setEditingAnnotationId(null); setAnnotationDraft(''); }}
          onDeleteAnnotation={(id) => { setAnnotations((current) => current.filter((annotation) => annotation.id !== id)); markDirty(); }}
          onEditAnnotation={(annotation) => { setEditingAnnotationId(annotation.id); setAnnotationDraft(annotation.body); }}
          onImportStandardAnswer={(file) => {
            const extension = file.name.toLocaleLowerCase();
            if (!extension.endsWith('.txt') && !extension.endsWith('.md')) {
              setStandardAnswerError('仅支持 .txt 或 .md 文件');
              return;
            }
            void readTextFile(file).then((value) => {
              setStandardAnswer(value);
              setStandardAnswerError('');
              markDirty();
            }).catch(() => setStandardAnswerError('无法读取标准答案文件'));
          }}
          onMoveAnnotation={(id, direction) => { setAnnotations((current) => moveAnnotation(current, id, direction)); markDirty(); }}
          onNotesChange={(value) => { setNotes(value); markDirty(); }}
          onSaveAnnotation={saveAnnotation}
          onStandardAnswerChange={(value) => { setStandardAnswer(value); setStandardAnswerError(''); markDirty(); }}
        />
        <ShenlunConnectors annotations={annotations} rootRef={workspaceRef} />
      </main>
    </div>
  );
}

function moveEditorSelection(
  editor: ShenlunEditorState,
  layout: ShenlunLayout,
  key: string,
  extend: boolean,
): ShenlunSelection {
  const backwards = key === 'ArrowLeft' || key === 'ArrowUp' || key === 'Home';
  const hasSelection = editor.selection.start !== editor.selection.end;
  const active = hasSelection
    ? (backwards ? editor.selection.start : editor.selection.end)
    : editor.selection.start;
  if (hasSelection && !extend && (key === 'ArrowLeft' || key === 'ArrowRight')) {
    const collapsed = backwards ? editor.selection.start : editor.selection.end;
    return { start: collapsed, end: collapsed };
  }

  const cells = layout.rows.flatMap((row) => row.cells);
  const currentCell = cellIndexForSourcePosition(cells, active, layout.endCellIndex, editor.text.length);
  let target = active;
  if (key === 'ArrowLeft') target = previousTextIndex(editor.text, active);
  if (key === 'ArrowRight') target = nextTextIndex(editor.text, active);
  if (key === 'ArrowUp') target = sourcePositionForCell(cells, currentCell - 25, active);
  if (key === 'ArrowDown') target = sourcePositionForCell(cells, currentCell + 25, active);
  if (key === 'Home') target = sourcePositionForRowEdge(cells, Math.floor(currentCell / 25), false, active);
  if (key === 'End') target = sourcePositionForRowEdge(cells, Math.floor(currentCell / 25), true, active);

  if (!extend) return { start: target, end: target };
  const anchor = hasSelection
    ? (backwards ? editor.selection.end : editor.selection.start)
    : active;
  return { start: Math.min(anchor, target), end: Math.max(anchor, target) };
}

function cellIndexForSourcePosition(
  cells: ShenlunLayout['rows'][number]['cells'],
  position: number,
  endCellIndex: number,
  textLength: number,
): number {
  if (position >= textLength) return endCellIndex;
  const index = cells.findIndex((cell) => {
    if (!cell) return false;
    const start = Math.min(...cell.sourceIndexes);
    return position >= start && position < cellSourceEnd(cell);
  });
  return index >= 0 ? index : endCellIndex;
}

function sourcePositionForCell(
  cells: ShenlunLayout['rows'][number]['cells'],
  rawCellIndex: number,
  fallback: number,
): number {
  const cellIndex = Math.max(0, Math.min(cells.length - 1, rawCellIndex));
  const cell = cells[cellIndex];
  if (cell) return Math.min(...cell.sourceIndexes);
  const rowStart = Math.floor(cellIndex / 25) * 25;
  const rowEnd = Math.min(cells.length, rowStart + 25);
  for (let index = cellIndex - 1; index >= rowStart; index -= 1) {
    if (cells[index]) return cellSourceEnd(cells[index]!);
  }
  for (let index = cellIndex + 1; index < rowEnd; index += 1) {
    if (cells[index]) return Math.min(...cells[index]!.sourceIndexes);
  }
  return fallback;
}

function sourcePositionForRowEdge(
  cells: ShenlunLayout['rows'][number]['cells'],
  rowIndex: number,
  end: boolean,
  fallback: number,
): number {
  const row = cells.slice(rowIndex * 25, rowIndex * 25 + 25);
  const occupied = row.filter((cell): cell is NonNullable<typeof cell> => cell !== null);
  if (occupied.length === 0) return fallback;
  return end
    ? cellSourceEnd(occupied[occupied.length - 1])
    : Math.min(...occupied[0].sourceIndexes);
}

function cellSourceEnd(cell: NonNullable<ShenlunLayout['rows'][number]['cells'][number]>): number {
  const characters = Array.from(cell.text);
  const lastIndex = cell.sourceIndexes[cell.sourceIndexes.length - 1] ?? 0;
  return lastIndex + (characters[characters.length - 1]?.length ?? 1);
}

function previousTextIndex(text: string, index: number): number {
  const character = Array.from(text.slice(0, index)).at(-1);
  return Math.max(0, index - (character?.length ?? 0));
}

function nextTextIndex(text: string, index: number): number {
  const character = Array.from(text.slice(index))[0];
  return Math.min(text.length, index + (character?.length ?? 0));
}

function FormatButton({ active, children, label, shortcut, onClick }: {
  active: boolean;
  children: React.ReactNode;
  label: string;
  shortcut: string;
  onClick: () => void;
}) {
  return (
    <button aria-keyshortcuts={shortcut} aria-label={label} aria-pressed={active} className={`shenlun-tool-button liquid-pressable${active ? ' shenlun-tool-button--active' : ''}`} title={label} type="button" onClick={onClick}>{children}</button>
  );
}

function isMarkActive(editor: ReturnType<typeof createShenlunEditorState>, type: ShenlunDecorationMarkType) {
  const { start, end } = editor.selection;
  if (start === end) return editor.pendingMarks.includes(type);
  let covered = start;
  for (const mark of editor.marks.filter((item) => item.type === type && item.end > start && item.start < end).sort((left, right) => left.start - right.start)) {
    if (mark.start > covered) return false;
    covered = Math.max(covered, mark.end);
    if (covered >= end) return true;
  }
  return false;
}

function isTextColorActive(
  editor: ReturnType<typeof createShenlunEditorState>,
  color: ShenlunTextColor,
) {
  const { start, end } = editor.selection;
  if (start === end) return editor.pendingColor === color;
  const colorMarks = editor.marks
    .filter((mark) => mark.type === 'color' && mark.end > start && mark.start < end)
    .sort((left, right) => left.start - right.start);
  if (color === 'ink') return colorMarks.length === 0;
  let covered = start;
  for (const mark of colorMarks.filter((item) => item.color === color)) {
    if (mark.start > covered) return false;
    covered = Math.max(covered, mark.end);
    if (covered >= end) return true;
  }
  return false;
}

function textColorLabel(color: ShenlunTextColor) {
  if (color === 'red') return '红色';
  if (color === 'blue') return '蓝色';
  if (color === 'green') return '绿色';
  return '墨色';
}

function autoTitle(text: string) {
  const visible = shenlunVisibleText(text).replace(/\s+/gu, '').trim();
  return Array.from(visible).slice(0, 24).join('') || defaultTitle;
}

function saveStateLabel(state: 'saving' | 'saved' | 'error') {
  if (state === 'saving') return '正在保存';
  if (state === 'saved') return '已保存';
  return '保存失败，本地草稿仍已保留';
}

function moveAnnotation(annotations: ShenlunAnnotation[], id: string, direction: -1 | 1) {
  const index = annotations.findIndex((annotation) => annotation.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= annotations.length) return annotations;
  const next = [...annotations];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function readTextFile(file: File): Promise<string> {
  if (typeof file.text === 'function') return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.readAsText(file);
  });
}
