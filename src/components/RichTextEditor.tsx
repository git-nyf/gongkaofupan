import { useEffect, useMemo } from 'react';
import type { JSONContent } from '@tiptap/core';
import Bold from '@tiptap/extension-bold';
import Color from '@tiptap/extension-color';
import Document from '@tiptap/extension-document';
import History from '@tiptap/extension-history';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import TextStyle from '@tiptap/extension-text-style';
import { EditorContent, useEditor } from '@tiptap/react';
import { Bold as BoldIcon, Sigma } from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  hint: string;
  onChange: (value: { text: string; json: string }) => void;
}

const emptyDocument: JSONContent = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
};

const editorExtensions = [Document, Paragraph, Text, Bold, TextStyle, Color, History];
const formulaText = '现期量 = 基期量 × (1 + 增长率)';
const editorColors = [
  { name: '朱红', value: '#c64232' },
  { name: '炭灰', value: '#23262b' },
  { name: '深绿', value: '#28735e' },
] as const;
const allowedColors = new Set(editorColors.map(({ value }) => value));

export function RichTextEditor({ value, hint, onChange }: RichTextEditorProps) {
  const controlledContent = useMemo(() => parseControlledDocument(value), [value]);
  const editor = useEditor({
    extensions: editorExtensions,
    content: controlledContent,
    editorProps: {
      attributes: {
        'aria-label': '原始内容',
        'aria-multiline': 'true',
        'data-hint': hint,
        class: 'rich-text-editor__content',
        role: 'textbox',
      },
      handlePaste(view, event) {
        const plainText = event.clipboardData?.getData('text/plain') ?? '';
        view.dispatch(view.state.tr.insertText(plainText));
        return true;
      },
    },
    onUpdate({ editor: activeEditor }) {
      onChange({
        text: activeEditor.getText(),
        json: JSON.stringify(activeEditor.getJSON()),
      });
    },
  });

  useEffect(() => {
    if (!editor) return;
    const current = JSON.stringify(editor.getJSON());
    const next = JSON.stringify(controlledContent);
    if (current !== next) editor.commands.setContent(controlledContent, false);
    editor.setOptions({
      editorProps: {
        ...editor.options.editorProps,
        attributes: {
          ...editor.options.editorProps.attributes,
          'aria-label': '原始内容',
          'aria-multiline': 'true',
          'data-hint': hint,
          class: 'rich-text-editor__content',
          role: 'textbox',
        },
      },
    });
  }, [controlledContent, editor, hint]);

  return (
    <div className="rich-text-editor">
      <div className="rich-text-editor__toolbar" role="toolbar" aria-label="原始内容格式">
        <button
          aria-label="加粗"
          className={editor?.isActive('bold') ? 'is-active' : undefined}
          disabled={!editor}
          onClick={() => editor?.chain().focus().toggleBold().run()}
          title="加粗"
          type="button"
        >
          <BoldIcon aria-hidden="true" size={18} />
        </button>
        {editorColors.map((color) => (
          <button
            aria-label={`文字颜色 ${color.name}`}
            className="rich-text-editor__swatch"
            disabled={!editor}
            key={color.value}
            onClick={() => editor?.chain().focus().setColor(color.value).run()}
            style={{ '--swatch-color': color.value } as React.CSSProperties}
            title={`文字颜色 ${color.name}`}
            type="button"
          >
            <span aria-hidden="true" />
          </button>
        ))}
        <button
          aria-label="插入公式文本"
          disabled={!editor}
          onClick={() => editor?.chain().focus().insertContent({ type: 'text', text: formulaText }).run()}
          title="插入公式文本"
          type="button"
        >
          <Sigma aria-hidden="true" size={18} />
        </button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

function parseControlledDocument(value: string): JSONContent {
  try {
    const parsed: unknown = JSON.parse(value);
    return isAllowedDocument(parsed) ? parsed : emptyDocument;
  } catch {
    return emptyDocument;
  }
}

function isAllowedDocument(value: unknown): value is JSONContent {
  if (!isRecord(value) || value.type !== 'doc' || !Array.isArray(value.content)) return false;
  return value.content.length > 0 && value.content.every(isAllowedParagraph);
}

function isAllowedParagraph(value: unknown) {
  if (!isRecord(value) || value.type !== 'paragraph') return false;
  if (value.content === undefined) return true;
  return Array.isArray(value.content) && value.content.every(isAllowedText);
}

function isAllowedText(value: unknown) {
  if (!isRecord(value) || value.type !== 'text' || typeof value.text !== 'string') return false;
  if (value.marks === undefined) return true;
  return Array.isArray(value.marks) && value.marks.every(isAllowedMark);
}

function isAllowedMark(value: unknown) {
  if (!isRecord(value)) return false;
  if (value.type === 'bold') return value.attrs === undefined;
  if (value.type !== 'textStyle' || !isRecord(value.attrs)) return false;
  return Object.keys(value.attrs).length === 1 && allowedColors.has(value.attrs.color as never);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
