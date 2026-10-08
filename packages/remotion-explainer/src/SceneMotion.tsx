import React from 'react';
import {
  AbsoluteFill,
  Audio,
  interpolate,
  staticFile,
  useCurrentFrame,
  Easing,
} from 'remotion';

const ENTER = Easing.bezier(0.22, 1, 0.36, 1);

/**
 * Gallery cuts: NO fade-to-empty (that creates black/white seams between Series beats).
 * Soft enter only; exit is a hard cut (or slight push — never opacity→0).
 * Matches explainer-video skill: hard cut on VO stress / short 0.25–0.4s overlap feel.
 */
export const SceneMotion: React.FC<{
  durationInFrames: number;
  children: React.ReactNode;
  zoomFrom?: number;
  /** Soft settle after cut (frames); 0 = hard cut in */
  enterFrames?: number;
  sfx?: 'whoosh' | 'click' | 'lowboom' | string | null;
  sfxVolume?: number;
}> = ({
  durationInFrames,
  children,
  zoomFrom = 1.04,
  enterFrames = 6,
  sfx = null,
  sfxVolume = 0.28,
}) => {
  const frame = useCurrentFrame();
  const enter = enterFrames <= 0
    ? 1
    : interpolate(frame, [0, enterFrames], [0.92, 1], {
      extrapolateRight: 'clamp',
      easing: ENTER,
    });
  // Opacity stays ≥0.92 — never dips to empty canvas between sequences
  const opacity = enterFrames <= 0
    ? 1
    : interpolate(frame, [0, enterFrames], [0.96, 1], {
      extrapolateRight: 'clamp',
      easing: ENTER,
    });
  const zoom = interpolate(frame, [0, durationInFrames], [zoomFrom, 1], {
    extrapolateRight: 'clamp',
    easing: ENTER,
  });
  const sfxSrc = !sfx ? null
    : sfx.includes('/') || sfx.includes('.')
      ? sfx
      : `sfx/${sfx}.wav`;
  return (
    <AbsoluteFill style={{
      opacity,
      transform: `scale(${zoom * enter})`,
    }}>
      {sfxSrc ? (
        <Audio src={staticFile(sfxSrc)} volume={sfxVolume} startFrom={0} />
      ) : null}
      {children}
    </AbsoluteFill>
  );
};
