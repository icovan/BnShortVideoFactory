/** Viewport-relative type ladder for 9:16 stickman films (W = composition width). */
export function typeScale(W: number) {
  const w = Math.max(720, W);
  return {
    /** Payoff / hero slam */
    hero: Math.round(w * 0.135),
    /** Panel main Chinese title */
    title: Math.round(w * 0.092),
    /** Split-panel title (slightly smaller) */
    titleSm: Math.round(w * 0.078),
    /** English / spaced subtitle */
    sub: Math.round(w * 0.024),
    /** Mid caption / zone labels */
    body: Math.round(w * 0.05),
    /** Footnote / counter */
    meta: Math.round(w * 0.028),
    /** Tiny progress */
    tiny: Math.round(w * 0.021),
  } as const;
}

export function safePad(W: number, H: number, aspect?: string) {
  if (aspect === '9:16' || H > W) {
    return { top: Math.round(H * 0.08), bottom: Math.round(H * 0.18), left: Math.round(W * 0.08), right: Math.round(W * 0.08) };
  }
  return { top: Math.round(H * 0.06), bottom: Math.round(H * 0.08), left: Math.round(W * 0.06), right: Math.round(W * 0.06) };
}
