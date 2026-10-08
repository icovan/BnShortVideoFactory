import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { CREAM, FOREST, INK } from './tokens';

/** chart-animation: growing bars */
export const GrowBars: React.FC<{
  accent: string;
  heights?: number[];
  delay?: number;
  height?: number;
}> = ({ accent, heights = [0.4, 0.62, 0.88, 0.55, 0.72], delay = 0, height = 120 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height }}>
      {heights.map((h, i) => {
        const p = spring({
          frame: Math.max(0, frame - delay - i * 4),
          fps,
          config: { damping: 14 },
        });
        return (
          <div
            key={i}
            style={{
              flex: 1,
              height: `${h * 100 * p}%`,
              borderRadius: '8px 8px 3px 3px',
              background: i === 2 ? accent : '#D9D2F5',
              boxShadow: i === 2 ? `0 8px 20px ${accent}44` : 'none',
            }}
          />
        );
      })}
    </div>
  );
};

/** Pie / donut reveal */
export const GrowPie: React.FC<{
  size?: number;
  delay?: number;
  colors?: [string, string, string];
}> = ({ size = 160, delay = 0, colors = [FOREST, '#F2C94C', '#5B4CDB'] }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [delay, delay + 28], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const a = 35 * p;
  const b = 30 * p;
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: `conic-gradient(${colors[0]} 0 ${a}%, ${colors[1]} ${a}% ${a + b}%, ${colors[2]} ${a + b}% 100%)`,
      boxShadow: '0 16px 40px rgba(0,0,0,0.22)',
      transform: `scale(${0.75 + p * 0.25})`,
      opacity: 0.4 + p * 0.6,
    }} />
  );
};

/** presentation-video: full slide card — no coffee/Bloom defaults */
export const SlideCard: React.FC<{
  title?: string;
  accentWord?: string;
  bullets?: string[];
  ink?: string;
  accent?: string;
  wide?: boolean;
  showPie?: boolean;
  delay?: number;
}> = ({
  title = 'Your headline',
  accentWord = 'here',
  bullets = ['Point one', 'Point two', 'Point three'],
  ink = INK,
  accent = '#5B4CDB',
  wide = true,
  showPie = false,
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: Math.max(0, frame - delay), fps, config: { damping: 14 } });
  return (
    <div style={{
      width: wide ? '100%' : 720,
      height: wide ? '100%' : 420,
      background: CREAM,
      borderRadius: 24,
      padding: wide ? '44px 48px' : '28px 32px',
      display: 'flex',
      gap: 36,
      boxShadow: '0 36px 90px rgba(26,21,64,0.16), 0 12px 28px rgba(26,21,64,0.08)',
      opacity: enter,
      transform: `translateY(${interpolate(enter, [0, 1], [24, 0])}px)`,
      overflow: 'hidden',
      boxSizing: 'border-box',
      border: '1px solid rgba(26,21,64,0.05)',
    }}>
      <div style={{ flex: 1.15, minWidth: 0 }}>
        <div style={{
          fontSize: wide ? 48 : 32, fontWeight: 800, color: ink,
          letterSpacing: '-0.035em', lineHeight: 1.12,
        }}>
          {title}{' '}
          <span style={{ color: FOREST }}>{accentWord}</span>
        </div>
        <div style={{ marginTop: wide ? 28 : 18, display: 'flex', flexDirection: 'column', gap: wide ? 16 : 12 }}>
          {bullets.map((b, i) => {
            const bp = spring({
              frame: Math.max(0, frame - delay - 8 - i * 5),
              fps,
              config: { damping: 16 },
            });
            return (
              <div key={`${b}-${i}`} style={{
                display: 'flex', gap: 12, alignItems: 'center',
                fontSize: wide ? 24 : 17, color: ink, fontWeight: 500,
                opacity: bp, transform: `translateX(${interpolate(bp, [0, 1], [16, 0])}px)`,
              }}>
                <span style={{ width: 12, height: 12, borderRadius: '50%', background: FOREST, flexShrink: 0 }} />
                {b}
              </div>
            );
          })}
        </div>
        {!showPie && (
          <div style={{ marginTop: 28, maxWidth: 280 }}>
            <GrowBars accent={accent} delay={delay + 18} height={wide ? 100 : 72} />
          </div>
        )}
      </div>
      <div style={{
        width: wide ? 300 : 200,
        borderRadius: 20,
        background: FOREST,
        display: 'grid',
        placeItems: 'center',
        boxShadow: '0 20px 50px rgba(63,107,75,0.35)',
        flexShrink: 0,
      }}>
        {showPie
          ? <GrowPie size={wide ? 160 : 110} delay={delay + 12} />
          : <GrowBars accent="#fff" delay={delay + 12} height={wide ? 140 : 90} heights={[0.35, 0.55, 0.85, 0.48, 0.7]} />}
      </div>
    </div>
  );
};

export type ThumbKind = 'cover' | 'bullets' | 'chart' | 'customers';

/** Multi-layout deck thumbs — cover / bullets / chart / customers (no white-circle mold) */
export const DeckThumb: React.FC<{
  title: string;
  sub?: string;
  tone: string;
  kind?: ThumbKind;
  bullets?: string[];
  rotate?: number;
  delay?: number;
  width?: number;
}> = ({ title, sub = '', tone, kind = 'cover', bullets, rotate = 0, delay = 0, width = 340 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: Math.max(0, frame - delay), fps, config: { damping: 14 } });
  const shell: React.CSSProperties = {
    width, background: '#fff', borderRadius: 20, padding: 0,
    boxShadow: '0 28px 70px rgba(0,0,0,0.35), 0 8px 20px rgba(0,0,0,0.18), 0 0 0 1px rgba(26,21,64,0.06)',
    opacity: p,
    transform: `rotate(${rotate}deg) scale(${interpolate(p, [0, 1], [0.86, 1])})`,
    overflow: 'hidden',
  };

  if (kind === 'cover') {
    return (
      <div style={shell}>
        <div style={{
          height: 210, padding: '28px 24px', boxSizing: 'border-box',
          background: `linear-gradient(155deg, ${tone} 0%, ${tone}bb 48%, #1A1540 120%)`,
          color: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
        }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14, marginBottom: 16,
            background: 'rgba(255,255,255,0.18)', border: '1.5px solid rgba(255,255,255,0.45)',
            display: 'grid', placeItems: 'center', fontSize: 26, fontWeight: 800,
          }}>{(title[0] || 'P').toUpperCase()}</div>
          <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.15 }}>{title}</div>
          {sub ? <div style={{ fontSize: 14, opacity: 0.85, marginTop: 8 }}>{sub}</div> : null}
        </div>
      </div>
    );
  }

  if (kind === 'chart') {
    return (
      <div style={{ ...shell, padding: '22px 20px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: tone, letterSpacing: '0.04em' }}>INSIGHT</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: INK, marginTop: 6, lineHeight: 1.2 }}>{title}</div>
        <div style={{ marginTop: 16 }}>
          <GrowBars accent={tone} delay={delay + 6} height={88} />
        </div>
        {sub ? <div style={{ fontSize: 13, color: '#6B6585', marginTop: 12 }}>{sub}</div> : null}
      </div>
    );
  }

  if (kind === 'customers') {
    return (
      <div style={{ ...shell, padding: '20px 20px 22px' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#8B84A3', letterSpacing: '0.06em' }}>05 · CUSTOMERS</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: INK, marginTop: 8 }}>{title}</div>
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 14 }}>
          <GrowPie size={108} delay={delay + 4} colors={[tone, '#F2C94C', '#5B4CDB']} />
        </div>
        {sub ? <div style={{ fontSize: 13, color: '#6B6585', marginTop: 10, textAlign: 'center' }}>{sub}</div> : null}
      </div>
    );
  }

  // bullets / SOLUTION style
  const lines = (bullets?.length ? bullets : (sub ? [sub] : ['Key point', 'Next beat'])).slice(0, 3);
  return (
    <div style={{ ...shell, padding: '22px 22px' }}>
      <div style={{
        display: 'inline-block', fontSize: 11, fontWeight: 800, letterSpacing: '0.08em',
        color: tone, background: `${tone}18`, padding: '4px 10px', borderRadius: 999, marginBottom: 10,
      }}>SOLUTION</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: INK, lineHeight: 1.15 }}>{title}</div>
      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {lines.map((b, i) => (
          <div key={`${b}-${i}`} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 14, color: '#4A4460', fontWeight: 500 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: tone, marginTop: 5, flexShrink: 0 }} />
            <span>{b}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
