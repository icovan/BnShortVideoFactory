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
} from 'remotion';
import { loadFont } from '@remotion/google-fonts/Inter';
import type { CaptionCue, NarratedProps, NarratedScene } from './narratedSchema';
import { SceneMotion } from './SceneMotion';
import {
  CaptionChip,
  ChatPane,
  CountUp,
  DeckThumb,
  ENTER,
  FakeCursor,
  KineticLines,
  KineticWords,
  LogoMark,
  SlideCard,
} from './ui';

const { fontFamily: FONT } = loadFont('normal', {
  weights: ['400', '500', '600', '700', '800'],
  subsets: ['latin'],
});

const DotGrid: React.FC<{ accent: string; opacity?: number }> = ({ accent, opacity = 0.4 }) => (
  <div style={{
    position: 'absolute', inset: 0, opacity,
    backgroundImage: `radial-gradient(${accent}38 1.2px, transparent 1.2px)`,
    backgroundSize: '26px 26px',
  }} />
);

const IndigoWipe: React.FC<{ accent: string }> = ({ accent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = interpolate(frame, [0, Math.round(fps * 0.28)], [0, 1], {
    extrapolateRight: 'clamp', easing: ENTER,
  });
  if (p >= 1) return null;
  return (
    <div style={{
      position: 'absolute', inset: '-20%', zIndex: 40, pointerEvents: 'none',
      background: `linear-gradient(115deg, transparent 0%, ${accent} 46%, ${accent} 54%, transparent 100%)`,
      transform: `translateX(${interpolate(p, [0, 1], [-120, 120])}%) skewX(-12deg)`,
      opacity: interpolate(p, [0, 0.2, 0.8, 1], [0, 0.75, 0.75, 0]),
    }} />
  );
};

const Captions: React.FC<{ cues: CaptionCue[] }> = ({ cues }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const cue = cues.find((c) => t >= c.from && t <= c.to);
  if (!cue) return null;
  return (
    <div style={{
      position: 'absolute', left: '10%', right: '10%', bottom: 44, zIndex: 30,
      display: 'flex', justifyContent: 'center',
    }}>
      <CaptionChip text={cue.text} />
    </div>
  );
};

const BrandBeat: React.FC<{ scene: NarratedScene; brand: string; brandBg: string; ink?: string; accent?: string }> = ({
  scene, brand, brandBg, ink = '#1A1540', accent = '#5B4CDB',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const nameIn = spring({ frame, fps, config: { damping: 13 } });
  const line2 = scene.accentWord && !/finished/i.test(scene.accentWord)
    ? scene.accentWord
    : '一句话搭好整套片子。';
  const recipe = scene.recipeId || 'deck_thumbs';
  // presentation recipe: hero_slide — single finished deck card on brand purple
  if (recipe === 'hero_slide') {
    return (
      <AbsoluteFill style={{
        background: `radial-gradient(circle at 50% 42%, #7B6CF0 0%, ${brandBg} 52%, #2F2480 100%)`,
        fontFamily: FONT, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', padding: 72,
      }}>
        <div style={{
          position: 'absolute', top: 40, left: 72, color: '#fff', fontWeight: 800, fontSize: 28, opacity: nameIn,
        }}>✦ {scene.brandName || brand}</div>
        <div style={{
          width: '100%', maxWidth: 1100, opacity: nameIn,
          transform: `scale(${interpolate(nameIn, [0, 1], [0.92, 1])})`,
        }}>
          <SlideCard
            title={scene.slideTitle || scene.title || '给你一个主题'}
            accentWord={scene.slideAccent || line2}
            bullets={scene.slideBullets}
            ink={ink}
            accent={accent}
            showPie
          />
        </div>
      </AbsoluteFill>
    );
  }
  const tones = ['#3F6B4B', '#5B4CDB', '#2F6B5A', '#E8A45A'];
  const kinds = ['cover', 'bullets', 'chart', 'customers'] as const;
  const thumbSrc = (scene.thumbs?.length ? scene.thumbs : []).slice(0, 4);
  const corners = thumbSrc.map((th, i) => ({
    ...th,
    kind: (th.kind as typeof kinds[number]) || kinds[i],
    tone: th.tone || tones[i],
    x: ['-3%', '73%', '-2%', '72%'][i],
    y: ['4%', '2%', '56%', '54%'][i],
    r: [-9, 8, 6, -7][i],
    d: [4, 7, 10, 13][i],
  })).filter((c) => c.title);
  return (
    <AbsoluteFill style={{
      background: `radial-gradient(circle at 50% 42%, #7B6CF0 0%, ${brandBg} 52%, #2F2480 100%)`,
      fontFamily: FONT, justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: 48, display: 'flex', alignItems: 'center', gap: 12,
        color: '#fff', fontSize: 28, fontWeight: 700, opacity: nameIn,
      }}>
        <span style={{
          width: 36, height: 36, borderRadius: 10, border: '2px solid #fff',
          display: 'grid', placeItems: 'center', fontSize: 18,
        }}>✦</span>
        {scene.brandName || brand}
      </div>
      {corners.map((c) => (
        <div key={`${c.kind}-${c.title}`} style={{ position: 'absolute', left: c.x, top: c.y, zIndex: 1 }}>
          <DeckThumb
            title={c.title || 'Slide'}
            sub={c.sub || ''}
            tone={c.tone}
            kind={c.kind}
            bullets={c.bullets}
            rotate={c.r}
            delay={c.d}
            width={360}
          />
        </div>
      ))}
      <div style={{ zIndex: 3, maxWidth: 1200, opacity: nameIn }}>
        <KineticLines lines={[
          { text: '给你一个主题。', size: 96, color: '#fff' },
          { text: line2, size: 72, color: '#fff', weight: 800 },
        ]} gap={10} />
      </div>
    </AbsoluteFill>
  );
};

const Problem: React.FC<{ scene: NarratedScene; ink: string; accent: string; canvas: string }> = ({
  scene, ink, accent, canvas,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // Content visible from frame 0 — no empty DotGrid still
  const slide = spring({ frame: Math.max(0, frame - Math.floor(fps * 0.55)), fps, config: { damping: 14 } });
  const sticker = spring({ frame: Math.max(0, frame - Math.floor(fps * 1.35)), fps, config: { damping: 12 } });
  const typeOut = interpolate(frame, [fps * 0.45, fps * 0.85], [1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const blink = Math.floor(frame / 10) % 2 === 0;
  const hook = scene.title || '明天就要路演。';
  return (
    <AbsoluteFill style={{ background: canvas, fontFamily: FONT, justifyContent: 'center', alignItems: 'center' }}>
      <DotGrid accent={accent} />
      <div style={{ position: 'absolute', zIndex: 2, opacity: Math.max(0.2, typeOut) }}>
        {scene.technique === 'kinetic' ? (
          <KineticWords
            text={hook}
            size={96}
            color={ink}
            accentColor={accent}
            accentWord={hook.split(/\s+/).slice(-1)[0]}
          />
        ) : (
          <KineticLines lines={[
            { text: '想法很多，', size: 42, color: '#8B84A3', weight: 600 },
            { text: hook, size: 88, color: ink },
            { text: '空白页还在。', size: 100, color: accent },
          ]} gap={6} />
        )}
      </div>
      <div style={{
        width: 1280, height: 640, borderRadius: 22, background: '#fff',
        boxShadow: '0 40px 100px rgba(26,21,64,0.14)',
        opacity: slide, transform: `scale(${interpolate(slide, [0, 1], [0.94, 1])}) rotate(${interpolate(slide, [0, 1], [3, 0])}deg)`,
        overflow: 'hidden',
      }}>
        <div style={{ height: 48, borderBottom: '1px solid #EEEAF8', display: 'flex', alignItems: 'center', gap: 8, padding: '0 18px' }}>
          <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#FF5F57' }} />
          <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#FEBC2E' }} />
          <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#28C840' }} />
          <span style={{ flex: 1, textAlign: 'center', color: '#9A94B0', fontSize: 15 }}>未命名演示文稿</span>
        </div>
        <div style={{
          margin: 48, height: 420, border: '2px dashed #D8D2E8', borderRadius: 16,
          display: 'grid', placeItems: 'center', color: '#B0A9C4', fontSize: 36, fontWeight: 500,
        }}>
          点击添加标题{blink ? '|' : ' '}
        </div>
      </div>
      <div style={{
        position: 'absolute', padding: '20px 36px', borderRadius: 18, background: accent, color: '#fff',
        fontSize: 48, fontWeight: 800, letterSpacing: '-0.03em',
        boxShadow: `0 28px 60px ${accent}55`,
        opacity: sticker, transform: `rotate(-6deg) scale(${interpolate(sticker, [0, 1], [0.7, 1])})`,
        zIndex: 5,
      }}>{scene.accentWord || '是不是很熟悉？'}</div>
    </AbsoluteFill>
  );
};

const SolutionInput: React.FC<{ scene: NarratedScene; ink: string; accent: string; canvas: string }> = ({
  scene, ink, accent, canvas,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 16 } });
  const typed = scene.promptText || scene.title || '输入你的主题';
  const show = typed.slice(0, Math.floor(interpolate(frame, [8, fps * 2], [0, typed.length], { extrapolateRight: 'clamp' })));
  const cursorOn = Math.floor(frame / 8) % 2 === 0;
  const clickAt = Math.floor(fps * 2.3);
  const pdfLabel = scene.cards?.[0]?.title?.slice(0, 28) || 'brief.pdf';
  return (
    <AbsoluteFill style={{
      background: canvas, fontFamily: FONT, padding: '64px 90px 72px',
      display: 'flex', flexDirection: 'column',
    }}>
      <DotGrid accent={accent} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 22, marginBottom: 36, opacity: enter }}>
        <div style={{
          width: 96, height: 96, borderRadius: '50%', background: accent, color: '#fff',
          display: 'grid', placeItems: 'center', fontSize: 52, fontWeight: 800,
          boxShadow: `0 18px 40px ${accent}44`, flexShrink: 0,
        }}>{scene.step ?? 1}</div>
        <div>
          <div style={{ fontSize: 64, fontWeight: 800, color: ink, letterSpacing: '-0.04em', lineHeight: 1.05 }}>
            {scene.title || '输入一个主题'}
          </div>
          <div style={{ fontSize: 28, fontWeight: 600, color: accent, marginTop: 8 }}>
            {scene.subtitle || '……或直接粘贴已有文档'}
          </div>
        </div>
      </div>
      <div style={{
        flex: 1, background: '#fff', borderRadius: 28, padding: '40px 44px',
        border: `2.5px solid ${accent}`, boxShadow: `0 32px 80px ${accent}22`,
        opacity: enter, transform: `translateY(${interpolate(enter, [0, 1], [20, 0])}px)`,
        display: 'flex', flexDirection: 'column', minHeight: 420, position: 'relative',
      }}>
        <div style={{ color: '#9A94B0', fontSize: 20, marginBottom: 18 }}>你想讲什么？</div>
        <div style={{ color: ink, fontSize: 40, fontWeight: 700, lineHeight: 1.25, flex: 1 }}>
          {show}<span style={{ opacity: cursorOn ? 1 : 0, color: accent }}>|</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 28 }}>
          <div style={{
            display: 'inline-flex', gap: 10, alignItems: 'center', padding: '12px 18px', borderRadius: 999,
            background: `${accent}14`, fontSize: 18, fontWeight: 600, color: ink,
            opacity: interpolate(frame, [fps * 1.5, fps * 1.9], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
          }}>
            <span style={{
              width: 28, height: 28, borderRadius: 6, background: '#FFE4E4', color: '#D94A4A',
              display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 800,
            }}>PDF</span>
            {pdfLabel}
          </div>
          <div style={{
            padding: '18px 36px', borderRadius: 999, background: `linear-gradient(90deg, ${accent}, #7B6CF0)`,
            color: '#fff', fontWeight: 700, fontSize: 24, boxShadow: `0 16px 36px ${accent}44`,
            transform: `scale(${frame > clickAt && frame < clickAt + 10 ? 0.96 : 1})`,
          }}>+ 生成</div>
        </div>
        <FakeCursor
          x={interpolate(frame, [fps * 1.8, fps * 2.3], [980, 1180], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}
          y={interpolate(frame, [fps * 1.8, fps * 2.3], [280, 340], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}
          clickAt={clickAt}
        />
      </div>
    </AbsoluteFill>
  );
};

const HowResearch: React.FC<{ scene: NarratedScene; ink: string; accent: string; canvas: string }> = ({
  scene, ink, accent, canvas,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const recipe = (scene.recipeId === 'nodes' || scene.recipeId === 'cascade' || scene.recipeId === 'flow')
    ? scene.recipeId
    : 'flow';
  const sources = scene.cards?.length
    ? scene.cards.map((c) => ({ t: c.title, s: c.subtitle || '来源' }))
    : [
      { t: '行业报告', s: '网页来源' },
      { t: '用户访谈纪要', s: '网页来源' },
      { t: 'brief.pdf', s: '你的文档' },
    ];
  const outline = (scene.outlineLines?.length
    ? scene.outlineLines
    : scene.slideBullets?.length
      ? scene.slideBullets
      : ['问题与机会', '方案一句话', '关键证明点', '下一步行动']
  ).slice(0, 5);
  const header = (
    <div style={{ display: 'flex', gap: 22, alignItems: 'center', marginBottom: 22 }}>
      <div style={{
        width: 92, height: 92, borderRadius: '50%', background: accent, color: '#fff',
        display: 'grid', placeItems: 'center', fontSize: 52, fontWeight: 800,
      }}>{scene.step ?? 2}</div>
      <div style={{ fontSize: 48, fontWeight: 800, color: ink, letterSpacing: '-0.035em' }}>
        {scene.title || '检索、撰写，搭出大纲'}
        <span style={{
          marginLeft: 14, fontSize: 16, fontWeight: 700, color: accent,
          padding: '4px 10px', borderRadius: 999, background: `${accent}14`, verticalAlign: 'middle',
        }}>{recipe}</span>
      </div>
    </div>
  );

  // nodes: hub + satellite cards, edges draw after nodes
  if (recipe === 'nodes') {
    const hubOn = spring({ frame: Math.max(0, frame - 4), fps, config: { damping: 14 } });
    const positions = [
      { x: '8%', y: '28%' }, { x: '72%', y: '22%' }, { x: '12%', y: '68%' }, { x: '70%', y: '66%' },
    ];
    return (
      <AbsoluteFill style={{
        background: canvas, fontFamily: FONT, padding: '48px 64px', boxSizing: 'border-box',
      }}>
        <DotGrid accent={accent} opacity={0.28} />
        {header}
        <div style={{ position: 'relative', flex: 1, minHeight: 520 }}>
          <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }} viewBox="0 0 1600 700">
            {sources.slice(0, 4).map((_, i) => {
              const edge = interpolate(frame, [fps * 0.9 + i * 4, fps * 1.4 + i * 4], [0, 1], {
                extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
              });
              const ends = [[220, 220], [1280, 180], [260, 520], [1260, 500]][i];
              return (
                <line
                  key={i}
                  x1={800} y1={340} x2={ends[0]} y2={ends[1]}
                  stroke={accent} strokeWidth={3} strokeDasharray="10 8"
                  strokeDashoffset={40 * (1 - edge)} opacity={0.45 + edge * 0.4}
                />
              );
            })}
          </svg>
          <div style={{
            position: 'absolute', left: '50%', top: '42%', transform: `translate(-50%, -50%) scale(${hubOn})`,
            width: 220, height: 220, borderRadius: '50%', background: accent, color: '#fff',
            display: 'grid', placeItems: 'center', textAlign: 'center', fontWeight: 800, fontSize: 28,
            boxShadow: `0 24px 60px ${accent}55`, zIndex: 2,
          }}>大纲枢纽</div>
          {sources.slice(0, 4).map((src, i) => {
            const pop = spring({
              frame: Math.max(0, frame - Math.floor(fps * 0.2) - i * 6),
              fps, config: { damping: 12, stiffness: 120 },
            });
            const pos = positions[i];
            return (
              <div key={src.t} style={{
                position: 'absolute', left: pos.x, top: pos.y, width: 280,
                background: '#fff', borderRadius: 16, padding: '16px 18px',
                boxShadow: '0 14px 36px rgba(26,21,64,0.1)',
                opacity: pop, transform: `scale(${interpolate(pop, [0, 1], [0.85, 1])})`, zIndex: 3,
              }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: ink }}>{src.t}</div>
                <div style={{ fontSize: 13, color: '#8B84A3', marginTop: 4 }}>{src.s}</div>
              </div>
            );
          })}
          <div style={{
            position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
            display: 'flex', gap: 10, opacity: interpolate(frame, [fps * 1.6, fps * 2], [0, 1], {
              extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
            }),
          }}>
            {outline.slice(0, 4).map((line, i) => (
              <div key={line} style={{
                padding: '10px 14px', borderRadius: 12, background: '#fff',
                border: `1.5px solid ${accent}44`, fontWeight: 700, fontSize: 15, color: ink,
              }}>{i + 1}. {line.slice(0, 14)}</div>
            ))}
          </div>
        </div>
      </AbsoluteFill>
    );
  }

  // cascade: sources stack → morph into numbered outline
  if (recipe === 'cascade') {
    const morph = interpolate(frame, [fps * 1.4, fps * 2.2], [0, 1], {
      extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    });
    return (
      <AbsoluteFill style={{
        background: canvas, fontFamily: FONT, padding: '48px 80px', boxSizing: 'border-box',
      }}>
        <DotGrid accent={accent} opacity={0.28} />
        {header}
        <div style={{ position: 'relative', height: 560 }}>
          {sources.slice(0, 3).map((src, i) => {
            const pop = spring({
              frame: Math.max(0, frame - i * 8), fps, config: { damping: 13 },
            });
            const y0 = 40 + i * 28;
            const y1 = 80 + i * 110;
            const y = interpolate(morph, [0, 1], [y0, y1]);
            const x = interpolate(morph, [0, 1], [120 + i * 40, 80]);
            const rot = interpolate(morph, [0, 1], [-4 + i * 3, 0]);
            return (
              <div key={src.t} style={{
                position: 'absolute', left: x, top: y, width: 420,
                background: '#fff', borderRadius: 16, padding: '18px 22px',
                boxShadow: '0 18px 40px rgba(26,21,64,0.1)',
                opacity: pop * (1 - morph * 0.15),
                transform: `rotate(${rot}deg) scale(${interpolate(pop, [0, 1], [0.9, 1])})`,
                zIndex: 3 - i,
              }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: ink }}>{src.t}</div>
                <div style={{ fontSize: 13, color: '#8B84A3' }}>{src.s}</div>
              </div>
            );
          })}
          <div style={{
            position: 'absolute', right: 40, top: 40, width: 560,
            opacity: morph, transform: `translateX(${interpolate(morph, [0, 1], [40, 0])}px)`,
          }}>
            {outline.map((line, i) => {
              const on = spring({
                frame: Math.max(0, frame - Math.floor(fps * 1.5) - i * 7),
                fps, config: { damping: 12 },
              });
              return (
                <div key={line} style={{
                  display: 'flex', gap: 14, alignItems: 'center', marginBottom: 18,
                  opacity: on, transform: `translateY(${interpolate(on, [0, 1], [16, 0])}px)`,
                }}>
                  <span style={{
                    width: 36, height: 36, borderRadius: 10, background: accent, color: '#fff',
                    display: 'grid', placeItems: 'center', fontWeight: 800,
                  }}>{i + 1}</span>
                  <span style={{ fontSize: 28, fontWeight: 700, color: ink }}>{line}</span>
                </div>
              );
            })}
          </div>
        </div>
      </AbsoluteFill>
    );
  }

  // flow (default): sources → edges → typed outline
  const typedChars = Math.floor(interpolate(frame, [fps * 0.8, fps * 3.2], [0, outline.join('').length + 8], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  }));
  let remain = typedChars;
  const visibleLines = outline.map((line) => {
    if (remain <= 0) return '';
    const take = Math.min(line.length, remain);
    remain -= take;
    return line.slice(0, take);
  });
  return (
    <AbsoluteFill style={{
      background: canvas, fontFamily: FONT, padding: '48px 64px', boxSizing: 'border-box',
      display: 'flex', flexDirection: 'column',
    }}>
      <DotGrid accent={accent} opacity={0.28} />
      {header}
      <div style={{ display: 'flex', gap: 0, flex: 1, minHeight: 0, alignItems: 'stretch' }}>
        <div style={{ width: 380, display: 'flex', flexDirection: 'column', gap: 12, zIndex: 2 }}>
          {sources.slice(0, 3).map((src, i) => {
            const on = frame > fps * 0.15 + i * 7;
            const pop = spring({
              frame: Math.max(0, frame - Math.floor(fps * 0.15) - i * 7),
              fps,
              config: { damping: 12, stiffness: 120 },
            });
            return (
              <div key={src.t} style={{
                background: '#fff', borderRadius: 16, padding: '16px 18px',
                boxShadow: '0 14px 36px rgba(26,21,64,0.08)',
                opacity: on ? 1 : 0.25,
                transform: `translateY(${interpolate(pop, [0, 1], [18, 0])}px) scale(${interpolate(pop, [0, 1], [0.92, 1])})`,
                display: 'flex', gap: 12, alignItems: 'center',
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10, background: `${accent}18`,
                  display: 'grid', placeItems: 'center', color: accent, fontWeight: 800, fontSize: 14,
                  boxShadow: on ? `0 0 0 3px ${accent}33` : 'none',
                }}>{src.s.includes('文档') || src.s.includes('pdf') || /\.pdf/i.test(src.t) ? 'PDF' : 'Web'}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 17, fontWeight: 800, color: ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{src.t}</div>
                  <div style={{ fontSize: 12, color: '#8B84A3' }}>{src.s}</div>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{
          width: 120, position: 'relative', flexShrink: 0,
          opacity: interpolate(frame, [fps * 0.4, fps * 0.9], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
        }}>
          <svg width="120" height="100%" viewBox="0 0 120 520" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0 }}>
            {[90, 200, 320].map((y, i) => (
              <path
                key={y}
                d={`M8 ${y} C 40 ${y}, 55 ${260}, 112 ${260}`}
                fill="none"
                stroke={accent}
                strokeWidth="2.5"
                strokeDasharray="8 8"
                strokeDashoffset={-(frame * 1.2 + i * 10)}
                opacity={0.55}
              />
            ))}
          </svg>
        </div>
        <div style={{
          flex: 1, background: '#fff', borderRadius: 22, padding: '28px 32px',
          border: `1.5px solid ${accent}33`,
          boxShadow: '0 20px 50px rgba(26,21,64,0.1)',
          minWidth: 0,
        }}>
          <div style={{ color: accent, fontWeight: 700, fontSize: 18, marginBottom: 18 }}>
            ✦ 正在写出大纲…
          </div>
          {outline.map((full, i) => {
            const text = visibleLines[i] || '';
            const show = text.length > 0 || frame > fps * 0.9 + i * 6;
            return (
              <div key={full} style={{
                display: 'flex', gap: 14, alignItems: 'baseline', marginBottom: 16,
                opacity: show ? 1 : 0.2,
              }}>
                <span style={{
                  width: 28, height: 28, borderRadius: 8, background: text ? accent : '#E8E4F2',
                  color: '#fff', display: 'grid', placeItems: 'center', fontSize: 14, fontWeight: 800, flexShrink: 0,
                }}>{i + 1}</span>
                <span style={{ fontSize: 26, fontWeight: 700, color: ink, letterSpacing: '-0.02em' }}>
                  {text || full}
                  {i === visibleLines.findIndex((l, idx) => idx >= i && (visibleLines[idx]?.length || 0) < outline[idx].length)
                    && text.length > 0 && text.length < full.length
                    ? <span style={{ color: accent }}>|</span> : null}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const HowDesign: React.FC<{ scene: NarratedScene; ink: string; accent: string; canvas: string }> = ({
  scene, ink, accent, canvas,
}) => {
  const { fps } = useVideoConfig();
  const recipe = scene.recipeId || (scene.technique === 'chart_slide' ? 'hero_slide' : 'split_chat');
  const titleBlock = (
    <div style={{ display: 'flex', gap: 22, alignItems: 'center', marginBottom: 28 }}>
      <div style={{
        width: 100, height: 100, borderRadius: '50%', background: accent, color: '#fff',
        display: 'grid', placeItems: 'center', fontSize: 56, fontWeight: 800,
      }}>{scene.step ?? 3}</div>
      <div style={{ fontSize: 52, fontWeight: 800, color: ink, letterSpacing: '-0.035em' }}>
        {scene.title ? (
          <>{scene.title.replace(/\.$/, '')}<span style={{ color: accent }}>.</span></>
        ) : (
          <>设计幻灯片<span style={{ color: accent }}>.</span></>
        )}
      </div>
    </div>
  );
  // hero_slide: full-bleed slide only
  if (recipe === 'hero_slide') {
    return (
      <AbsoluteFill style={{ background: canvas, fontFamily: FONT, padding: '56px 96px', boxSizing: 'border-box' }}>
        <DotGrid accent={accent} opacity={0.28} />
        {titleBlock}
        <div style={{ height: 560 }}>
          <SlideCard
            title={scene.slideTitle || '市场在变'}
            accentWord={scene.slideAccent || '关键一击'}
            bullets={scene.slideBullets?.length ? scene.slideBullets : undefined}
            ink={ink}
            accent={accent}
            showPie
            delay={Math.floor(fps * 0.35)}
          />
        </div>
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill style={{ background: canvas, fontFamily: FONT, padding: '56px 72px', boxSizing: 'border-box' }}>
      <DotGrid accent={accent} opacity={0.28} />
      {titleBlock}
      <div style={{ display: 'flex', gap: 28, height: 560 }}>
        <ChatPane
          accent={accent}
          ink={ink}
          userText={scene.chatUser}
          replyText={scene.chatReply}
          delay={Math.floor(fps * 0.4)}
          width={360}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <SlideCard
            title={scene.slideTitle || '市场在变'}
            accentWord={scene.slideAccent || '关键一击'}
            bullets={scene.slideBullets?.length ? scene.slideBullets : undefined}
            ink={ink}
            accent={accent}
            showPie
            delay={Math.floor(fps * 0.5)}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};

const DesignsProof: React.FC<{ scene: NarratedScene; ink: string; accent: string; canvas: string }> = ({
  scene, ink, accent, canvas,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 14 } });
  const label = scene.proofLabel || '来自 120+ 个国家的创作者';
  return (
    <AbsoluteFill style={{ background: canvas, fontFamily: FONT, justifyContent: 'center', alignItems: 'center' }}>
      <DotGrid accent={accent} opacity={0.3} />
      <div style={{
        position: 'absolute', width: 780, height: 780, borderRadius: '50%',
        border: `2.5px dashed ${accent}44`, transform: `rotate(${frame * 0.35}deg)`,
      }}>
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * Math.PI * 2;
          return (
            <div key={i} style={{
              position: 'absolute', left: '50%', top: '50%', width: 72, height: 48, borderRadius: 10,
              background: '#fff', border: `1px solid ${accent}33`,
              transform: `translate(-50%, -50%) rotate(${(a * 180) / Math.PI}deg) translateY(-340px) rotate(${-(a * 180) / Math.PI}deg)`,
              boxShadow: '0 10px 24px rgba(26,21,64,0.1)', opacity: enter,
            }} />
          );
        })}
      </div>
      <div style={{ textAlign: 'center', zIndex: 2, opacity: enter }}>
        <CountUp to={120} color={accent} size={200} durationFrames={Math.floor(fps * 2.2)} />
        <div style={{ fontSize: 42, fontWeight: 700, color: ink, marginTop: 16, maxWidth: 900 }}>{label}</div>
      </div>
    </AbsoluteFill>
  );
};

const EndCard: React.FC<{ scene: NarratedScene; brand: string; ink: string; accent: string; canvas: string }> = ({
  scene, brand, ink, accent, canvas,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 14 } });
  const name = scene.brandName || brand;
  const ctaRaw = scene.cta as unknown;
  const cta = typeof ctaRaw === 'string'
    ? ctaRaw
    : ctaRaw && typeof ctaRaw === 'object'
      ? String((ctaRaw as { url?: string; text?: string }).url
        || (ctaRaw as { text?: string }).text || '')
      : '';
  const subFromCta = ctaRaw && typeof ctaRaw === 'object'
    ? String((ctaRaw as { subtext?: string }).subtext || '')
    : '';
  return (
    <AbsoluteFill style={{ background: canvas, fontFamily: FONT, justifyContent: 'center', alignItems: 'center' }}>
      <div style={{
        position: 'absolute', width: 900, height: 900, borderRadius: '50%',
        background: `radial-gradient(circle, ${accent}30 0%, transparent 65%)`,
      }} />
      <div style={{ zIndex: 2, opacity: enter }}>
        <LogoMark accent={accent} size={120} label={name} ink={ink} />
        {cta ? (
          <div style={{
            marginTop: 22, padding: '16px 36px', borderRadius: 999,
            background: `linear-gradient(90deg, ${accent}, #6E5FE8)`,
            color: '#fff', fontWeight: 700, fontSize: 28, textAlign: 'center',
            boxShadow: `0 16px 36px ${accent}44`,
          }}>{cta}</div>
        ) : null}
        <div style={{ marginTop: 20, color: '#6B6585', fontSize: 28, fontWeight: 600, textAlign: 'center' }}>
          {scene.subtitle || scene.accentWord || subFromCta || '用在你的下一套片子上。'}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const NarratedExplainer: React.FC<NarratedProps> = (props) => {
  const { fps } = useVideoConfig();
  const cues = props.captions?.length ? props.captions : (() => {
    let t = 0.2;
    return props.scenes.filter((s) => s.vo).map((s) => {
      const from = t;
      const to = t + Math.max(1, s.durationSec - 0.25);
      t += s.durationSec;
      return { from, to, text: s.vo || '' };
    });
  })();

  const renderScene = (scene: NarratedScene) => {
    const tech = scene.technique
      || (scene.stage === 'research' || scene.stage === 'how' ? 'diagram'
        : scene.stage === 'solution' ? 'product_demo'
          : scene.stage === 'design' ? 'chat_edit'
            : scene.stage === 'proof' ? 'stat'
              : scene.stage === 'end' ? 'cta'
                : scene.stage === 'problem' ? 'blank_deck'
                  : 'kinetic');
    const ink = props.ink;
    const accent = props.accent;
    const canvas = props.canvas;

    if (tech === 'diagram' || scene.stage === 'research' || scene.stage === 'how') {
      return <HowResearch scene={scene} ink={ink} accent={accent} canvas={canvas} />;
    }
    if (tech === 'product_demo' || scene.stage === 'solution') {
      return <SolutionInput scene={scene} ink={ink} accent={accent} canvas={canvas} />;
    }
    if (tech === 'chat_edit') {
      return <HowDesign scene={scene} ink={ink} accent={accent} canvas={canvas} />;
    }
    if (tech === 'chart_slide') {
      if (scene.stage === 'brand') {
        return (
          <AbsoluteFill style={{ background: canvas, fontFamily: FONT, padding: 72, boxSizing: 'border-box' }}>
            <DotGrid accent={accent} opacity={0.25} />
            <div style={{ position: 'absolute', top: 40, left: 72, color: ink, fontWeight: 800, fontSize: 28 }}>
              ✦ {scene.brandName || props.brandName}
            </div>
            <div style={{ height: '100%', paddingTop: 48 }}>
              <SlideCard
                title={scene.slideTitle || scene.title}
                accentWord={scene.slideAccent || scene.accentWord}
                bullets={scene.slideBullets}
                ink={ink}
                accent={accent}
                showPie
              />
            </div>
          </AbsoluteFill>
        );
      }
      return <HowDesign scene={scene} ink={ink} accent={accent} canvas={canvas} />;
    }
    if (tech === 'stat' || scene.stage === 'proof') {
      return <DesignsProof scene={scene} ink={ink} accent={accent} canvas={canvas} />;
    }
    if (tech === 'cta' || scene.stage === 'end') {
      return <EndCard scene={scene} brand={props.brandName} ink={ink} accent={accent} canvas={canvas} />;
    }
    if (tech === 'blank_deck' || scene.stage === 'problem') {
      return <Problem scene={scene} ink={ink} accent={accent} canvas={canvas} />;
    }
    // kinetic brand / kinetic problem fallback
    if (scene.stage === 'brand') {
      return (
        <BrandBeat
          scene={scene}
          brand={props.brandName}
          brandBg={props.brandBg || props.accent}
          ink={ink}
          accent={accent}
        />
      );
    }
    return <Problem scene={scene} ink={ink} accent={accent} canvas={canvas} />;
  };

  return (
    <AbsoluteFill style={{ background: props.canvas, fontFamily: FONT }}>
      <Series>
        {props.scenes.map((scene, i) => {
          const dur = Math.max(1, Math.round(scene.durationSec * fps));
          const sfx = i === 0 ? 'lowboom' : i === props.scenes.length - 1 ? 'whoosh' : 'click';
          const zoom = scene.zoomFrom ?? 1.03;
          const enter = scene.enterFrames ?? 4;
          return (
            <Series.Sequence key={`${scene.stage}-${scene.technique || 'x'}-${i}`} durationInFrames={dur}>
              {scene.narrationFile ? <Audio src={staticFile(scene.narrationFile)} /> : null}
              <SceneMotion durationInFrames={dur} zoomFrom={zoom} enterFrames={enter} sfx={sfx} sfxVolume={0.24}>
                {i > 0 ? <IndigoWipe accent={props.accent} /> : null}
                {renderScene(scene)}
              </SceneMotion>
            </Series.Sequence>
          );
        })}
      </Series>
      <Captions cues={cues} />
    </AbsoluteFill>
  );
};
