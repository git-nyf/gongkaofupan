// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MathText } from '../../src/components/MathText';

afterEach(cleanup);

describe('资料分析公式排版', () => {
  it('将 DeepSeek 输出的分数和运算符显示为公式结构', () => {
    const { container } = render(
      <p>
        <MathText text={'增长率 = \\(\\frac{3}{5} \\times 100\\%\\)'} />
      </p>,
    );

    expect(screen.getByRole('img', { name: '公式：3/5 × 100%' })).toBeInTheDocument();
    expect(container.querySelector('.math-fraction__numerator')).toHaveTextContent('3');
    expect(container.querySelector('.math-fraction__denominator')).toHaveTextContent('5');
  });

  it('保留普通文本，并在遇到不支持命令时回退显示原公式', () => {
    render(
      <MathText text={'日期 2025/7/19，未知公式 \\(\\unsupported{3}\\)'} />,
    );

    expect(screen.getByText(/日期 2025\/7\/19/)).toBeInTheDocument();
    expect(screen.getByText(/\\\(\\unsupported\{3\}\\\)/)).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
