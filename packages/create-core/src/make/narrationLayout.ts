/**
 * Narration films bind each spoken line to a hand-written layout.
 * The model picks the layout and the object. It does not draw the pixels.
 */

export const NARRATION_LAYOUTS = [
  'object',
  'deck',
  'type',
  'flow',
  'bars',
  'ink',
  'route',
  'iso',
  'chat',
  'device',
  'price',
] as const;

export type NarrationLayoutId = (typeof NARRATION_LAYOUTS)[number];

export const GLYPH_IDS = [
  'brush',
  'frame',
  'dice',
  'gear',
  'coin',
  'card',
  'block',
  'hand',
  'doc',
  'question',
  'cursor',
  'tag',
  'clock',
  'fork',
  'prop',
] as const;

export type GlyphId = (typeof GLYPH_IDS)[number];

const GLYPH_RULES: Array<[GlyphId, RegExp]> = [
  ['brush', /画笔|毛笔|brush|\bpen\b/i],
  ['frame', /画框|相框|空框|\bframe\b/i],
  ['dice', /骰子|色子|\bdice\b/i],
  ['gear', /齿轮|\bgear\b|\bcog\b/i],
  ['coin', /硬币|金币|\bcoin\b|两毛|成本|一块钱/i],
  ['card', /卡片|名片|\bcard\b/i],
  ['block', /方块|积木|木块|\bblock\b/i],
  ['hand', /一只手|拖动|手指|挥动|\bhand\b/i],
  ['doc', /文档|文稿|稿纸|文件|文章|口播稿|\bdocument\b/i],
  ['question', /问号|怎么办|\bquestion\b/i],
  ['cursor', /光标|鼠标|\bcursor\b|\bpointer\b/i],
  ['tag', /标签|铭牌|贴纸|署名|\btag\b/i],
  ['clock', /时间轴|钟面|时钟|时长|\bclock\b|\btimeline\b/i],
  ['fork', /分叉|岔路/],
];

export type NarrationBeatRef = {
  skill?: string;
  visualIntent?: string;
  keyMotion?: string;
  headline?: string;
  items?: string[];
  vo?: string;
};

function hayOf(beat: NarrationBeatRef): string {
  return `${beat.visualIntent || ''} ${beat.keyMotion || ''} ${beat.headline || ''} ${beat.vo || ''}`;
}

export function labelsFromBeat(beat: NarrationBeatRef, n = 4): string[] {
  if (beat.items?.length) {
    return beat.items.map((s) => s.trim()).filter((s) => s.length > 0 && s.length <= 10).slice(0, n);
  }
  const intent = beat.visualIntent || '';
  const quoted = [...intent.matchAll(/「([^」]{1,8})」/g)].map((m) => m[1]);
  if (quoted.length >= 2) return quoted.slice(0, n);
  const parts = intent
    .split(/[，、；;·]/)
    .map((s) => s.replace(/画面主体是|短标题放在物体外面|及其动作|这句里的一个物体|：/g, '').trim())
    .filter((s) => s.length >= 2 && s.length <= 10)
    .slice(0, n);
  if (parts.length >= 2) return parts;
  const head = (beat.headline || '').trim();
  return head ? [head.slice(0, 8), ...parts].filter(Boolean).slice(0, n) : parts;
}

/** Layout follows the sentence's object. A diagram skill does not force a node graph. */
export function pickNarrationLayout(beat: NarrationBeatRef): NarrationLayoutId {
  const hay = hayOf(beat);
  if (/地图|航线|海岸|路线图|航线图|城市之间|\broute\b|\bmap\b|coastline|marker/i.test(hay)) {
    return 'route';
  }
  if (/等距|轴测|三面墙|工位|isometric/i.test(hay)) return 'iso';
  if (/聊天气泡|对话框|气泡|微信|短信|\bchat\b/i.test(hay)) return 'chat';
  if (/价格|划价|折扣|标价|￥|\$\s?\d|被划掉|两毛|一块钱/.test(hay)) return 'price';
  if (/光标|界面|屏幕|播放器|输入框|窗口|预览|发布|\bcursor\b|\bscreen\b/i.test(hay)) {
    return 'device';
  }
  if (/柱状|数据条|百分比|图表|柱图|折线|\bchart\b|%/.test(hay)) return 'bars';
  if (/白板|手绘线|墨线|粉笔|whiteboard/i.test(hay)) return 'ink';
  if (/节点|连线|流程图|模块|五个模块|流水线/.test(hay)) return 'flow';
  if (/卡片|幻灯|分镜|草稿|缩略|deck|slide/i.test(hay)) return 'deck';
  if (/路径分叉|岔路|分叉/.test(hay)) return 'route';
  const intent = (beat.visualIntent || '').trim();
  const wordsOnly = intent.length < 8
    || /只有字|大字|words only|标题本身/i.test(hay)
    || /^illustrate\s*:/i.test(intent);
  if (beat.skill === 'kinetic-typography' && wordsOnly) return 'type';
  if (beat.skill === 'kinetic-typography' && /署名|告别|下期见/.test(hay)) return 'type';
  return 'object';
}

export function glyphsFor(text: string): GlyphId[] {
  const found: GlyphId[] = [];
  for (const [id, re] of GLYPH_RULES) {
    if (re.test(text) && !found.includes(id)) found.push(id);
  }
  return found.slice(0, 2);
}

export function bindNarrationScene(beat: NarrationBeatRef): {
  layout: NarrationLayoutId;
  glyphs: GlyphId[];
  items?: string[];
} {
  const glyphs = glyphsFor(hayOf(beat));
  const labels = labelsFromBeat(beat, 4);
  return {
    layout: pickNarrationLayout(beat),
    glyphs: glyphs.length ? glyphs : ['prop'],
    ...(labels.length >= 2 ? { items: labels } : {}),
  };
}

/**
 * 旁白版式（NarrationFilm）仅「口播解说」快捷形态。
 * 自由创作（prompt / 未指定）即使 scriptDrive=polish|verbatim，也只锁旁白文案，
 * 画面走 skill codegen（对齐 Agent：附件 + 需求 + 开关自由组合）。
 */
export function usesNarrationLayouts(_plan: {
  scriptDrive?: string;
  voMode?: string;
  primary?: string;
  /** UI 形态：prompt=自由；六类内容均走自由 codegen */
  formMode?: string;
}): boolean {
  // 解说/教程等也走自由 codegen + 技法池；旁白固定版式门闩永久关闭
  return false;
}

export function narrationLayoutIssues(
  tsx: string,
  scenes: Array<{ layout?: string }>,
): string[] {
  const issues: string[] = [];
  if (!/narration-layout/.test(tsx)) issues.push('narration layout marker missing');
  if (!/NarrationFilm/.test(tsx)) issues.push('NarrationFilm is not on screen');
  if (!/export\s+(const|function)\s+ActiveDirected/.test(tsx)) issues.push('must export ActiveDirected');
  scenes.forEach((scene, i) => {
    if (!scene.layout || !(NARRATION_LAYOUTS as readonly string[]).includes(scene.layout)) {
      issues.push(`scene ${i} has no narration layout`);
    }
  });
  return issues;
}

/** Clock + audio only. Pictures live in NarrationFilm. */
export function composeNarrationDirectedSource(): string {
  return `import React from 'react';
import {
  AbsoluteFill, Audio, Sequence, Series, staticFile, useVideoConfig,
} from 'remotion';
import type { DirectedProps } from '../directedSchema';
import { NarrationFilm } from '../narration/NarrationFilm';

/**
 * narration-layout
 * Each spoken line instantiates one hand-written full-frame layout.
 * scene.layout chooses the picture. scene.glyphs names the object.
 * NarrationFilm fills the frame (title strip + hero well + side detail),
 * with three motion beats across ~20% / 50% / 80% of the line.
 * This file does not invent a second drawing.
 */
export const ActiveDirected: React.FC<DirectedProps> = (props) => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: props.canvas }}>
      {props.musicFile ? <Audio src={staticFile(props.musicFile)} volume={0.22} /> : null}
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
            <Series.Sequence key={i} durationInFrames={dur}>
              {scene.narrationFile ? <Audio src={staticFile(scene.narrationFile)} /> : null}
              {cues.map((cue, j) => (
                <Sequence key={j} from={Math.max(0, Math.round((cue.atSec || 0) * fps))} layout="none">
                  <Audio src={staticFile(cue.file)} volume={cue.volume ?? 0.18} />
                </Sequence>
              ))}
              <NarrationFilm scene={scene} film={props} />
            </Series.Sequence>
          );
        })}
      </Series>
    </AbsoluteFill>
  );
};
`;
}
