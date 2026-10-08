import type { Settings } from '../../../shared/src/index.ts';

/** Audience-facing language for VO + on-screen copy. Machine brief stays English. */
export type ContentLang = 'zh' | 'en' | 'bilingual';

const BILINGUAL_RE =
  /双语|中英|英中|中英文|bilingual|zh\s*[\+/&]\s*en|en\s*[\+/&]\s*zh|chinese\s+and\s+english|english\s+and\s+chinese/i;
const FORCE_ZH_RE = /纯中文|只要中文|全中文|中文口播|chinese\s*only|mandarin\s*only/i;
const FORCE_EN_RE = /纯英文|只要英文|全英文|english\s*only|英文口播/i;

const DEFAULT_ZH_VOICE = 'zh-CN-YunxiNeural';
const DEFAULT_EN_VOICE = 'en-US-JennyNeural';

/**
 * Strip English factory packing lines appended by the create UI so they don't
 * skew audience language detection toward `en`.
 */
export function stripFactoryPackLines(prompt: string): string {
  return (prompt || '')
    .split('\n')
    .filter((line) => {
      const t = line.trim();
      if (!t) return true;
      if (/^形态[：:]/.test(t) || /^形态倾向/.test(t)) return false;
      if (/^(Form|Form mode|Morphology)\b/i.test(t)) return false;
      if (
        /^(Design reference|Screen assets|User music|Source docs|Web search|URL extract|Auto SFX|No voice-over|Voice-over required|Script-drive)\b/i.test(
          t,
        )
      ) {
        return false;
      }
      return true;
    })
    .join('\n');
}

/** Detect audience language from the raw user ask (before English factory brief). */
export function detectContentLang(ask: string): ContentLang {
  const t = stripFactoryPackLines(ask || '').trim();
  if (!t) return 'zh';
  if (BILINGUAL_RE.test(t)) return 'bilingual';
  if (FORCE_ZH_RE.test(t)) return 'zh';
  if (FORCE_EN_RE.test(t)) return 'en';

  const cjk = (t.match(/[\u4e00-\u9fff]/g) || []).length;
  const latin = (t.match(/[A-Za-z]/g) || []).length;
  if (cjk === 0 && latin === 0) return 'zh';
  if (cjk === 0) return 'en';
  if (latin === 0) return 'zh';
  // Mixed ask without explicit bilingual → follow majority script
  return cjk >= latin * 0.35 ? 'zh' : 'en';
}

export function isContentLang(v: unknown): v is ContentLang {
  return v === 'zh' || v === 'en' || v === 'bilingual';
}

/**
 * Audience language is locked to the raw user ask.
 * LLM "guess" is ignored — only script detection + explicit force phrases win.
 */
export function resolveContentLang(opts: {
  ask: string;
  guessed?: unknown;
}): ContentLang {
  void opts.guessed;
  return detectContentLang(opts.ask);
}

export type VoMode = 'on' | 'off' | 'auto';

export function isVoMode(v: unknown): v is VoMode {
  return v === 'on' || v === 'off' || v === 'auto';
}

/** Infer from ask when UI sends auto. */
export function detectVoMode(ask: string): VoMode {
  const t = ask || '';
  if (/无旁白|不要旁白|别配音|无需旁白|no[\s-]?vo|no[\s-]?voice(?:over)?|music[\s-]?led|music[\s-]?driven|caption[\s-]?driven/i.test(t)) {
    return 'off';
  }
  if (/要旁白|需要旁白|口播|配音|解说|voice[\s-]?over|\bvo\b|narrat/i.test(t)) {
    return 'on';
  }
  return 'auto';
}

/** Primary default when still auto after detect. */
export function resolveVoMode(opts: {
  ask: string;
  uiMode?: unknown;
  primary?: string;
}): VoMode {
  if (isVoMode(opts.uiMode) && opts.uiMode !== 'auto') return opts.uiMode;
  const fromAsk = detectVoMode(opts.ask);
  if (fromAsk !== 'auto') return fromAsk;
  const p = opts.primary || '';
  if (
    p === 'stickman-animation'
    || p === 'launch-video'
    || p === 'short-form-video'
    || p === 'promo-video'
    || p === 'ad-creative-video'
    || p === 'logo-animation'
    || p === 'countdown-video'
  ) {
    return 'off';
  }
  if (p === 'explainer-video' || p === 'presentation-video' || p === 'whiteboard-animation') {
    return 'on';
  }
  return 'auto';
}

function cjkCount(s: string) {
  return (s.match(/[\u4e00-\u9fff]/g) || []).length;
}
function latinCount(s: string) {
  return (s.match(/[A-Za-z]/g) || []).length;
}

/** True if text is clearly the wrong script for contentLang (long enough to matter). */
export function textLangMismatch(text: string, contentLang: ContentLang): boolean {
  const t = (text || '').trim();
  if (t.length < 4) return false;
  const cjk = cjkCount(t);
  const latin = latinCount(t);
  if (contentLang === 'en') return cjk >= 2 && cjk > latin * 0.5;
  if (contentLang === 'zh') return latin >= 8 && cjk === 0;
  return false;
}

/** Primary spoken language for TTS (bilingual → Chinese VO by default for CN shorts). */
export function voLangOf(contentLang: ContentLang): 'zh' | 'en' {
  return contentLang === 'en' ? 'en' : 'zh';
}

export function resolveEdgeVoice(settings: Settings, contentLang: ContentLang): string {
  const raw = (settings.speechVoice || '').trim();
  // Clone / custom voices: never auto-swap
  if (raw.startsWith('my:')) return raw;

  const want = voLangOf(contentLang);
  if (want === 'en') {
    if (/^en-[A-Za-z]{2}-/.test(raw) && /Neural/.test(raw)) return raw;
    return DEFAULT_EN_VOICE;
  }
  if (/^zh-(CN|TW|HK)-/.test(raw) && /Neural/.test(raw)) return raw;
  return DEFAULT_ZH_VOICE;
}

/** Inject into codegen / plan prompts — audience lock, not machine brief language. */
export function contentLangLockLine(contentLang: ContentLang): string {
  if (contentLang === 'en') {
    return [
      'CONTENT LANG LOCK: en',
      '- VO lines: English only.',
      '- On-screen headlines / captions / CTAs: English only.',
      '- Do NOT add Chinese characters on screen or in VO.',
      '- Do NOT use BilingualTitle; use a single English title component.',
    ].join('\n');
  }
  if (contentLang === 'bilingual') {
    return [
      'CONTENT LANG LOCK: bilingual',
      '- VO lines: Simplified Chinese (primary).',
      '- On-screen: Chinese main title + short English sublabel allowed (e.g. BilingualTitle).',
      '- Do not invent a third language. Keep English labels short (1–4 words).',
    ].join('\n');
  }
  return [
    'CONTENT LANG LOCK: zh',
    '- VO lines: Simplified Chinese only.',
    '- On-screen headlines / captions / CTAs: Simplified Chinese only.',
    '- English allowed ONLY for proper nouns / brand marks the user already gave.',
    '- Do NOT default to BilingualTitle; prefer single Chinese title / CaptionPill.',
  ].join('\n');
}

export function planLanguageRules(contentLang: ContentLang): string {
  if (contentLang === 'en') {
    return `LANGUAGE (LOCKED en): Every beat.vo and beat.headline MUST be English. beat.line optional English sub. No Chinese glyphs.`;
  }
  if (contentLang === 'bilingual') {
    return `LANGUAGE (LOCKED bilingual): beat.vo = Simplified Chinese. beat.headline = Chinese. beat.line = short English sublabel (1–4 words) when useful.`;
  }
  return `LANGUAGE (LOCKED zh): Every beat.vo and beat.headline MUST be Simplified Chinese. No English sentences on screen unless a proper noun from the brief.`;
}
