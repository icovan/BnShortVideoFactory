/**
 * 创作面板「口播」三态 → 内部 voMode + scriptDrive
 * 关 / 自动 / 驱动 —— 不换画面管线，只决定旁白从哪来
 */
import type { VoMode } from './contentLang.ts';
import type { ScriptDriveMode } from './scriptDrive.ts';

export type VoiceOverUi = 'off' | 'auto' | 'drive';

export function isVoiceOverUi(v: unknown): v is VoiceOverUi {
  return v === 'off' || v === 'auto' || v === 'drive';
}

/** 把 legacy voMode+scriptDrive 合成口播三态（兼容旧客户端） */
export function coalesceVoiceOver(opts: {
  voiceOver?: unknown;
  voMode?: unknown;
  scriptDrive?: unknown;
}): VoiceOverUi {
  if (isVoiceOverUi(opts.voiceOver)) return opts.voiceOver;
  if (opts.voMode === 'off') return 'off';
  // 旧「旁白驱动」开 → 驱动
  if (
    opts.scriptDrive === 'polish'
    || opts.scriptDrive === 'verbatim'
    || (opts.scriptDrive === 'auto' && opts.voMode === 'on')
  ) {
    // auto+on 在旧 UI 里常=有文稿才驱动；无明确 drive 时偏「自动」
    if (opts.scriptDrive === 'polish' || opts.scriptDrive === 'verbatim') return 'drive';
  }
  if (opts.voMode === 'on' || opts.voMode === 'auto') return 'auto';
  if (opts.scriptDrive === 'off' && opts.voMode !== 'on') return 'off';
  return 'auto';
}

/**
 * 口播三态 → 管线开关（drive 在无文稿时由调用方拦截）。
 * drive：fromPrompt 先 formatToNarrationTxt → 空行=画面单元（不开 NarrationFilm）。
 */
export function mapVoiceOver(ui: VoiceOverUi): {
  voMode: VoMode;
  scriptDrive: ScriptDriveMode;
} {
  if (ui === 'off') return { voMode: 'off', scriptDrive: 'off' };
  if (ui === 'drive') return { voMode: 'on', scriptDrive: 'polish' };
  // 自动：需要旁白，但不用文稿硬锁（从需求策划 narration.txt）
  return { voMode: 'on', scriptDrive: 'off' };
}
