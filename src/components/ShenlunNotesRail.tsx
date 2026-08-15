import { ChevronDown, ChevronUp, FileUp, Link2, Pencil, Trash2, X } from 'lucide-react';
import type { ShenlunAnnotation } from '../shenlun/draft';
import type { ShenlunNotePart } from '../shenlun/notes';

interface ShenlunNotesRailProps {
  standardAnswer: string;
  standardAnswerError: string;
  notes: string;
  noteParts: ShenlunNotePart[];
  annotations: ShenlunAnnotation[];
  editingAnnotationId: string | null;
  selectionQuote?: string;
  annotationDraft: string;
  onStandardAnswerChange: (value: string) => void;
  onImportStandardAnswer: (file: File) => void;
  onNotesChange: (value: string) => void;
  onAnnotationDraftChange: (value: string) => void;
  onSaveAnnotation: () => void;
  onCancelAnnotation: () => void;
  onEditAnnotation: (annotation: ShenlunAnnotation) => void;
  onDeleteAnnotation: (id: string) => void;
  onMoveAnnotation: (id: string, direction: -1 | 1) => void;
}

export function ShenlunNotesRail({
  standardAnswer,
  standardAnswerError,
  notes,
  noteParts,
  annotations,
  editingAnnotationId,
  selectionQuote,
  annotationDraft,
  onStandardAnswerChange,
  onImportStandardAnswer,
  onNotesChange,
  onAnnotationDraftChange,
  onSaveAnnotation,
  onCancelAnnotation,
  onEditAnnotation,
  onDeleteAnnotation,
  onMoveAnnotation,
}: ShenlunNotesRailProps) {
  return (
    <aside aria-label="标准答案、批注与备注" className="shenlun-notes-rail">
      <section className="shenlun-standard-answer" aria-labelledby="shenlun-answer-title">
        <div className="shenlun-rail-heading">
          <h2 id="shenlun-answer-title">标准答案</h2>
          <label className="shenlun-file-import liquid-pressable">
            <FileUp aria-hidden="true" size={15} />
            <span>导入 .txt/.md</span>
            <input
              accept=".txt,.md,text/plain,text/markdown"
              aria-label="导入标准答案文件"
              type="file"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file) onImportStandardAnswer(file);
                event.currentTarget.value = '';
              }}
            />
          </label>
        </div>
        <textarea
          aria-label="标准答案"
          placeholder="输入或粘贴标准答案，用于右侧对照"
          rows={7}
          value={standardAnswer}
          onChange={(event) => onStandardAnswerChange(event.currentTarget.value)}
        />
        <div className="shenlun-standard-answer__print">{standardAnswer || '未填写'}</div>
        {standardAnswerError ? <p className="shenlun-status" role="alert">{standardAnswerError}</p> : null}
      </section>

      <section className="shenlun-note-editor" aria-labelledby="shenlun-notes-title">
        <div className="shenlun-rail-heading">
          <h2 id="shenlun-notes-title">普通备注</h2>
          <span>可关联复盘</span>
        </div>
        <textarea
          aria-label="普通备注"
          placeholder="记录提纲、论据或复盘链接"
          rows={5}
          value={notes}
          onChange={(event) => onNotesChange(event.currentTarget.value)}
        />
        {notes ? (
          <div className="shenlun-note-preview" aria-label="备注预览">
            {noteParts.map((part, index) => part.type === 'link' ? (
              <a className="shenlun-note-link" href={part.href} key={`${part.href}-${index}`}>
                <Link2 aria-hidden="true" size={13} />
                {part.text}
              </a>
            ) : (
              <span key={`${part.text}-${index}`}>{part.text}</span>
            ))}
          </div>
        ) : null}
      </section>

      <section className="shenlun-annotation-list" aria-labelledby="shenlun-annotation-title">
        <div className="shenlun-rail-heading">
          <h2 id="shenlun-annotation-title">批注</h2>
          <span>{annotations.length} 条</span>
        </div>
        {editingAnnotationId === 'new' ? (
          <article className="shenlun-annotation-card shenlun-annotation-card--draft" id="shenlun-annotation-draft">
            <p className="shenlun-annotation-card__quote">“{selectionQuote ?? ''}”</p>
            <AnnotationEditor
              value={annotationDraft}
              onCancel={onCancelAnnotation}
              onChange={onAnnotationDraftChange}
              onSave={onSaveAnnotation}
            />
          </article>
        ) : annotations.length === 0 ? (
          <p className="shenlun-annotation-empty">选择答题纸中的文字后添加批注</p>
        ) : annotations.map((annotation, index) => (
          <article
            className={`shenlun-annotation-card${annotation.detached ? ' shenlun-annotation-card--detached' : ''}`}
            id={`shenlun-annotation-${annotation.id}`}
            key={annotation.id}
          >
            <p className="shenlun-annotation-card__quote">“{annotation.quote}”</p>
            {editingAnnotationId === annotation.id ? (
              <AnnotationEditor
                value={annotationDraft}
                onCancel={onCancelAnnotation}
                onChange={onAnnotationDraftChange}
                onSave={onSaveAnnotation}
              />
            ) : (
              <>
                <p className="shenlun-annotation-card__body">{annotation.body}</p>
                {annotation.detached ? <small>原文位置已变化</small> : null}
                <div className="shenlun-card-actions">
                  <div className="shenlun-annotation-order">
                    <button aria-label={`上移批注 ${annotation.quote}`} disabled={index === 0} title="上移" type="button" onClick={() => onMoveAnnotation(annotation.id, -1)}><ChevronUp aria-hidden="true" size={15} /></button>
                    <button aria-label={`下移批注 ${annotation.quote}`} disabled={index === annotations.length - 1} title="下移" type="button" onClick={() => onMoveAnnotation(annotation.id, 1)}><ChevronDown aria-hidden="true" size={15} /></button>
                  </div>
                  <button aria-label={`编辑批注 ${annotation.quote}`} title="编辑批注" type="button" onClick={() => onEditAnnotation(annotation)}><Pencil aria-hidden="true" size={15} /></button>
                  <button aria-label={`删除批注 ${annotation.quote}`} title="删除批注" type="button" onClick={() => onDeleteAnnotation(annotation.id)}><Trash2 aria-hidden="true" size={15} /></button>
                </div>
              </>
            )}
          </article>
        ))}
      </section>
    </aside>
  );
}

function AnnotationEditor({ value, onCancel, onChange, onSave }: {
  value: string;
  onCancel: () => void;
  onChange: (value: string) => void;
  onSave: () => void;
}) {
  return (
    <div className="shenlun-annotation-editor">
      <textarea
        aria-label="批注内容"
        rows={3}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            onCancel();
          }
        }}
      />
      <div className="shenlun-card-actions">
        <button type="button" onClick={onSave}>保存批注</button>
        <button aria-label="取消批注编辑" title="取消" type="button" onClick={onCancel}><X aria-hidden="true" size={15} /></button>
      </div>
    </div>
  );
}
