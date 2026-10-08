import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Series,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  Easing,
} from 'remotion';
import { loadFont } from '@remotion/google-fonts/Inter';
import type { LaunchProps, LaunchScene } from './launchSchema';
import { SceneMotion } from './SceneMotion';
import { IssueCard, KineticWords, type IssueTone } from './ui';
import { launchShot } from './techniques';

const { fontFamily: FONT } = loadFont('normal', {
  weights: ['400', '500', '600', '700', '800'],
  subsets: ['latin'],
});

const ENTER = Easing.bezier(0.22, 1, 0.36, 1);
const MINT = '#77DDB7';
const GRAIN = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.045 0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>`,
)}")`;

const Stage: React.FC<{ canvas: string; children: React.ReactNode; softGrid?: boolean }> = ({
  canvas, children, softGrid,
}) => (
  <AbsoluteFill style={{ background: canvas, fontFamily: FONT, overflow: 'hidden' }}>
    <AbsoluteFill style={{
      background: 'radial-gradient(ellipse at 50% 42%, rgba(94,106,210,0.14) 0%, transparent 52%)',
    }} />
    {softGrid && (
      <AbsoluteFill style={{
        opacity: 0.22,
        backgroundImage:
          'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
        backgroundSize: '64px 64px',
      }} />
    )}
    <AbsoluteFill style={{ backgroundImage: GRAIN, opacity: 0.5, mixBlendMode: 'overlay' }} />
    {children}
  </AbsoluteFill>
);

/** Official Linear mark: white disc + three diagonal black slashes */
const LinearMark: React.FC<{ size?: number; glow?: number }> = ({ size = 72, glow = 1 }) => (
  <div style={{
    width: size, height: size, borderRadius: '50%', background: '#fff', position: 'relative', overflow: 'hidden',
    boxShadow: `0 0 ${28 * glow}px ${10 * glow}px rgba(255,255,255,0.45)`,
  }}>
    {[0, 1, 2].map((i) => (
      <div key={i} style={{
        position: 'absolute',
        width: size * 1.4, height: Math.max(2.5, size * 0.055),
        background: '#07070A',
        left: -size * 0.15,
        top: size * (0.52 + i * 0.12),
        transform: 'rotate(-42deg)',
        transformOrigin: 'center',
      }} />
    ))}
  </div>
);

const Sunburst: React.FC<{ accent: string; spin?: number }> = ({ accent, spin = 0 }) => (
  <div style={{
    position: 'absolute', inset: '-20%',
    background: `conic-gradient(from ${spin}deg, transparent 0deg, ${accent}18 8deg, transparent 16deg, transparent 24deg, ${accent}12 32deg, transparent 40deg)`,
    filter: 'blur(2px)', opacity: 0.85,
  }} />
);

const Dot: React.FC<{ accent: string }> = ({ accent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 18, stiffness: 90 } });
  const glow = interpolate(frame, [0, fps * 0.9], [0.85, 1.35], { extrapolateRight: 'clamp', easing: ENTER });
  const ring = interpolate(frame, [0, fps], [0.7, 1.15], { extrapolateRight: 'clamp', easing: ENTER });
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      {[1.6, 2.35, 3.1].map((m, i) => (
        <div key={i} style={{
          position: 'absolute', width: 120 * m * ring, height: 120 * m * ring, borderRadius: '50%',
          border: `1px solid ${accent}`, opacity: 0.12 - i * 0.03,
          boxShadow: `0 0 40px ${accent}22`,
        }} />
      ))}
      <div style={{ transform: `scale(${interpolate(s, [0, 1], [0.55, 1]) * glow})` }}>
        <LinearMark size={118} glow={glow} />
      </div>
    </AbsoluteFill>
  );
};

const IssuePill: React.FC<{
  label: string; x: number; y: number; z: number; rotate: number; accent: string;
}> = ({ label, x, y, z, rotate, accent }) => {
  const blur = Math.max(0, Math.min(14, Math.abs(z) / 28));
  const scale = interpolate(z, [-220, 220], [0.62, 1.35], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const opacity = interpolate(Math.abs(z), [0, 240], [0.92, 0.12], { extrapolateRight: 'clamp' });
  return (
    <div style={{
      position: 'absolute', left: '50%', top: '50%',
      transform: `translate(-50%, -50%) translate3d(${x}px, ${y}px, 0) scale(${scale}) rotate(${rotate}deg)`,
      filter: `blur(${blur}px)`, opacity,
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '8px 14px', borderRadius: 9,
      background: 'rgba(255,255,255,0.055)',
      border: '1px solid rgba(255,255,255,0.07)',
      color: 'rgba(200,204,230,0.9)', fontSize: 13, fontWeight: 500,
      boxShadow: z > 50 ? `0 0 28px ${accent}40` : 'none',
      whiteSpace: 'nowrap', letterSpacing: '-0.01em',
    }}>
      <span style={{
        width: 8, height: 8, borderRadius: '50%',
        background: accent, boxShadow: `0 0 10px ${accent}`,
      }} />
      {label}
      <span style={{
        width: 40, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.12)', marginLeft: 2,
      }} />
    </div>
  );
};

const Cloud: React.FC<{ scene: LaunchScene; accent: string; cloudCount?: number; zoomFrom?: number }> = ({
  scene, accent, cloudCount = 36, zoomFrom = 1.12,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cam = interpolate(frame, [0, fps * 2], [zoomFrom, 1], { extrapolateRight: 'clamp', easing: ENTER });
  const pills = scene.pills?.length ? scene.pills : ['ENG-1001', 'ENG-1002', 'ENG-1003'];
  const items = Array.from({ length: cloudCount }, (_, i) => {
    const label = pills[i % pills.length];
    const seed = i * 17.13;
    const drift = frame * (0.42 + (i % 5) * 0.09);
    return {
      label,
      x: Math.sin(seed) * 560 + Math.cos(seed * 0.7 + drift / 38) * 90,
      y: Math.cos(seed * 1.3) * 300 + Math.sin(seed + drift / 48) * 48,
      z: ((i * 47) % 440) - 220 + Math.sin(drift / 28) * 24,
      rotate: Math.sin(seed) * 10,
    };
  });
  return (
    <AbsoluteFill style={{ perspective: 1100, transform: `scale(${cam})` }}>
      {items.map((it, i) => (
        <IssuePill key={i} {...it} accent={accent} />
      ))}
    </AbsoluteFill>
  );
};

const Hook: React.FC<{ scene: LaunchScene; ink: string; accent: string; camScale?: number }> = ({
  scene, ink, accent, camScale = 1.08,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 15, stiffness: 88 } });
  const cam = interpolate(frame, [0, fps * 2.4], [camScale, 1], { extrapolateRight: 'clamp', easing: ENTER });
  const slash = interpolate(frame, [fps * 1.6, fps * 2.4], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const pills = scene.pills || [];
  const lavender = '#B4BEFE';
  return (
    <AbsoluteFill style={{ transform: `scale(${cam})` }}>
      <AbsoluteFill style={{
        background: 'radial-gradient(circle at 50% 48%, rgba(255,255,255,0.07) 0%, transparent 42%)',
      }} />
      {pills.map((p, i) => {
        const ang = (i / Math.max(1, pills.length)) * Math.PI * 2 + frame / 95;
        const r = 360 + (i % 3) * 55;
        return (
          <IssuePill
            key={p + i}
            label={p}
            x={Math.cos(ang) * r}
            y={Math.sin(ang) * r * 0.52}
            z={-90 - (i % 4) * 45}
            rotate={Math.sin(i) * 7}
            accent={accent}
          />
        );
      })}
      <AbsoluteFill style={{
        justifyContent: 'center', alignItems: 'center', zIndex: 5,
        opacity: enter * (1 - slash * 0.85),
        transform: `translateY(${interpolate(enter, [0, 1], [32, 0])}px)`,
        padding: '0 80px',
      }}>
        <KineticWords text={scene.line1 || ''} size={92} color={ink} delay={2} />
        <div style={{ height: 10 }} />
        <KineticWords text={scene.line2 || ''} size={92} color={lavender} delay={8} />
      </AbsoluteFill>
      {slash > 0 && (
        <div style={{
          position: 'absolute', left: '50%', top: '50%', width: 2, height: 1400,
          background: '#fff',
          boxShadow: '0 0 12px 3px rgba(255,255,255,0.85)',
          transform: `translate(-50%, -50%) rotate(45deg) scaleY(${slash})`,
          opacity: slash,
        }} />
      )}
    </AbsoluteFill>
  );
};

const Spinner: React.FC<{ scene: LaunchScene; ink: string }> = ({ scene, ink }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 16 } });
  const rot = frame * 2.2;
  const label = scene.spinnerLabel || 'In Review';
  const nodes = [
    { color: '#8B8FA8' },
    { color: '#F2C94C' },
    { color: MINT },
    { color: 'rgba(255,255,255,0.2)' },
  ];
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }} >
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.1, fontSize: 110, fontWeight: 700,
        letterSpacing: '0.18em', display: 'grid', placeItems: 'center',
        transform: 'scale(1.35)', WebkitTextStroke: `1px ${MINT}`, color: 'transparent',
      }}>{label.toUpperCase()}</div>
      <div style={{
        width: 128, height: 128, borderRadius: '50%', position: 'relative',
        transform: `scale(${interpolate(enter, [0, 1], [0.7, 1])})`,
        boxShadow: `0 0 60px ${MINT}55`,
      }}>
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          border: `10px solid ${MINT}`,
          clipPath: 'polygon(0 0, 100% 0, 100% 38%, 62% 38%, 38% 100%, 0 100%)',
          boxShadow: `0 0 28px ${MINT}`,
        }} />
        <div style={{
          position: 'absolute', inset: 18, borderRadius: '50%', background: MINT,
          boxShadow: `0 0 24px ${MINT}`,
        }} />
        {Array.from({ length: 28 }, (_, i) => {
          const a = (i / 28) * Math.PI * 2 + rot * 0.02;
          return (
            <div key={i} style={{
              position: 'absolute', left: '50%', top: '50%',
              width: 4, height: 4, borderRadius: '50%', background: MINT,
              boxShadow: `0 0 6px ${MINT}`,
              transform: `translate(-50%, -50%) rotate(${(a * 180) / Math.PI}deg) translateY(-78px)`,
              opacity: 0.35 + (i % 3) * 0.2,
            }} />
          );
        })}
      </div>
      <div style={{
        marginTop: 28, color: MINT, fontSize: 38, fontWeight: 700,
        textShadow: `0 0 28px ${MINT}88`, opacity: enter, letterSpacing: '-0.02em',
      }}>{label}</div>
      <div style={{
        position: 'absolute', bottom: 100, display: 'flex', alignItems: 'center', gap: 0,
      }}>
        {nodes.map((n, i) => (
          <React.Fragment key={i}>
            {i > 0 && (
              <div style={{
                width: 56, height: 2,
                background: i <= 2 ? MINT : 'rgba(255,255,255,0.15)',
                boxShadow: i <= 2 ? `0 0 8px ${MINT}` : 'none',
              }} />
            )}
            <div style={{
              width: 12, height: 12, borderRadius: '50%', background: n.color,
              boxShadow: i === 2 ? `0 0 12px ${MINT}` : 'none',
              border: '2px solid rgba(0,0,0,0.4)',
            }} />
          </React.Fragment>
        ))}
      </div>
      <div style={{ opacity: 0, color: ink }} />
    </AbsoluteFill>
  );
};

const Keys: React.FC<{ scene: LaunchScene; ink: string; accent: string; highlight: string }> = ({
  scene, ink, accent, highlight,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 14, stiffness: 100 } });
  const active = Math.min(6, Math.floor(interpolate(frame, [8, fps * 1.4], [0, 2.8], { extrapolateRight: 'clamp' })));
  const items = [
    { label: 'Create new issue', key: 'C' },
    { label: 'Assign to...', key: 'A' },
    { label: 'Change status...', key: 'S' },
    { label: 'Change priority...', key: 'P' },
    { label: 'Add labels...', key: 'L' },
    { label: 'Move to project...', key: 'M' },
    { label: 'Set due date...', key: 'D' },
  ];
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div style={{
        width: 820, borderRadius: 18, overflow: 'hidden',
        background: 'rgba(18,18,24,0.96)',
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: `0 40px 100px rgba(0,0,0,0.7), 0 0 80px ${accent}30`,
        opacity: enter, transform: `scale(${interpolate(enter, [0, 1], [0.94, 1.06])})`,
        backdropFilter: 'blur(12px)',
      }}>
        <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '5px 10px', borderRadius: 999, background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)', marginBottom: 12, fontSize: 12, color: ink,
          }}>
            <span style={{
              width: 10, height: 10, borderRadius: '50%', background: highlight,
              boxShadow: `0 0 8px ${highlight}`,
            }} />
            {scene.statusTitle || 'ENG-2481 Fix checkout race condition'}
          </div>
          <div style={{ color: '#6B7088', fontSize: 18, fontWeight: 500 }}>Type a command or search...</div>
        </div>
        <div style={{ padding: '6px 8px 10px' }}>
          {items.map((it, i) => (
            <div key={it.label} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '11px 12px', borderRadius: 10, marginBottom: 2,
              background: i === active ? `${accent}55` : 'transparent',
              boxShadow: i === active ? `inset 0 0 0 1px ${accent}66` : 'none',
              color: ink, fontSize: 16, fontWeight: 500,
            }}>
              <span style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <span style={{
                  width: 16, height: 16, borderRadius: 4,
                  border: '1.5px solid rgba(255,255,255,0.25)',
                }} />
                {it.label}
              </span>
              <span style={{
                minWidth: 22, padding: '2px 7px', borderRadius: 6, textAlign: 'center',
                background: 'rgba(255,255,255,0.06)', color: '#7C829A', fontSize: 12, fontWeight: 600,
              }}>{it.key}</span>
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Board: React.FC<{
  scene: LaunchScene; ink: string; accent: string; highlight: string;
  tiltRange?: readonly [number, number];
  pitchRange?: readonly [number, number];
  scale?: number;
}> = ({
  scene, ink, accent, highlight,
  tiltRange = [-14, -8], pitchRange = [12, 8], scale = 1.18,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 16 } });
  const tilt = interpolate(frame, [0, fps * 3], [...tiltRange], { extrapolateRight: 'clamp' });
  const pitch = interpolate(frame, [0, fps * 3], [...pitchRange], { extrapolateRight: 'clamp' });
  const cols = scene.boardColumns || [];
  const toneDot = (t?: string) => {
    if (t === 'progress') return highlight;
    if (t === 'review') return MINT;
    if (t === 'done') return accent;
    return '#8B8FA8';
  };
  const floatId = scene.floatingCardId;
  const words = (scene.boardTagline || 'Plan. Build. Ship.').split(/\s+/);
  const denseCols = cols.map((col) => {
    const seen = new Set<string>();
    const cards = (col.cards || []).filter((c) => {
      const key = (c.title || '').trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 5);
    return { ...col, cards };
  });
  return (
    <AbsoluteFill style={{ opacity: enter, overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', inset: '-4% -2% 18% -2%',
        transform: `perspective(1600px) rotateY(${tilt}deg) rotateX(${pitch}deg) scale(${scale})`,
        transformOrigin: '50% 45%',
      }}>
        <div style={{
          display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, denseCols.length)}, 1fr)`,
          gap: 18, height: '100%', padding: '28px 36px',
        }}>
          {denseCols.map((col, ci) => (
            <div key={col.title} style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14,
                color: '#9AA0B5', fontSize: 16, fontWeight: 600,
              }}>
                <span style={{
                  width: 12, height: 12, borderRadius: '50%',
                  background: toneDot(col.tone),
                  boxShadow: `0 0 10px ${toneDot(col.tone)}`,
                }} />
                {col.title}
                <span style={{ opacity: 0.45 }}>{col.cards.length}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 11, flex: 1 }}>
                {col.cards.map((card, ri) => {
                  const isFloat = card.id === floatId;
                  return (
                    <IssueCard
                      key={`${card.id}-${ri}`}
                      id={card.id}
                      title={card.title}
                      avatar={card.avatar}
                      tone={(col.tone as IssueTone) || 'todo'}
                      accent={accent}
                      ink={ink}
                      highlight={isFloat}
                      delay={ci * 3 + ri * 2}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{
        position: 'absolute', bottom: 40, left: 56, right: 56,
        fontSize: 72, fontWeight: 800, letterSpacing: '-0.04em', display: 'flex', gap: 18,
        textShadow: '0 12px 40px rgba(0,0,0,0.65)',
      }}>
        {words.map((w, i) => (
          <span key={w + i} style={{
            color: i === 0 ? ink : i === 1 ? '#A8AEBF' : accent,
            opacity: interpolate(frame, [fps * 0.35 + i * 5, fps * 0.35 + i * 5 + 8], [0, 1], {
              extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
            }),
          }}>{w}</span>
        ))}
      </div>
    </AbsoluteFill>
  );
};

const Status: React.FC<{ scene: LaunchScene; ink: string; accent: string; highlight: string; panelWidth?: number }> = ({
  scene, ink, accent, highlight, panelWidth = 900,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 16 } });
  const toast = frame > fps * 1.35;
  const toastEnter = spring({ frame: Math.max(0, frame - Math.floor(fps * 1.35)), fps, config: { damping: 14 } });
  const items = scene.statusItems || [];
  const active = scene.activeStatus ?? Math.min(items.length - 1, Math.floor(frame / (fps * 0.32)));
  const tone = (t?: string) => {
    if (t === 'yellow') return highlight;
    if (t === 'green') return MINT;
    if (t === 'purple') return accent;
    return '#8B8FA8';
  };
  if (toast) {
    return (
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 10,
          padding: '12px 20px', borderRadius: 999,
          background: 'rgba(28,24,48,0.92)',
          border: '1px solid rgba(255,255,255,0.14)',
          boxShadow: `0 20px 50px rgba(0,0,0,0.55), 0 0 40px ${accent}33`,
          opacity: toastEnter, transform: `scale(${interpolate(toastEnter, [0, 1], [0.9, 1])})`,
          color: ink, fontSize: 18, fontWeight: 600,
        }}>
          <span style={{
            width: 22, height: 22, borderRadius: '50%', background: accent,
            display: 'grid', placeItems: 'center', color: '#fff', fontSize: 13, fontWeight: 800,
            boxShadow: `0 0 14px ${accent}`,
          }}>✓</span>
          Moved to Done
        </div>
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div style={{
        width: panelWidth, borderRadius: 22, padding: 28,
        background: 'rgba(20,20,28,0.96)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: `0 40px 100px rgba(0,0,0,0.65), 0 0 80px ${accent}28`,
        opacity: enter, transform: `scale(${interpolate(enter, [0, 1], [0.94, 1.05])})`,
      }}>
        <div style={{
          display: 'inline-flex', gap: 8, alignItems: 'center',
          padding: '6px 12px', borderRadius: 999, background: `${accent}2A`,
          color: ink, fontSize: 13, marginBottom: 12, fontWeight: 500,
        }}>
          <span style={{ color: accent }}>✓</span>{scene.statusTitle}
        </div>
        <div style={{ color: '#8B90A8', fontSize: 14, marginBottom: 8 }}>Change status to...</div>
        {items.map((it, i) => (
          <div key={it.label} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '10px 12px', borderRadius: 10, marginBottom: 3,
            background: i === active ? `${accent}40` : 'transparent',
            boxShadow: i === active ? `inset 0 0 0 1px ${accent}66` : 'none',
            color: ink, fontSize: 17, fontWeight: 500,
          }}>
            <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{
                width: 14, height: 14, borderRadius: '50%',
                border: `2px solid ${tone(it.tone)}`,
                background: it.tone === 'purple' || it.tone === 'green' ? tone(it.tone) : 'transparent',
              }} />
              {it.label}
            </span>
            <span style={{ color: '#5C6278', fontSize: 13 }}>{i + 1}</span>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

const MiniChart: React.FC<{ accent: string; frame: number }> = ({ accent, frame }) => {
  const progress = interpolate(frame, [4, 40], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <svg width="100%" height="72" viewBox="0 0 280 72" style={{ marginTop: 18 }}>
      {[18, 36, 54].map((y) => (
        <line key={y} x1="0" y1={y} x2="280" y2={y} stroke="rgba(255,255,255,0.06)" strokeDasharray="4 6" />
      ))}
      <path
        d="M0,58 C40,52 70,48 100,40 S160,18 200,22 S250,8 280,6"
        fill="none" stroke={accent} strokeWidth="2.5"
        strokeDasharray={400} strokeDashoffset={400 * (1 - progress)}
        style={{ filter: `drop-shadow(0 0 6px ${accent})` }}
      />
      <circle cx={280 * progress} cy={6 + (1 - progress) * 20} r="4.5" fill="#fff"
        style={{ filter: `drop-shadow(0 0 8px ${accent})` }} />
    </svg>
  );
};

const Features: React.FC<{ scene: LaunchScene; ink: string; accent: string; highlight: string; pad?: number }> = ({
  scene, ink, accent, highlight, pad = 44,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cards = scene.cards || [];
  const playhead = interpolate(frame, [0, fps * 2.5], [8, 72], { extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{
      padding: `${Math.max(24, pad - 8)}px ${pad}px`, display: 'grid',
      gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 20,
      transform: 'scale(1.04)',
    }}>
      {cards.map((c, i) => {
        const p = spring({ frame: Math.max(0, frame - i * 5), fps, config: { damping: 15 } });
        return (
          <div key={c.title} style={{
            background: 'linear-gradient(160deg, rgba(34,34,44,0.98), rgba(14,14,20,0.99))',
            borderRadius: 18, padding: '22px 24px',
            border: '1px solid rgba(255,255,255,0.07)',
            boxShadow: '0 22px 50px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
            opacity: p, transform: `translateY(${interpolate(p, [0, 1], [24, 0])}px)`,
            overflow: 'hidden',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 30, fontWeight: 700, color: ink, letterSpacing: '-0.025em' }}>{c.title}</div>
                <div style={{ fontSize: 14, color: '#8B90A5', marginTop: 4 }}>{c.subtitle}</div>
              </div>
              {c.metric && (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: ink }}>{c.metric}</div>
                  <div style={{ fontSize: 12, color: '#8B90A5' }}>{c.detail}</div>
                </div>
              )}
            </div>
            {i === 0 && <MiniChart accent={accent} frame={frame} />}
            {i === 1 && (
              <div style={{ marginTop: 20, position: 'relative' }}>
                {[
                  { name: 'Checkout v2', pct: 22, color: accent },
                  { name: 'Onboarding revamp', pct: 13, color: MINT },
                  { name: 'iOS 3.0', pct: 8, color: '#C9895A' },
                ].map((row) => (
                  <div key={row.name} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#9AA0B5', marginBottom: 4 }}>
                      <span>{row.name}</span><span>{row.pct}%</span>
                    </div>
                    <div style={{ height: 7, borderRadius: 4, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                      <div style={{
                        width: `${row.pct * interpolate(frame, [6, 36], [0.2, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}%`,
                        height: '100%', background: row.color, borderRadius: 4,
                        boxShadow: `0 0 10px ${row.color}88`,
                      }} />
                    </div>
                  </div>
                ))}
                <div style={{
                  position: 'absolute', top: 0, bottom: 0, left: `${playhead}%`, width: 2,
                  background: accent, boxShadow: `0 0 10px ${accent}`, opacity: 0.85,
                }} />
              </div>
            )}
            {i === 2 && (
              <div style={{ marginTop: 18 }}>
                {['Crash on large paste', 'Webhook signature mismatch'].map((t) => (
                  <div key={t} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)',
                  }}>
                    <span style={{ display: 'flex', gap: 8, alignItems: 'center', color: ink, fontSize: 14 }}>
                      <span style={{
                        width: 14, height: 14, borderRadius: '50%',
                        border: `2px dotted ${highlight}`,
                      }} />
                      {t}
                    </span>
                    <span style={{
                      padding: '4px 10px', borderRadius: 999, fontSize: 12, color: ink,
                      background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)',
                    }}>Accept</span>
                  </div>
                ))}
              </div>
            )}
            {i === 3 && (
              <div style={{ marginTop: 16 }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}>
                  <span style={{ color: ink, fontSize: 13 }}>maya/eng-2481-fix-checkout-race</span>
                  <span style={{
                    padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                    color: MINT, background: `${MINT}22`, border: `1px solid ${MINT}55`,
                  }}>Open</span>
                </div>
                <div style={{
                  marginLeft: 18, height: 18, borderLeft: '1.5px dotted rgba(255,255,255,0.2)',
                }} />
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: ink, fontSize: 13, paddingLeft: 8 }}>
                  <span style={{
                    width: 12, height: 12, borderRadius: '50%', background: highlight,
                    boxShadow: `0 0 8px ${highlight}`,
                  }} />
                  {c.detail || 'ENG-2481 Fix checkout race condition'}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

const LogoEnd: React.FC<{ scene: LaunchScene; brand: string; tagline?: string; ink: string; accent: string }> = ({
  scene, brand, tagline, ink, accent,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 13 } });
  const burst = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: 'clamp' });
  const name = scene.brandName || brand;
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      <Sunburst accent={accent} spin={frame * 0.35} />
      <div style={{
        position: 'absolute', width: 900, height: 900, borderRadius: '50%',
        background: `radial-gradient(circle, rgba(255,255,255,${0.12 * burst}) 0%, transparent 58%)`,
      }} />
      {[0, 1, 2].map((i) => (
        <div key={i} style={{
          position: 'absolute', width: 2, height: 900,
          background: `rgba(255,255,255,${0.35 - i * 0.08})`,
          boxShadow: '0 0 10px rgba(255,255,255,0.5)',
          transform: `rotate(-42deg) translateX(${(i - 1) * 18}px) scaleY(${burst})`,
          opacity: burst,
        }} />
      ))}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 18, opacity: enter,
        transform: `scale(${interpolate(enter, [0, 1], [0.88, 1])})`, position: 'relative', zIndex: 2,
      }}>
        <LinearMark size={70} glow={1.1} />
        <div style={{ fontSize: 78, fontWeight: 700, color: ink, letterSpacing: '-0.045em' }}>{name}</div>
      </div>
      <div style={{ marginTop: 18, color: '#9AA0B5', fontSize: 24, opacity: enter, zIndex: 2 }}>
        {scene.tagline || tagline}
      </div>
      {scene.cta && (
        <div style={{
          marginTop: 26, padding: '10px 18px', borderRadius: 999,
          background: 'rgba(255,255,255,0.04)',
          border: `1px solid ${accent}88`,
          boxShadow: `0 0 24px ${accent}44`,
          color: ink, fontSize: 15, fontWeight: 600, opacity: enter, zIndex: 2,
        }}>{scene.cta}</div>
      )}
    </AbsoluteFill>
  );
};

const LaunchCaptions: React.FC<{ cues: { from: number; to: number; text: string }[] }> = ({ cues }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const cue = cues.find((c) => t >= c.from && t <= c.to);
  if (!cue) return null;
  return (
    <div style={{
      position: 'absolute', left: '12%', right: '12%', bottom: 40, zIndex: 30,
      display: 'flex', justifyContent: 'center', pointerEvents: 'none',
    }}>
      <div style={{
        padding: '12px 22px', borderRadius: 12,
        background: 'rgba(8,8,14,0.78)', border: '1px solid rgba(255,255,255,0.12)',
        color: '#F5F5F7', fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em',
        textAlign: 'center', maxWidth: 900, whiteSpace: 'pre-line',
        boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
      }}>{cue.text}</div>
    </div>
  );
};

export const LaunchShowreel: React.FC<LaunchProps> = (props) => {
  const { fps } = useVideoConfig();
  const cues = props.captions?.length ? props.captions : undefined;
  const shot = launchShot(props.shotId ?? props.variant ?? 0);
  return (
    <AbsoluteFill style={{ background: props.canvas }}>
      {!props.scenes.some((s) => s.narrationFile) && props.narrationFile
        ? <Audio src={staticFile(props.narrationFile)} />
        : null}
      <Series>
        {props.scenes.map((scene, i) => {
          const dur = Math.max(1, Math.round(scene.durationSec * fps));
          const sfx =
            scene.kind === 'dot' || scene.kind === 'logo' ? 'lowboom'
              : scene.kind === 'keys' || scene.kind === 'status' ? 'click'
                : 'whoosh';
          const zoomFrom = scene.kind === 'board' || scene.kind === 'hook'
            ? shot.zoomFrom
            : scene.kind === 'cloud' ? shot.zoomFrom * 0.98
              : shot.zoomFrom * 0.96;
          return (
            <Series.Sequence key={`${scene.kind}-${i}`} durationInFrames={dur}>
              {scene.narrationFile ? <Audio src={staticFile(scene.narrationFile)} /> : null}
              <SceneMotion
                durationInFrames={dur}
                zoomFrom={zoomFrom}
                enterFrames={scene.kind === 'dot' ? 2 : 5}
                sfx={sfx}
                sfxVolume={scene.kind === 'dot' ? 0.4 : 0.26}
              >
                <Stage canvas={props.canvas} softGrid={scene.kind === 'spinner' || scene.kind === 'status'}>
                  {scene.kind === 'dot' && <Dot accent={props.accent} />}
                  {scene.kind === 'cloud' && (
                    <Cloud scene={scene} accent={props.accent} cloudCount={shot.cloudCount} zoomFrom={1.08 + shot.id * 0.02} />
                  )}
                  {scene.kind === 'hook' && (
                    <Hook scene={scene} ink={props.ink} accent={props.accent} camScale={shot.hookCam} />
                  )}
                  {scene.kind === 'spinner' && <Spinner scene={scene} ink={props.ink} />}
                  {scene.kind === 'keys' && (
                    <Keys scene={scene} ink={props.ink} accent={props.accent} highlight={props.highlight} />
                  )}
                  {scene.kind === 'board' && (
                    <Board
                      scene={scene}
                      ink={props.ink}
                      accent={props.accent}
                      highlight={props.highlight}
                      tiltRange={shot.boardTilt}
                      pitchRange={shot.boardPitch}
                      scale={shot.boardScale}
                    />
                  )}
                  {scene.kind === 'status' && (
                    <Status
                      scene={scene}
                      ink={props.ink}
                      accent={props.accent}
                      highlight={props.highlight}
                      panelWidth={shot.statusWidth}
                    />
                  )}
                  {scene.kind === 'features' && (
                    <Features
                      scene={scene}
                      ink={props.ink}
                      accent={props.accent}
                      highlight={props.highlight}
                      pad={shot.featurePad}
                    />
                  )}
                  {scene.kind === 'logo' && (
                    <LogoEnd scene={scene} brand={props.brandName} tagline={props.tagline} ink={props.ink} accent={props.accent} />
                  )}
                </Stage>
              </SceneMotion>
            </Series.Sequence>
          );
        })}
      </Series>
      {cues ? <LaunchCaptions cues={cues} /> : null}
    </AbsoluteFill>
  );
};
