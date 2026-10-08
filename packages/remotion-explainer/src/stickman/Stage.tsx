import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { VISUAL_LOCK } from './types';
import { typeScale } from './typeScale';

const CJK =
  '"Noto Sans SC","PingFang SC","Hiragino Sans GB","Source Han Sans SC","Microsoft YaHei",sans-serif';

/** Thick platform under stickmen (not a hairline). */
export const Platform: React.FC<{
  x: number;
  y: number;
  w: number;
  h?: number;
  color?: string;
  shadow?: boolean;
}> = ({
  x,
  y,
  w,
  h = 16,
  color = VISUAL_LOCK.propLight,
  shadow = true,
}) => (
  <>
    <div
      className="stickman-platform"
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
        borderRadius: h / 2,
        background: color,
      }}
    />
    {shadow ? (
      <div
        style={{
          position: 'absolute',
          left: x + h,
          top: y + h,
          width: Math.max(0, w - h * 3),
          height: h * 3,
          background: 'rgba(58,58,64,0.22)',
          filter: 'blur(6px)',
          pointerEvents: 'none',
        }}
      />
    ) : null}
  </>
);

/** Prefer Platform; Ground kept as thin ledge fallback. */
export const Ground: React.FC<{
  y: number;
  left?: number;
  right?: number;
  color?: string;
  thickness?: number;
}> = ({
  y,
  left = 80,
  right = 80,
  color = VISUAL_LOCK.propLight,
  thickness = 14,
}) => (
  <div
    className="stickman-ground"
    style={{
      position: 'absolute',
      top: y,
      left,
      right,
      height: thickness,
      background: color,
      borderRadius: thickness / 2,
    }}
  />
);

export const SplitRule: React.FC<{
  orientation?: 'horizontal' | 'vertical';
  color?: string;
  inset?: number | string;
}> = ({ orientation = 'horizontal', color = '#3A3A40', inset = '8%' }) => (
  <div
    className="stickman-split"
    style={
      orientation === 'horizontal'
        ? {
            position: 'absolute',
            left: inset,
            right: inset,
            top: '50%',
            height: 2,
            background: color,
            transform: 'translateY(-50%)',
          }
        : {
            position: 'absolute',
            top: inset,
            bottom: '12%',
            left: '50%',
            width: 2,
            background: color,
            transform: 'translateX(-50%)',
          }
    }
  />
);

export const PropBlock: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  color?: string;
  radius?: number;
}> = ({
  x, y, w, h,
  color = VISUAL_LOCK.prop,
  radius = 8,
}) => (
  <div
    className="stickman-prop"
    style={{
      position: 'absolute',
      left: x,
      top: y,
      width: w,
      height: h,
      background: color,
      borderRadius: radius,
    }}
  />
);

/** Progress dashes + optional 03 / 08 counter. */
export const ProgressTicks: React.FC<{
  y: number;
  filled: number;
  total?: number;
  left?: number;
  width?: number;
  showCounter?: boolean;
  ink?: string;
  muted?: string;
}> = ({
  y,
  filled,
  total = 8,
  left,
  width,
  showCounter = true,
  ink = VISUAL_LOCK.ink,
  muted = '#3A3A40',
}) => {
  const { width: W } = useVideoConfig();
  const x0 = left ?? Math.round(W * 0.18);
  const barW = width ?? Math.round(W * 0.52);
  const gap = 8;
  const tickW = Math.max(10, Math.floor((barW - gap * (total - 1)) / total));
  const n = Math.max(0, Math.min(total, filled));
  const ts = typeScale(W);
  return (
    <div className="stickman-progress" style={{ position: 'absolute', left: x0, top: y, display: 'flex', alignItems: 'center', gap }}>
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          style={{
            width: tickW,
            height: 4,
            borderRadius: 2,
            background: i < n ? ink : muted,
            opacity: i < n ? 1 : 0.55,
          }}
        />
      ))}
      {showCounter ? (
        <span style={{ marginLeft: 14, fontSize: ts.meta, fontWeight: 700, color: ink, fontFamily: CJK }}>
          <span style={{ color: ink }}>{String(n).padStart(2, '0')}</span>
          <span style={{ color: muted }}> / {String(total).padStart(2, '0')}</span>
        </span>
      ) : null}
    </div>
  );
};

/** Chinese hero + English spaced subtitle (no glow). */
export const BilingualTitle: React.FC<{
  zh: string;
  en?: string;
  y: number;
  size?: number;
  subSize?: number;
  color?: string;
  muted?: string;
  align?: 'center' | 'left' | 'right';
  x?: number;
  width?: number;
}> = ({
  zh,
  en,
  y,
  size,
  subSize,
  color = VISUAL_LOCK.ink,
  muted = '#6A6A6A',
  align = 'center',
  x,
  width,
}) => {
  const { width: W } = useVideoConfig();
  const ts = typeScale(W);
  const titleSize = size ?? ts.title;
  const enSize = subSize ?? ts.sub;
  const left = x ?? 0;
  const w = width ?? W;
  return (
    <div
      className="stickman-bilingual"
      style={{
        position: 'absolute',
        left,
        top: y,
        width: w,
        textAlign: align,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          fontFamily: CJK,
          fontSize: titleSize,
          fontWeight: 900,
          color,
          letterSpacing: '-0.04em',
          lineHeight: 1.1,
        }}
      >
        {zh}
      </div>
      {en ? (
        <div
          style={{
            marginTop: Math.round(titleSize * 0.18),
            fontSize: enSize,
            fontWeight: 600,
            color: muted,
            letterSpacing: '0.28em',
            textTransform: 'uppercase',
          }}
        >
          {en}
        </div>
      ) : null}
    </div>
  );
};

/** Bottom caption pill (matte — no bloom). */
export const CaptionPill: React.FC<{
  text: string;
  y?: number;
  size?: number;
  ink?: string;
}> = ({ text, y, size, ink = VISUAL_LOCK.ink }) => {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();
  const ts = typeScale(W);
  const fontSize = size ?? ts.body;
  const chars = Array.from(text);
  const per = Math.max(3, Math.round(fps * 0.12));
  const start = Math.round(fps * 0.25);
  const active = Math.max(0, Math.min(chars.length - 1, Math.floor((frame - start) / per)));
  return (
    <div
      className="stickman-caption"
      style={{
        position: 'absolute',
        left: '50%',
        top: y ?? Math.round(H * 0.82),
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        padding: `${Math.round(fontSize * 0.35)}px ${Math.round(fontSize * 0.85)}px`,
        borderRadius: 999,
        border: '1px solid rgba(255,255,255,0.18)',
        background: 'rgba(0,0,0,0.55)',
        fontFamily: CJK,
        fontSize,
        fontWeight: 700,
        color: ink,
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
      }}
    >
      {chars.map((c, i) => (
        <span
          key={`${c}-${i}`}
          style={{
            opacity: i <= active ? 1 : 0.35,
            color: i === active ? ink : 'rgba(255,255,255,0.72)',
            transform: i === active ? 'scale(1.06)' : 'scale(1)',
            display: 'inline-block',
          }}
        >
          {c}
        </span>
      ))}
    </div>
  );
};

/** Per-char kinetic reveal — matte, no drop-shadow bloom. */
export const KineticLine: React.FC<{
  text: string;
  y?: number;
  size?: number;
  delay?: number;
  stagger?: number;
  color?: string;
  weight?: number;
  tracking?: string;
  align?: 'center' | 'left' | 'right';
  x?: number;
  width?: number;
}> = ({
  text,
  y = 0,
  size,
  delay = 0,
  stagger = 2,
  color = VISUAL_LOCK.ink,
  weight = 900,
  tracking = '-0.03em',
  align = 'center',
  x = 0,
  width,
}) => {
  const frame = useCurrentFrame();
  const { fps, width: W } = useVideoConfig();
  const ts = typeScale(W);
  const fontSize = size ?? ts.title;
  const chars = Array.from(text);
  const justify = align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center';
  return (
    <div
      className="stickman-kinetic"
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: width ?? W - x,
        display: 'flex',
        justifyContent: justify,
        alignItems: 'flex-end',
        fontFamily: CJK,
        fontWeight: weight,
        fontSize,
        letterSpacing: tracking,
        color,
        lineHeight: 1.1,
        pointerEvents: 'none',
      }}
    >
      {chars.map((c, i) => {
        const p = spring({
          frame: frame - delay - i * stagger,
          fps,
          config: { damping: 14, mass: 0.55, stiffness: 150 },
        });
        return (
          <span key={i} style={{ display: 'inline-block', overflow: 'hidden', paddingBottom: fontSize * 0.12 }}>
            <span
              style={{
                display: 'inline-block',
                transform: `translateY(${interpolate(p, [0, 1], [110, 0])}%)`,
                opacity: interpolate(p, [0, 1], [0, 1]),
              }}
            >
              {c === ' ' ? '\u00A0' : c}
            </span>
          </span>
        );
      })}
    </div>
  );
};

/** @deprecated Prefer BilingualTitle / KineticLine — kept for codegen compat. */
export const PanelLabel: React.FC<{
  text: string;
  x?: number | string;
  y?: number | string;
  size?: number;
  color?: string;
  align?: 'left' | 'center' | 'right';
}> = ({
  text,
  x = '50%',
  y = 80,
  size,
  color = VISUAL_LOCK.ink,
  align = 'center',
}) => {
  const { width: W } = useVideoConfig();
  const ts = typeScale(W);
  return (
    <div
      className="stickman-label"
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: align === 'center' ? 'translateX(-50%)' : undefined,
        fontFamily: CJK,
        fontSize: size ?? ts.titleSm,
        fontWeight: 900,
        color,
        letterSpacing: '-0.04em',
        textAlign: align,
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
      }}
    >
      {text}
    </div>
  );
};
