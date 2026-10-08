import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

/** text-message-animation recipes — chat bubbles + typing */
export const ChatPane: React.FC<{
  accent: string;
  ink?: string;
  userText?: string;
  replyText?: string;
  delay?: number;
  width?: number;
}> = ({
  accent,
  ink = '#1A1540',
  userText = '把标题加粗，再加一张图表',
  replyText = '好了，版式已更新。',
  delay = 0,
  width = 340,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const userIn = spring({ frame: Math.max(0, frame - delay), fps, config: { damping: 15 } });
  const typing = frame > delay + Math.floor(fps * 0.7) && frame < delay + Math.floor(fps * 1.35);
  const replyIn = spring({
    frame: Math.max(0, frame - delay - Math.floor(fps * 1.4)),
    fps,
    config: { damping: 14 },
  });
  return (
    <div style={{
      width, background: '#fff', borderRadius: 22, padding: 22,
      boxShadow: '0 20px 50px rgba(26,21,64,0.1)',
      display: 'flex', flexDirection: 'column', gap: 12, height: '100%', boxSizing: 'border-box',
    }}>
      <div style={{
        alignSelf: 'flex-end', maxWidth: '92%',
        background: `${accent}14`, color: ink, fontSize: 18, fontWeight: 600,
        padding: '14px 16px', borderRadius: '16px 16px 4px 16px',
        opacity: userIn, transform: `translateY(${interpolate(userIn, [0, 1], [12, 0])}px)`,
      }}>{userText}</div>
      {typing && (
        <div style={{
          alignSelf: 'flex-start', padding: '12px 16px', borderRadius: 14,
          background: '#F0EDF6', display: 'flex', gap: 5,
        }}>
          {[0, 1, 2].map((i) => (
            <span key={i} style={{
              width: 7, height: 7, borderRadius: '50%', background: '#9A94B0',
              opacity: 0.35 + (Math.sin((frame + i * 4) / 4) + 1) * 0.3,
            }} />
          ))}
        </div>
      )}
      <div style={{
        alignSelf: 'flex-start', background: accent, color: '#fff', fontSize: 16,
        padding: '12px 16px', borderRadius: '16px 16px 16px 4px',
        opacity: replyIn, transform: `translateY(${interpolate(replyIn, [0, 1], [10, 0])}px)`,
      }}>{replyText}</div>
      <div style={{ marginTop: 'auto', color: '#9A94B0', fontSize: 14, paddingTop: 8 }}>
        问 PageOn…
      </div>
    </div>
  );
};

/** product-demo fake cursor */
export const FakeCursor: React.FC<{
  x: number;
  y: number;
  clickAt?: number;
}> = ({ x, y, clickAt }) => {
  const frame = useCurrentFrame();
  const clicking = clickAt != null && frame >= clickAt && frame < clickAt + 8;
  return (
    <div style={{
      position: 'absolute', left: x, top: y, zIndex: 50, pointerEvents: 'none',
      transform: `scale(${clicking ? 0.88 : 1})`,
      filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.35))',
    }}>
      <svg width="28" height="28" viewBox="0 0 24 24">
        <path d="M4 2l14 10-6 1 3 8-3 1-3-8-5 4z" fill="#fff" stroke="#1A1540" strokeWidth="1.2" />
      </svg>
      {clicking && (
        <div style={{
          position: 'absolute', left: 2, top: 2, width: 22, height: 22, borderRadius: '50%',
          border: '2px solid #5B4CDB', opacity: 0.5,
          transform: `scale(${1 + (frame - (clickAt || 0)) * 0.15})`,
        }} />
      )}
    </div>
  );
};
