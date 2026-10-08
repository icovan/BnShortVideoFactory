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
import type { CaptionCue, ExplainerProps, SceneProps } from './schema';

const STAGE_LABEL: Record<SceneProps['stage'], string> = {
  problem: '问题',
  stakes: '代价',
  solution: '方案',
  how: '机制',
  payoff: '结果',
};

/** Skill easing: enter cubic-bezier(.22,1,.36,1) */
const ENTER = Easing.bezier(0.22, 1, 0.36, 1);

function useEnter(delay = 0) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = Math.max(0, frame - delay);
  return spring({ frame: local, fps, config: { damping: 200 }, durationInFrames: Math.round(0.4 * fps) });
}

const Captions: React.FC<{ cues: CaptionCue[]; ink: string; canvas: string }> = ({ cues, ink, canvas }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const cue = cues.find((c) => t >= c.from && t <= c.to);
  if (!cue) return null;
  const lines = cue.text.split('\n').slice(0, 2);
  return (
    <div style={{
      position: 'absolute', left: '5%', right: '5%', bottom: 64,
      display: 'flex', justifyContent: 'center', pointerEvents: 'none', zIndex: 20,
    }}>
      <div style={{
        maxWidth: '90%', padding: '14px 28px', borderRadius: 8,
        background: 'rgba(11,15,20,0.82)', color: ink || '#F5F7FA',
        fontSize: 28, fontWeight: 500, lineHeight: 1.35, textAlign: 'center',
        fontFamily: '"Microsoft YaHei", "Noto Sans SC", system-ui, sans-serif',
        border: `1px solid ${canvas === '#0B0F14' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
      }}>
        {lines.map((ln, i) => <div key={i}>{ln}</div>)}
      </div>
    </div>
  );
};

const Kinetic: React.FC<{ scene: SceneProps; accent: string; ink: string; muted: string }> = ({
  scene, accent, ink, muted,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = useEnter(0);
  const y = interpolate(enter, [0, 1], [18, 0]);
  // 动能字：按字符错开（Skill kinetic keyword）
  const chars = Array.from(scene.keyword.slice(0, 12));
  return (
    <>
      <div style={{
        position: 'absolute', top: 80, left: '5%', fontSize: 26, letterSpacing: '0.2em',
        color: accent, fontWeight: 600, opacity: enter,
      }}>
        {STAGE_LABEL[scene.stage]}
      </div>
      <div style={{
        position: 'absolute', top: 160, left: '5%', right: '5%',
        display: 'flex', flexWrap: 'wrap', gap: 2, fontSize: 72, fontWeight: 700,
        color: ink, lineHeight: 1.15,
      }}>
        {chars.map((ch, i) => {
          const local = Math.max(0, frame - Math.round(i * 0.05 * fps));
          const p = spring({ frame: local, fps, config: { damping: 18, stiffness: 120 } });
          return (
            <span key={`${ch}-${i}`} style={{
              display: 'inline-block',
              opacity: p,
              transform: `translateY(${interpolate(p, [0, 1], [18, 0])}px)`,
            }}>{ch}</span>
          );
        })}
      </div>
      <div style={{
        position: 'absolute', top: 320, left: '5%', right: '8%',
        fontSize: 34, lineHeight: 1.45, color: muted,
        opacity: interpolate(enter, [0.15, 1], [0, 1], { extrapolateLeft: 'clamp' }),
        transform: `translateY(${y * 0.4}px)`,
      }}>
        {scene.visual}
      </div>
    </>
  );
};

const Diagram: React.FC<{ scene: SceneProps; accent: string; ink: string; muted: string }> = ({
  scene, accent, ink, muted,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const nodes = scene.nodes?.length ? scene.nodes : ['A', 'B', 'C'];
  const labels = scene.labels?.length ? scene.labels : nodes;
  const n = nodes.length;
  const W = 1600;
  const y0 = 420;
  const xs = nodes.map((_, i) => 160 + (W / Math.max(1, n - 1)) * i);

  return (
    <>
      <div style={{
        position: 'absolute', top: 80, left: '5%', fontSize: 26, letterSpacing: '0.2em',
        color: accent, fontWeight: 600,
        opacity: spring({ frame, fps, config: { damping: 200 } }),
      }}>
        {STAGE_LABEL[scene.stage]} · {scene.keyword}
      </div>
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
        {xs.slice(0, -1).map((x, i) => {
          const x2 = xs[i + 1];
          // edges 在 nodes 之后揭露（Skill: nodes → edges → labels）
          const edgeStart = Math.round((0.45 + i * 0.3) * fps);
          const local = Math.max(0, frame - edgeStart);
          const progress = interpolate(local, [0, Math.round(0.5 * fps)], [0, 1], {
            extrapolateRight: 'clamp', easing: ENTER,
          });
          const len = x2 - x;
          return (
            <line
              key={`e-${i}`}
              x1={x + 48} y1={y0} x2={x + 48 + len * progress - 48} y2={y0}
              stroke={accent} strokeWidth={4} strokeLinecap="round"
              opacity={0.85}
            />
          );
        })}
        {nodes.map((node, i) => {
          const local = Math.max(0, frame - Math.round(i * 0.3 * fps));
          const p = spring({ frame: local, fps, config: { damping: 14, stiffness: 110 } });
          const scale = interpolate(p, [0, 1], [0.85, 1]);
          return (
            <g key={`n-${i}`} opacity={p} transform={`translate(${xs[i]}, ${y0}) scale(${scale})`}>
              <circle r={48} fill={accent} />
              <text textAnchor="middle" dy="10" fill="#fff" fontSize={28} fontWeight={700}
                fontFamily='"Microsoft YaHei", sans-serif'>{node.slice(0, 2)}</text>
            </g>
          );
        })}
      </svg>
      {labels.map((lab, i) => {
        const labelStart = Math.round((0.9 + i * 0.12) * fps);
        const local = Math.max(0, frame - labelStart);
        const p = interpolate(local, [0, Math.round(0.3 * fps)], [0, 1], {
          extrapolateRight: 'clamp', easing: ENTER,
        });
        return (
          <div key={`l-${i}`} style={{
            position: 'absolute', left: xs[i] - 80, top: y0 + 70, width: 160,
            textAlign: 'center', color: muted, fontSize: 26,
            opacity: p, transform: `translateY(${interpolate(p, [0, 1], [6, 0])}px)`,
          }}>{lab}</div>
        );
      })}
      <div style={{
        position: 'absolute', top: 160, left: '5%', right: '5%',
        fontSize: 48, fontWeight: 700, color: ink, maxWidth: '70%',
      }}>{scene.visual}</div>
    </>
  );
};

const Stat: React.FC<{ scene: SceneProps; accent: string; ink: string; muted: string }> = ({
  scene, accent, ink, muted,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = useEnter(0);
  const to = scene.statValue ?? 0;
  const dur = Math.round(1.2 * fps);
  const k = Math.min(1, frame / dur);
  const e = 1 - Math.pow(1 - k, 3); // Skill count-up ease-out cubic
  const shown = Math.round(to * e);
  return (
    <>
      <div style={{
        position: 'absolute', top: 80, left: '5%', fontSize: 26, letterSpacing: '0.2em',
        color: accent, fontWeight: 600, opacity: enter,
      }}>
        {STAGE_LABEL[scene.stage]}
      </div>
      <div style={{
        position: 'absolute', top: 220, left: '5%',
        fontSize: 120, fontWeight: 700, color: ink, letterSpacing: '-0.02em',
      }}>
        {shown.toLocaleString()}
        <span style={{ fontSize: 42, marginLeft: 16, color: muted }}>{scene.statSuffix || ''}</span>
      </div>
      <div style={{
        position: 'absolute', top: 420, left: '5%', right: '10%',
        fontSize: 36, color: muted, opacity: enter,
      }}>
        {scene.visual}
      </div>
      <div style={{
        position: 'absolute', left: '5%', bottom: 220, width: 420, height: 18,
        background: 'rgba(255,255,255,0.12)', borderRadius: 9, overflow: 'hidden',
      }}>
        <div style={{
          width: `${e * 100}%`, height: '100%', background: accent,
          transformOrigin: 'left', borderRadius: 9,
        }} />
      </div>
    </>
  );
};

const CtaCard: React.FC<{
  scene: SceneProps; cta?: string; coreIdea: string; accent: string; ink: string; muted: string;
}> = ({ scene, cta, coreIdea, accent, ink, muted }) => {
  const enter = useEnter(0);
  const y = interpolate(enter, [0, 1], [24, 0]);
  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', textAlign: 'center',
      opacity: enter, transform: `translateY(${y}px)`,
    }}>
      <div style={{ fontSize: 28, letterSpacing: '0.2em', color: accent, marginBottom: 24, fontWeight: 600 }}>
        {STAGE_LABEL[scene.stage]}
      </div>
      <div style={{ fontSize: 56, fontWeight: 700, color: ink, maxWidth: '70%', lineHeight: 1.25 }}>
        {coreIdea}
      </div>
      <div style={{ fontSize: 32, color: muted, marginTop: 28, maxWidth: '60%' }}>{scene.visual}</div>
      <div style={{
        marginTop: 56, padding: '18px 48px', borderRadius: 999,
        background: accent, color: '#fff', fontSize: 32, fontWeight: 700,
      }}>
        {cta || scene.keyword}
      </div>
    </div>
  );
};

const SceneView: React.FC<{
  scene: SceneProps;
  accent: string; ink: string; canvas: string; muted: string;
  coreIdea: string; cta?: string;
}> = (props) => {
  const { scene, canvas, accent, ink, muted, coreIdea, cta } = props;
  const tech = scene.technique || 'kinetic';
  return (
    <AbsoluteFill style={{
      background: canvas, color: ink,
      fontFamily: '"Microsoft YaHei", "Noto Sans SC", system-ui, sans-serif',
    }}>
      {tech === 'diagram' && <Diagram scene={scene} accent={accent} ink={ink} muted={muted} />}
      {tech === 'stat' && <Stat scene={scene} accent={accent} ink={ink} muted={muted} />}
      {tech === 'cta' && <CtaCard scene={scene} cta={cta} coreIdea={coreIdea} accent={accent} ink={ink} muted={muted} />}
      {(tech === 'kinetic' || !['diagram', 'stat', 'cta'].includes(tech)) && (
        <Kinetic scene={scene} accent={accent} ink={ink} muted={muted} />
      )}
      {/* safe-area guide: 内容已落在 5%–95% */}
      <div style={{
        position: 'absolute', bottom: 48, left: '5%', width: 72, height: 6, background: accent,
      }} />
    </AbsoluteFill>
  );
};

export const Explainer: React.FC<ExplainerProps> = (props) => {
  const { fps } = useVideoConfig();
  const muted = props.muted || '#8B939E';
  const cues = props.captions?.length
    ? props.captions
    : (() => {
        let t = 0.3;
        return props.scenes.map((s) => {
          const from = t;
          const to = t + Math.max(1, s.durationSec - 0.4);
          t += s.durationSec;
          return { from, to, text: (s.caption || s.vo).slice(0, 84) };
        });
      })();

  return (
    <AbsoluteFill>
      {props.narrationFile ? <Audio src={staticFile(props.narrationFile)} /> : null}
      <Series>
        {props.scenes.map((scene, i) => (
          <Series.Sequence
            key={`${scene.stage}-${i}`}
            durationInFrames={Math.max(1, Math.round(scene.durationSec * fps))}
          >
            <SceneView
              scene={scene}
              accent={props.accent}
              ink={props.ink}
              canvas={props.canvas}
              muted={muted}
              coreIdea={props.coreIdea}
              cta={props.cta}
            />
          </Series.Sequence>
        ))}
      </Series>
      <Captions cues={cues} ink={props.ink} canvas={props.canvas} />
    </AbsoluteFill>
  );
};
