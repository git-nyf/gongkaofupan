import { Fragment, type ReactNode } from 'react';

interface MathTextProps {
  className?: string;
  text: string;
}

interface TextSegment {
  display: boolean;
  math: boolean;
  value: string;
}

const symbolCommands: Record<string, string> = {
  approx: '≈',
  cdot: '·',
  Delta: 'Δ',
  div: '÷',
  ge: '≥',
  le: '≤',
  ne: '≠',
  pm: '±',
  times: '×',
};

export function MathText({ className, text }: MathTextProps) {
  return (
    <span className={['math-text', className].filter(Boolean).join(' ')}>
      {splitMathText(text).map((segment, index) => (
        <Fragment key={String(index) + ':' + segment.value}>
          {segment.math
            ? <Formula display={segment.display} source={segment.value} />
            : segment.value}
        </Fragment>
      ))}
    </span>
  );
}

function Formula({ display, source }: { display: boolean; source: string }) {
  try {
    return (
      <span
        aria-label={'公式：' + formulaLabel(source)}
        className={'math-expression' + (display ? ' math-expression--display' : '')}
        role="img"
      >
        <span aria-hidden="true">{renderFormula(source)}</span>
      </span>
    );
  } catch {
    return (
      <span className="math-expression math-expression--fallback">
        {display ? '\\[' + source + '\\]' : '\\(' + source + '\\)'}
      </span>
    );
  }
}

function renderFormula(source: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const token = /\\frac\{([^{}]+)\}\{([^{}]+)\}|\\sqrt\{([^{}]+)\}|([_^])\{([^{}]+)\}|\\text\{([^{}]+)\}|\\(approx|cdot|Delta|div|ge|le|ne|pm|times)|\\%/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = token.exec(source)) !== null) {
    pushPlain(nodes, source.slice(lastIndex, match.index));
    const key = match.index;
    if (match[1] !== undefined && match[2] !== undefined) {
      nodes.push(
        <span className="math-fraction" key={key}>
          <span className="math-fraction__numerator">{renderFormula(match[1])}</span>
          <span className="math-fraction__denominator">{renderFormula(match[2])}</span>
        </span>,
      );
    } else if (match[3] !== undefined) {
      nodes.push(
        <span className="math-root" key={key}>
          <span className="math-root__symbol">√</span>
          <span className="math-root__content">{renderFormula(match[3])}</span>
        </span>,
      );
    } else if (match[4] !== undefined && match[5] !== undefined) {
      nodes.push(match[4] === '^'
        ? <sup className="math-script" key={key}>{renderFormula(match[5])}</sup>
        : <sub className="math-script" key={key}>{renderFormula(match[5])}</sub>);
    } else if (match[6] !== undefined) {
      nodes.push(<Fragment key={key}>{match[6]}</Fragment>);
    } else if (match[7] !== undefined) {
      nodes.push(<Fragment key={key}>{symbolCommands[match[7]]}</Fragment>);
    } else {
      nodes.push(<Fragment key={key}>%</Fragment>);
    }
    lastIndex = token.lastIndex;
  }

  pushPlain(nodes, source.slice(lastIndex));
  return nodes;
}

function pushPlain(nodes: ReactNode[], value: string) {
  if (!value) return;
  if (/\\[A-Za-z]+|[{}]/.test(value)) throw new Error('unsupported formula');
  nodes.push(<Fragment key={'plain:' + nodes.length}>{value.replaceAll(' ', ' ')}</Fragment>);
}

function splitMathText(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  const delimiter = /\\\[([\s\S]*?)\\\]|\\\(([\s\S]*?)\\\)/g;
  let lastIndex = 0;
  for (const match of text.matchAll(delimiter)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      segments.push({ display: false, math: false, value: text.slice(lastIndex, index) });
    }
    segments.push({
      display: match[1] !== undefined,
      math: true,
      value: match[1] ?? match[2] ?? '',
    });
    lastIndex = index + match[0].length;
  }
  if (lastIndex < text.length) {
    segments.push({ display: false, math: false, value: text.slice(lastIndex) });
  }
  return segments.length > 0 ? segments : [{ display: false, math: false, value: text }];
}

function formulaLabel(source: string) {
  return source
    .replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '$1/$2')
    .replace(/\\(times|cdot)/g, '×')
    .replace(/\\div/g, '÷')
    .replace(/\\%/g, '%')
    .replace(/[{}]/g, '')
    .trim();
}
