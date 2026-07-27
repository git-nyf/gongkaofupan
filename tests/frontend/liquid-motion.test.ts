import { describe, expect, it } from 'vitest';
import {
  criticalSpring,
  momentumSpring,
  projectMomentum,
  rubberBand,
  selectProjectedSnap,
} from '../../src/motion/liquidMotion';

describe('液态手势物理', () => {
  it('按指数衰减率与释放速度投射终点', () => {
    expect(projectMomentum(0, 800)).toBeCloseTo(399.2);
    expect(projectMomentum(0, 800, 0.99)).toBeCloseTo(79.2);
    expect(projectMomentum(120, -500, 0.99)).toBeCloseTo(70.5);
  });

  it('拒绝无法形成指数衰减的速率', () => {
    expect(() => projectMomentum(0, 800, 1)).toThrow(RangeError);
    expect(() => projectMomentum(0, 800, Number.NaN)).toThrow(RangeError);
    expect(() => projectMomentum(0, 800, -0.1)).toThrow(RangeError);
  });

  it('越过边界后连续增加阻力并保留方向', () => {
    const positive = rubberBand(40, 320);
    const farther = rubberBand(80, 320);

    expect(positive).toBeGreaterThan(0);
    expect(positive).toBeLessThan(40);
    expect(farther).toBeGreaterThan(positive);
    expect(farther).toBeLessThan(80);
    expect(rubberBand(-40, 320)).toBeCloseTo(-positive);
  });

  it('尺寸无效时不产生非有限阻力值', () => {
    expect(rubberBand(40, 0)).toBe(0);
    expect(rubberBand(40, -320)).toBe(0);
    expect(rubberBand(40, Number.NaN)).toBe(0);
    expect(rubberBand(40, Number.POSITIVE_INFINITY)).toBe(0);
  });

  it('根据投射终点选择最近卡位', () => {
    const snapPoints = [-320, 0, 320] as const;

    expect(selectProjectedSnap(0, 800, snapPoints)).toBe(320);
    expect(selectProjectedSnap(0, -800, snapPoints)).toBe(-320);
    expect(selectProjectedSnap(280, 0, snapPoints)).toBe(320);
  });

  it('没有可选卡位时拒绝投射', () => {
    expect(() => selectProjectedSnap(0, 800, [])).toThrow(RangeError);
  });

  it('区分默认临界弹簧与手势动量弹簧', () => {
    expect(criticalSpring).toEqual({
      type: 'spring',
      bounce: 0,
      duration: 0.4,
    });
    expect(momentumSpring).toEqual({
      type: 'spring',
      bounce: 0.2,
      duration: 0.4,
    });
  });
});
