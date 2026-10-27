export type LeftLevel = 'ok' | 'near' | 'bust';

export function leftLevel(pointsLeft: number): LeftLevel {
  if (pointsLeft < 0) return 'bust';
  return pointsLeft <= 19 ? 'near' : 'ok';
}
