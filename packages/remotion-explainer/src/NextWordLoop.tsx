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
import type { NextWordProps, NextWordScene } from './nextWordSchema';

/** 9:16 short-form-video: 1080×1920 · safe center 900×1400 */
const SAFE = { top: 118, bottom: 300, left: 88, right: 118 } as const;
const PILL_H = 72;
const STEPS = ['READ', 'ODDS', 'SPIN', 'ADD'] as const;
const BLUES = ['#B4BBFF', '#8B92EA', '#5A62C4', '#3E4578', '#2C3358', '#1C2238'];
const ENTER = Easing.bezier(0.16, 1, 0.3, 1);

const { fontFamily: FONT } = loadFont('normal', {
  weights: ['400', '500', '600', '700', '800'],
  subsets: ['latin'],
});

const GRAIN = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.045 0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>`,
)}")`;

function springIn(frame: number, fps: number, delay: number, damping = 12) {
  return spring({ frame: frame - delay, fps, config: { damping, stiffness: 140, mass: 0.65 } });
}

function splitCaption(text: string): string[] {
  const chunks = text.match(/[^，。！？、；\s]+[，。！？、；]?/g);
  return chunks && chunks.length ? chunks : [text];
}

function splitHeadline(text: string): { body: string; accent?: string } {
  const m = text.match(/^(.*?)(\bthe next word\??)$/i);
  if (m) return { body: m[1].trim(), accent: m[2] };
  return { body: text };
}

function stepIndex(kind: NextWordScene['kind']): number {
  if (kind === 'read') return 0;
  if (kind === 'odds') return 1;
  if (kind === 'spin') return 2;
  if (kind === 'add' || kind === 'loop') return kind === 'loop' ? 4 : 3;
  return -1;
}

function sceneAtFrame(scenes: NextWordScene[], frame: number, fps: number) {
  let acc = 0;
  for (const s of scenes) {
    const d = Math.max(1, Math.round(s.durationSec * fps));
    if (frame < acc + d) return { scene: s, start: acc };
    acc += d;
  }
  return { scene: scenes[scenes.length - 1], start: acc };
}

function firstPillsFrame(scenes: NextWordScene[], fps: number) {
  let acc = 0;
  for (const s of scenes) {
    const d = Math.max(1, Math.round(s.durationSec * fps));
    if (s.kind !== 'hook' && s.kind !== 'type') return acc;
    acc += d;
  }
  return acc;
}

const Stage: React.FC<{ canvas: string; children: React.ReactNode }> = ({ canvas, children }) => (
  <AbsoluteFill style={{ background: canvas, fontFamily: FONT, overflow: 'hidden', color: '#fff' }}>
    <AbsoluteFill style={{
      background: 'radial-gradient(ellipse at 50% 38%, rgba(142,148,242,0.16) 0%, transparent 60%)',
    }}
    />
    <AbsoluteFill style={{ backgroundImage: GRAIN, opacity: 0.5, mixBlendMode: 'overlay' }} />
    {children}
  </AbsoluteFill>
);

/** Persistent overlay — never remounts with Series. Official: pills stay once they appear. */
const PersistentPills: React.FC<{ props: NextWordProps }> = ({ props }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { scene } = sceneAtFrame(props.scenes, frame, fps);
  const showFrom = firstPillsFrame(props.scenes, fps);
  const appear = interpolate(frame, [showFrom, showFrom + 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const active = stepIndex(scene.kind);
  const { accent, muted, ink } = props;
  return (
    <div style={{
      position: 'absolute',
      top: SAFE.top,
      left: SAFE.left,
      right: SAFE.right,
      zIndex: 20,
      opacity: appear,
    }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        {STEPS.map((label, i) => {
          const isCurrent = active < 4 && i === active;
          const done = active >= 4 || i < active;
          return (
            <div
              key={label}
              style={{
                padding: '15px 2px',
                borderRadius: 999,
                textAlign: 'center',
                background: isCurrent ? accent : 'rgba(18,20,28,0.78)',
                color: isCurrent ? '#12141C' : done ? ink : muted,
                fontSize: 20,
                fontWeight: 800,
                letterSpacing: 0.6,
                border: isCurrent ? 'none' : '1.5px solid rgba(255,255,255,0.12)',
                boxShadow: isCurrent ? `0 0 0 2px ${accent}` : 'none',
              }}
            >
              {i + 1} {label}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const WordSlam: React.FC<{ text: string; size: number; color: string; delay?: number; align?: 'center' | 'left' }> = ({
  text, size, color, delay = 0, align = 'center',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(/\s+/).filter(Boolean);
  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', justifyContent: align === 'center' ? 'center' : 'flex-start',
      columnGap: 16, rowGap: 4,
    }}
    >
      {words.map((w, i) => {
        const p = spring({
          frame: frame - delay - i * 3,
          fps,
          config: { damping: 12, stiffness: 150, mass: 0.55 },
        });
        return (
          <span
            key={`${w}-${i}`}
            style={{
              display: 'inline-block',
              fontSize: size,
              fontWeight: 800,
              color,
              letterSpacing: '-0.035em',
              lineHeight: 1.08,
              opacity: interpolate(p, [0, 1], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
              transform: `translateY(${interpolate(p, [0, 1], [26, 0])}px) scale(${interpolate(p, [0, 1], [1.08, 1])})`,
            }}
          >
            {w}
          </span>
        );
      })}
    </div>
  );
};

const SceneHeadline: React.FC<{ text: string; accent: string; ink: string; hook?: boolean }> = ({
  text, accent, ink, hook,
}) => {
  const { body, accent: accentLine } = splitHeadline(text);
  if (hook && accentLine) {
    return (
      <div style={{ margin: '8px 0 20px', flexShrink: 0 }}>
        <WordSlam text={body} size={72} color={ink} delay={2} />
        <div style={{ height: 6 }} />
        <WordSlam text={accentLine} size={76} color={accent} delay={12} />
      </div>
    );
  }
  return (
    <div style={{ margin: '10px 0 12px', flexShrink: 0 }}>
      <WordSlam text={text} size={54} color={ink} delay={4} />
    </div>
  );
};

const VoCaption: React.FC<{ text?: string; accent: string }> = ({ text, accent }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  if (!text?.trim()) return <div style={{ height: 8, flexShrink: 0 }} />;
  const words = splitCaption(text.trim());
  const span = Math.max(4, Math.floor((durationInFrames * 0.72) / Math.max(words.length, 1)));
  return (
    <div style={{
      marginTop: 14, flexShrink: 0, alignSelf: 'center',
      padding: '14px 22px', borderRadius: 999,
      background: 'rgba(0,0,0,0.58)', border: `1.5px solid ${accent}66`,
      display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.28em',
    }}
    >
      {words.map((w, i) => {
        const enter = 8 + i * span;
        const p = spring({ frame: frame - enter, fps, config: { damping: 12, mass: 0.6, stiffness: 160 } });
        const active = frame >= enter && frame < enter + span + 4;
        return (
          <span
            key={`${w}-${i}`}
            style={{
              display: 'inline-block', fontSize: 28, fontWeight: 700,
              color: active ? accent : '#fff',
              opacity: interpolate(p, [0, 1], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
              transform: `scale(${interpolate(p, [0, 1], [0.65, 1])})`,
            }}
          >
            {w}
          </span>
        );
      })}
    </div>
  );
};

const ChatPanel: React.FC<{
  promptBubble?: string;
  writingText: string;
  accent: string;
  muted: string;
  ink: string;
  typewriter?: boolean;
  highlightWord?: string;
  compact?: boolean;
}> = ({ promptBubble, writingText, accent, muted, ink, typewriter, highlightWord, compact }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const bubbleIn = springIn(frame, fps, 10, 13);
  const boxIn = springIn(frame, fps, promptBubble ? 18 : 8, 13);
  const blink = Math.floor(frame / 12) % 2 === 0;
  const words = writingText.trim() ? writingText.trim().split(/\s+/) : [];
  const shownCount = typewriter
    ? Math.min(words.length, Math.max(0, Math.floor((frame - 18) / 4)))
    : words.length;
  const shown = words.slice(0, shownCount);

  return (
    <div style={{
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      gap: 18,
      flex: compact ? undefined : 1,
      justifyContent: compact ? 'flex-start' : 'center',
      minHeight: 0,
    }}
    >
      {promptBubble ? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
          opacity: bubbleIn,
          transform: `translateX(${interpolate(bubbleIn, [0, 1], [36, 0])}px)`,
        }}
        >
          <div style={{ fontSize: 16, fontWeight: 800, color: muted, letterSpacing: 2, marginBottom: 8 }}>YOU</div>
          <div style={{
            background: 'rgba(210,214,230,0.92)',
            borderRadius: 999,
            padding: '16px 26px',
            maxWidth: '88%',
          }}
          >
            <div style={{ fontSize: 30, lineHeight: 1.25, color: '#1A1C28', fontWeight: 650 }}>{promptBubble}</div>
          </div>
        </div>
      ) : null}
      <div style={{
        background: 'rgba(12,14,24,0.55)',
        border: `2px solid ${muted}55`,
        borderRadius: 28,
        padding: compact ? '22px 26px' : '26px 28px',
        minHeight: compact ? 108 : 148,
        opacity: boxIn,
        transform: `translateY(${interpolate(boxIn, [0, 1], [22, 0])}px)`,
      }}
      >
        <div style={{ fontSize: 18, fontWeight: 800, color: muted, marginBottom: 12, letterSpacing: 2 }}>WRITING...</div>
        <div style={{ fontSize: compact ? 40 : 42, lineHeight: 1.35, color: ink, fontWeight: 700 }}>
          {shown.map((w, i) => {
            const isHit = highlightWord && w.replace(/[.,!?]/g, '') === highlightWord.replace(/[.,!?]/g, '');
            return (
              <span
                key={`${w}-${i}`}
                style={{
                  color: isHit ? accent : ink,
                  marginRight: 10,
                }}
              >
                {w}
              </span>
            );
          })}
          {(typewriter || compact) && blink ? <span style={{ color: accent }}>|</span> : null}
        </div>
      </div>
    </div>
  );
};

const TokenChips: React.FC<{ tokens: string[]; accent: string; bar: string; line?: string; muted: string }> = ({
  tokens, accent, bar, line, muted,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scan = Math.min(tokens.length - 1, Math.max(0, Math.floor((frame - 8) / 4)));
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
        {tokens.slice(0, 28).map((tok, i) => {
          const p = springIn(frame, fps, 4 + i * 2, 16);
          const current = i === scan;
          const lit = i <= scan;
          return (
            <div
              key={`${tok}-${i}`}
              style={{
                opacity: interpolate(p, [0, 1], [0.2, lit ? 1 : 0.4]),
                transform: `scale(${current ? 1.1 : 1})`,
                padding: '12px 16px',
                borderRadius: 12,
                fontSize: 30,
                fontWeight: 750,
                background: current ? `${accent}40` : lit ? `${bar}30` : 'rgba(255,255,255,0.04)',
                border: `2px solid ${current ? accent : 'transparent'}`,
                color: current ? accent : '#E8EAFF',
              }}
            >
              {tok}
            </div>
          );
        })}
      </div>
      {line ? (
        <p style={{ textAlign: 'center', margin: '24px 0 0', fontSize: 26, color: muted, fontWeight: 600 }}>{line}</p>
      ) : null}
    </div>
  );
};

const OddsBars: React.FC<{
  candidates: { word: string; pct: number }[];
  bar: string;
  accent: string;
  muted: string;
  ink: string;
  context?: string;
}> = ({ candidates, bar, accent, muted, ink, context }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const max = Math.max(...candidates.map((c) => c.pct), 1);
  const slot = springIn(frame, fps, 6, 12);
  return (
    <div style={{
      width: '100%', flex: 1, minHeight: 0,
      display: 'flex', flexDirection: 'column', gap: 20, justifyContent: 'center',
    }}
    >
      <div style={{
        border: `2px solid ${muted}55`, borderRadius: 24, padding: '22px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
        fontSize: 38, fontWeight: 800, color: ink,
        opacity: slot, transform: `scale(${interpolate(slot, [0, 1], [0.94, 1])})`,
      }}
      >
        <span>{context || 'Peanut butter and'}</span>
        <span style={{
          width: 58, height: 58, border: `3px dashed ${accent}`, borderRadius: 12,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: accent, fontSize: 36,
        }}
        >
          ?
        </span>
      </div>
      {candidates.slice(0, 6).map((c, i) => {
        const delay = 14 + i * 7;
        const p = springIn(frame, fps, delay, 14);
        const w = interpolate(p, [0, 1], [0, (c.pct / max) * 100], { extrapolateRight: 'clamp' });
        const shown = Math.round(interpolate(p, [0, 1], [0, c.pct], { extrapolateRight: 'clamp' }));
        return (
          <div key={c.word} style={{
            display: 'grid', gridTemplateColumns: '150px 1fr 90px', alignItems: 'center', gap: 12,
            opacity: p, transform: `translateX(${interpolate(p, [0, 1], [20, 0])}px)`,
          }}
          >
            <span style={{ fontSize: 32, fontWeight: 800, color: ink, textAlign: 'right' }}>{c.word}</span>
            <div style={{ height: 34, background: 'rgba(255,255,255,0.08)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${w}%`, borderRadius: 999,
                background: i === 0 ? `linear-gradient(90deg, ${bar}, ${accent})` : bar,
              }}
              />
            </div>
            <span style={{ fontSize: 28, fontWeight: 800, color: muted, fontVariantNumeric: 'tabular-nums' }}>{shown}%</span>
          </div>
        );
      })}
    </div>
  );
};

const SpinWheel: React.FC<{
  candidates: { word: string; pct: number }[];
  winner?: string;
  accent: string;
  ink: string;
  muted: string;
  line?: string;
  paintWinner?: boolean;
  size?: number;
}> = ({ candidates, winner, accent, muted, line, paintWinner, size = 640 }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const total = candidates.reduce((a, c) => a + c.pct, 0) || 1;
  let acc = 0;
  const slices = candidates.map((c, i) => {
    const start = acc;
    acc += (c.pct / total) * 360;
    const isWin = winner && c.word === winner;
    return {
      ...c, start, sweep: (c.pct / total) * 360,
      color: paintWinner && isWin ? accent : BLUES[i % BLUES.length],
    };
  });
  const winIdx = winner ? Math.max(0, candidates.findIndex((c) => c.word === winner)) : 0;
  const winSlice = slices[winIdx] || slices[0];
  const landAngle = 270 - (winSlice.start + winSlice.sweep / 2);
  const spinProgress = interpolate(frame, [3, durationInFrames * 0.8], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic),
  });
  const rotation = interpolate(spinProgress, [0, 1], [0, 1320 + landAngle]);
  const cx = size / 2;
  const r = size / 2 - 6;

  return (
    <div style={{
      flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 16,
    }}
    >
      <div style={{ position: 'relative', width: size, height: size, maxWidth: '100%' }}>
        <div style={{
          position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)',
          width: 0, height: 0,
          borderLeft: '22px solid transparent',
          borderRight: '22px solid transparent',
          borderTop: `44px solid ${accent}`,
          zIndex: 4,
          filter: `drop-shadow(0 4px 10px ${accent}99)`,
        }}
        />
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{
          transform: `rotate(${rotation}deg)`,
          filter: 'drop-shadow(0 8px 28px rgba(0,0,0,0.45))',
        }}
        >
          {slices.map((s) => {
            const a0 = ((s.start - 90) * Math.PI) / 180;
            const a1 = ((s.start + s.sweep - 90) * Math.PI) / 180;
            const x0 = cx + r * Math.cos(a0);
            const y0 = cx + r * Math.sin(a0);
            const x1 = cx + r * Math.cos(a1);
            const y1 = cx + r * Math.sin(a1);
            const large = s.sweep > 180 ? 1 : 0;
            const mid = ((s.start + s.sweep / 2 - 90) * Math.PI) / 180;
            const lx = cx + r * 0.55 * Math.cos(mid);
            const ly = cx + r * 0.55 * Math.sin(mid);
            return (
              <g key={s.word}>
                <path
                  d={`M ${cx} ${cx} L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} Z`}
                  fill={s.color} stroke="#0E1018" strokeWidth="4"
                />
                {s.sweep > 14 ? (
                  <text
                    x={lx} y={ly} textAnchor="middle" dominantBaseline="middle"
                    fill={s.color === accent ? '#12141C' : '#fff'}
                    fontSize={s.sweep > 80 ? 42 : s.sweep > 28 ? 26 : 18}
                    fontWeight={800}
                    transform={`rotate(${s.start + s.sweep / 2} ${lx} ${ly})`}
                  >
                    {s.word}
                  </text>
                ) : null}
              </g>
            );
          })}
          <circle cx={cx} cy={cx} r={Math.max(28, r * 0.09)} fill="#12141C" stroke="#fff" strokeWidth="5" />
        </svg>
      </div>
      {line ? (
        <p style={{ margin: 0, textAlign: 'center', fontSize: 26, color: muted, fontWeight: 600, maxWidth: '96%', lineHeight: 1.35 }}>
          {line}
        </p>
      ) : null}
    </div>
  );
};

const LoopDiagram: React.FC<{ accent: string; bar: string }> = ({ accent, bar }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const nodes = [
    { x: 260, y: 68, label: 'READ' },
    { x: 432, y: 210, label: 'ODDS' },
    { x: 260, y: 352, label: 'SPIN' },
    { x: 88, y: 210, label: 'ADD' },
  ];
  const circ = interpolate(frame, [26, 52], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const r = 148;
  const dashLen = 2 * Math.PI * r;
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width="100%" height="500" viewBox="0 0 520 420">
        <circle cx="260" cy="210" r={r} fill="none" stroke={bar} strokeWidth="4"
          strokeDasharray={`${dashLen}`} strokeDashoffset={dashLen * circ} />
        {nodes.map((n, i) => {
          const p = springIn(frame, fps, 4 + i * 8, 12);
          return (
            <g key={n.label} opacity={p}>
              <rect
                x={n.x - 58} y={n.y - 32} width="116" height="64" rx="16"
                fill="#12141C" stroke={accent} strokeWidth="3"
                transform={`translate(${n.x} ${n.y}) scale(${0.84 + 0.16 * p}) translate(${-n.x} ${-n.y})`}
              />
              <text x={n.x} y={n.y + 8} textAnchor="middle" fill="#fff" fontSize="24" fontWeight="800">{n.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

const SceneBody: React.FC<{ scene: NextWordScene; props: NextWordProps }> = ({ scene, props }) => {
  const { accent, muted, ink, bar: barColor = '#8E94F2' } = props;
  const frame = useCurrentFrame();
  const reservePills = scene.kind !== 'hook' && scene.kind !== 'type';
  const contextWords = scene.writingText?.trim() || 'Peanut butter and';

  return (
    <div style={{
      position: 'absolute',
      top: SAFE.top + (reservePills ? PILL_H : 0),
      left: SAFE.left,
      right: SAFE.right,
      bottom: SAFE.bottom,
      display: 'flex',
      flexDirection: 'column',
      transform: `scale(${interpolate(frame, [0, 10], [1.04, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ENTER })})`,
      transformOrigin: '50% 42%',
    }}
    >
      {scene.headline ? (
        <SceneHeadline text={scene.headline} accent={accent} ink={ink} hook={scene.kind === 'hook'} />
      ) : null}

      {scene.kind === 'hook' ? (
        <ChatPanel
          promptBubble={scene.promptBubble}
          writingText={scene.writingText || ''}
          accent={accent} muted={muted} ink={ink}
          compact
        />
      ) : null}

      {scene.kind === 'type' ? (
        <ChatPanel
          writingText={scene.writingText || ''}
          accent={accent} muted={muted} ink={ink}
          typewriter
          compact
        />
      ) : null}

      {scene.kind === 'read' && scene.tokens?.length ? (
        <TokenChips tokens={scene.tokens} accent={accent} bar={barColor} line={scene.line} muted={muted} />
      ) : null}

      {scene.kind === 'odds' && scene.candidates?.length ? (
        <OddsBars
          candidates={scene.candidates} bar={barColor} accent={accent} muted={muted} ink={ink}
          context={contextWords}
        />
      ) : null}

      {scene.kind === 'spin' && scene.candidates?.length ? (
        <SpinWheel
          candidates={scene.candidates} winner={scene.winner}
          accent={accent} ink={ink} muted={muted} line={scene.line}
        />
      ) : null}

      {scene.kind === 'add' ? (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <ChatPanel
            writingText={scene.writingText || ''}
            accent={accent} muted={muted} ink={ink}
            highlightWord={scene.winner}
            compact
          />
          {scene.candidates?.length ? (
            <SpinWheel
              candidates={scene.candidates} winner={scene.winner}
              accent={accent} ink={ink} muted={muted}
              paintWinner size={520}
            />
          ) : null}
        </div>
      ) : null}

      {scene.kind === 'loop' ? (
        <>
          <LoopDiagram accent={accent} bar={barColor} />
          {scene.line ? (
            <p style={{ textAlign: 'center', margin: 0, fontSize: 30, color: ink, fontWeight: 700, flexShrink: 0 }}>
              {scene.line}
            </p>
          ) : null}
        </>
      ) : null}

      <VoCaption text={scene.vo} accent={accent} />
    </div>
  );
};

export const NextWordLoop: React.FC<NextWordProps> = (props) => {
  const { fps } = useVideoConfig();
  return (
    <Stage canvas={props.canvas}>
      {!props.scenes.some((s) => s.narrationFile) && props.narrationFile ? (
        <Audio src={staticFile(props.narrationFile)} />
      ) : null}
      <PersistentPills props={props} />
      <Series>
        {props.scenes.map((scene, i) => {
          const dur = Math.max(1, Math.round(scene.durationSec * fps));
          return (
            <Series.Sequence key={`${scene.kind}-${i}`} durationInFrames={dur}>
              {scene.narrationFile ? <Audio src={staticFile(scene.narrationFile)} /> : null}
              <SceneBody scene={scene} props={props} />
            </Series.Sequence>
          );
        })}
      </Series>
    </Stage>
  );
};
