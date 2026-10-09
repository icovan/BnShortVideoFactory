/**
 * 工作台创作进度：步骤标题已有 studio.steps.*；
 * 描述默认值 + 引擎运行时中文 detail → 按界面语言显示。
 */
import type { TFunction } from 'i18next'

type StepLike = { id: string; label?: string; detail?: string; status?: string }

/** remakePipeline 的中文 label，用于区分默认描述 */
const REMAKE_LABELS = new Set(['改分镜', '定风格', '更新旁白', '重画画面', '检查画面', '质量验收', '导出成片'])

export function stepDetailKey(s: StepLike): string | null {
  if (s.label && REMAKE_LABELS.has(s.label)) {
    const remake: Record<string, string> = {
      plan: 'studio.stepDetails.planRemake',
      brief: 'studio.stepDetails.briefRemake',
      voice: 'studio.stepDetails.voiceRemake',
      build: 'studio.stepDetails.buildRemake',
      stills: 'studio.stepDetails.stills',
      inspect: 'studio.stepDetails.inspectRemake',
      encode: 'studio.stepDetails.encodeRemake',
    }
    return remake[s.id] || null
  }
  const key = `studio.stepDetails.${s.id}`
  return key
}

/** 引擎初始中文 seed（与 pipeline.ts 对齐）→ i18n key */
const SEED_TO_KEY: Record<string, string> = {
  '润色提示词并规划分镜': 'studio.stepDetails.plan',
  '锁定画布与视觉调性': 'studio.stepDetails.brief',
  '有旁白则配音；无旁白则准备音轨': 'studio.stepDetails.voice',
  '按分镜生成动画': 'studio.stepDetails.build',
  '抽帧预览关键镜头': 'studio.stepDetails.stills',
  '确认画面与结构达标': 'studio.stepDetails.inspect',
  '合成最终视频': 'studio.stepDetails.encode',
  '规划短视频节奏': 'studio.stepDetails.plan',
  '锁定竖屏视觉': 'studio.stepDetails.brief',
  '确认节奏与可读性': 'studio.stepDetails.inspect',
  '规划发布片节奏': 'studio.stepDetails.plan',
  '锁定视觉与音轨': 'studio.stepDetails.brief',
  '确认节奏与卖点': 'studio.stepDetails.inspect',
  '规划解说分镜': 'studio.stepDetails.plan',
  '旁白与字幕对齐': 'studio.stepDetails.voice',
  '确认讲解清晰可读': 'studio.stepDetails.inspect',
  '按你的意见改所选镜头': 'studio.stepDetails.planRemake',
  '沿用当前成片风格': 'studio.stepDetails.briefRemake',
  '有改动则重配所选镜': 'studio.stepDetails.voiceRemake',
  '按新分镜生成动画': 'studio.stepDetails.buildRemake',
  '确认改动达标': 'studio.stepDetails.inspectRemake',
  '合成新版本': 'studio.stepDetails.encodeRemake',
  '口播硬锁 / 合成旁白': 'studio.stepDetails.planRemix',
  '扫描分镜素材库': 'studio.stepDetails.briefRemix',
  'EdgeTTS 按句配音': 'studio.stepDetails.voiceRemix',
  '切素材 + 字幕成片': 'studio.stepDetails.encodeRemix',
  'construct() · MathTex': 'studio.stepDetails.scene',
  'manim -sql': 'studio.stepDetails.stillsManim',
  'manim -qh + probe': 'studio.stepDetails.encodeManim',
}

type LiveRule = { re: RegExp; key: string; params?: (m: RegExpMatchArray) => Record<string, string | number> }

const LIVE_RULES: LiveRule[] = [
  { re: /^静默润色 · 双轨提示词$/, key: 'studio.stepLive.densify' },
  { re: /^网页检索…$/, key: 'studio.stepLive.webSearch' },
  { re: /^读网页 · (\d+) 链$/, key: 'studio.stepLive.urlExtract', params: (m) => ({ n: Number(m[1]) }) },
  { re: /^旁白驱动 · (\w+)$/, key: 'studio.stepLive.scriptDrive', params: (m) => ({ mode: m[1] }) },
  { re: /^旁白锁定 · (\d+) 句$/, key: 'studio.stepLive.scriptLocked', params: (m) => ({ n: Number(m[1]) }) },
  { re: /^旁白合成 · 无文稿$/, key: 'studio.stepLive.scriptSynth' },
  { re: /^旁白锁定 · 合成 (\d+) 句$/, key: 'studio.stepLive.scriptSynthLocked', params: (m) => ({ n: Number(m[1]) }) },
  { re: /^设计参考 → look$/, key: 'studio.stepLive.styleLook' },
  { re: /^跳过空旁白 · 镜长按分镜$/, key: 'studio.stepLive.skipEmptyVo' },
  { re: /^业务口播文案$/, key: 'studio.stepLive.remixCopy' },
  { re: /^口播 (\d+) 句$/, key: 'studio.stepLive.remixVoLines', params: (m) => ({ n: Number(m[1]) }) },
  { re: /^素材 (\d+) 条$/, key: 'studio.stepLive.remixFootage', params: (m) => ({ n: Number(m[1]) }) },
  { re: /^(\d+) 条可用$/, key: 'studio.stepLive.remixFootageReady', params: (m) => ({ n: Number(m[1]) }) },
  { re: /^切素材…$/, key: 'studio.stepLive.remixCutting' },
  { re: /^FFmpeg · (\d+) 段$/, key: 'studio.stepLive.remixFfmpeg', params: (m) => ({ n: Number(m[1]) }) },
  { re: /^改 (\d+) 镜$/, key: 'studio.stepLive.remakeBeats', params: (m) => ({ n: Number(m[1]) }) },
  { re: /^已改 (\d+) 镜 · (.+)$/, key: 'studio.stepLive.remakeBeatsDone', params: (m) => ({ n: Number(m[1]), mode: m[2] }) },
  { re: /^刷新色板$/, key: 'studio.stepLive.refreshPalette' },
  { re: /^更新旁白$/, key: 'studio.stepLive.updateVo' },
  { re: /^重配 (\d+) 镜旁白$/, key: 'studio.stepLive.reVo', params: (m) => ({ n: Number(m[1]) }) },
  { re: /^旁白未改$/, key: 'studio.stepLive.voUnchanged' },
  { re: /^成片文件解锁后复制$/, key: 'studio.stepLive.copyWhenUnlocked' },
  { re: /^docs · (.+)$/, key: 'studio.stepLive.docs', params: (m) => ({ info: m[1] }) },
  { re: /^网页检索 · (.+)$/, key: 'studio.stepLive.webSearchInfo', params: (m) => ({ info: m[1] }) },
  {
    re: /^双轨就绪 · (.+)$/,
    key: 'studio.stepLive.dualReady',
    params: (m) => ({ info: m[1] }),
  },
  {
    re: /^primary (.+)$/,
    key: 'studio.stepLive.primaryDone',
    params: (m) => ({ info: m[1] }),
  },
]

export function localizeStepDetail(
  s: StepLike,
  t: TFunction,
  exists: (key: string) => boolean,
): string {
  const detail = (s.detail || '').trim()
  const seedKey = detail ? SEED_TO_KEY[detail] : null
  const idleKey = seedKey || stepDetailKey(s)

  // 等待中 / 空描述：用界面语言默认句（优先按引擎 seed 精确映射）
  if (s.status === 'pending' || !detail) {
    if (idleKey && exists(idleKey)) return String(t(idleKey))
    return detail
  }

  // 仍是初始 seed：换成本地化默认句
  if (seedKey && exists(seedKey)) {
    return String(t(seedKey))
  }

  for (const rule of LIVE_RULES) {
    const m = detail.match(rule.re)
    if (m && exists(rule.key)) {
      return String(t(rule.key, rule.params?.(m) || {}))
    }
  }

  // 已是英文/技术串（codegen · …、TTS 1/8）原样展示
  return detail
}
