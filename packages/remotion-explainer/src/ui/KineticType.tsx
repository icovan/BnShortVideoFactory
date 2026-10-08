import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { ENTER } from './tokens';

/** kinetic-typography: staggered line / word slam */
export const KineticLines: React.FC<{
  lines: { text: string; size: number; color: string; weight?: number }[];
  delay?: number;
  gap?: number;
}> = ({ lines, delay = 0, gap = 8 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap }}>
      {lines.map((ln, i) => {
        const p = spring({
          frame: Math.max(0, frame - delay - i * 5),
          fps,
          config: { damping: 12, stiffness: 110 },
        });
        return (
          <div
            key={`${ln.text}-${i}`}
            style={{
              fontSize: ln.size,
              fontWeight: ln.weight ?? 800,
              color: ln.color,
              letterSpacing: '-0.045em',
              lineHeight: 1.02,
              opacity: p,
              transform: `translateY(${interpolate(p, [0, 1], [28, 0])}px) scale(${interpolate(p, [0, 1], [1.12, 1])})`,
            }}
          >
            {ln.text}
          </div>
        );
      })}
    </div>
  );
};

/** Word-by-word pop on stressed syllables */
export const KineticWords: React.FC<{
  text: string;
  size?: number;
  color?: string;
  accentColor?: string;
  accentWord?: string;
  delay?: number;
}> = ({ text, size = 72, color = '#fff', accentColor, accentWord, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(/\s+/);
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.18em', rowGap: 4 }}>
      {words.map((w, i) => {
        const p = spring({
          frame: Math.max(0, frame - delay - i * 3),
          fps,
          config: { damping: 14, stiffness: 120 },
        });
        const isAccent = accentWord && w.replace(/[.,!?]/g, '') === accentWord.replace(/[.,!?]/g, '');
        return (
          <span
            key={`${w}-${i}`}
            style={{
              fontSize: size,
              fontWeight: 800,
              color: isAccent && accentColor ? accentColor : color,
              letterSpacing: '-0.04em',
              opacity: p,
              transform: `translateY(${interpolate(p, [0, 1], [22, 0])}px)`,
              display: 'inline-block',
            }}
          >
            {w}
          </span>
        );
      })}
    </div>
  );
};

export const CountUp: React.FC<{
  to: number;
  suffix?: string;
  size?: number;
  color?: string;
  durationFrames?: number;
}> = ({ to, suffix = '+', size = 180, color = '#5B4CDB', durationFrames = 50 }) => {
  const frame = useCurrentFrame();
  const n = Math.min(to, Math.floor(interpolate(frame, [4, durationFrames], [0, to], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: ENTER,
  })));
  return (
    <span style={{
      fontSize: size, fontWeight: 800, color, letterSpacing: '-0.06em',
      fontVariantNumeric: 'tabular-nums', lineHeight: 0.9,
    }}>
      {n}{suffix}
    </span>
  );
};
