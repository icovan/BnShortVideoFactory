import React from 'react';
import {
  AbsoluteFill, Audio, Img, Sequence, Series, interpolate, spring, staticFile,
  useCurrentFrame, useVideoConfig,
} from 'remotion';
import { loadFont } from '@remotion/google-fonts/Inter';
import type { DirectedProps, DirectedScene } from './directedSchema';
import { Stickman, POSES, idleBob, lerpPose, Platform, BilingualTitle, VISUAL_LOCK, typeScale } from './stickman';

const { fontFamily: FONT } = loadFont('normal', {
  weights: ['400', '500', '600', '700', '800'],
  subsets: ['latin'],
});

function safe(aspect: DirectedProps['aspect']) {
  if (aspect === '9:16') return { top: 120, bottom: 280, left: 72, right: 72 };
  if (aspect === '3:4') return { top: 96, bottom: 200, left: 64, right: 64 };
  if (aspect === '1:1') return { top: 72, bottom: 120, left: 64, right: 64 };
  return { top: 64, bottom: 88, left: 80, right: 80 };
}

const WordSlam: React.FC<{ text: string; size: number; color: string; delay?: number }> = ({
  text, size, color, delay = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(/\s+/).filter(Boolean);
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.28em 0.42em', justifyContent: 'center' }}>
      {words.map((w, i) => {
        const p = spring({ frame: frame - delay - i * 3, fps, config: { damping: 13, stiffness: 160, mass: 0.55 } });
        return (
          <span key={`${w}-${i}`} style={{
            display: 'inline-block', fontSize: size, fontWeight: 800, color,
            letterSpacing: '-0.04em', lineHeight: 1.08,
            opacity: p,
            transform: `translateY(${interpolate(p, [0, 1], [28, 0])}px) scale(${interpolate(p, [0, 1], [1.1, 1])})`,
          }}
          >{w}</span>
        );
      })}
    </div>
  );
};

const Karaoke: React.FC<{ text?: string; accent: string }> = ({ text, accent }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  if (!text?.trim()) return null;
  const words = text.trim().match(/[^，。！？、；\s]+[，。！？、；]?/g) || [text];
  const span = Math.max(4, Math.floor((durationInFrames * 0.7) / Math.max(words.length, 1)));
  return (
    <div style={{
      position: 'absolute', left: 48, right: 48, bottom: 36,
      display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.3em',
      padding: '12px 18px', borderRadius: 999, background: 'rgba(0,0,0,0.55)',
    }}
    >
      {words.map((w, i) => {
        const enter = 6 + i * span;
        const p = spring({ frame: frame - enter, fps, config: { damping: 12, stiffness: 170 } });
        const active = frame >= enter && frame < enter + span + 3;
        return (
          <span key={`${w}-${i}`} style={{
            fontSize: 26, fontWeight: 700, color: active ? accent : '#fff',
            opacity: interpolate(p, [0, 1], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
            transform: `scale(${interpolate(p, [0, 1], [0.7, 1])})`,
          }}
          >{w}</span>
        );
      })}
    </div>
  );
};

const BeatBody: React.FC<{ scene: DirectedScene; props: DirectedProps }> = ({ scene, props }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const pad = safe(props.aspect);
  const SAFE = pad;
  const dropSec = props.dropSec ?? 0;
  const hero = props.aspect === '9:16' ? 64 : 72;
  const items = scene.items || [];
  const max = Math.max(...items.map((_, i) => 80 - i * 10), 1);
  const skill = scene.skill || props.primary;
  const p0 = spring({ frame, fps, config: { damping: 12, stiffness: 160 } });
  const remaining = Math.max(0, Math.floor((durationInFrames - frame) / fps));
  const ken = interpolate(frame, [0, Math.max(durationInFrames, 1)], [1.08, 1], { extrapolateRight: 'clamp' });
  const assets = props.assets || [];
  const pickAsset = (role: string) => assets.find((a) => a.role === role) || assets[0];
  const logoAsset = pickAsset('logo');
  const productAsset = pickAsset('product') || pickAsset('shot') || pickAsset('image') || logoAsset;
  const job = (scene.job || '').toLowerCase();
  const showLogo = !!logoAsset && (
    skill === 'logo-animation'
    || job.includes('logo')
    || job.includes('end')
    || job.includes('cta')
    || job.includes('brand')
  );
  const showProduct = !!productAsset && (
    skill === 'product-demo-video'
    || skill === 'photo-slideshow'
    || skill === 'promo-video'
    || skill === 'ad-creative-video'
    || job.includes('demo')
    || job.includes('product')
    || job.includes('feature')
  );

  return (
    <div style={{
      position: 'absolute', top: SAFE.top, left: SAFE.left, right: SAFE.right, bottom: SAFE.bottom,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22,
    }}
    >
      <div className="motionBg" style={{
        position: 'absolute', inset: -80, zIndex: 0, pointerEvents: 'none',
        background: `radial-gradient(ellipse at ${40 + p0 * 20}% 30%, ${props.accent}22, transparent 55%)`,
        opacity: 0.9,
      }}
      />
      {skill === 'text-message-animation' ? (
        <div style={{ width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 10, zIndex: 1 }}>
          {(items.length ? items : [scene.headline, scene.line].filter(Boolean) as string[]).slice(0, 5).map((msg, i) => {
            const fromMe = i % 2 === 1;
            const enter = spring({ frame: frame - 6 - i * 8, fps, config: { damping: 14 } });
            return (
              <div key={`${msg}-${i}`} className="chatRow" style={{
                display: 'flex', justifyContent: fromMe ? 'flex-end' : 'flex-start', opacity: enter,
                transform: `translateY(${interpolate(enter, [0, 1], [16, 0])}px)`,
              }}
              >
                <div className="bubble" data-from-me={fromMe} style={{
                  maxWidth: '78%', padding: '12px 16px', borderRadius: fromMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  background: fromMe ? props.accent : props.brandBg || '#1C1F2E', color: fromMe ? '#111' : props.ink,
                  fontWeight: 650, fontSize: 22, lineHeight: 1.35,
                }}
                >{msg}</div>
              </div>
            );
          })}
        </div>
      ) : null}

      {skill === 'whiteboard-animation' ? (
        <svg className="whiteboard" width="520" height="180" viewBox="0 0 520 180" style={{ zIndex: 1 }}>
          <path
            d="M 24 90 C 120 20, 220 160, 320 70 S 460 40, 500 100"
            fill="none" stroke={props.ink} strokeWidth="4"
            strokeDasharray="720" strokeDashoffset={720 * (1 - p0)}
          />
        </svg>
      ) : null}

      {skill === 'stickman-animation' ? (() => {
        const W = props.aspect === '9:16' ? 1080 : props.aspect === '1:1' ? 1080 : 1920;
        const H = props.aspect === '9:16' ? 1920 : props.aspect === '1:1' ? 1080 : 1080;
        const ts = typeScale(W);
        const groundY = props.aspect === '9:16' ? 1320 : 820;
        const midX = props.aspect === '9:16' ? 540 : 960;
        return (
          <div style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none' }}>
            <BilingualTitle
              zh={scene.headline || 'Stickman'}
              en={scene.line || undefined}
              y={SAFE.top + 16}
              size={ts.title}
            />
            <Platform
              x={SAFE.left}
              y={groundY}
              w={W - SAFE.left - SAFE.right}
              color={VISUAL_LOCK.propLight}
            />
            <Stickman
              x={midX}
              y={groundY - 8}
              pose={idleBob(
                lerpPose(
                  POSES.stand,
                  job.includes('sit') || job.includes('smart') ? POSES.sit : POSES['reach-up'],
                  p0,
                ),
                frame,
                fps,
              )}
              scale={props.aspect === '9:16' ? 1.35 : 1.15}
              ink={props.ink === '#FFFFFF' || !props.ink ? VISUAL_LOCK.ink : props.ink}
            />
          </div>
        );
      })() : null}

      {skill === 'isometric-animation' ? (
        <div className="isometric" style={{
          width: 220, height: 220, perspective: 600, zIndex: 1,
          transform: `rotateX(18deg) rotateZ(-12deg) scale(${interpolate(p0, [0, 1], [0.7, 1])})`,
        }}
        >
          <div style={{ width: '100%', height: '100%', background: props.accent, borderRadius: 16, opacity: 0.9 }} />
        </div>
      ) : null}

      {skill === 'countdown-video' ? (
        <div className="countdown" style={{ fontSize: 120, fontWeight: 800, color: props.accent, zIndex: 1 }}>{remaining}</div>
      ) : null}

      {skill === 'product-demo-video' ? (
        <div className="device" style={{
          width: props.aspect === '9:16' ? 280 : 420, height: props.aspect === '9:16' ? 500 : 260,
          borderRadius: 28, border: `3px solid ${props.ink}33`, background: props.brandBg || '#0E1018',
          position: 'relative', zIndex: 1, overflow: 'hidden',
        }}
        >
          {productAsset ? (
            <Img
              src={staticFile(productAsset.file)}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : null}
          <div className="cursor pointer" style={{
            position: 'absolute', left: interpolate(p0, [0, 1], [40, 180]), top: interpolate(p0, [0, 1], [60, 140]),
            width: 18, height: 18, borderRadius: 2, background: props.accent, transform: 'rotate(12deg)',
          }}
          />
        </div>
      ) : null}

      {skill === 'photo-slideshow' ? (
        <div style={{
          width: '70%', height: '46%', borderRadius: 18, overflow: 'hidden', zIndex: 1,
          transform: `scale(${ken})`, background: props.brandBg || props.accent,
        }}
        >
          {productAsset ? (
            <Img
              src={staticFile(productAsset.file)}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : null}
        </div>
      ) : null}

      {skill === 'ad-creative-video' ? (
        <div className="cta" style={{
          zIndex: 1, padding: '16px 36px', borderRadius: 999, background: props.accent, color: '#111',
          fontWeight: 800, fontSize: 28, transform: `scale(${interpolate(p0, [0, 1], [0.85, 1])})`,
        }}
        >CTA</div>
      ) : null}

      {skill === 'testimonial-video' ? (
        <div className="quote" style={{ zIndex: 1, maxWidth: 680, textAlign: 'center' }}>
          <div className="stars" style={{ color: props.accent, letterSpacing: 6, fontSize: 22, marginBottom: 12 }}>★★★★★</div>
          <p style={{ fontSize: 32, fontWeight: 700, margin: 0 }}>{scene.headline || 'review'}</p>
        </div>
      ) : null}

      {skill === 'map-animation' ? (
        <svg className="map" width="420" height="240" viewBox="0 0 420 240" style={{ zIndex: 1 }}>
          <circle className="marker" cx="210" cy="120" r={12 + p0 * 8} fill={props.accent} opacity={0.85} />
          <text x="210" y="210" textAnchor="middle" fill={props.muted} fontSize="16">lat 0 · lng 0</text>
        </svg>
      ) : null}

      {skill === 'logo-animation' || showLogo ? (
        <div className="logo" style={{
          zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
          transform: `scale(${interpolate(p0, [0, 1], [1.18, 1])})`,
        }}
        >
          {logoAsset ? (
            <Img
              src={staticFile(logoAsset.file)}
              style={{
                maxWidth: props.aspect === '9:16' ? 280 : 360,
                maxHeight: props.aspect === '9:16' ? 160 : 140,
                objectFit: 'contain',
              }}
            />
          ) : (
            <div style={{ fontSize: 64, fontWeight: 800, letterSpacing: '-0.06em' }}>
              {scene.headline || 'LOGO'}
            </div>
          )}
        </div>
      ) : null}

      {/* 通用：非特定 skill 时仍把产品/截图放进构图 */}
      {showProduct && skill !== 'product-demo-video' && skill !== 'photo-slideshow' && !showLogo ? (
        <div style={{
          zIndex: 1, width: props.aspect === '9:16' ? '78%' : '52%', maxWidth: 560,
          borderRadius: 16, overflow: 'hidden', border: `1px solid ${props.ink}22`,
          transform: `scale(${interpolate(p0, [0, 1], [0.94, 1])})`,
          boxShadow: `0 24px 60px ${props.ink}18`,
        }}
        >
          <Img
            src={staticFile(productAsset!.file)}
            style={{ width: '100%', display: 'block', aspectRatio: '16 / 10', objectFit: 'cover' }}
          />
        </div>
      ) : null}

      {skill === 'audiogram' ? (
        <div className="audiogram" style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 120, zIndex: 1 }}>
          {Array.from({ length: 16 }, (_, i) => {
            const barH = 24 + Math.abs(Math.sin((frame + i * 7) / 8)) * 90;
            return <div key={i} className="waveform" style={{ width: 10, height: barH, background: props.accent, borderRadius: 4 }} />;
          })}
        </div>
      ) : null}

      {skill === 'youtube-intro-outro' ? (
        <div className="intro outro" style={{ zIndex: 1, fontSize: 48, fontWeight: 800 }}>
          {scene.job.includes('out') ? 'outro' : 'intro'} · subscribe
        </div>
      ) : null}

      {skill === 'promo-video' ? (
        <div className="promo" style={{ zIndex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 28, color: props.muted, textDecoration: 'line-through' }} className="strike price">$99</div>
          <div style={{ fontSize: 72, fontWeight: 800, color: props.accent }}>{scene.stat ? `${scene.stat.value}%` : '40%'} off</div>
        </div>
      ) : null}

      {skill === 'wrapped-video' || skill === 'animated-infographic' ? (
        <div className="wrapped recap infographic cascade" style={{ zIndex: 1, width: '100%', maxWidth: 720 }}>
          {(items.length ? items : [scene.headline].filter(Boolean) as string[]).map((it, i) => {
            const p = spring({ frame: frame - 8 - i * 6, fps, config: { damping: 14 } });
            return (
              <div key={it} style={{ opacity: p, transform: `translateY(${interpolate(p, [0, 1], [18, 0])}px)`, fontSize: 28, fontWeight: 800, marginBottom: 8 }}>
                {it}
              </div>
            );
          })}
        </div>
      ) : null}

      {skill !== 'text-message-animation' && skill !== 'logo-animation' && skill !== 'stickman-animation' && scene.headline ? (
        <WordSlam text={scene.headline} size={hero} color={props.ink} />
      ) : null}
      {scene.line && skill !== 'text-message-animation' && skill !== 'stickman-animation' ? (
        <p style={{ margin: 0, fontSize: 28, color: props.muted, fontWeight: 600, textAlign: 'center', zIndex: 1 }}>{scene.line}</p>
      ) : null}
      {items.length && skill !== 'text-message-animation' && skill !== 'wrapped-video' && skill !== 'animated-infographic' ? (
        <div style={{ width: '100%', maxWidth: 820, display: 'flex', flexDirection: 'column', gap: 10, zIndex: 1 }}>
          {items.map((it, i) => {
            const p = spring({ frame: frame - 8 - i * 6, fps, config: { damping: 14 } });
            const w = interpolate(p, [0, 1], [0, max - i * 8], { extrapolateRight: 'clamp' });
            return (
              <div key={it} style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 12, alignItems: 'center', opacity: p }}>
                <span style={{ fontWeight: 800, fontSize: 22, color: props.ink, textAlign: 'right' }}>{it}</span>
                <div style={{ height: 18, background: 'rgba(255,255,255,0.08)', borderRadius: 99 }}>
                  <div style={{ height: '100%', width: `${w}%`, background: props.accent, borderRadius: 99 }} />
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
      {scene.stat && skill !== 'promo-video' ? (
        <div style={{ fontSize: 88, fontWeight: 800, color: props.accent, zIndex: 1 }}>
          {Math.round(interpolate(spring({ frame: frame - 6, fps, config: { damping: 14 } }), [0, 1], [0, scene.stat.value]))}
          <div style={{ fontSize: 22, color: props.muted, textAlign: 'center' }}>{scene.stat.label}</div>
        </div>
      ) : null}
      {skill === 'diagram-animation' || scene.job === 'how' ? (
        <svg width="420" height="160" viewBox="0 0 420 160" style={{ zIndex: 1 }}>
          {['A', 'B', 'C'].map((n, i) => {
            const p = spring({ frame: frame - 4 - i * 8, fps, config: { damping: 12 } });
            return (
              <g key={n} opacity={p}>
                <rect x={20 + i * 140} y={40} width="100" height="56" rx="12" fill="none" stroke={props.accent} strokeWidth="3" />
                <text x={70 + i * 140} y={74} textAnchor="middle" fill={props.ink} fontSize="20" fontWeight="800">{n}</text>
                {i < 2 ? <path d={`M ${122 + i * 140} 68 H ${158 + i * 140}`} stroke={props.accent} strokeWidth="3" strokeDasharray="80" strokeDashoffset={80 * (1 - p)} /> : null}
              </g>
            );
          })}
        </svg>
      ) : null}

      {(skill === 'lower-thirds' || props.primary === 'testimonial-video') ? (
        <div className="lowerThird namePlate" style={{
          position: 'absolute', left: 0, bottom: 8, padding: '14px 22px',
          background: props.accent, color: '#111', fontWeight: 800, fontSize: 22, borderRadius: 4,
        }}
        >{scene.headline || 'Name'} · {scene.line || 'Title'}</div>
      ) : null}

      {dropSec > 0 && skill === 'launch-video' ? (
        <div className="reveal beat" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
      ) : null}
    </div>
  );
};

export const DirectedFilm: React.FC<DirectedProps> = (props) => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: props.canvas, fontFamily: FONT, color: props.ink, overflow: 'hidden' }}>
      {props.musicFile ? (
        <Audio src={staticFile(props.musicFile)} volume={0.24} />
      ) : null}
      <Series>
        {props.scenes.map((scene, i) => {
          const dur = Math.max(1, Math.round(scene.durationSec * fps));
          const cues = props.autoSfx === false
            ? []
            : (scene.sfxCues?.length
              ? scene.sfxCues
              : scene.sfxFile
                ? [{ file: scene.sfxFile, volume: scene.sfxVolume ?? 0.2, atSec: 0 }]
                : []);
          return (
            <Series.Sequence key={`${scene.job}-${i}`} durationInFrames={dur}>
              {scene.narrationFile ? <Audio src={staticFile(scene.narrationFile)} /> : null}
              {cues.map((cue, j) => {
                const from = Math.max(0, Math.round((cue.atSec || 0) * fps));
                return (
                  <Sequence key={`sfx-${i}-${j}`} from={from} layout="none">
                    <Audio
                      src={staticFile(cue.file)}
                      volume={typeof cue.volume === 'number' ? cue.volume : 0.18}
                    />
                  </Sequence>
                );
              })}
              <BeatBody scene={scene} props={props} />
              <Karaoke text={scene.vo} accent={props.accent} />
            </Series.Sequence>
          );
        })}
      </Series>
    </AbsoluteFill>
  );
};
