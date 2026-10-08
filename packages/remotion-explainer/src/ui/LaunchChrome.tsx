import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { GOLD, MINT } from './tokens';

export type IssueTone = 'todo' | 'progress' | 'review' | 'done';

const toneColor = (t?: IssueTone, accent = '#5E6AD2') => {
  if (t === 'progress') return GOLD;
  if (t === 'review') return MINT;
  if (t === 'done') return accent;
  return '#8B8FA8';
};

/** launch / Linear issue card — denser product chrome */
export const IssueCard: React.FC<{
  id: string;
  title: string;
  avatar?: string;
  tone?: IssueTone;
  accent?: string;
  ink?: string;
  highlight?: boolean;
  delay?: number;
  compact?: boolean;
}> = ({
  id, title, avatar = 'A', tone = 'todo', accent = '#5E6AD2', ink = '#F5F5F7',
  highlight = false, delay = 0, compact = false,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: Math.max(0, frame - delay), fps, config: { damping: 16 } });
  const avatars = [MINT, GOLD, '#F472B6', accent, '#60A5FA'];
  const av = avatars[id.charCodeAt(id.length - 1) % avatars.length];
  return (
    <div style={{
      background: '#14141A',
      borderRadius: 12,
      padding: compact ? '12px 12px 10px' : '14px 14px 12px',
      border: highlight ? `1px solid ${accent}` : '1px solid rgba(255,255,255,0.06)',
      boxShadow: highlight
        ? `0 22px 55px rgba(0,0,0,0.55), 0 0 36px ${accent}66`
        : '0 10px 26px rgba(0,0,0,0.3)',
      opacity: p,
      transform: highlight
        ? `translate(${6 + Math.sin(frame / 18) * 2}px, ${-8 + Math.cos(frame / 16) * 2}px) rotate(-1deg) scale(1.03)`
        : `translateY(${interpolate(p, [0, 1], [14, 0])}px)`,
      zIndex: highlight ? 5 : 1,
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', color: '#7C829A',
        fontSize: compact ? 11 : 12, marginBottom: 6,
      }}>
        <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{
            width: 10, height: 10, borderRadius: '50%',
            border: `2px solid ${toneColor(tone, accent)}`,
            background: tone === 'done' || tone === 'review' ? toneColor(tone, accent) : 'transparent',
          }} />
          {id}
        </span>
        <span style={{
          width: 20, height: 20, borderRadius: '50%', background: av,
          color: '#0a0a0c', fontSize: 11, display: 'grid', placeItems: 'center', fontWeight: 700,
        }}>{avatar}</span>
      </div>
      <div style={{ color: ink, fontSize: compact ? 15 : 17, fontWeight: 600, lineHeight: 1.3 }}>{title}</div>
      <div style={{ marginTop: 10, display: 'flex', gap: 4, alignItems: 'flex-end' }}>
        {[1, 2, 3].map((b) => (
          <div key={b} style={{
            width: 3, height: 3 + b * 2, borderRadius: 1,
            background: b <= 2 ? GOLD : 'rgba(255,255,255,0.15)',
          }} />
        ))}
      </div>
    </div>
  );
};

/** logo-animation: stroke-dash mark + bloom */
export const LogoMark: React.FC<{
  accent: string;
  size?: number;
  label?: string;
  ink?: string;
}> = ({ accent, size = 120, label, ink = '#1A1540' }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 14 } });
  const dash = interpolate(frame, [0, fps * 1.1], [280, 0], { extrapolateRight: 'clamp' });
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      opacity: enter, transform: `translateY(${interpolate(enter, [0, 1], [16, 0])}px)`,
    }}>
      <svg width={size} height={size} viewBox="0 0 88 88" style={{ marginBottom: label ? 18 : 0 }}>
        <rect x="8" y="8" width="72" height="72" rx="18" fill="none" stroke={accent} strokeWidth="5"
          strokeDasharray="280" strokeDashoffset={dash} />
        <text x="44" y="54" textAnchor="middle" fill={accent} fontSize="28" fontWeight="800">✦</text>
      </svg>
      {label && (
        <div style={{ fontSize: size * 0.72, fontWeight: 800, color: ink, letterSpacing: '-0.045em' }}>
          {label}
        </div>
      )}
    </div>
  );
};

/** caption-animation: soft rise caption chip */
export const CaptionChip: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame, fps, config: { damping: 16 } });
  return (
    <div style={{
      maxWidth: '78%', padding: '12px 22px', borderRadius: 14,
      background: 'rgba(26,21,64,0.9)', color: '#fff',
      fontSize: 22, fontWeight: 500, textAlign: 'center',
      boxShadow: '0 12px 30px rgba(26,21,64,0.28)',
      opacity: p, transform: `translateY(${interpolate(p, [0, 1], [10, 0])}px)`,
    }}>
      {text.split('\n').slice(0, 2).map((ln, i) => <div key={i}>{ln}</div>)}
    </div>
  );
};
