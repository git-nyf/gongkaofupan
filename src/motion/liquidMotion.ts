export function projectMomentum(
  position: number,
  velocity: number,
  decelerationRate = 0.998,
) {
  if (!Number.isFinite(decelerationRate)
    || decelerationRate < 0
    || decelerationRate >= 1) {
    throw new RangeError('减速率必须是大于等于 0 且小于 1 的有限数值');
  }

  return position + (velocity / 1000) * decelerationRate / (1 - decelerationRate);
}

export function rubberBand(
  overshoot: number,
  dimension: number,
  constant = 0.55,
) {
  if (!Number.isFinite(dimension) || dimension <= 0) return 0;

  return (overshoot * dimension * constant)
    / (dimension + constant * Math.abs(overshoot));
}

export function selectProjectedSnap(
  position: number,
  velocity: number,
  snapPoints: readonly number[],
) {
  if (snapPoints.length === 0) {
    throw new RangeError('至少需要一个可选卡位');
  }

  const projectedPosition = projectMomentum(position, velocity);

  return snapPoints.reduce((closest, point) => (
    Math.abs(projectedPosition - point) < Math.abs(projectedPosition - closest)
      ? point
      : closest
  ));
}

export const criticalSpring = {
  type: 'spring',
  bounce: 0,
  duration: 0.4,
} as const;

export const momentumSpring = {
  type: 'spring',
  bounce: 0.2,
  duration: 0.4,
} as const;
