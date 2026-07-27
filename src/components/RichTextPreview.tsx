import { Fragment, type ReactNode } from 'react';

interface RichTextPreviewProps {
  contentJson: string | null;
  fallback: string;
}

const allowedColors = new Set(['#c64232', '#23262b', '#28735e']);

export function RichTextPreview({ contentJson, fallback }: RichTextPreviewProps) {
  const paragraphs = parseDocument(contentJson);
  const documentText = paragraphs
    ?.map((paragraph) => paragraph.map(({ text }) => text).join(''))
    .join('\n\n');
  if (!paragraphs || normalizeText(documentText ?? '') !== normalizeText(fallback)) {
    return <span className="rich-text-preview">{fallback}</span>;
  }

  return (
    <span className="rich-text-preview">
      {paragraphs.map((paragraph, index) => (
        <Fragment key={index}>
          {index > 0 ? <br /> : null}
          {paragraph.map((node, nodeIndex) => renderTextNode(node, nodeIndex))}
        </Fragment>
      ))}
    </span>
  );
}

interface TextNode {
  marks?: Array<{
    attrs?: { color?: string };
    type?: string;
  }>;
  text: string;
  type: 'text';
}

function parseDocument(contentJson: string | null): TextNode[][] | null {
  if (!contentJson) return null;
  try {
    const document: unknown = JSON.parse(contentJson);
    if (!isRecord(document) || document.type !== 'doc' || !Array.isArray(document.content)) {
      return null;
    }

    const paragraphs: TextNode[][] = [];
    for (const paragraph of document.content) {
      if (!isRecord(paragraph) || paragraph.type !== 'paragraph') return null;
      if (paragraph.content === undefined) {
        paragraphs.push([]);
        continue;
      }
      if (!Array.isArray(paragraph.content)) return null;

      const textNodes: TextNode[] = [];
      for (const node of paragraph.content) {
        if (!isTextNode(node)) return null;
        textNodes.push(node);
      }
      paragraphs.push(textNodes);
    }
    return paragraphs.length > 0 ? paragraphs : null;
  } catch {
    return null;
  }
}

function renderTextNode(node: TextNode, key: number): ReactNode {
  let bold = false;
  let color: string | undefined;
  for (const mark of node.marks ?? []) {
    if (mark.type === 'bold') {
      bold = true;
      continue;
    }
    if (
      mark.type === 'textStyle' &&
      mark.attrs?.color &&
      allowedColors.has(mark.attrs.color)
    ) {
      color = mark.attrs.color;
      continue;
    }
    return <Fragment key={key}>{node.text}</Fragment>;
  }

  const text = color
    ? <span style={{ color }}>{node.text}</span>
    : node.text;
  return bold
    ? <strong key={key}>{text}</strong>
    : <Fragment key={key}>{text}</Fragment>;
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function isTextNode(value: unknown): value is TextNode {
  if (!isRecord(value) || value.type !== 'text' || typeof value.text !== 'string') return false;
  if (value.marks === undefined) return true;
  return Array.isArray(value.marks) && value.marks.every((mark) => isRecord(mark));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
