/** Match Series.Sequence: round each scene to frames, then sum. Do not round the summed seconds. */

export function sceneFrames(durationSec: number, fps = 30): number {
  const sec = Number(durationSec);
  if (!Number.isFinite(sec) || sec <= 0) return 1;
  return Math.max(1, Math.round(sec * fps));
}

export function sumSceneFrames(scenes: { durationSec?: number }[], fps = 30): number {
  if (!scenes.length) return 1;
  return Math.max(1, scenes.reduce((sum, sc) => sum + sceneFrames(sc.durationSec ?? 0, fps), 0));
}
