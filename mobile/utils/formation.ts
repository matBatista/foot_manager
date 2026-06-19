// Maps a formation string (e.g. "4-3-3") to normalized player positions on a
// half-field. Y=0 is the attacking end, Y=1 is the defensive (GK) end.
// X=0 is left, X=1 is right. All values are 0–1 fractions.

export interface FieldPosition {
  x: number; // 0 (left) → 1 (right)
  y: number; // 0 (attacking end) → 1 (GK end)
  role: string; // "GK", "DEF", "MID", "FWD", "WB", etc.
  lineIndex: number; // position index within the line
}

const FORMATIONS: Record<string, FieldPosition[]> = buildFormations();

function row(role: string, count: number, y: number): FieldPosition[] {
  return Array.from({ length: count }, (_, i) => ({
    x: (i + 1) / (count + 1),
    y,
    role,
    lineIndex: i,
  }));
}

function buildFormations(): Record<string, FieldPosition[]> {
  const gk = row('GK', 1, 0.92);

  return {
    '4-4-2': [
      ...gk,
      ...row('DEF', 4, 0.73),
      ...row('MID', 4, 0.48),
      ...row('FWD', 2, 0.16),
    ],
    '4-3-3': [
      ...gk,
      ...row('DEF', 4, 0.73),
      ...row('MID', 3, 0.48),
      ...row('FWD', 3, 0.14),
    ],
    '4-5-1': [
      ...gk,
      ...row('DEF', 4, 0.73),
      ...row('MID', 5, 0.46),
      ...row('FWD', 1, 0.12),
    ],
    '3-5-2': [
      ...gk,
      ...row('DEF', 3, 0.75),
      ...row('MID', 5, 0.46),
      ...row('FWD', 2, 0.16),
    ],
    '5-3-2': [
      ...gk,
      ...row('DEF', 5, 0.75),
      ...row('MID', 3, 0.48),
      ...row('FWD', 2, 0.16),
    ],
    '4-2-3-1': [
      ...gk,
      ...row('DEF', 4, 0.76),
      ...row('MID', 2, 0.58),
      ...row('MID', 3, 0.38),
      ...row('FWD', 1, 0.12),
    ],
  };
}

export function getFormationPositions(formation: string): FieldPosition[] {
  return FORMATIONS[formation] ?? FORMATIONS['4-4-2'];
}

export const ALLOWED_FORMATIONS = Object.keys(FORMATIONS);
