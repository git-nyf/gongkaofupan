import { useMemo, useRef, useState, type FormEvent } from 'react';
import { CircleAlert, CircleCheck, FileImage, LoaderCircle, Plus, Save, Trash2, X } from 'lucide-react';
import type { CardDetail, CardUpdateInput, CreateCardInput, EntryMode, Mastery } from '../../shared/contracts';
import { categoryCatalog } from '../../server/catalog/categories';
import { api, apiForm } from '../api/client';
import { entryTemplates } from '../catalog/templates';
import { RichTextEditor } from '../components/RichTextEditor';

type Rating = 1 | 2 | 3 | 4 | 5;
type SaveState = 'idle' | 'saving' | 'ready' | 'pending' | 'needs_input' | 'error';

interface RequiredErrors {
  categories?: string;
  subcategories?: string;
  rawInput?: string;
}

interface PersistedAttachment {
  id: string;
  originalName: string;
}

const emptyRawContentJson = JSON.stringify({
  type: 'doc',
  content: [{ type: 'paragraph' }],
});

const primaryCategories = Object.entries(categoryCatalog) as Array<
  [keyof typeof categoryCatalog, readonly string[]]
>;

export function EntryPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
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
  const [rating, setRating] = useState<Rating>(3);
  const [mastery, setMastery] = useState<Mastery>('unseen');
  const [tagText, setTagText] = useState('');
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [persistedAttachments, setPersistedAttachments] = useState<PersistedAttachment[]>([]);
  const [currentCardId, setCurrentCardId] = useState<string>();
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [requiredErrors, setRequiredErrors] = useState<RequiredErrors>({});

  const selectedTemplate = useMemo(
    () => entryTemplates.find(({ name }) => name === templateName) ?? entryTemplates[0],
    [templateName],
  );
  const userTags = useMemo(() => normalizeTags(tagText), [tagText]);
  const categoryIds = useMemo(
    () => [...selectedPrimary, ...selectedSecondary],
    [selectedPrimary, selectedSecondary],
  );

  const resetForm = () => {
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
    setRating(3);
    setMastery('unseen');
    setTagText('');
    setStagedFiles([]);
    setPersistedAttachments([]);
    setCurrentCardId(undefined);
    setSaveState('idle');
    setStatusMessage('');
    setRequiredErrors({});
    if (fileInputRef.current) fileInputRef.current.value = '';
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

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saveState === 'saving') return;

    const errors: RequiredErrors = {};
    if (selectedPrimary.length === 0) errors.categories = '请选择至少一个所属板块';
    if (selectedSecondary.length === 0) errors.subcategories = '请选择至少一个细分考点';
    if (!rawInput.trim()) errors.rawInput = '请输入原始内容';
    setRequiredErrors(errors);
    if (Object.keys(errors).length > 0) return;

    if (currentCardId && stagedFiles.length > 0) {
      setSaveState('error');
      setStatusMessage('当前卡片暂不支持追加图片，请先移除待上传图片');
      return;
    }

    setSaveState('saving');
    setStatusMessage('正在保存并自动整理');
    try {
      const detail = currentCardId
        ? await updateCard(currentCardId, {
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
            rating,
            mastery,
          })
        : await createCard(
            {
              entryMode,
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
              rating,
              initialMastery: mastery,
              attachments: [],
            },
            stagedFiles,
          );

      applySaveResult(detail);
    } catch {
      setSaveState('error');
      setStatusMessage('保存失败，请稍后重试');
    }
  };

  const applySaveResult = (detail: CardDetail) => {
    const resultState = detail.aiStatus === 'processing' ? 'pending' : detail.aiStatus;
    setStagedFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setPersistedAttachments(
      detail.attachments.map(({ id, originalName }) => ({ id, originalName })),
    );
    setSaveState(resultState);
    if (resultState === 'ready') {
      setCurrentCardId(undefined);
      setStatusMessage(`已生成 ${detail.quizItems.length} 个背诵方向`);
      return;
    }
    setCurrentCardId(detail.id);
    setStatusMessage(
      resultState === 'pending'
        ? '已保存，等待重新整理'
        : '已保存，需要补充关系后再整理',
    );
  };

  return (
    <section className="page entry-page">
      <form className="entry-form" noValidate onSubmit={submit}>
        <header className="entry-page__topbar">
          <div className="entry-page__title-group">
            <h1 className="page__title">录入</h1>
            <fieldset className="entry-mode" aria-label="录入模式">
              <label>
                <input
                  checked={entryMode === 'mistake'}
                  name="entry-mode"
                  onChange={() => setEntryMode('mistake')}
                  type="radio"
                />
                <span>错题录入</span>
              </label>
              <label>
                <input
                  checked={entryMode === 'knowledge'}
                  name="entry-mode"
                  onChange={() => setEntryMode('knowledge')}
                  type="radio"
                />
                <span>知识点积累</span>
              </label>
            </fieldset>
            <label className="entry-template-select">
              <span>模板</span>
              <select value={templateName} onChange={(event) => setTemplateName(event.target.value)}>
                {entryTemplates.map(({ name }) => <option key={name}>{name}</option>)}
              </select>
            </label>
          </div>
          <div className="entry-page__actions">
            <button className="button button--secondary" onClick={resetForm} type="button">
              <X aria-hidden="true" size={17} />
              取消
            </button>
            <button className="button button--primary entry-page__save" disabled={saveState === 'saving'} type="submit">
              {saveState === 'saving' ? <LoaderCircle aria-hidden="true" className="is-spinning" size={17} /> : <Save aria-hidden="true" size={17} />}
              {saveState === 'saving' ? '正在保存' : '保存并自动整理'}
            </button>
          </div>
        </header>

        <div className="entry-page__template-meta">
          <span>适用范围：{selectedTemplate.applicableCategories.join('、')}</span>
        </div>

        <div className="entry-layout">
          <main className="entry-content">
            <div className="entry-field entry-field--raw">
              <label className="entry-field__label">原始内容 <span aria-hidden="true">*</span></label>
              <RichTextEditor
                hint={selectedTemplate.fieldHints.core}
                onChange={({ text, json }) => {
                  setRawInput(text);
                  setRawContentJson(json);
                }}
                value={rawContentJson}
              />
              <span className="entry-field__hint">{selectedTemplate.fieldHints.core}</span>
              {requiredErrors.rawInput ? <span className="entry-field__error">{requiredErrors.rawInput}</span> : null}
            </div>

            <div className="entry-content__fields">
              <TextAreaField label="错误选项或易错点" onChange={setWrongPoint} placeholder={selectedTemplate.fieldHints.wrongPoint} value={wrongPoint} />
              <TextAreaField label="正确解析" onChange={setAnalysis} placeholder={selectedTemplate.fieldHints.analysis} value={analysis} />
              <TextAreaField label="记忆速记口诀" onChange={setMnemonic} placeholder={selectedTemplate.fieldHints.mnemonic} value={mnemonic} />
              <TextAreaField label="同类拓展知识点" onChange={setExtension} placeholder={selectedTemplate.fieldHints.extension} value={extension} />
              <TextAreaField className="entry-field--wide" label="补充笔记" onChange={setNotes} placeholder="记录需要长期保留的补充内容" value={notes} />
            </div>

            <div className="entry-images">
              <label className="entry-field__label" htmlFor="entry-images">图片</label>
              <label className="entry-images__picker" htmlFor="entry-images">
                <Plus aria-hidden="true" size={17} />
                选择本地图片
              </label>
              <input
                accept="image/png,image/jpeg,image/webp"
                id="entry-images"
                multiple
                onChange={(event) => setStagedFiles((current) => [...current, ...Array.from(event.target.files ?? [])])}
                ref={fileInputRef}
                type="file"
              />
              {stagedFiles.length > 0 ? (
                <ul className="entry-images__list">
                  {stagedFiles.map((file, index) => (
                    <li key={`${file.name}-${file.size}-${index}`}>
                      <FileImage aria-hidden="true" size={16} />
                      <span>{file.name}</span>
                      <button aria-label={`移除图片 ${file.name}`} onClick={() => setStagedFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))} title={`移除图片 ${file.name}`} type="button">
                        <Trash2 aria-hidden="true" size={16} />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {persistedAttachments.map((attachment) => (
                <div className="entry-images__persisted" key={attachment.id}>
                  <CircleCheck aria-hidden="true" size={16} />
                  已保存附件：{attachment.originalName}
                </div>
              ))}
            </div>
          </main>

          <aside className="entry-properties" aria-label="卡片属性">
            <CategoryFields
              errors={requiredErrors}
              onPrimaryChange={togglePrimary}
              onSecondaryChange={toggleSecondary}
              selectedPrimary={selectedPrimary}
              selectedSecondary={selectedSecondary}
            />

            <div className="entry-property">
              <label htmlFor="entry-source-type">题目来源类型</label>
              <select id="entry-source-type" value={sourceType} onChange={(event) => setSourceType(event.target.value)}>
                <option value="">未填写</option>
                <option>历年真题</option>
                <option>模拟题</option>
                <option>教材</option>
                <option>自建</option>
              </select>
              <label className="entry-property__sub-label" htmlFor="entry-source-detail">题目来源详情</label>
              <input id="entry-source-detail" onChange={(event) => setSourceDetail(event.target.value)} placeholder="年份、考试或资料名称" value={sourceDetail} />
            </div>

            <div className="entry-properties__row">
              <label className="entry-property">
                <span>星级</span>
                <select aria-label="星级" onChange={(event) => setRating(Number(event.target.value) as Rating)} value={rating}>
                  {[1, 2, 3, 4, 5].map((item) => <option key={item} value={item}>{item} 星</option>)}
                </select>
              </label>
              <label className="entry-property">
                <span>掌握程度</span>
                <select aria-label="掌握程度" onChange={(event) => setMastery(event.target.value as Mastery)} value={mastery}>
                  <option value="unseen">未学习</option>
                  <option value="again">完全不会</option>
                  <option value="hard">记忆模糊</option>
                  <option value="good">熟练掌握</option>
                </select>
              </label>
            </div>

            <div className="entry-property">
              <label htmlFor="entry-tags">标签</label>
              <input id="entry-tags" onChange={(event) => setTagText(event.target.value)} placeholder="使用逗号分隔" value={tagText} />
              <div className="entry-recommended-tags" aria-label="推荐标签">
                {selectedTemplate.recommendedTags.map((tag) => (
                  <button aria-label={`添加推荐标签 ${tag}`} key={tag} onClick={() => addRecommendedTag(tag)} type="button">
                    <Plus aria-hidden="true" size={13} />
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            <div className="entry-property entry-property--date">
              <span>录入日期</span>
              <time dateTime={localDateValue()}>{localDateValue()}</time>
            </div>
          </aside>
        </div>

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
}

function TextAreaField({ className = '', label, onChange, placeholder, value }: TextAreaFieldProps) {
  return (
    <label className={`entry-field ${className}`.trim()}>
      <span className="entry-field__label">{label}</span>
      <textarea aria-label={label} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={4} value={value} />
    </label>
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
            <label key={category}>
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
                  <label key={id}>
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
    <div className="entry-save-notice" data-state={state} role={isError ? 'alert' : 'status'}>
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

function normalizeTags(value: string) {
  return [...new Set(value.split(/[，,\n]/).map((tag) => tag.trim()).filter(Boolean))];
}

function appendUnique(values: string[], value: string) {
  return values.includes(value) ? values : [...values, value];
}

function localDateValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
