/**
 * 语义音效角色库（开源素材，不自创波形）。
 * 本地：packages/remotion-explainer/public/sfx/
 * 来源：remotion.media（MIT）+ Kenney via soundcn（CC0）
 */

export type SfxRole =
  | 'whoosh'
  | 'whip'
  | 'click'
  | 'snap'
  | 'tick'
  | 'pop'
  | 'ding'
  | 'confirm'
  | 'open'
  | 'impact'
  | 'sub'
  | 'paper'
  | 'shutter'
  | 'scratch'
  | 'glass'
  | 'laser';

export type SfxIntent = 'enter' | 'accent' | 'settle';

export type SfxAsset = {
  role: SfxRole;
  /** public/sfx 下文件名 */
  file: string;
  /** 默认相对音量（再按 intent 衰减） */
  volume: number;
  label: string;
  source: string;
};

export type SfxCue = {
  role: SfxRole;
  intent: SfxIntent;
  file: string;
  volume: number;
  /** 相对该 beat 起点的秒 */
  atSec: number;
};

/** 角色 → 多变体（同片内轮换，禁止连用同文件） */
export const SFX_ASSETS: Record<SfxRole, SfxAsset[]> = {
  whoosh: [
    { role: 'whoosh', file: 'whoosh.wav', volume: 0.24, label: 'Whoosh', source: 'remotion.media' },
    { role: 'whoosh', file: 'iface-open-001.ogg', volume: 0.2, label: 'Open 1', source: 'Kenney Interface CC0' },
    { role: 'whoosh', file: 'iface-open-002.ogg', volume: 0.2, label: 'Open 2', source: 'Kenney Interface CC0' },
    { role: 'whoosh', file: 'iface-maximize-001.ogg', volume: 0.18, label: 'Maximize 1', source: 'Kenney Interface CC0' },
    { role: 'whoosh', file: 'iface-maximize-003.ogg', volume: 0.18, label: 'Maximize 3', source: 'Kenney Interface CC0' },
    { role: 'whoosh', file: 'iface-minimize-001.ogg', volume: 0.17, label: 'Minimize 1', source: 'Kenney Interface CC0' },
  ],
  whip: [
    { role: 'whip', file: 'whip.wav', volume: 0.22, label: 'Whip', source: 'remotion.media' },
    { role: 'whip', file: 'iface-scratch-001.ogg', volume: 0.16, label: 'Scratch swipe', source: 'Kenney Interface CC0' },
    { role: 'whip', file: 'iface-scratch-003.ogg', volume: 0.16, label: 'Scratch 3', source: 'Kenney Interface CC0' },
  ],
  click: [
    { role: 'click', file: 'kenney-click-1.wav', volume: 0.18, label: 'UI click 1', source: 'Kenney UI CC0' },
    { role: 'click', file: 'kenney-click-2.wav', volume: 0.18, label: 'UI click 2', source: 'Kenney UI CC0' },
    { role: 'click', file: 'kenney-click-3.wav', volume: 0.18, label: 'UI click 3', source: 'Kenney UI CC0' },
    { role: 'click', file: 'mouse-click.wav', volume: 0.18, label: 'Mouse click', source: 'remotion.media' },
    { role: 'click', file: 'iface-click-001.ogg', volume: 0.17, label: 'Click 001', source: 'Kenney Interface CC0' },
    { role: 'click', file: 'iface-click-002.ogg', volume: 0.17, label: 'Click 002', source: 'Kenney Interface CC0' },
    { role: 'click', file: 'iface-click-003.ogg', volume: 0.17, label: 'Click 003', source: 'Kenney Interface CC0' },
    { role: 'click', file: 'iface-click-004.ogg', volume: 0.17, label: 'Click 004', source: 'Kenney Interface CC0' },
    { role: 'click', file: 'iface-select-001.ogg', volume: 0.16, label: 'Select 1', source: 'Kenney Interface CC0' },
    { role: 'click', file: 'iface-select-003.ogg', volume: 0.16, label: 'Select 3', source: 'Kenney Interface CC0' },
  ],
  snap: [
    { role: 'snap', file: 'kenney-switch-1.wav', volume: 0.17, label: 'Switch 1', source: 'Kenney UI CC0' },
    { role: 'snap', file: 'switch.wav', volume: 0.17, label: 'Switch', source: 'remotion.media' },
    { role: 'snap', file: 'iface-switch-001.ogg', volume: 0.16, label: 'Switch 001', source: 'Kenney Interface CC0' },
    { role: 'snap', file: 'iface-switch-003.ogg', volume: 0.16, label: 'Switch 003', source: 'Kenney Interface CC0' },
    { role: 'snap', file: 'iface-toggle-001.ogg', volume: 0.16, label: 'Toggle 1', source: 'Kenney Interface CC0' },
    { role: 'snap', file: 'iface-toggle-003.ogg', volume: 0.16, label: 'Toggle 3', source: 'Kenney Interface CC0' },
  ],
  tick: [
    { role: 'tick', file: 'kenney-switch-2.wav', volume: 0.15, label: 'Tick switch', source: 'Kenney UI CC0' },
    { role: 'tick', file: 'iface-tick-001.ogg', volume: 0.14, label: 'Tick 001', source: 'Kenney Interface CC0' },
    { role: 'tick', file: 'iface-tick-002.ogg', volume: 0.14, label: 'Tick 002', source: 'Kenney Interface CC0' },
    { role: 'tick', file: 'iface-tick-004.ogg', volume: 0.14, label: 'Tick 004', source: 'Kenney Interface CC0' },
    { role: 'tick', file: 'iface-drop-001.ogg', volume: 0.14, label: 'Drop 1', source: 'Kenney Interface CC0' },
  ],
  pop: [
    { role: 'pop', file: 'kenney-mouseclick.wav', volume: 0.17, label: 'Pop click', source: 'Kenney UI CC0' },
    { role: 'pop', file: 'iface-bong-001.ogg', volume: 0.15, label: 'Bong', source: 'Kenney Interface CC0' },
    { role: 'pop', file: 'iface-pluck-001.ogg', volume: 0.15, label: 'Pluck 1', source: 'Kenney Interface CC0' },
    { role: 'pop', file: 'iface-pluck-002.ogg', volume: 0.15, label: 'Pluck 2', source: 'Kenney Interface CC0' },
    { role: 'pop', file: 'iface-drop-003.ogg', volume: 0.14, label: 'Drop 3', source: 'Kenney Interface CC0' },
  ],
  ding: [
    { role: 'ding', file: 'ding.wav', volume: 0.2, label: 'Ding', source: 'remotion.media' },
    { role: 'ding', file: 'snapchat-notification.wav', volume: 0.16, label: 'Notify', source: 'remotion.media' },
    { role: 'ding', file: 'iface-confirm-001.ogg', volume: 0.17, label: 'Confirm 1', source: 'Kenney Interface CC0' },
    { role: 'ding', file: 'iface-confirm-002.ogg', volume: 0.17, label: 'Confirm 2', source: 'Kenney Interface CC0' },
    { role: 'ding', file: 'iface-question-001.ogg', volume: 0.15, label: 'Question chime', source: 'Kenney Interface CC0' },
  ],
  confirm: [
    { role: 'confirm', file: 'iface-confirm-003.ogg', volume: 0.18, label: 'Confirm 3', source: 'Kenney Interface CC0' },
    { role: 'confirm', file: 'iface-confirm-004.ogg', volume: 0.18, label: 'Confirm 4', source: 'Kenney Interface CC0' },
    { role: 'confirm', file: 'ding.wav', volume: 0.18, label: 'Ding', source: 'remotion.media' },
    { role: 'confirm', file: 'iface-bong-001.ogg', volume: 0.15, label: 'Bong settle', source: 'Kenney Interface CC0' },
  ],
  open: [
    { role: 'open', file: 'iface-open-003.ogg', volume: 0.18, label: 'Open 3', source: 'Kenney Interface CC0' },
    { role: 'open', file: 'iface-open-004.ogg', volume: 0.18, label: 'Open 4', source: 'Kenney Interface CC0' },
    { role: 'open', file: 'iface-maximize-002.ogg', volume: 0.17, label: 'Maximize 2', source: 'Kenney Interface CC0' },
    { role: 'open', file: 'whoosh.wav', volume: 0.2, label: 'Whoosh', source: 'remotion.media' },
  ],
  impact: [
    { role: 'impact', file: 'dramatic-boomer.wav', volume: 0.18, label: 'Boomer', source: 'remotion.media' },
    { role: 'impact', file: 'impact-generic-000.ogg', volume: 0.16, label: 'Impact light 0', source: 'Kenney Impact CC0' },
    { role: 'impact', file: 'impact-generic-001.ogg', volume: 0.16, label: 'Impact light 1', source: 'Kenney Impact CC0' },
    { role: 'impact', file: 'impact-soft-000.ogg', volume: 0.15, label: 'Soft impact', source: 'Kenney Impact CC0' },
    { role: 'impact', file: 'impact-punch-000.ogg', volume: 0.15, label: 'Punch', source: 'Kenney Impact CC0' },
    { role: 'impact', file: 'impact-plate-000.ogg', volume: 0.15, label: 'Plate', source: 'Kenney Impact CC0' },
  ],
  sub: [
    { role: 'sub', file: 'vine-boom.wav', volume: 0.14, label: 'Sub boom', source: 'remotion.media' },
    { role: 'sub', file: 'lowboom.wav', volume: 0.14, label: 'Low boom', source: 'alias' },
    { role: 'sub', file: 'impact-soft-002.ogg', volume: 0.14, label: 'Soft sub', source: 'Kenney Impact CC0' },
    { role: 'sub', file: 'scifi-low-explosion-000.ogg', volume: 0.12, label: 'Low explode', source: 'Kenney Sci-Fi CC0' },
  ],
  paper: [
    { role: 'paper', file: 'page-turn.wav', volume: 0.22, label: 'Page turn', source: 'remotion.media' },
    { role: 'paper', file: 'iface-scroll-001.ogg', volume: 0.14, label: 'Scroll 1', source: 'Kenney Interface CC0' },
    { role: 'paper', file: 'iface-scroll-003.ogg', volume: 0.14, label: 'Scroll 3', source: 'Kenney Interface CC0' },
    { role: 'paper', file: 'iface-close-001.ogg', volume: 0.14, label: 'Close paper', source: 'Kenney Interface CC0' },
  ],
  shutter: [
    { role: 'shutter', file: 'shutter-modern.wav', volume: 0.2, label: 'Shutter modern', source: 'remotion.media' },
    { role: 'shutter', file: 'shutter-old.wav', volume: 0.18, label: 'Shutter old', source: 'remotion.media' },
    { role: 'shutter', file: 'iface-select-005.ogg', volume: 0.15, label: 'Select snap', source: 'Kenney Interface CC0' },
  ],
  scratch: [
    { role: 'scratch', file: 'record-scratch.wav', volume: 0.12, label: 'Record scratch', source: 'remotion.media' },
    { role: 'scratch', file: 'iface-scratch-002.ogg', volume: 0.12, label: 'Scratch 2', source: 'Kenney Interface CC0' },
    { role: 'scratch', file: 'iface-scratch-004.ogg', volume: 0.12, label: 'Scratch 4', source: 'Kenney Interface CC0' },
  ],
  glass: [
    { role: 'glass', file: 'iface-glass-001.ogg', volume: 0.14, label: 'Glass 1', source: 'Kenney Interface CC0' },
    { role: 'glass', file: 'iface-glass-003.ogg', volume: 0.14, label: 'Glass 3', source: 'Kenney Interface CC0' },
    { role: 'glass', file: 'impact-glass-000.ogg', volume: 0.13, label: 'Glass impact', source: 'Kenney Impact CC0' },
  ],
  laser: [
    { role: 'laser', file: 'scifi-laser-small-000.ogg', volume: 0.12, label: 'Laser small 0', source: 'Kenney Sci-Fi CC0' },
    { role: 'laser', file: 'scifi-laser-small-002.ogg', volume: 0.12, label: 'Laser small 2', source: 'Kenney Sci-Fi CC0' },
    { role: 'laser', file: 'scifi-laser-retro-000.ogg', volume: 0.12, label: 'Laser retro', source: 'Kenney Sci-Fi CC0' },
  ],
};

const SKILL_ENTER: Record<string, SfxRole> = {
  'logo-animation': 'whoosh',
  'youtube-intro-outro': 'whoosh',
  'launch-video': 'whip',
  'promo-video': 'whoosh',
  'ad-creative-video': 'whip',
  'countdown-video': 'tick',
  'text-message-animation': 'pop',
  'photo-slideshow': 'shutter',
  'whiteboard-animation': 'paper',
  'stickman-animation': 'whoosh',
  'kinetic-typography': 'snap',
  'caption-animation': 'tick',
  'product-demo-video': 'open',
  'testimonial-video': 'open',
  'wrapped-video': 'whoosh',
  'chart-animation': 'tick',
  'animated-infographic': 'snap',
  'explainer-video': 'whoosh',
  'short-form-video': 'whip',
  'beat-sync-editing': 'impact',
};

const SKILL_ACCENT: Record<string, SfxRole> = {
  'product-demo-video': 'click',
  'countdown-video': 'tick',
  'chart-animation': 'tick',
  'animated-infographic': 'snap',
  'kinetic-typography': 'snap',
  'caption-animation': 'tick',
  'text-message-animation': 'pop',
  'photo-slideshow': 'shutter',
  'whiteboard-animation': 'paper',
  'stickman-animation': 'pop',
  'explainer-video': 'click',
  'short-form-video': 'pop',
  'launch-video': 'laser',
  'promo-video': 'snap',
  'ad-creative-video': 'impact',
  'beat-sync-editing': 'impact',
};

type Density = 'sparse' | 'normal' | 'dense';

function densityFor(primary: string): Density {
  if (['short-form-video', 'launch-video', 'promo-video', 'ad-creative-video', 'beat-sync-editing', 'countdown-video'].includes(primary)) {
    return 'dense';
  }
  if (['testimonial-video', 'whiteboard-animation', 'explainer-video', 'logo-animation'].includes(primary)) {
    return 'sparse';
  }
  return 'normal';
}

const INTENT_SCALE: Record<SfxIntent, number> = {
  enter: 0.92,
  accent: 0.55, // 压在口播下
  settle: 0.72,
};

/** 片级轮换器：同文件不连用，尽量全片少重复 */
export class SfxPicker {
  private cursor = new Map<SfxRole, number>();
  private recent: string[] = [];

  pick(role: SfxRole, salt = 0): SfxAsset {
    const list = SFX_ASSETS[role] || SFX_ASSETS.whoosh;
    const start = ((this.cursor.get(role) || 0) + salt) % list.length;
    for (let i = 0; i < list.length; i++) {
      const asset = list[(start + i) % list.length];
      if (!this.recent.includes(asset.file)) {
        this.cursor.set(role, (start + i + 1) % list.length);
        this.remember(asset.file);
        return asset;
      }
    }
    const asset = list[start % list.length];
    this.cursor.set(role, (start + 1) % list.length);
    this.remember(asset.file);
    return asset;
  }

  private remember(file: string) {
    this.recent.push(file);
    if (this.recent.length > 10) this.recent.shift();
  }
}

function enterRole(opts: { skill?: string; job?: string; index: number; primary?: string }): SfxRole {
  const job = (opts.job || '').toLowerCase();
  const skill = opts.skill || '';
  const primary = opts.primary || '';
  if (job.includes('reveal') || job.includes('drop')) return 'impact';
  if (job.includes('hook') || opts.index === 0) {
    if (primary === 'launch-video' || skill === 'launch-video') return 'sub';
    return SKILL_ENTER[skill] || SKILL_ENTER[primary] || 'whoosh';
  }
  if (job.includes('logo')) return 'whoosh';
  return SKILL_ENTER[skill] || SKILL_ENTER[primary] || 'open';
}

function accentRole(opts: { skill?: string; primary?: string; keyMotion?: string }): SfxRole {
  const motion = (opts.keyMotion || '').toLowerCase();
  if (motion.includes('list') || motion.includes('bullet') || motion.includes('type')) return 'tick';
  if (motion.includes('chart') || motion.includes('bar') || motion.includes('count')) return 'tick';
  if (motion.includes('photo') || motion.includes('ken burns')) return 'shutter';
  if (motion.includes('glass') || motion.includes('shine')) return 'glass';
  const skill = opts.skill || '';
  const primary = opts.primary || '';
  return SKILL_ACCENT[skill] || SKILL_ACCENT[primary] || 'click';
}

function settleRole(opts: { job?: string; primary?: string; index: number; total: number }): SfxRole {
  const job = (opts.job || '').toLowerCase();
  if (job.includes('cta') || job.includes('end') || job.includes('settle') || opts.index === opts.total - 1) {
    return 'confirm';
  }
  if (opts.primary === 'logo-animation') return 'ding';
  return 'ding';
}

function clampAt(sec: number, durationSec: number): number {
  const max = Math.max(0, durationSec - 0.12);
  return Number(Math.min(Math.max(0, sec), max).toFixed(3));
}

function toCue(asset: SfxAsset, intent: SfxIntent, atSec: number): SfxCue {
  return {
    role: asset.role,
    intent,
    file: `sfx/${asset.file}`,
    volume: Number((asset.volume * INTENT_SCALE[intent]).toFixed(3)),
    atSec,
  };
}

/**
 * 分镜时间轴：enter + accents + settle（按片型控密度）
 * 返回 2–4 个挂点，挂在 VO/口播之下。
 */
export function buildSceneSfxTimeline(
  opts: {
    skill?: string;
    job?: string;
    index: number;
    total: number;
    primary?: string;
    durationSec: number;
    items?: string[];
    keyMotion?: string;
  },
  picker: SfxPicker = new SfxPicker(),
): SfxCue[] {
  const dur = Math.max(0.6, opts.durationSec || 1.2);
  const density = densityFor(opts.primary || '');
  const cues: SfxCue[] = [];
  const job = (opts.job || '').toLowerCase();

  // ENTER — 切点稍后一点，避免与硬切叠爆
  const enterAsset = picker.pick(enterRole(opts), opts.index);
  cues.push(toCue(enterAsset, 'enter', clampAt(0.04, dur)));

  // ACCENTS — 列表项 / 时长驱动
  const itemCount = opts.items?.filter(Boolean).length || 0;
  let accentCount = 0;
  if (density === 'dense') accentCount = Math.min(3, Math.max(1, itemCount || (dur >= 2.2 ? 2 : 1)));
  else if (density === 'normal') accentCount = itemCount >= 1 ? Math.min(2, itemCount) : dur >= 2.4 ? 1 : 0;
  else accentCount = itemCount >= 2 ? Math.min(2, itemCount) : 0;

  if (job.includes('countdown')) accentCount = Math.min(3, Math.max(accentCount, 2));

  const accentR = accentRole(opts);
  for (let a = 0; a < accentCount; a++) {
    const t = itemCount > 0
      ? 0.28 + ((a + 1) / (accentCount + 1)) * Math.min(dur * 0.72, dur - 0.35)
      : 0.35 + ((a + 1) / (accentCount + 1)) * (dur * 0.55);
    const asset = picker.pick(accentR, opts.index * 3 + a);
    cues.push(toCue(asset, 'accent', clampAt(t, dur)));
  }

  // SETTLE — CTA / 较长镜 / 密型片
  const wantSettle =
    job.includes('cta') ||
    job.includes('end') ||
    job.includes('settle') ||
    opts.index === opts.total - 1 ||
    (density === 'dense' && dur >= 1.6) ||
    (density === 'normal' && dur >= 2.8);

  if (wantSettle && dur >= 1.2) {
    const asset = picker.pick(settleRole(opts), opts.index);
    cues.push(toCue(asset, 'settle', clampAt(dur - 0.32, dur)));
  }

  // 去重时间：两挂点间隔 < 120ms 则合并掉后一个
  cues.sort((x, y) => x.atSec - y.atSec);
  const dedup: SfxCue[] = [];
  for (const c of cues) {
    const prev = dedup[dedup.length - 1];
    if (prev && Math.abs(prev.atSec - c.atSec) < 0.12) continue;
    dedup.push(c);
  }
  return dedup;
}

/** @deprecated 兼容旧单挂点 API */
export function buildSceneSfxCue(opts: {
  skill?: string;
  job?: string;
  index: number;
  total: number;
  primary?: string;
  durationSec?: number;
}): SfxCue {
  const timeline = buildSceneSfxTimeline({
    ...opts,
    durationSec: opts.durationSec ?? 2.4,
  });
  return timeline[0];
}

export function resolveSfxAsset(role: SfxRole, sceneIndex = 0): SfxAsset {
  const list = SFX_ASSETS[role] || SFX_ASSETS.whoosh;
  return list[sceneIndex % list.length] || SFX_ASSETS.whoosh[0];
}
