import React from 'react';
import {
  RIG,
  VISUAL_LOCK,
  resolveRig,
  type StickPose,
  type StickRig,
  type StickVariant,
} from './types';
import { ensurePose } from './poses';

type Seg = { angle: number; length: number };

const LimbChain: React.FC<{
  segs: Seg[];
  width: number;
  color: string;
  /** End-cap radius (hand / foot). 0 = none. */
  capR?: number;
}> = ({ segs, width, color, capR = 0 }) => {
  const [head, ...rest] = segs;
  if (!head) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: 0,
        height: 0,
        transform: `rotate(${head.angle}deg)`,
        transformOrigin: '0 0',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: -width / 2,
          top: -width / 2,
          width,
          height: head.length + width,
          borderRadius: width / 2,
          background: color,
        }}
      />
      {rest.length ? (
        <div style={{ position: 'absolute', left: 0, top: head.length, width: 0, height: 0 }}>
          <LimbChain segs={rest} width={width} color={color} capR={capR} />
        </div>
      ) : capR > 0 ? (
        <div
          style={{
            position: 'absolute',
            left: -capR,
            top: head.length - capR * 0.35,
            width: capR * 2,
            height: capR * 2,
            borderRadius: capR,
            background: color,
          }}
        />
      ) : null}
    </div>
  );
};

export type StickmanProps = {
  /** Hip root X in parent coords. */
  x: number;
  /** Hip root Y in parent coords (plant feet on ground near y). */
  y: number;
  /** Full StickPose preferred; undefined/partial is coerced via ensurePose. */
  pose?: StickPose | null;
  scale?: number;
  rotate?: number;
  /** 1 = default facing, -1 = mirror horizontally (for left/right walks). */
  face?: 1 | -1;
  /** Body silhouette variant. */
  variant?: StickVariant;
  /** Body color. Default matte white (dark-canvas polarity); pass props.ink or resolveStickInk(canvas) for light scenes. */
  ink?: string;
  /** Optional small head accent dot (role / team mark). */
  accent?: string;
  /** Optional bloom 0–1. Default 0 — matte white, no glow. */
  glow?: number;
  opacity?: number;
  className?: string;
};

/**
 * Capsule stickman (Simply Animated lock).
 * Anchor = hip root. Legs hang down; torso grows upward.
 * Default look is matte white — do not enable glow unless the brief asks.
 */
export const Stickman: React.FC<StickmanProps> = ({
  x,
  y,
  pose,
  scale = 1,
  rotate = 0,
  face = 1,
  variant = 'default',
  ink = VISUAL_LOCK.ink,
  accent,
  glow = VISUAL_LOCK.glow,
  opacity = 1,
  className = 'stickman',
}) => {
  const rig: StickRig = resolveRig(variant);
  const safePose = ensurePose(pose);
  const headTilt = safePose.headTilt;

  return (
    <div
      className={className}
      data-stickman="1"
      data-variant={variant}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: 0,
        height: 0,
        transform: `rotate(${rotate}deg) scale(${face * scale}, ${scale})`,
        transformOrigin: '0 0',
        opacity,
        filter: glow > 0
          ? `drop-shadow(0 0 ${Math.max(1, VISUAL_LOCK.glowPx || 10)}px rgba(255,255,255,${glow})) drop-shadow(0 0 3px rgba(255,255,255,${glow}))`
          : undefined,
        pointerEvents: 'none',
      }}
    >
      {/* legs behind */}
      <div style={{ position: 'absolute', left: -rig.hipX, top: 0, width: 0, height: 0 }}>
        <LimbChain
          segs={[{ angle: safePose.hipL, length: rig.upLeg }, { angle: safePose.kneeL, length: rig.loLeg }]}
          width={rig.legW}
          color={ink}
          capR={rig.footR}
        />
      </div>
      <div style={{ position: 'absolute', left: rig.hipX, top: 0, width: 0, height: 0 }}>
        <LimbChain
          segs={[{ angle: safePose.hipR, length: rig.upLeg }, { angle: safePose.kneeR, length: rig.loLeg }]}
          width={rig.legW}
          color={ink}
          capR={rig.footR}
        />
      </div>

      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: 0,
          height: 0,
          transform: `rotate(${safePose.torsoTilt}deg)`,
          transformOrigin: '0 0',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: -rig.torsoW / 2,
            top: -rig.torsoH,
            width: rig.torsoW,
            height: rig.torsoH,
            borderRadius: rig.torsoW / 2,
            background: ink,
          }}
        />
        {/* head + optional accent */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: -rig.torsoH - rig.neck,
            width: 0,
            height: 0,
            transform: `rotate(${headTilt}deg)`,
            transformOrigin: '0 0',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: -rig.headR,
              top: -rig.headR * 2,
              width: rig.headR * 2,
              height: rig.headR * 2,
              borderRadius: rig.headR,
              background: ink,
            }}
          />
          {accent ? (
            <div
              style={{
                position: 'absolute',
                left: -rig.headR * 0.35,
                top: -rig.headR * 1.55,
                width: rig.headR * 0.7,
                height: rig.headR * 0.35,
                borderRadius: rig.headR * 0.2,
                background: accent,
              }}
            />
          ) : null}
        </div>
        {/* arms */}
        <div
          style={{
            position: 'absolute',
            left: -rig.shoulderX,
            top: rig.shoulderY,
            width: 0,
            height: 0,
          }}
        >
          <LimbChain
            segs={[{ angle: safePose.shoulderL, length: rig.upArm }, { angle: safePose.elbowL, length: rig.loArm }]}
            width={rig.armW}
            color={ink}
            capR={rig.handR}
          />
        </div>
        <div
          style={{
            position: 'absolute',
            left: rig.shoulderX,
            top: rig.shoulderY,
            width: 0,
            height: 0,
          }}
        >
          <LimbChain
            segs={[{ angle: safePose.shoulderR, length: rig.upArm }, { angle: safePose.elbowR, length: rig.loArm }]}
            width={rig.armW}
            color={ink}
            capR={rig.handR}
          />
        </div>
      </div>
    </div>
  );
};

/** @deprecated use resolveRig — kept for rare external callers */
export const DEFAULT_RIG = RIG;
