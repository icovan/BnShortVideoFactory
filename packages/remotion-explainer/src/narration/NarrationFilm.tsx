import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { DirectedProps, DirectedScene } from '../directedSchema';

const FONT = '"Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif';

type Film = DirectedProps;
type BeatProps = { scene: DirectedScene; film: Film };

/** Three motion beats: structure → detail → settle (≈20% / 50% / 80% of the line). */
function usePhases() {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width, height } = useVideoConfig();
  const a = Math.max(8, Math.round(durationInFrames * 0.2));
  const b = Math.max(a + 6, Math.round(durationInFrames * 0.5));
  const c = Math.max(b + 6, Math.round(durationInFrames * 0.8));
  const p0 = spring({ frame, fps, config: { damping: 16, stiffness: 140, mass: 0.7 } });
  const p1 = spring({ frame: frame - a, fps, config: { damping: 15, stiffness: 130, mass: 0.75 } });
  const p2 = spring({ frame: frame - b, fps, config: { damping: 14, stiffness: 120, mass: 0.8 } });
  const t = interpolate(frame, [0, c], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return { frame, fps, width, height, p0, p1, p2, t, a, b, c };
}

function pad(aspect: Film['aspect']) {
  if (aspect === '9:16' || aspect === '3:4') {
    return { top: 0.07, bottom: 0.12, side: 0.07, titleH: 0.1 };
  }
  if (aspect === '1:1') return { top: 0.06, bottom: 0.08, side: 0.06, titleH: 0.1 };
  return { top: 0.055, bottom: 0.07, side: 0.055, titleH: 0.1 };
}

function labelsOf(scene: DirectedScene, n = 4): string[] {
  const fromItems = (scene.items || []).map((s) => s.trim()).filter((s) => s.length > 0 && s.length <= 10);
  if (fromItems.length >= 2) return fromItems.slice(0, n);
  const quoted = [...(scene.visualIntent || '').matchAll(/「([^」]{1,8})」/g)].map((m) => m[1]);
  if (quoted.length >= 2) return quoted.slice(0, n);
  const parts = (scene.visualIntent || '')
    .split(/[，、；;·]/)
    .map((s) => s.replace(/画面主体是|短标题放在物体外面|及其动作|这句里的一个物体/g, '').trim())
    .filter((s) => s.length >= 2 && s.length <= 10)
    .slice(0, n);
  if (parts.length >= 2) return parts;
  const head = (scene.headline || '').trim();
  if (head) return [head.slice(0, 8), ...parts].filter(Boolean).slice(0, n);
  return ['起点', '过程', '结果'].slice(0, n);
}

function skinKind(notes?: string): 'halftone' | 'paper' | 'clay' | 'ink' | 'grid' {
  const n = notes || '';
  if (/halftone|网点|点阵/.test(n)) return 'halftone';
  if (/clay|黏土|橡皮泥/.test(n)) return 'clay';
  if (/paper|纸纹|grain/.test(n)) return 'paper';
  if (/ink|墨|brush|笔触|手绘|charcoal/.test(n)) return 'ink';
  return 'grid';
}

const Skin: React.FC<{ notes?: string; ink: string; accent: string }> = ({ notes, ink, accent }) => {
  const kind = skinKind(notes);
  const base: React.CSSProperties = { position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 };
  if (kind === 'halftone') {
    return (
      <div style={{
        ...base, opacity: 0.28,
        backgroundImage: `radial-gradient(${ink} 1.2px, transparent 1.3px)`,
        backgroundSize: '16px 16px',
      }}
      />
    );
  }
  if (kind === 'paper') {
    return (
      <div style={{
        ...base, opacity: 0.3,
        backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 3px, ${ink}20 4px)`,
      }}
      />
    );
  }
  if (kind === 'clay') {
    return (
      <div style={{
        ...base,
        background: `radial-gradient(circle at 18% 72%, ${accent}55, transparent 40%), radial-gradient(circle at 82% 28%, ${ink}28, transparent 36%)`,
        filter: 'blur(10px)',
      }}
      />
    );
  }
  if (kind === 'ink') {
    return (
      <div style={{
        ...base, opacity: 0.18,
        backgroundImage: `repeating-linear-gradient(-18deg, transparent, transparent 11px, ${ink}66 12px)`,
      }}
      />
    );
  }
  return (
    <div style={{
      ...base, opacity: 0.2,
      backgroundImage: `linear-gradient(${ink}22 1px, transparent 1px), linear-gradient(90deg, ${ink}22 1px, transparent 1px)`,
      backgroundSize: '48px 48px',
    }}
    />
  );
};

const TitleStrip: React.FC<{ text?: string; film: Film; enter: number }> = ({ text, film, enter }) => {
  const { width } = useVideoConfig();
  const label = (text || '').trim();
  if (!label) return null;
  const p = pad(film.aspect);
  const size = Math.round(width * (label.length <= 6 ? 0.042 : 0.032));
  return (
    <div style={{
      position: 'absolute',
      top: `${p.top * 100}%`,
      left: `${p.side * 100}%`,
      right: `${p.side * 100}%`,
      height: `${p.titleH * 100}%`,
      zIndex: 4,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-end',
      color: film.ink,
      fontFamily: FONT,
      opacity: enter,
      transform: `translateY(${(1 - enter) * 18}px)`,
    }}
    >
      <div style={{ fontSize: size, fontWeight: 780, letterSpacing: '-0.03em', lineHeight: 1.05 }}>{label}</div>
      <div style={{
        marginTop: 10, height: 5, width: `${18 + enter * 14}%`,
        background: film.accent, borderRadius: 99,
      }}
      />
    </div>
  );
};

const Stage: React.FC<{ film: Film; children: React.ReactNode }> = ({ film, children }) => {
  const p = pad(film.aspect);
  return (
    <div style={{
      position: 'absolute',
      top: `${(p.top + p.titleH + 0.02) * 100}%`,
      left: `${p.side * 100}%`,
      right: `${p.side * 100}%`,
      bottom: `${p.bottom * 100}%`,
      zIndex: 2,
    }}
    >
      {children}
    </div>
  );
};

const Panel: React.FC<{
  ink: string;
  accent: string;
  fill?: string;
  enter: number;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ ink, accent, fill, enter, children, style }) => (
  <div style={{
    border: `3px solid ${ink}`,
    background: fill || 'transparent',
    borderRadius: 22,
    boxShadow: `0 0 0 1px ${accent}33, 0 28px 60px ${ink}18`,
    opacity: 0.15 + 0.85 * enter,
    transform: `translateY(${(1 - enter) * 28}px) scale(${0.94 + enter * 0.06})`,
    overflow: 'hidden',
    ...style,
  }}
  >
    {children}
  </div>
);

/** Large object drawn inside a full-width well — never a speck. */
const Glyph: React.FC<{ id: string; t: number; ink: string; accent: string }> = ({ id, t, ink, accent }) => {
  const dash = (n: number) => n * (1 - t);
  const box: React.CSSProperties = { width: '100%', height: '100%', overflow: 'visible' };
  if (id === 'brush') {
    return (
      <svg viewBox="0 0 320 240" style={box}>
        <path d="M24 200 C 90 150, 140 120, 200 70" fill="none" stroke={accent} strokeWidth="22" strokeLinecap="round" strokeDasharray={520} strokeDashoffset={dash(520)} />
        <path d="M186 92 L240 36 L274 68 L218 120 Z" fill={ink} opacity={0.35 + 0.65 * t} />
        <circle cx="56" cy="188" r={10 + t * 8} fill={accent} opacity={t} />
      </svg>
    );
  }
  if (id === 'frame') {
    return (
      <svg viewBox="0 0 320 240" style={box}>
        <rect x="28" y="20" width="264" height="200" rx="8" fill="none" stroke={ink} strokeWidth="14" strokeDasharray={900} strokeDashoffset={dash(900)} />
        <rect x="64" y="52" width="192" height="136" fill="none" stroke={accent} strokeWidth="6" opacity={t} />
        <circle cx="160" cy="120" r={18 * t} fill={accent} />
      </svg>
    );
  }
  if (id === 'dice') {
    return (
      <svg viewBox="0 0 320 240" style={box}>
        <rect x="70" y="40" width="180" height="160" rx="28" fill="none" stroke={ink} strokeWidth="12" />
        {[[110, 80], [160, 120], [210, 160], [210, 80], [110, 160]].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="12" fill={accent} opacity={t > i / 5 ? 1 : 0.18} />
        ))}
      </svg>
    );
  }
  if (id === 'gear') {
    return (
      <svg viewBox="0 0 320 240" style={box}>
        <g transform={`rotate(${t * 220} 160 120)`}>
          {Array.from({ length: 10 }, (_, i) => {
            const a = (i / 10) * Math.PI * 2;
            const x = 160 + Math.cos(a) * 78;
            const y = 120 + Math.sin(a) * 78;
            return <rect key={i} x={x - 12} y={y - 18} width="24" height="36" rx="4" fill={accent} transform={`rotate(${(a * 180) / Math.PI} ${x} ${y})`} />;
          })}
          <circle cx="160" cy="120" r="54" fill="none" stroke={ink} strokeWidth="14" />
        </g>
        <circle cx="160" cy="120" r="18" fill={accent} />
      </svg>
    );
  }
  if (id === 'coin') {
    return (
      <svg viewBox="0 0 320 240" style={box}>
        {[0, 1, 2, 3].map((i) => {
          const show = Math.min(1, Math.max(0, t * 4 - i));
          return (
            <ellipse key={i} cx="160" cy={190 - i * 34 * show} rx="78" ry="24" fill={i === 3 ? accent : 'none'} stroke={ink} strokeWidth="8" opacity={0.25 + 0.75 * show} />
          );
        })}
      </svg>
    );
  }
  if (id === 'hand') {
    return (
      <svg viewBox="0 0 320 240" style={box}>
        <path d="M90 170 C 80 110, 110 70, 130 60 C 140 100, 146 140, 150 168" fill="none" stroke={ink} strokeWidth="14" strokeLinecap="round" strokeDasharray={280} strokeDashoffset={dash(280)} />
        <path d="M150 168 C 180 100, 210 70, 230 64 C 220 120, 210 150, 200 180" fill="none" stroke={ink} strokeWidth="14" strokeLinecap="round" opacity={0.35 + 0.65 * t} />
        <path d="M70 196 H250" stroke={accent} strokeWidth="14" strokeLinecap="round" strokeDasharray={200} strokeDashoffset={dash(200)} />
      </svg>
    );
  }
  if (id === 'doc') {
    return (
      <svg viewBox="0 0 320 240" style={box}>
        <path d="M70 24 H190 L250 78 V216 H70 Z" fill="none" stroke={ink} strokeWidth="12" strokeLinejoin="round" />
        <path d="M190 24 V78 H250" fill="none" stroke={accent} strokeWidth="10" />
        {[0, 1, 2, 3].map((i) => (
          <path key={i} d={`M96 ${110 + i * 22} H${96 + 110 * t}`} stroke={accent} strokeWidth="7" strokeLinecap="round" />
        ))}
      </svg>
    );
  }
  if (id === 'question') {
    return (
      <svg viewBox="0 0 320 240" style={box}>
        <text x="160" y="170" textAnchor="middle" fontSize={170} fontWeight={800} fill={ink} opacity={0.3 + 0.7 * t} fontFamily={FONT}>?</text>
        <circle cx="160" cy="210" r={8 + t * 6} fill={accent} />
      </svg>
    );
  }
  if (id === 'cursor') {
    return (
      <svg viewBox="0 0 320 240" style={box}>
        <path d={`M${40 + t * 140} ${40 + t * 40} l28 80 24-10 20 42-18 8-20-40-24 20 z`} fill={ink} />
        <circle cx={90 + t * 140} cy={170} r="22" fill={accent} opacity={t} />
      </svg>
    );
  }
  if (id === 'tag') {
    return (
      <svg viewBox="0 0 320 240" style={box}>
        <path d="M36 70 H170 L280 120 L170 170 H36 Z" fill="none" stroke={ink} strokeWidth="12" strokeLinejoin="round" strokeDasharray={700} strokeDashoffset={dash(700)} />
        <circle cx="92" cy="120" r="14" fill={accent} opacity={t} />
      </svg>
    );
  }
  if (id === 'clock') {
    return (
      <svg viewBox="0 0 320 240" style={box}>
        <circle cx="160" cy="120" r="84" fill="none" stroke={ink} strokeWidth="12" />
        <path d="M160 120 L160 52" stroke={accent} strokeWidth="10" strokeLinecap="round" transform={`rotate(${t * 320} 160 120)`} />
        <circle cx="160" cy="120" r="10" fill={accent} />
      </svg>
    );
  }
  if (id === 'fork') {
    return (
      <svg viewBox="0 0 320 240" style={box}>
        <path d="M30 190 C 90 190, 120 120, 160 120" fill="none" stroke={ink} strokeWidth="14" strokeLinecap="round" strokeDasharray={260} strokeDashoffset={dash(260)} />
        <path d="M160 120 C 210 70, 250 50, 300 40" fill="none" stroke={accent} strokeWidth="14" strokeLinecap="round" strokeDasharray={220} strokeDashoffset={dash(220)} />
        <path d="M160 120 C 220 160, 260 190, 300 210" fill="none" stroke={ink} strokeWidth="14" strokeLinecap="round" opacity={t} />
      </svg>
    );
  }
  if (id === 'card' || id === 'block') {
    return (
      <svg viewBox="0 0 320 240" style={box}>
        <rect x={40 + (id === 'block' ? t * 80 : 0)} y="48" width="160" height="144" rx="18" fill={accent} opacity={0.85} stroke={ink} strokeWidth="8" />
        <rect x="120" y="64" width="160" height="144" rx="18" fill="none" stroke={ink} strokeWidth="8" opacity={0.4 + 0.6 * t} />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 320 240" style={box}>
      <rect x="36" y="28" width="248" height="184" rx="28" fill="none" stroke={ink} strokeWidth="12" strokeDasharray={860} strokeDashoffset={dash(860)} />
      <circle cx="160" cy="120" r={24 + t * 36} fill={accent} />
    </svg>
  );
};

/** Full-frame object stage: title + large hero panel + side rail of labels. */
const ObjectBeat: React.FC<BeatProps> = ({ scene, film }) => {
  const { p0, p1, p2, t } = usePhases();
  const ids = (scene.glyphs?.length ? scene.glyphs : ['prop']).slice(0, 2);
  const labels = labelsOf(scene, 3);
  return (
    <Stage film={film}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.55fr 0.9fr', gap: '3%', width: '100%', height: '100%' }}>
        <Panel ink={film.ink} accent={film.accent} enter={p0} style={{ padding: '4%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '92%', height: '88%', display: 'flex', gap: '4%' }}>
            {ids.map((id) => (
              <div key={id} style={{ flex: 1, opacity: 0.2 + 0.8 * p1 }}>
                <Glyph id={id} t={t} ink={film.ink} accent={film.accent} />
              </div>
            ))}
          </div>
        </Panel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4%', height: '100%' }}>
          {labels.map((label, i) => {
            const on = Math.min(1, Math.max(0, p2 * 3 - i));
            return (
              <Panel
                key={`${label}-${i}`}
                ink={film.ink}
                accent={film.accent}
                fill={i === 0 ? `${film.accent}33` : undefined}
                enter={on}
                style={{ flex: 1, display: 'flex', alignItems: 'center', padding: '0 8%', fontFamily: FONT, fontWeight: 750, fontSize: 28, color: film.ink }}
              >
                <span style={{
                  width: 12, height: 12, borderRadius: 99, background: film.accent, marginRight: 14, opacity: on,
                }}
                />
                {label.slice(0, 8)}
              </Panel>
            );
          })}
        </div>
      </div>
    </Stage>
  );
};

const DeckBeat: React.FC<BeatProps> = ({ scene, film }) => {
  const { p0, p1, p2 } = usePhases();
  const labels = labelsOf(scene, 4);
  const tones = [film.accent, film.ink, film.muted || film.ink, film.accent];
  return (
    <Stage film={film}>
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        {labels.map((label, i) => {
          const on = i === 0 ? p0 : i === 1 ? p1 : p2;
          const x = ['2%', '28%', '54%', '18%'][i % 4];
          const y = ['4%', '8%', '12%', '46%'][i % 4];
          const rot = [-8, 6, -4, 9][i % 4];
          return (
            <Panel
              key={`${label}-${i}`}
              ink={film.ink}
              accent={film.accent}
              fill={i % 2 === 0 ? `${tones[i % tones.length]}22` : film.brandBg || 'transparent'}
              enter={on}
              style={{
                position: 'absolute',
                left: x,
                top: y,
                width: '42%',
                height: '48%',
                padding: '4% 3%',
                transform: `rotate(${rot * on}deg) translateY(${(1 - on) * 40}px)`,
                fontFamily: FONT,
                color: film.ink,
              }}
            >
              <div style={{ fontSize: 18, opacity: 0.55, fontWeight: 650, marginBottom: 10 }}>{`0${i + 1}`}</div>
              <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1 }}>{label.slice(0, 8)}</div>
              <div style={{
                position: 'absolute', left: '8%', right: '8%', bottom: '12%', height: 8,
                borderRadius: 99, background: film.accent, transform: `scaleX(${on})`, transformOrigin: 'left center',
              }}
              />
            </Panel>
          );
        })}
      </div>
    </Stage>
  );
};

const FlowBeat: React.FC<BeatProps> = ({ scene, film }) => {
  const { p0, p1, p2, width } = usePhases();
  const labels = labelsOf(scene, 4);
  const n = labels.length;
  const phases = [p0, p1, p2, p2];
  return (
    <Stage film={film}>
      <Panel ink={film.ink} accent={film.accent} enter={p0} style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', padding: '0 4%' }}>
        <div style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          {labels.map((label, i) => {
            const on = phases[Math.min(i, phases.length - 1)];
            return (
              <React.Fragment key={`${label}-${i}`}>
                <div style={{
                  flex: 1,
                  minHeight: Math.round(width * 0.14),
                  border: `4px solid ${film.ink}`,
                  borderRadius: 20,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 16,
                  fontFamily: FONT,
                  fontWeight: 780,
                  fontSize: Math.round(width * 0.022),
                  color: film.ink,
                  background: i === Math.min(n - 1, 1) ? `${film.accent}44` : 'transparent',
                  opacity: 0.2 + 0.8 * on,
                  transform: `translateY(${(1 - on) * 24}px)`,
                }}
                >{label.slice(0, 6)}</div>
                {i < n - 1 ? (
                  <div style={{
                    width: 48, height: 6, borderRadius: 99, background: film.accent,
                    transform: `scaleX(${on})`, transformOrigin: 'left center', flexShrink: 0,
                  }}
                  />
                ) : null}
              </React.Fragment>
            );
          })}
        </div>
      </Panel>
    </Stage>
  );
};

const BarsBeat: React.FC<BeatProps> = ({ scene, film }) => {
  const { p0, p1, p2, t, width } = usePhases();
  const labels = labelsOf(scene, 5);
  const heights = [0.42, 0.7, 0.55, 0.88, 0.62];
  const raw = `${scene.headline || ''} ${scene.visualIntent || ''}`;
  const num = Number((raw.match(/(\d+(?:\.\d+)?)/) || [])[1] || 0);
  const shown = Math.round((num > 0 ? num : 100) * t);
  return (
    <Stage film={film}>
      <Panel ink={film.ink} accent={film.accent} enter={p0} style={{ width: '100%', height: '100%', position: 'relative', padding: '4% 5% 3%' }}>
        <div style={{
          position: 'absolute', top: '6%', right: '5%', color: film.accent,
          fontFamily: FONT, fontWeight: 820, fontSize: Math.round(width * 0.07), opacity: p1,
        }}
        >{shown}</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3%', height: '100%', paddingTop: '12%' }}>
          {labels.map((label, i) => {
            const on = i < 2 ? p1 : p2;
            return (
              <div key={`${label}-${i}`} style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: '100%',
                  height: `${heights[i % heights.length] * on * 100}%`,
                  minHeight: 10,
                  borderRadius: '14px 14px 6px 6px',
                  background: i === 2 ? film.accent : film.ink,
                  opacity: 0.35 + 0.65 * on,
                }}
                />
                <div style={{ color: film.ink, fontFamily: FONT, fontWeight: 720, fontSize: 22 }}>{label.slice(0, 6)}</div>
              </div>
            );
          })}
        </div>
      </Panel>
    </Stage>
  );
};

const DeviceBeat: React.FC<BeatProps> = ({ scene, film }) => {
  const { p0, p1, p2, t } = usePhases();
  const glyph = (scene.glyphs || []).find((g) => g !== 'prop' && g !== 'cursor') || 'doc';
  const rows = labelsOf(scene, 4);
  return (
    <Stage film={film}>
      <Panel ink={film.ink} accent={film.accent} enter={p0} fill={film.brandBg || 'transparent'} style={{ width: '100%', height: '100%', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 44, borderBottom: `2px solid ${film.ink}55`, display: 'flex', alignItems: 'center', gap: 10, padding: '0 18px' }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ width: 12, height: 12, borderRadius: 99, background: i === 0 ? film.accent : film.ink, opacity: 0.5 + 0.5 * p0 }} />
          ))}
          <div style={{ marginLeft: 12, flex: 1, height: 10, borderRadius: 99, background: `${film.ink}33` }} />
        </div>
        <div style={{ position: 'absolute', top: 64, left: '4%', right: '34%', bottom: '8%', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {rows.map((row, i) => {
            const on = i < 2 ? p1 : p2;
            return (
              <div key={`${row}-${i}`} style={{
                height: 22 + i * 4,
                borderRadius: 99,
                background: film.ink,
                opacity: 0.2 + 0.55 * on,
                width: `${55 + i * 8}%`,
                transform: `scaleX(${0.35 + 0.65 * on})`,
                transformOrigin: 'left center',
              }}
              />
            );
          })}
          <div style={{
            marginTop: 8, height: 56, borderRadius: 14, border: `3px solid ${film.accent}`,
            opacity: p2, display: 'flex', alignItems: 'center', padding: '0 18px',
            fontFamily: FONT, fontWeight: 750, color: film.ink, fontSize: 24,
          }}
          >{(scene.headline || rows[0] || '').slice(0, 10)}</div>
        </div>
        <div style={{ position: 'absolute', right: '4%', top: '22%', width: '26%', height: '52%', opacity: p1 }}>
          <Glyph id={glyph} t={t} ink={film.ink} accent={film.accent} />
        </div>
        <div style={{
          position: 'absolute',
          left: `${10 + t * 52}%`,
          top: `${28 + t * 36}%`,
          width: 26,
          height: 26,
          background: film.accent,
          clipPath: 'polygon(0 0, 100% 40%, 55% 55%, 40% 100%)',
          opacity: p2,
          zIndex: 3,
        }}
        />
      </Panel>
    </Stage>
  );
};

const ChatBeat: React.FC<BeatProps> = ({ scene, film }) => {
  const { p0, p1, p2 } = usePhases();
  const raw = (scene.items?.length ? scene.items : [scene.headline, scene.line].filter(Boolean) as string[])
    .map((s) => s.trim().slice(0, 18))
    .filter(Boolean)
    .slice(0, 5);
  const lines = raw.length ? raw : labelsOf(scene, 4);
  const phases = [p0, p1, p1, p2, p2];
  return (
    <Stage film={film}>
      <Panel ink={film.ink} accent={film.accent} enter={p0} style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 18, padding: '4% 8%' }}>
        {lines.map((line, i) => {
          const on = phases[Math.min(i, phases.length - 1)];
          const mine = i % 2 === 1;
          return (
            <div key={`${line}-${i}`} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', opacity: on }}>
              <div style={{
                maxWidth: '76%',
                padding: '18px 24px',
                borderRadius: mine ? '24px 24px 8px 24px' : '24px 24px 24px 8px',
                background: mine ? film.accent : 'transparent',
                color: mine ? film.canvas : film.ink,
                border: mine ? 'none' : `3px solid ${film.ink}`,
                fontFamily: FONT,
                fontWeight: 720,
                fontSize: 30,
                transform: `translateY(${(1 - on) * 22}px)`,
              }}
              >{line}</div>
            </div>
          );
        })}
      </Panel>
    </Stage>
  );
};

const RouteBeat: React.FC<BeatProps> = ({ film }) => {
  const { p0, p1, p2, t } = usePhases();
  const x = 70 + t * 780;
  const y = 150 + Math.sin(t * Math.PI) * -80;
  return (
    <Stage film={film}>
      <Panel ink={film.ink} accent={film.accent} enter={p0} style={{ width: '100%', height: '100%', padding: '3%' }}>
        <svg viewBox="0 0 960 320" style={{ width: '100%', height: '100%' }}>
          <rect x="20" y="20" width="920" height="280" rx="18" fill="none" stroke={film.ink} strokeWidth="3" opacity={0.25} />
          {[[120, 220], [320, 90], [540, 180], [760, 70], [880, 160]].map(([cx, cy], i) => (
            <circle key={i} cx={cx} cy={cy} r={8 + (i === 2 ? p1 * 6 : 0)} fill={i === 2 ? film.accent : film.ink} opacity={0.35 + 0.65 * p1} />
          ))}
          <path
            d="M40 210 C 180 60, 340 250, 520 140 S 760 40, 920 170"
            fill="none"
            stroke={film.ink}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray="1200"
            strokeDashoffset={1200 * (1 - p1)}
          />
          <circle cx={x} cy={y} r="18" fill={film.accent} opacity={p2} />
          <circle cx={x} cy={y} r={26 + t * 12} fill="none" stroke={film.accent} strokeWidth="4" opacity={0.55 * p2} />
        </svg>
      </Panel>
    </Stage>
  );
};

const IsoBeat: React.FC<BeatProps> = ({ scene, film }) => {
  const { p0, p1, p2 } = usePhases();
  const labels = labelsOf(scene, 3);
  const phases = [p0, p1, p2];
  return (
    <Stage film={film}>
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '4%' }}>
        {labels.map((label, i) => {
          const on = phases[i] ?? p2;
          return (
            <Panel
              key={`${label}-${i}`}
              ink={film.ink}
              accent={film.accent}
              fill={i === 1 ? film.accent : undefined}
              enter={on}
              style={{
                width: '28%',
                height: `${58 + i * 8}%`,
                transform: `translateY(${(1 - on) * -90}px) skewY(-8deg)`,
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'center',
                paddingBottom: 20,
                color: i === 1 ? film.canvas : film.ink,
                fontFamily: FONT,
                fontWeight: 780,
                fontSize: 30,
              }}
            >
              {label.slice(0, 6)}
            </Panel>
          );
        })}
      </div>
    </Stage>
  );
};

const InkBeat: React.FC<BeatProps> = ({ scene, film }) => {
  const { p0, p1, p2, t } = usePhases();
  const id = (scene.glyphs || []).find((g) => g !== 'prop') || 'brush';
  const labels = labelsOf(scene, 2);
  return (
    <Stage film={film}>
      <Panel ink={film.ink} accent={film.accent} enter={p0} style={{ width: '100%', height: '100%', display: 'grid', gridTemplateColumns: '1.4fr 0.8fr', gap: '3%', padding: '3%' }}>
        <div style={{ opacity: p1 }}>
          <Glyph id={id} t={t} ink={film.ink} accent={film.accent} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 18 }}>
          {labels.map((label, i) => (
            <div key={`${label}-${i}`} style={{
              fontFamily: FONT, fontWeight: 760, fontSize: 32, color: film.ink,
              opacity: p2, borderLeft: `6px solid ${film.accent}`, paddingLeft: 16,
              transform: `translateX(${(1 - p2) * 20}px)`,
            }}
            >{label.slice(0, 8)}</div>
          ))}
        </div>
      </Panel>
    </Stage>
  );
};

const PriceBeat: React.FC<BeatProps> = ({ scene, film }) => {
  const { p0, p1, p2, width } = usePhases();
  const nums = [...`${scene.visualIntent || ''} ${scene.headline || ''}`.matchAll(/(\d+(?:\.\d+)?)/g)].map((m) => m[1]);
  const was = nums[0] || '';
  const now = nums[1] || scene.headline || nums[0] || '—';
  return (
    <Stage film={film}>
      <Panel ink={film.ink} accent={film.accent} enter={p0} style={{
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', fontFamily: FONT, color: film.ink,
      }}
      >
        {was && now !== was ? (
          <div style={{ position: 'relative', display: 'inline-block', fontSize: Math.round(width * 0.045), opacity: 0.65 * p1, fontWeight: 650 }}>
            {was}
            <div style={{
              position: 'absolute', left: 0, right: 0, top: '48%', height: 5, background: film.accent,
              transform: `scaleX(${p1})`, transformOrigin: 'left center',
            }}
            />
          </div>
        ) : null}
        <div style={{
          marginTop: 18,
          fontSize: Math.round(width * 0.11),
          fontWeight: 820,
          color: film.accent,
          letterSpacing: '-0.04em',
          clipPath: `inset(0 ${(1 - p2) * 100}% 0 0)`,
        }}
        >{now}</div>
      </Panel>
    </Stage>
  );
};

const TypeBeat: React.FC<BeatProps> = ({ scene, film }) => {
  const { p0, p1, p2, width } = usePhases();
  const text = (scene.headline || '').trim() || ' ';
  const chars = [...text];
  const size = Math.round(width * (chars.length <= 8 ? 0.1 : 0.062));
  return (
    <AbsoluteFill style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '10% 8%',
      fontFamily: FONT,
      color: film.ink,
    }}
    >
      <div style={{
        position: 'absolute', inset: '12% 10%', border: `3px solid ${film.ink}44`, borderRadius: 28, opacity: p0,
      }}
      />
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.08em', fontSize: size, fontWeight: 820, letterSpacing: '-0.04em', lineHeight: 1.05 }}>
        {chars.map((ch, i) => {
          const start = i / Math.max(1, chars.length);
          const local = interpolate(p1 + p2 * 0.35, [start, Math.min(1, start + 0.2)], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          return (
            <span
              key={`${ch}-${i}`}
              style={{
                display: 'inline-block',
                opacity: local,
                clipPath: `inset(${(1 - local) * 100}% 0 0 0)`,
                transform: `translateY(${(1 - local) * 36}px)`,
              }}
            >{ch}</span>
          );
        })}
      </div>
      <div style={{
        position: 'absolute', bottom: '14%', left: '18%', right: '18%', height: 8,
        background: film.accent, borderRadius: 99, transform: `scaleX(${p2})`, transformOrigin: 'left center',
      }}
      />
    </AbsoluteFill>
  );
};

function Picture({ scene, film }: BeatProps) {
  const layout = scene.layout || 'object';
  if (layout === 'type') return <TypeBeat scene={scene} film={film} />;
  if (layout === 'deck') return <DeckBeat scene={scene} film={film} />;
  if (layout === 'flow') return <FlowBeat scene={scene} film={film} />;
  if (layout === 'bars') return <BarsBeat scene={scene} film={film} />;
  if (layout === 'ink') return <InkBeat scene={scene} film={film} />;
  if (layout === 'route') return <RouteBeat film={film} />;
  if (layout === 'iso') return <IsoBeat scene={scene} film={film} />;
  if (layout === 'chat') return <ChatBeat scene={scene} film={film} />;
  if (layout === 'device') return <DeviceBeat scene={scene} film={film} />;
  if (layout === 'price') return <PriceBeat scene={scene} film={film} />;
  return <ObjectBeat scene={scene} film={film} />;
}

export const NarrationFilm: React.FC<BeatProps> = ({ scene, film }) => {
  const { p0 } = usePhases();
  const layout = scene.layout || 'object';
  return (
    <AbsoluteFill style={{ background: film.canvas, overflow: 'hidden', fontFamily: FONT }}>
      <Skin notes={film.material} ink={film.ink} accent={film.accent} />
      <div style={{
        position: 'absolute',
        inset: 0,
        zIndex: 1,
        pointerEvents: 'none',
        background: `radial-gradient(ellipse at 48% 58%, ${film.accent}28, transparent 62%)`,
      }}
      />
      {layout === 'type' ? (
        <TypeBeat scene={scene} film={film} />
      ) : (
        <>
          <TitleStrip text={scene.headline} film={film} enter={p0} />
          <Picture scene={scene} film={film} />
        </>
      )}
    </AbsoluteFill>
  );
};
