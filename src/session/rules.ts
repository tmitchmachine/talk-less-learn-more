import { claimsFor, type Claim } from '../data/claims';
import { maxIns, type Session } from '../data/sessions';

export function sessionScore(ins: number, bias: number, mx: number, early: boolean): number {
  if (early) return 0;
  return Math.max(0, Math.min(1, (ins - bias * 0.5) / mx));
}

/** Stars from score, or 0 if any mustFind insight is missing. */
export function sessionStars(
  score: number,
  early: boolean,
  found: string[],
  mustFind?: string[],
): { stars: number; missing: string[] } {
  if (early) return { stars: 0, missing: [] };
  const missing = (mustFind ?? []).filter((id) => !found.includes(id));
  if (missing.length) return { stars: 0, missing };
  const stars = score >= 0.85 ? 3 : score >= 0.6 ? 2 : score >= 0.35 ? 1 : 0;
  return { stars, missing: [] };
}

/** Claims still needing a correct call this debrief. */
export function debriefClaims(
  sessionId: string,
  found: string[],
  alreadyRight: string[],
): Claim[] {
  return claimsFor(sessionId).filter((c) => {
    if (alreadyRight.includes(c.id)) return false;
    if (c.needs && !found.includes(c.needs)) return false;
    return true;
  });
}

export function scoreSession(s: Session, ins: number, bias: number, early: boolean, found: string[]) {
  const mx = maxIns(s);
  const score = sessionScore(ins, bias, mx, early);
  const { stars, missing } = sessionStars(score, early, found, s.mustFind);
  return { mx, score, stars, missing };
}
