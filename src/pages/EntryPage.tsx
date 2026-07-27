import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent as ReactClipboardEvent,
  type DragEvent as ReactDragEvent,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { CircleAlert, CircleCheck, ClipboardPaste, Copy, FileImage, LoaderCircle, Plus, Save, TextSelect, Trash2, Undo2, X } from 'lucide-react';
import { useInRouterContext, useSearchParams } from 'react-router-dom';
import type {
  CardDetail,
  CardUpdateInput,
  CreateCardInput,
  EntryMode,
  OriginalCardRewriteInput,
  OriginalCardRewriteResult,
} from '../../shared/contracts';
import { categoryCatalog } from '../../server/catalog/categories';
import { ApiError, api, apiForm } from '../api/client';
import { entryTemplates } from '../catalog/templates';
import { RichTextEditor } from '../components/RichTextEditor';
import { StatusNotice } from '../components/StatusNotice';
import type { EditingTarget } from '../components/editingTarget';
import '../styles/entry-glass.css';

type SaveState = 'idle' | 'saving' | 'ready' | 'pending' | 'needs_input' | 'error';
type EditLoadState = 'idle' | 'loading' | 'ready' | 'error';
type EntryEditMode = 'card' | 'original';

interface RequiredErrors {
  categories?: string;
  subcategories?: string;
  rawInput?: string;
}

interface PersistedAttachment {
  id: string;
  originalName: string;
}

type EditableQuizItem = Pick<CardDetail['quizItems'][number], 'id' | 'direction' | 'question' | 'answer'>;

const quizDirectionLabels: Record<EditableQuizItem['direction'], string> = {
  forward: '正向',
  reverse: '反向',
  single: '单向',
};

const emptyRawContentJson = JSON.stringify({
  type: 'doc',
  content: [{ type: 'paragraph' }],
});

const acceptedImageTypes = ['image/png', 'image/jpeg', 'image/webp'] as const;
const acceptedImageTypeSet = new Set<string>(acceptedImageTypes);

const primaryCategories = Object.entries(categoryCatalog) as Array<
  [keyof typeof categoryCatalog, readonly string[]]
>;

export function EntryPage() {
  return useInRouterContext() ? <RoutedEntryPage /> : <EntryForm />;
}

function RoutedEntryPage() {
  const [searchParams] = useSearchParams();
  const originalEditId = searchParams.get('editOriginal')?.trim() || undefined;
  const cardEditId = searchParams.get('edit')?.trim() || undefined;
  const editId = originalEditId ?? cardEditId;
  const editMode: EntryEditMode = originalEditId ? 'original' : 'card';
  return <EntryForm editId={editId} editMode={editMode} key={editId ? `${editMode}:${editId}` : 'new'} />;
}

function EntryForm({ editId, editMode = 'card' }: { editId?: string; editMode?: EntryEditMode }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageDragDepthRef = useRef(0);
  const saveInFlightRef = useRef(false);
  const [entryMode, setEntryMode] = useState<EntryMode>('mistake');
  const [templateName, setTemplateName] = useState(entryTemplates[0].name);
  const [rawInput, setRawInput] = useState('');
  const [rawContentJson, setRawContentJson] = useState(emptyRawContentJson);
  const [wrongPoint, setWrongPoint] = useState('');
  const [analysis, setAnalysis] = useState('');
  const [mnemonic, setMnemonic] = useState('');
  const [extension, setExtension] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedPrimary, setSelectedPrimary] = useState<string[]>([]);
  const [selectedSecondary, setSelectedSecondary] = useState<string[]>([]);
  const [sourceType, setSourceType] = useState('');
  const [sourceDetail, setSourceDetail] = useState('');
  const [tagText, setTagText] = useState('');
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [imageDragActive, setImageDragActive] = useState(false);
  const [persistedAttachments, setPersistedAttachments] = useState<PersistedAttachment[]>([]);
  const [quizItemEdits, setQuizItemEdits] = useState<EditableQuizItem[]>([]);
  const [currentCardId, setCurrentCardId] = useState<string>();
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [validationMessage, setValidationMessage] = useState('');
  const [requiredErrors, setRequiredErrors] = useState<RequiredErrors>({});
  const [editLoadState, setEditLoadState] = useState<EditLoadState>(editId ? 'loading' : 'idle');
  const [editReloadKey, setEditReloadKey] = useState(0);
  const [loadedDetail, setLoadedDetail] = useState<CardDetail>();
  const [rawEditorVersion, setRawEditorVersion] = useState(0);
  const [editingTarget, setEditingTarget] = useState<EditingTarget>();
  const [editingFeedback, setEditingFeedback] = useState('');
  const isEditing = Boolean(editId);
  const isOriginalEditing = isEditing && editMode === 'original';

  const selectedTemplate = useMemo(
    () => entryTemplates.find(({ name }) => name === templateName) ?? entryTemplates[0],
    [templateName],
  );
  const userTags = useMemo(() => normalizeTags(tagText), [tagText]);
  const categoryIds = useMemo(
    () => [...selectedPrimary, ...selectedSecondary],
    [selectedPrimary, selectedSecondary],
  );

  const applyDetailToForm = useCallback((detail: CardDetail) => {
    setEntryMode(detail.entryMode);
    setTemplateName(detail.template);
    setRawInput(detail.rawInput);
    setRawContentJson(detail.rawContentJson ?? rawContentForText(detail.rawInput));
    setWrongPoint(detail.wrongPoint);
    setAnalysis(detail.analysis);
    setMnemonic(detail.mnemonic);
    setExtension(detail.extension);
    setNotes(detail.notes);
    setSelectedPrimary(
      detail.categories.filter(({ parentId }) => parentId === null).map(({ id }) => id),
    );
    setSelectedSecondary(
      detail.categories.filter(({ parentId }) => parentId !== null).map(({ id }) => id),
    );
    setSourceType(detail.sourceType);
    setSourceDetail(detail.sourceDetail);
    setTagText(detail.tags.filter(({ origin }) => origin === 'user').map(({ name }) => name).join('，'));
    setStagedFiles([]);
    setPersistedAttachments(
      detail.attachments.map(({ id, originalName }) => ({ id, originalName })),
    );
    setQuizItemEdits(isOriginalEditing
      ? []
      : detail.quizItems.map(({ id, direction, question, answer }) => ({
          id,
          direction,
          question,
          answer,
        })));
    setCurrentCardId(detail.id);
    setRawEditorVersion((current) => current + 1);
    setRequiredErrors({});
    setValidationMessage('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [isOriginalEditing]);

  useEffect(() => {
    if (!editId) {
      setEditLoadState('idle');
      return;
    }

    const controller = new AbortController();
    setEditLoadState('loading');
    setStatusMessage('');
    api<CardDetail>(`/api/cards/${encodeURIComponent(editId)}`, { signal: controller.signal })
      .then((detail) => {
        applyDetailToForm(detail);
        setLoadedDetail(detail);
        setEditLoadState('ready');
        if (detail.aiStatus === 'pending' || detail.aiStatus === 'processing') {
          setSaveState('pending');
          setStatusMessage(isOriginalEditing ? '当前初始稿待重新整理' : '当前卡片待整理');
        } else if (detail.aiStatus === 'needs_input') {
          setSaveState('needs_input');
          setStatusMessage(isOriginalEditing ? '当前初始稿待完善' : '当前卡片待完善');
        } else {
          setSaveState('idle');
        }
      })
      .catch((error: unknown) => {
        if (isAbortError(error)) return;
        setEditLoadState('error');
      });

    return () => controller.abort();
  }, [applyDetailToForm, editId, editReloadKey, isOriginalEditing]);

  const clearFormValues = () => {
    setEntryMode('mistake');
    setTemplateName(entryTemplates[0].name);
    setRawInput('');
    setRawContentJson(emptyRawContentJson);
    setWrongPoint('');
    setAnalysis('');
    setMnemonic('');
    setExtension('');
    setNotes('');
    setSelectedPrimary([]);
    setSelectedSecondary([]);
    setSourceType('');
    setSourceDetail('');
    setTagText('');
    setStagedFiles([]);
    imageDragDepthRef.current = 0;
    setImageDragActive(false);
    setPersistedAttachments([]);
    setQuizItemEdits([]);
    setCurrentCardId(undefined);
    setRawEditorVersion((current) => current + 1);
    setRequiredErrors({});
    setValidationMessage('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const resetForm = () => {
    if (isEditing && loadedDetail) {
      applyDetailToForm(loadedDetail);
      setSaveState('idle');
      setStatusMessage('');
      setValidationMessage('');
      return;
    }
    clearFormValues();
    setSaveState('idle');
    setStatusMessage('');
    setValidationMessage('');
  };

  const togglePrimary = (category: string, selected: boolean) => {
    setSelectedPrimary((current) =>
      selected ? appendUnique(current, category) : current.filter((item) => item !== category),
    );
    if (!selected) {
      setSelectedSecondary((current) =>
        current.filter((item) => !item.startsWith(`${category}/`)),
      );
    }
  };

  const toggleSecondary = (category: string, selected: boolean) => {
    setSelectedSecondary((current) =>
      selected ? appendUnique(current, category) : current.filter((item) => item !== category),
    );
  };

  const addRecommendedTag = (tag: string) => {
    const next = appendUnique(userTags, tag);
    setTagText(next.join('，'));
  };

  const stageImageFiles = (files: File[]) => {
    if (isEditing) return false;
    const accepted = files.filter(({ type }) => acceptedImageTypeSet.has(type));
    if (accepted.length === 0) return false;
    setStagedFiles((current) => [...current, ...accepted]);
    return true;
  };

  const resetImageDrag = () => {
    imageDragDepthRef.current = 0;
    setImageDragActive(false);
  };

  const handleImageDragEnter = (event: ReactDragEvent<HTMLDivElement>) => {
    if (isEditing || !hasFileTransfer(event.dataTransfer)) return;
    event.preventDefault();
    imageDragDepthRef.current += 1;
    setImageDragActive(true);
  };

  const handleImageDragOver = (event: ReactDragEvent<HTMLDivElement>) => {
    if (!hasFileTransfer(event.dataTransfer)) return;
    event.preventDefault();
    if (isEditing) return;
    event.dataTransfer.dropEffect = 'copy';
  };

  const handleImageDragLeave = () => {
    imageDragDepthRef.current = Math.max(0, imageDragDepthRef.current - 1);
    if (imageDragDepthRef.current === 0) setImageDragActive(false);
  };

  const handleImageDrop = (event: ReactDragEvent<HTMLDivElement>) => {
    if (!hasFileTransfer(event.dataTransfer)) return;
    event.preventDefault();
    resetImageDrag();
    if (isEditing) return;
    stageImageFiles(Array.from(event.dataTransfer.files));
  };

  const handleImagePaste = (event: ReactClipboardEvent<HTMLElement>) => {
    if (isEditing) return;
    const files = imageFilesFromClipboard(event.clipboardData);
    if (!files.some(({ type }) => acceptedImageTypeSet.has(type))) return;
    event.preventDefault();
    stageImageFiles(files);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saveInFlightRef.current) return;

    const errors: RequiredErrors = {};
    if (selectedPrimary.length === 0) errors.categories = '请选择至少一个所属板块';
    if (selectedSecondary.length === 0) errors.subcategories = '请选择至少一个细分考点';
    if (!rawInput.trim()) errors.rawInput = '请输入原始内容';
    setRequiredErrors(errors);
    if (Object.keys(errors).length > 0) {
      setValidationMessage('请先补全必填内容后再保存');
      return;
    }
    setValidationMessage('');

    if (isEditing && !isOriginalEditing && quizItemEdits.some(({ question, answer }) => !question.trim() || !answer.trim())) {
      setValidationMessage('请补全背诵题面和答案后再保存');
      return;
    }

    if (currentCardId && stagedFiles.length > 0) {
      setSaveState('error');
      setStatusMessage('当前卡片暂不支持追加图片，请先移除待上传图片');
      return;
    }

    saveInFlightRef.current = true;
    setSaveState('saving');
    setStatusMessage(isOriginalEditing ? '正在保存初始稿并重新衍生问题' : isEditing ? '正在保存修改' : '正在保存并自动整理');
    try {
      const cardInput = {
        rawInput: rawInput.trim(),
        rawContentJson,
        wrongPoint,
        analysis,
        mnemonic,
        extension,
        notes,
        categoryIds,
        userTags,
        template: templateName,
        sourceType,
        sourceDetail,
      };
      let detail: CardDetail;
      let derivedCount: number | undefined;
      if (currentCardId && isOriginalEditing) {
        const result = await rewriteOriginalCard(currentCardId, cardInput);
        detail = result.card;
        derivedCount = result.derivedCount;
      } else if (currentCardId) {
        detail = await updateCard(currentCardId, {
          ...cardInput,
          ...(quizItemEdits.length > 0
            ? {
                quizItems: quizItemEdits.map(({ id, question, answer }) => ({
                  id,
                  question: question.trim(),
                  answer: answer.trim(),
                })),
              }
            : {}),
        });
      } else {
        detail = await createCard(
            {
              entryMode,
              ...cardInput,
              attachments: [],
            },
            stagedFiles,
          );
      }

      applySaveResult(detail, derivedCount);
    } catch (error) {
      setSaveState('error');
      setStatusMessage(saveFailureMessage(error));
    } finally {
      saveInFlightRef.current = false;
    }
  };

  const handleFormKeyDown = (event: ReactKeyboardEvent<HTMLFormElement>) => {
    if (
      event.defaultPrevented
      || event.nativeEvent.isComposing
      || event.altKey
      || event.shiftKey
      || (!event.ctrlKey && !event.metaKey)
    ) {
      return;
    }
    const isSave = event.key.toLowerCase() === 's';
    const isSubmit = event.key === 'Enter';
    if (!isSave && !isSubmit) return;
    event.preventDefault();
    event.currentTarget.requestSubmit();
  };

  const applySaveResult = (detail: CardDetail, derivedCount?: number) => {
    const resultState = detail.aiStatus === 'processing' ? 'pending' : detail.aiStatus;
    if (isEditing) {
      applyDetailToForm(detail);
      setLoadedDetail(detail);
      setSaveState(resultState);
      setStatusMessage(
        isOriginalEditing && resultState === 'ready'
          ? `初始稿已更新，并重新衍生 ${derivedCount ?? detail.quizItems.length} 个问题`
          : isOriginalEditing && resultState === 'pending'
            ? '初始稿已更新，等待重新整理'
            : isOriginalEditing
              ? '初始稿已更新，需要补充关系后再重新衍生'
              : resultState === 'ready'
          ? '已保存并完成整理'
          : resultState === 'pending'
            ? '已保存，等待重新整理'
            : '已保存，需要补充关系后再整理',
      );
      return;
    }
    clearFormValues();
    setSaveState(resultState);
    setStatusMessage(
      resultState === 'ready'
        ? `已生成 ${detail.quizItems.length} 个背诵方向，可继续录入下一条`
        : resultState === 'pending'
        ? '已保存，等待重新整理'
        : '已保存，需要补充关系后再整理，可继续录入下一条',
    );
  };

  if (editId && editLoadState === 'loading') {
    return (
      <section className="page entry-page">
        <header className="page__header"><h1 className="page__title">{isOriginalEditing ? '编辑初始稿' : '编辑卡片'}</h1></header>
        <StatusNotice state="loading" message={isOriginalEditing ? '正在加载初始稿' : '正在加载卡片'} />
      </section>
    );
  }

  if (editId && editLoadState === 'error') {
    return (
      <section className="page entry-page">
        <header className="page__header"><h1 className="page__title">{isOriginalEditing ? '编辑初始稿' : '编辑卡片'}</h1></header>
        <StatusNotice state="error" message={`${isOriginalEditing ? '初始稿' : '卡片'}加载失败，请稍后重试`} />
        <button className="button button--secondary entry-page__retry liquid-glass liquid-glass--thin liquid-pressable" onClick={() => setEditReloadKey((current) => current + 1)} type="button">重新加载</button>
      </section>
    );
  }

  return (
    <section className="page entry-page">
      <form aria-label={isOriginalEditing ? '编辑初始稿表单' : '录入卡片表单'} className="entry-form liquid-glass liquid-glass--regular" noValidate onKeyDown={handleFormKeyDown} onPaste={handleImagePaste} onSubmit={submit}>
        <header className="entry-page__topbar">
          <div className="entry-page__title-group">
            <h1 className="page__title">{isOriginalEditing ? '编辑初始稿' : isEditing ? '编辑卡片' : '录入'}</h1>
            <label className="entry-template-select">
              <span>模板</span>
              <select className="liquid-glass liquid-glass--thin liquid-glass__nested" value={templateName} onChange={(event) => setTemplateName(event.target.value)}>
                {entryTemplates.map(({ name }) => <option key={name}>{name}</option>)}
              </select>
            </label>
          </div>
          <div className="entry-page__actions">
            <button className="button button--secondary liquid-glass liquid-glass--thin liquid-glass__nested liquid-pressable" disabled={saveState === 'saving'} onClick={resetForm} type="button">
              <X aria-hidden="true" size={17} />
              取消
            </button>
            <button className="button button--primary entry-page__save liquid-glass liquid-glass--thin liquid-pressable" disabled={saveState === 'saving'} type="submit">
              {saveState === 'saving' ? <LoaderCircle aria-hidden="true" className="is-spinning" size={17} /> : <Save aria-hidden="true" size={17} />}
              {saveState === 'saving' ? '正在保存' : isOriginalEditing ? '保存并重新衍生' : isEditing ? '保存修改' : '保存并自动整理'}
            </button>
          </div>
        </header>

        <div className="entry-page__template-meta liquid-glass__nested">
          <span>适用范围：{selectedTemplate.applicableCategories.join('、')}</span>
        </div>

        <EditingToolbar
          feedback={editingFeedback}
          onFeedback={setEditingFeedback}
          target={editingTarget}
        />

        <div className="entry-layout">
          <div className="entry-content liquid-glass liquid-glass--regular">
            <div className="entry-field entry-field--raw">
              <label className="entry-field__label">原始内容 <span aria-hidden="true">*</span></label>
              <RichTextEditor
                hint={selectedTemplate.fieldHints.core}
                key={rawEditorVersion}
                onChange={({ text, json }) => {
                  setRawInput(text);
                  setRawContentJson(json);
                }}
                onTarget={setEditingTarget}
                value={rawContentJson}
              />
              <span className="entry-field__hint">{selectedTemplate.fieldHints.core}</span>
              {requiredErrors.rawInput ? <span className="entry-field__error">{requiredErrors.rawInput}</span> : null}
            </div>

            <div className="entry-content__fields">
              <TextAreaField label="错误选项或易错点" onChange={setWrongPoint} onTarget={setEditingTarget} placeholder={selectedTemplate.fieldHints.wrongPoint} value={wrongPoint} />
              <TextAreaField label="正确解析" onChange={setAnalysis} onTarget={setEditingTarget} placeholder={selectedTemplate.fieldHints.analysis} value={analysis} />
              <TextAreaField label="记忆速记口诀" onChange={setMnemonic} onTarget={setEditingTarget} placeholder={selectedTemplate.fieldHints.mnemonic} value={mnemonic} />
              <TextAreaField label="同类拓展知识点" onChange={setExtension} onTarget={setEditingTarget} placeholder={selectedTemplate.fieldHints.extension} value={extension} />
              <TextAreaField className="entry-field--wide" label="补充笔记" onChange={setNotes} onTarget={setEditingTarget} placeholder="记录需要长期保留的补充内容" value={notes} />
            </div>

            {isEditing && !isOriginalEditing && quizItemEdits.length > 0 ? (
              <QuizItemsEditor items={quizItemEdits} onChange={setQuizItemEdits} onTarget={setEditingTarget} />
            ) : null}

            <div className="entry-images">
              <label className="entry-field__label" htmlFor="entry-images">图片</label>
              <div
                aria-disabled={isEditing}
                aria-label="图片拖放与粘贴区域"
                className={`entry-images__dropzone liquid-glass liquid-glass--regular${imageDragActive ? ' is-drag-active' : ''}${isEditing ? ' is-disabled' : ''}`}
                onDragEnter={handleImageDragEnter}
                onDragLeave={handleImageDragLeave}
                onDragOver={handleImageDragOver}
                onDrop={handleImageDrop}
                role="group"
              >
                <button
                  className={`entry-images__picker liquid-glass liquid-glass--thin liquid-glass__nested liquid-pressable${isEditing ? ' is-disabled' : ''}`}
                  disabled={isEditing}
                  onClick={() => fileInputRef.current?.click()}
                  tabIndex={isEditing ? -1 : 0}
                  type="button"
                >
                  <Plus aria-hidden="true" size={17} />
                  {isEditing ? '编辑时不追加图片' : '选择本地图片'}
                </button>
                {isEditing ? <span className="entry-field__hint">已有图片会继续保留</span> : null}
                <input
                  accept={acceptedImageTypes.join(',')}
                  aria-hidden="true"
                  disabled={isEditing}
                  hidden
                  id="entry-images"
                  multiple
                  onChange={(event) => stageImageFiles(Array.from(event.target.files ?? []))}
                  ref={fileInputRef}
                  tabIndex={-1}
                  type="file"
                />
              </div>
              {stagedFiles.length > 0 ? (
                <ul aria-label="待上传图片" className="entry-images__list">
                  {stagedFiles.map((file, index) => (
                    <li className="liquid-glass__nested" key={`${file.name}-${file.size}-${index}`}>
                      <FileImage aria-hidden="true" size={16} />
                      <span>{file.name}</span>
                      <button aria-label={`移除图片 ${file.name}`} className="liquid-pressable" onClick={() => setStagedFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))} title={`移除图片 ${file.name}`} type="button">
                        <Trash2 aria-hidden="true" size={16} />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {persistedAttachments.map((attachment) => (
                <div className="entry-images__persisted liquid-glass__nested" key={attachment.id}>
                  <CircleCheck aria-hidden="true" size={16} />
                  已保存附件：{attachment.originalName}
                </div>
              ))}
            </div>
          </div>

          <aside className="entry-properties liquid-glass liquid-glass--regular" aria-label="卡片属性">
            <CategoryFields
              errors={requiredErrors}
              onPrimaryChange={togglePrimary}
              onSecondaryChange={toggleSecondary}
              selectedPrimary={selectedPrimary}
              selectedSecondary={selectedSecondary}
            />

            <div className="entry-property">
              <label htmlFor="entry-source-type">题目来源类型</label>
              <select className="liquid-glass liquid-glass--thin liquid-glass__nested" id="entry-source-type" value={sourceType} onChange={(event) => setSourceType(event.target.value)}>
                <option value="">未填写</option>
                <option>历年真题</option>
                <option>模拟题</option>
                <option>教材</option>
                <option>自建</option>
              </select>
              <label className="entry-property__sub-label" htmlFor="entry-source-detail">题目来源详情</label>
              <input className="liquid-glass liquid-glass--thin liquid-glass__nested" id="entry-source-detail" onChange={(event) => setSourceDetail(event.target.value)} placeholder="年份、考试或资料名称" value={sourceDetail} />
            </div>

            <div className="entry-property">
              <label htmlFor="entry-tags">标签</label>
              <input className="liquid-glass liquid-glass--thin liquid-glass__nested" id="entry-tags" onChange={(event) => setTagText(event.target.value)} placeholder="使用逗号分隔" value={tagText} />
              <div className="entry-recommended-tags" aria-label="推荐标签">
                {selectedTemplate.recommendedTags.map((tag) => (
                  <button aria-label={`添加推荐标签 ${tag}`} className="liquid-glass__nested liquid-pressable" key={tag} onClick={() => addRecommendedTag(tag)} type="button">
                    <Plus aria-hidden="true" size={13} />
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            <div className="entry-property entry-property--date liquid-glass__nested">
              <span>录入日期</span>
              <time dateTime={localDateValue()}>{localDateValue()}</time>
            </div>
          </aside>
        </div>

        {validationMessage ? <SaveNotice message={validationMessage} state="error" /> : null}
        {statusMessage ? <SaveNotice message={statusMessage} state={saveState} /> : null}
      </form>
    </section>
  );
}

interface TextAreaFieldProps {
  className?: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onTarget: (target: EditingTarget) => void;
}

function TextAreaField({ className = '', label, onChange, onTarget, placeholder, value }: TextAreaFieldProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const actionHistoryRef = useRef<string[]>([]);
  const target = useMemo<EditingTarget>(() => ({
    label,
    async copy() {
      const textarea = textareaRef.current;
      if (!textarea) return;
      const selected = textarea.value.slice(textarea.selectionStart, textarea.selectionEnd);
      await navigator.clipboard.writeText(selected || textarea.value);
    },
    async paste() {
      const textarea = textareaRef.current;
      if (!textarea) return;
      const text = await navigator.clipboard.readText();
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      actionHistoryRef.current.push(textarea.value);
      const next = `${textarea.value.slice(0, start)}${text}${textarea.value.slice(end)}`;
      onChange(next);
      queueMicrotask(() => {
        textarea.focus();
        textarea.setSelectionRange(start + text.length, start + text.length);
      });
    },
    selectAll() {
      const textarea = textareaRef.current;
      textarea?.focus();
      textarea?.setSelectionRange(0, textarea.value.length);
    },
    undo() {
      const textarea = textareaRef.current;
      if (!textarea) return;
      const previous = actionHistoryRef.current.pop();
      if (previous !== undefined) {
        onChange(previous);
        queueMicrotask(() => textarea.focus());
        return;
      }
      textarea.focus();
      if (typeof document.execCommand === 'function') document.execCommand('undo');
    },
    clear() {
      const textarea = textareaRef.current;
      if (!textarea || textarea.value === '') return;
      actionHistoryRef.current.push(textarea.value);
      onChange('');
      queueMicrotask(() => textarea.focus());
    },
  }), [label, onChange]);

  return (
    <label className={`entry-field ${className}`.trim()}>
      <span className="entry-field__label">{label}</span>
      <textarea
        aria-label={label}
        className="liquid-glass liquid-glass--thin liquid-glass__nested"
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => onTarget(target)}
        placeholder={placeholder}
        ref={textareaRef}
        rows={4}
        value={value}
      />
    </label>
  );
}

interface QuizItemsEditorProps {
  items: EditableQuizItem[];
  onChange: (items: EditableQuizItem[]) => void;
  onTarget: (target: EditingTarget) => void;
}

function QuizItemsEditor({ items, onChange, onTarget }: QuizItemsEditorProps) {
  const updateItem = (id: string, field: 'question' | 'answer', value: string) => {
    onChange(items.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  };

  return (
    <section className="entry-quiz-editor" aria-labelledby="entry-quiz-editor-title">
      <h2 id="entry-quiz-editor-title">背诵题面</h2>
      <div className="entry-quiz-editor__list">
        {items.map((item, index) => (
          <div className="entry-quiz-item liquid-glass__nested" key={item.id}>
            <div className="entry-quiz-item__header">
              <span>{quizDirectionLabels[item.direction]}</span>
              <strong>第 {index + 1} 题</strong>
            </div>
            <TextAreaField
              label={`第 ${index + 1} 题题目`}
              onChange={(value) => updateItem(item.id, 'question', value)}
              onTarget={onTarget}
              placeholder="填写背诵时展示的题目"
              value={item.question}
            />
            <TextAreaField
              label={`第 ${index + 1} 题答案`}
              onChange={(value) => updateItem(item.id, 'answer', value)}
              onTarget={onTarget}
              placeholder="填写查看答案后展示的内容"
              value={item.answer}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

function EditingToolbar({
  feedback,
  onFeedback,
  target,
}: {
  feedback: string;
  onFeedback: (message: string) => void;
  target?: EditingTarget;
}) {
  const runClipboard = async (action: 'copy' | 'paste') => {
    if (!target) return;
    try {
      await target[action]();
      onFeedback(action === 'copy' ? `已复制${target.label}` : `已粘贴到${target.label}`);
    } catch {
      onFeedback(
        action === 'copy'
          ? '无法写入剪贴板，请使用 Ctrl/Cmd+C'
          : '无法读取剪贴板，请使用 Ctrl/Cmd+V',
      );
    }
  };
  const preventSelectionLoss = (event: ReactMouseEvent<HTMLButtonElement>) => event.preventDefault();

  return (
    <div className="entry-edit-toolbar liquid-glass liquid-glass--thin liquid-glass__nested" role="toolbar" aria-label="快捷编辑">
      <span>快捷编辑</span>
      <button aria-label="复制当前编辑区" className="liquid-pressable" disabled={!target} onClick={() => void runClipboard('copy')} onMouseDown={preventSelectionLoss} title="复制" type="button"><Copy aria-hidden="true" size={17} /></button>
      <button aria-label="粘贴到当前编辑区" className="liquid-pressable" disabled={!target} onClick={() => void runClipboard('paste')} onMouseDown={preventSelectionLoss} title="粘贴" type="button"><ClipboardPaste aria-hidden="true" size={17} /></button>
      <button aria-label="全选当前编辑区" className="liquid-pressable" disabled={!target} onClick={() => { target?.selectAll(); if (target) onFeedback(`已全选${target.label}`); }} onMouseDown={preventSelectionLoss} title="全选" type="button"><TextSelect aria-hidden="true" size={17} /></button>
      <button aria-label="撤销当前编辑区" className="liquid-pressable" disabled={!target} onClick={() => { target?.undo(); if (target) onFeedback(`已撤销${target.label}`); }} onMouseDown={preventSelectionLoss} title="撤销" type="button"><Undo2 aria-hidden="true" size={17} /></button>
      <button aria-label="清空当前编辑区" className="liquid-pressable" disabled={!target} onClick={() => { target?.clear(); if (target) onFeedback(`已清空${target.label}`); }} onMouseDown={preventSelectionLoss} title="清空" type="button"><Trash2 aria-hidden="true" size={17} /></button>
      {feedback ? <span className="entry-edit-toolbar__feedback" role="status">{feedback}</span> : null}
    </div>
  );
}

interface CategoryFieldsProps {
  errors: RequiredErrors;
  selectedPrimary: string[];
  selectedSecondary: string[];
  onPrimaryChange: (category: string, selected: boolean) => void;
  onSecondaryChange: (category: string, selected: boolean) => void;
}

function CategoryFields({ errors, onPrimaryChange, onSecondaryChange, selectedPrimary, selectedSecondary }: CategoryFieldsProps) {
  return (
    <div className="entry-property entry-categories">
      <fieldset>
        <legend>所属板块 <span aria-hidden="true">*</span></legend>
        <div className="entry-categories__primary">
          {primaryCategories.map(([category]) => (
            <label className="liquid-pressable" key={category}>
              <input checked={selectedPrimary.includes(category)} onChange={(event) => onPrimaryChange(category, event.target.checked)} type="checkbox" />
              <span>{category}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {errors.categories ? <span className="entry-field__error">{errors.categories}</span> : null}

      {selectedPrimary.map((parent) => {
        const children = categoryCatalog[parent as keyof typeof categoryCatalog];
        return (
          <fieldset className="entry-categories__secondary" key={parent}>
            <legend>{parent}细分考点 <span aria-hidden="true">*</span></legend>
            <div>
              {children.map((child) => {
                const id = `${parent}/${child}`;
                return (
                  <label className="liquid-pressable" key={id}>
                    <input checked={selectedSecondary.includes(id)} onChange={(event) => onSecondaryChange(id, event.target.checked)} type="checkbox" />
                    <span>{child}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        );
      })}
      {errors.subcategories ? <span className="entry-field__error">{errors.subcategories}</span> : null}
    </div>
  );
}

function SaveNotice({ message, state }: { message: string; state: SaveState }) {
  const isError = state === 'error';
  const Icon = isError ? CircleAlert : state === 'saving' ? LoaderCircle : CircleCheck;
  return (
    <div className="entry-save-notice liquid-glass liquid-glass--regular" data-state={state} role={isError ? 'alert' : 'status'}>
      <Icon aria-hidden="true" className={state === 'saving' ? 'is-spinning' : undefined} size={18} />
      <span>{message}</span>
    </div>
  );
}

async function createCard(input: CreateCardInput, files: File[]) {
  const formData = new FormData();
  formData.set('payload', JSON.stringify(input));
  for (const file of files) formData.append('image', file);
  return apiForm<CardDetail>('/api/cards', formData);
}

async function updateCard(cardId: string, input: CardUpdateInput) {
  return api<CardDetail>(`/api/cards/${cardId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

async function rewriteOriginalCard(cardId: string, input: OriginalCardRewriteInput) {
  return api<OriginalCardRewriteResult>(`/api/cards/${cardId}/original`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

function normalizeTags(value: string) {
  return [...new Set(value.split(/[，,\n]/).map((tag) => tag.trim()).filter(Boolean))];
}

function saveFailureMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === 'processing_conflict') return error.message;
    if (error.code === 'invalid_request') return '保存内容不完整，请检查原始内容、分类和字段后再试';
  }
  return '保存失败，请稍后重试';
}

function appendUnique(values: string[], value: string) {
  return values.includes(value) ? values : [...values, value];
}

function hasFileTransfer(dataTransfer: DataTransfer) {
  return dataTransfer.files.length > 0 || Array.from(dataTransfer.types).includes('Files');
}

function imageFilesFromClipboard(dataTransfer: DataTransfer) {
  const files = Array.from(dataTransfer.files ?? []);
  if (files.length > 0) return files;
  return Array.from(dataTransfer.items ?? [])
    .filter(({ kind }) => kind === 'file')
    .map((item) => item.getAsFile())
    .filter((file): file is File => file !== null);
}

function localDateValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function rawContentForText(text: string) {
  return JSON.stringify({
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: text ? [{ type: 'text', text }] : undefined,
      },
    ],
  });
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError';
}
