/**
 * 冒烟：面板 formMode 技法池 / 预算 / 旁白门闩 / 原文切句 / brand 子型
 * 不跑 LLM、不出片。
 */
import assert from 'node:assert/strict';
import {
  applyFormModeSkillBudget,
  poolForFormMode,
  resolveBrandSubtype,
} from '../make/formModePools.ts';
import { usesNarrationLayouts } from '../make/narrationLayout.ts';
import { splitCaptionBlocks } from '../make/captionBlocks.ts';
import {
  applyScriptDriveToPlan,
  assessDriveConsumption,
  assessDriveScript,
  assessDriveVisualVariety,
  DRIVE_SHOT_MAX_CHARS,
  A2E_SHOT_HARD_MAX_CHARS,
  DRIVE_SHOT_SAFETY_MAX,
  enforcePictureShotBudget,
  lockA2eBlankLineShots,
  looksLikeSpokenLineList,
  normalizeDriveLines,
  resolveDrivePack,
  shotsFromFormattedNarration,
  splitVerbatimScript,
  stripA2eCaptionPipes,
} from '../make/scriptDrive.ts';
import { localCoarseNarration } from '../make/narrationFormat.ts';
import { diversifyBeatSkills } from '../make/beatTechnique.ts';
import { assignA2eLayoutModes } from '../make/canvas/a2eModes.ts';
import {
  applyDirectorToolkit,
  detectMotifLock,
  sharpenFreeSupport,
} from '../make/directorToolkit.ts';
import { inferTechnique, isPictureMaterialBrief } from '../make/beatTechnique.ts';
import {
  assertBeatComponentCoverage,
  assertSafeGoogleFonts,
  parseTsxSyntaxIssues,
  repairJsxBareGt,
  repairMediaStaticPaths,
  repairUnsafeGoogleFonts,
} from '../make/remotionCodegen.ts';
import {
  applyStylePresetToPlan,
  getStylePreset,
  listStylePresets,
  stylePresetBriefLock,
} from '../make/stylePresets.ts';
import { reconcileStyleLook } from '../make/look.ts';
import type { SkillName } from '../llm.ts';

function smoke(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok  ${name}`);
  } catch (e) {
    console.error(`FAIL ${name}`);
    throw e;
  }
}

smoke('free: pool null, leaf cap 3, soft→brand', () => {
  const r = applyFormModeSkillBudget({
    primary: 'explainer-video',
    support: [
      'kinetic-typography',
      'diagram-animation',
      'chart-animation',
      'caption-animation',
      'particle-system',
    ] as SkillName[],
    formMode: 'prompt',
  });
  assert.equal(r.primary, 'explainer-video');
  assert.ok(r.support.length <= 3);
  assert.ok(r.brandSkills.includes('particle-system'));
  assert.equal(poolForFormMode('prompt'), null);
});

smoke('narrate/tutorial/story/launch/brand: pool null like free', () => {
  for (const mode of ['narrate', 'tutorial', 'story', 'launch', 'brand', 'logo', 'showreel'] as const) {
    assert.equal(poolForFormMode(mode, mode === 'showreel' ? 'showreel' : 'logo'), null, mode);
  }
  const r = applyFormModeSkillBudget({
    primary: 'short-form-video',
    support: [
      'kinetic-typography',
      'diagram-animation',
      'chart-animation',
      'svg-animation',
      'particle-system',
    ] as SkillName[],
    formMode: 'narrate',
  });
  // 不再改写 primary；只截 leaf + soft→brand
  assert.equal(r.primary, 'short-form-video');
  assert.ok(r.support.length <= 3);
  assert.ok(r.brandSkills.includes('particle-system'));
});

smoke('brand subtype resolve still works for UI', () => {
  assert.equal(resolveBrandSubtype('brand', 'showreel'), 'showreel');
  assert.equal(resolveBrandSubtype('brand', 'logo'), 'logo');
  const r = applyFormModeSkillBudget({
    primary: 'explainer-video',
    support: ['svg-animation', 'kinetic-typography', 'particle-system'] as SkillName[],
    formMode: 'brand',
    brandSubtype: 'logo',
  });
  assert.equal(r.primary, 'explainer-video');
  assert.equal(r.filmKind, undefined);
  assert.ok(r.support.includes('svg-animation') || r.support.includes('kinetic-typography'));
  assert.ok(r.brandSkills.includes('particle-system'));
});

smoke('remix: pool null (unchanged path)', () => {
  assert.equal(poolForFormMode('remix'), null);
});
smoke('narration layouts always off', () => {
  assert.equal(
    usesNarrationLayouts({ formMode: 'narrate', scriptDrive: 'polish', voMode: 'on' }),
    false,
  );
});

smoke('codegen=禁止BEATS钳位复用末镜（vbgv）', () => {
  const bad = `
const Beat00 = () => null; const Beat01 = () => null; const Beat02 = () => null;
const Beat03 = () => null; const Beat04 = () => null; const Beat05 = () => null;
const Beat06 = () => null; const Beat07 = () => null;
const BEATS = [Beat00, Beat01, Beat02, Beat03, Beat04, Beat05, Beat06, Beat07];
const Comp = BEATS[Math.min(index, BEATS.length - 1)];
`;
  const issues = assertBeatComponentCoverage(bad, 12);
  assert.ok(issues.some((x) => /beat clamp/i.test(x)), issues.join('; '));
  assert.ok(issues.some((x) => /beat coverage/i.test(x)), issues.join('; '));

  const ok = `
const Beat00 = () => null; const Beat01 = () => null; const Beat02 = () => null;
const Beat03 = () => null; const Beat04 = () => null; const Beat05 = () => null;
const Beat06 = () => null; const Beat07 = () => null; const Beat08 = () => null;
const Beat09 = () => null; const Beat10 = () => null; const Beat11 = () => null;
const BEATS = [Beat00, Beat01, Beat02, Beat03, Beat04, Beat05, Beat06, Beat07, Beat08, Beat09, Beat10, Beat11];
const Comp = BEATS[index];
`;
  assert.equal(assertBeatComponentCoverage(ok, 12).length, 0);
});

smoke('drive=原文切句', () => {
  const lines = splitVerbatimScript('第一句。第二句！第三句？');
  assert.ok(lines.length >= 3);
  assert.ok(lines[0].includes('第一'));
});

smoke('drive=多分镜按句切', () => {
  const many = Array.from({ length: 12 }, (_, i) => `这是第${i + 1}个要点。`).join('');
  const lines = splitVerbatimScript(many);
  assert.ok(lines.length >= 8, `got ${lines.length}`);
  assert.ok(lines[0].includes('第1') || lines[0].includes('要点'));
});

smoke('drive=a2e段落镜：长段切镜且不丢字', () => {
  const long =
    '它背后是五十多个 skill，由旁白驱动、智能化组合。你丢进去一篇文章、一个网页链接，或者一段口播稿，它会先理解内容，再判断这一段该用什么方式讲——是拆结构、做对比、画流程，还是上时间线。每个分镜自动匹配对应类型的 skill，生成配音和动画，最后连同字幕一起写进成片。';
  const { lines, issues } = normalizeDriveLines([long]);
  assert.ok(lines.length >= 2, `expected split, got ${lines.length}`);
  assert.equal(lines.join(''), long.replace(/\s+/g, ' ').trim());
  assert.ok(lines.every((l) => l.length <= DRIVE_SHOT_MAX_CHARS + 12), lines.map((l) => l.length).join(','));
  assert.ok(!issues.some((x) => /character coverage mismatch/i.test(x)));
});

smoke('drive=a2e：禁止一句一镜（过碎合并）', () => {
  const thin = Array.from({ length: 12 }, (_, i) => `这是第${i + 1}个要点。`);
  const { lines } = normalizeDriveLines(thin);
  assert.ok(lines.length <= 6, `expected merge, got ${lines.length}`);
  assert.ok(lines.length >= 3, `expected not over-merge, got ${lines.length}`);
  assert.equal(lines.join(''), thin.join(''));
});

smoke('drive=a2e空行锁镜：不经 normalize 再切', () => {
  const doc = [
    '痛点先抛出。真人出镜成本高，动画能做真人做不到的表达。',
    '',
    '这条片子由口播稿驱动。一套 skill 一键生成后再微调。',
    '',
    '成本只花 token。没有生图接口，没有积分墙。',
    '',
    '三步走完：配音、语义分镜、逐帧成片。下期见。',
  ].join('\n');
  const locked = lockA2eBlankLineShots(doc);
  assert.ok(locked, 'expected a2e lock');
  assert.equal(locked!.lines.length, 4, `got ${locked!.lines.length}`);
  const resolved = resolveDrivePack(doc);
  assert.equal(resolved.kind, 'a2e-lock');
  assert.equal(resolved.lines.length, 4);
});

smoke('drive=|字幕竖线不进朗读串', () => {
  assert.equal(stripA2eCaptionPipes('强大|但是|克制'), '强大但是克制');
  assert.equal(stripA2eCaptionPipes('powerful|but they'), 'powerful but they');
});

smoke('drive=散句/散文均走 pack（不再 polish 碎切）', () => {
  const spoken = Array.from({ length: 10 }, (_, i) => `这是第${i + 1}个口播要点，约二十字左右。`).join('\n');
  assert.equal(looksLikeSpokenLineList(spoken), true);
  assert.equal(resolveDrivePack(spoken).kind, 'pack');

  const prose =
    '做个人 IP 不想露脸，怎么办？真正有效的做法，不是找个 IP 形象替你出镜，而是让动画完成真人做不到的表达。'
    + '你看到的这条视频，就是我输入一段口播稿，由一套 skill 一键生成，再简单微调而来。'
    + '它不是单个工具，而是五十多个 skill，由旁白驱动、智能组合，适配各类口播动画。'
    + '用法很简单：输入一篇文章或一段口播稿，它会自动分析内容、拆分语义分镜，每个分镜调用不同的 skill。'
    + '成本是重点。整条流程唯一花钱的地方是大模型的 token。没有调用任何AI生图接口。';
  const resolved = resolveDrivePack(prose);
  assert.equal(resolved.kind, 'pack', resolved.issues.join('; '));
  assert.ok(resolved.lines.length >= 2 && resolved.lines.length <= DRIVE_SHOT_SAFETY_MAX);
});

smoke('drive=narration.txt：空行定镜、并过碎、无24硬顶', () => {
  const prose =
    '做个人 IP 不想露脸，怎么办？真正有效的做法，不是找个 IP 形象替你出镜，而是让动画完成真人做不到的表达。'
    + '你看到的这条视频，就是我输入一段口播稿，由一套 skill 一键生成，再简单微调而来。'
    + '它不是单个工具，而是五十多个 skill，由旁白驱动、智能组合，适配各类口播动画。'
    + '用法很简单：输入一篇文章或一段口播稿，它会自动分析内容、拆分语义分镜，每个分镜调用不同的 skill 生成配音和动画，再拼接成完整视频。'
    + '成本是重点。整条流程唯一花钱的地方是大模型的 token。没有调用任何AI生图接口，没有充值，没有积分。'
    + '单条视频最低几毛钱，五分钟左右视频平均不到一块钱。别人在烧钱抽卡，你在用 token 驱动一条稳定生产线。'
    + '核心技术路线共三步。第一步生成配音。第二步语义分镜。第三步逐帧成片。我是周什么周，下期见。';
  const narration = localCoarseNarration(prose);
  assert.ok(/\n\s*\n/.test(narration), 'local coarse must emit blank-line shots');
  const packed = shotsFromFormattedNarration(narration);
  assert.ok(packed.lines.length >= 4, `got ${packed.lines.length}`);
  assert.ok(!packed.issues.some((x) => /hard-cap 24|pairwise-merge/i.test(x)), packed.issues.join('; '));

  // 一句一镜碎料 → 只并过碎，不强制压到 24
  const micro = Array.from({ length: 31 }, (_, i) => `这是第${i + 1}个短句内容。`);
  const merged = enforcePictureShotBudget(micro);
  assert.ok(merged.length < 31, `thin-merge ${merged.length}`);
  assert.ok(!merged.some((x) => /hard-cap 24|pairwise/i.test(x)));
  assert.equal(merged.join(''), micro.join(''));

  // 长片：30 个合格空行镜不应被并顶
  const longOk = Array.from({ length: 30 }, (_, i) => (
    `第${i + 1}段先讲背景要点。然后补一句结果与动作。`
  )).join('\n\n');
  const longPacked = shotsFromFormattedNarration(longOk);
  assert.ok(longPacked.lines.length >= 28, `long film kept shots ${longPacked.lines.length}`);
  assert.ok(longPacked.lines.length <= DRIVE_SHOT_SAFETY_MAX);
});

smoke('drive=1q6u回归：墙段散文不误锁；format 后可出画面单元', () => {
  const wall =
    '做个人 IP 不想露脸，怎么办？真正有效的做法，不是找个 IP 形象替你出镜，而是让动画完成真人做不到的表达。'
    + '你看到的这条视频，就是我输入一段口播稿，由一套 skill 一键生成，再简单微调而来。'
    + '它不是单个工具，而是五十多个 skill，由旁白驱动、智能组合，适配各类口播动画。'
    + '从痛点到方法再到结果，整段一口气讲完，远超单个画面单元的字数预算。';
  assert.ok(wall.length > A2E_SHOT_HARD_MAX_CHARS, `wall ${wall.length}`);
  const doc = [
    wall,
    '',
    '用法很简单：输入一篇文章或一段口播稿，它会自动分析内容、拆分语义分镜，每个分镜调用不同的 skill 生成配音和动画，再拼接成完整视频，连同字幕一起写入成片。每个分镜还能单独二次创作。',
    '',
    '成本是重点。整条流程唯一花钱的地方是大模型的 token。没有调用任何AI生图接口，没有充值，没有积分。单条视频最低几毛钱，五分钟左右平均不到一块钱。',
    '',
    '那它如何把一个需求变成动画视频呢？核心技术路线共三步。第一步生成配音。第二步语义分镜。第三步逐帧成片。我是周什么周，下期见。',
  ].join('\n');
  assert.equal(lockA2eBlankLineShots(doc), null);
  const viaFormat = shotsFromFormattedNarration(localCoarseNarration(doc));
  assert.ok(viaFormat.lines.length >= 3);
  assert.ok(viaFormat.lines.length <= DRIVE_SHOT_SAFETY_MAX);
});

smoke('drive=邻镜同族画面软门禁', () => {
  const issues = assessDriveVisualVariety([
    { visualIntent: '产品时间轴推进', headline: '路线' },
    { visualIntent: '里程碑时间轴展开', headline: '节点' },
    { visualIntent: '硬币落下计数', headline: '成本' },
  ]);
  assert.ok(issues.some((x) => /visual family.*timeline/i.test(x)), issues.join('; '));
});

smoke('drive=步骤残缺软门禁', () => {
  const issues = assessDriveScript([
    '技术路线分五步。',
    '第一步，生成配音。',
    '第二步，语义分镜。',
    '第三步，逐帧生成。',
    '我们下期见。',
  ]);
  assert.ok(issues.some((x) => /missing step 4/i.test(x)));
  assert.ok(issues.some((x) => /missing step 5/i.test(x)));
});

smoke('drive=skill轮转不被mainTechnique压死', () => {
  const plan = applyScriptDriveToPlan(
    {
      aspect: '16:9',
      engine: 'explainer-remotion',
      primary: 'explainer-video',
      support: ['isometric-animation', 'diagram-animation'],
      brandSkills: [],
      skills: ['explainer-video', 'isometric-animation', 'diagram-animation'],
      coreIdea: 'test',
      look: {
        canvas: '#000', ink: '#fff', accent: '#0f0', muted: '#888',
        highlight: '#fff', bar: '#0f0', brandBg: '#000', energy: 'bold',
        surface: 'dark', motionNotes: '',
      },
      beats: [],
      contentLang: 'zh',
      voMode: 'on',
      formMode: 'prompt',
      mainTechnique: 'isometric-animation',
    },
    Array.from({ length: 8 }, (_, i) => ({
      job: `b${i}`,
      vo: `这是第${i + 1}句旁白内容，用来测试轮转。`,
      headline: `标题${i}`,
      visualIntent: '发光卡片推进',
      keyMotion: 'spring reveal',
      skill: 'isometric-animation' as SkillName,
    })),
    'verbatim',
  );
  const skills = plan.beats.map((b) => b.skill);
  for (let i = 1; i < skills.length; i++) {
    assert.notEqual(skills[i], skills[i - 1], `consecutive @${i}: ${skills.join(',')}`);
  }
  const uniq = new Set(skills);
  assert.ok(uniq.size >= 3, `variety ${uniq.size}: ${[...uniq].join(',')}`);
  const consume = assessDriveConsumption({ beats: plan.beats });
  assert.ok(!consume.some((x) => /consecutive same skill|dominates/i.test(x)), consume.join('; '));
});

smoke('drive=diversify打散isometric垄断', () => {
  const beats = Array.from({ length: 10 }, (_, i) => ({
    job: `b${i}`,
    vo: `旁白${i}`,
    headline: `H${i}`,
    visualIntent: '物体动作',
    keyMotion: 'enter',
    skill: 'isometric-animation' as SkillName,
  }));
  const out = diversifyBeatSkills(beats);
  const iso = out.filter((b) => b.skill === 'isometric-animation').length;
  assert.ok(iso <= 4, `iso ${iso}/10`);
  for (let i = 1; i < out.length; i++) {
    assert.notEqual(out[i].skill, out[i - 1].skill);
  }
});

smoke('caption=不拆英文 token', () => {
  const blocks = splitCaptionBlocks('就是我用一套 skill 一键生成，token 费用很低。');
  assert.ok(blocks.every((b) => !/^sk$/i.test(b.trim()) && !/^ill/i.test(b.trim())));
  assert.ok(blocks.some((b) => /skill/i.test(b)));
  assert.ok(!blocks.some((b) => /^ill/i.test(b.trim())));
});

smoke('a2e assign no-op (no layoutMode write)', () => {
  const out = assignA2eLayoutModes([
    { visualIntent: 'big number slam', job: 'hook' },
    { visualIntent: 'network graph', job: 'body' },
  ]);
  assert.equal(out[0].layoutMode, undefined);
  assert.equal(out[1].layoutMode, undefined);
});

smoke('director toolkit: population → chart main + leaf cap', () => {
  const ask = '世界人口从十亿到八十亿，曲线越来越陡';
  const sharp = sharpenFreeSupport(
    'explainer-video',
    [
      'kinetic-typography',
      'diagram-animation',
      'chart-animation',
      'whiteboard-animation',
      'animated-infographic',
      'map-animation',
    ] as SkillName[],
    [],
    ask,
  );
  assert.ok(sharp.support.length <= 3, `support ${sharp.support.join(',')}`);
  assert.equal(sharp.mainTechnique, 'chart-animation');
  assert.ok(!sharp.support.includes('map-animation'), 'map not cued');

  const plan = applyDirectorToolkit({
    primary: 'explainer-video' as SkillName,
    support: sharp.support,
    brandSkills: [],
    skills: ['explainer-video', ...sharp.support],
    coreIdea: ask,
    formMode: 'prompt',
    beats: [
      { job: 'h', vo: '1804十亿', headline: '十亿', visualIntent: '数字块升起', keyMotion: 'rise', skill: 'kinetic-typography' },
      { job: 'a', vo: '二十亿', headline: '20', visualIntent: '折线抬头', keyMotion: 'line', skill: 'whiteboard-animation' },
      { job: 'b', vo: '三十亿', headline: '30', visualIntent: '柱体弹出', keyMotion: 'bar', skill: 'diagram-animation' },
      { job: 'c', vo: '四十亿', headline: '40', visualIntent: '折线再升', keyMotion: 'line', skill: 'kinetic-typography' },
      { job: 'd', vo: '越来越陡', headline: '陡', visualIntent: '曲线近垂直', keyMotion: 'spike', skill: 'animated-infographic' },
    ],
  }, ask);
  assert.equal(plan.mainTechnique, 'chart-animation');
  const chartN = plan.beats.filter((b) => b.skill === 'chart-animation').length;
  assert.ok(chartN >= 3, `chart beats ${chartN}`);
  assert.ok((plan.beats[0].craftMust || []).length >= 3, 'deep craftMust');
});

smoke('director toolkit: motif lock', () => {
  const lock = detectMotifLock('同一页上连续演化，不要换场景', '日落散射');
  assert.ok(lock?.continuousPage);
  const plan = applyDirectorToolkit({
    primary: 'explainer-video' as SkillName,
    support: ['diagram-animation', 'kinetic-typography'] as SkillName[],
    brandSkills: [],
    skills: ['explainer-video', 'diagram-animation'],
    coreIdea: '日落散射',
    formMode: 'prompt',
    beats: [
      { job: 'a', vo: '', headline: '光', visualIntent: '光带斜贯', keyMotion: 'push', skill: 'kinetic-typography' },
      { job: 'b', vo: '', headline: '分子', visualIntent: '分子点阵', keyMotion: 'press', skill: 'diagram-animation' },
      { job: 'c', vo: '', headline: '蓝', visualIntent: '蓝光散射', keyMotion: 'spray', skill: 'diagram-animation' },
      { job: 'd', vo: '', headline: '红', visualIntent: '红光抵达', keyMotion: 'settle', skill: 'kinetic-typography' },
    ],
  }, '同一页上连续演化，不要换场景');
  assert.ok(plan.motifLock?.continuousPage);
  assert.ok(plan.beats.every((b) => /same-page/i.test(b.keyMotion || '')));
});

smoke('picture material → generative, not kinetic', () => {
  const ask = '剪纸拼贴风格，靛蓝纸夜，小男孩失眠，云捧月光，纸屑纸星轻落。20秒。';
  assert.ok(isPictureMaterialBrief(ask));
  assert.equal(inferTechnique(ask), 'generative-illustration');
  const sharp = sharpenFreeSupport(
    'explainer-video',
    ['kinetic-typography', 'diagram-animation'] as SkillName[],
    ['particle-system'] as SkillName[],
    ask,
  );
  assert.equal(sharp.mainTechnique, 'generative-illustration');
  assert.ok(sharp.support.includes('generative-illustration'));
  assert.ok(!sharp.support.includes('kinetic-typography') || sharp.support[0] === 'generative-illustration');
  const plan = applyDirectorToolkit({
    primary: 'explainer-video' as SkillName,
    support: ['kinetic-typography'] as SkillName[],
    brandSkills: ['particle-system'] as SkillName[],
    skills: ['explainer-video', 'kinetic-typography'],
    coreIdea: '剪纸夜与月光',
    formMode: 'prompt',
    beats: Array.from({ length: 6 }, (_, i) => ({
      job: `b${i}`,
      vo: '',
      headline: '夜',
      visualIntent: '剪纸层叠窗棂与云朵',
      keyMotion: '层滑入',
      skill: 'kinetic-typography',
    })),
  }, ask);
  assert.equal(plan.mainTechnique, 'generative-illustration');
  const genN = plan.beats.filter((b) => b.skill === 'generative-illustration').length;
  assert.ok(genN >= 1, `generative beats ${genN}`);
});

smoke('style presets: 8 look styles + palette-only with ref', () => {
  const list = listStylePresets();
  assert.equal(list.length, 8);
  const ids = list.map((p) => p.id).sort();
  assert.deepEqual(ids, [
    'glass-ui',
    'kinetic-type',
    'paper-cut',
    'picture-book',
    'stickman',
    'textbook-50s',
    'whiteboard',
    'woodcut',
  ].sort());
  assert.ok(list.every((p) => getStylePreset(p.id)?.mainTechnique === p.mainTechnique));
  assert.ok(/paper-cut|剪纸/i.test(stylePresetBriefLock('paper-cut')));
  assert.equal(getStylePreset('chart-led'), null);
  assert.equal(getStylePreset('infographic'), null);
  assert.equal(getStylePreset('diagram'), null);

  const base = {
    aspect: '16:9' as const,
    engine: 'explainer-remotion' as const,
    primary: 'explainer-video' as SkillName,
    support: ['kinetic-typography'] as SkillName[],
    brandSkills: [] as SkillName[],
    skills: ['explainer-video', 'kinetic-typography'] as SkillName[],
    coreIdea: 'demo',
    formMode: 'prompt',
    contentLang: 'zh' as const,
    voMode: 'off' as const,
    look: {
      canvas: '#111111',
      ink: '#FFFFFF',
      accent: '#FF0000',
      muted: '#888888',
      highlight: '#FFFFFF',
      bar: '#FF0000',
      brandBg: '#111111',
      energy: 'bold',
      surface: 'dark' as const,
      motionNotes: 'generic kinetic',
    },
    beats: Array.from({ length: 5 }, (_, i) => ({
      job: `b${i}`,
      vo: '',
      headline: '测',
      visualIntent: '卡片',
      keyMotion: '入',
      skill: 'kinetic-typography' as SkillName,
    })),
  };
  const paper = applyStylePresetToPlan(base, 'paper-cut');
  assert.equal(paper.mainTechnique, 'generative-illustration');
  assert.equal(paper.support[0], 'generative-illustration');
  assert.ok(paper.beats.some((b) => b.skill === 'generative-illustration'));
  assert.ok(/paper|剪纸|layer/i.test(paper.look.motionNotes));

  const glass = applyStylePresetToPlan(base, 'glass-ui');
  assert.equal(glass.mainTechnique, 'product-demo-video');
  assert.ok(glass.brandSkills.includes('glassmorphism'));
  assert.ok(/frost|glass/i.test(glass.look.motionNotes));

  const briefLook = paper.look;
  const refLook = {
    ...briefLook,
    canvas: '#F5F0E6',
    ink: '#1A1208',
    accent: '#C45C26',
    muted: '#A09080',
    highlight: '#FFFFFF',
    bar: '#C45C26',
    brandBg: '#F5F0E6',
    surface: 'light' as const,
    motionNotes: 'collage wipe geometric editorial — should NOT win when paletteOnly',
    energy: 'noisy',
  };
  const merged = reconcileStyleLook(briefLook, refLook, ['STYLE PRESET paper-cut'], 'launch', {
    paletteOnly: true,
  });
  assert.equal(merged.canvas, '#F5F0E6');
  assert.equal(merged.accent, '#C45C26');
  assert.ok(/paper|layer/i.test(merged.motionNotes), 'preset motionNotes kept');
  assert.ok(!/collage wipe/i.test(merged.motionNotes));
});

smoke('font: any CJK google subset → Inter+latin', () => {
  const bad = `
import { loadFont } from '@remotion/google-fonts/NotoSansSC';
const { fontFamily: ZH } = loadFont('normal', {
  weights: ['400', '500', '600', '700'],
  subsets: ['latin', 'chinese-simplified'],
});
export const ActiveDirected = () => null;
`;
  assert.ok(assertSafeGoogleFonts(bad).length >= 1);
  const fixed = repairUnsafeGoogleFonts(bad);
  assert.ok(!/@remotion\/google-fonts\/NotoSansSC/.test(fixed));
  assert.ok(!/@remotion\/google-fonts\/NotoSerifSC/.test(fixed));
  assert.ok(!/loadFont\s*\(\s*['"]normal['"]\s*,\s*\{[^}]*chinese-simplified/i.test(fixed));
  assert.ok(/@remotion\/google-fonts\/Inter/.test(fixed));
  assert.ok(/FONT_CJK_STACK/.test(fixed));
  assert.ok(/Microsoft YaHei/.test(fixed));
  assert.equal(assertSafeGoogleFonts(fixed).length, 0);
});

smoke('repair: bitshift >> 不被改成 ≫，误伤可回修', () => {
  const bit = '  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];';
  const kept = repairJsxBareGt(bit);
  assert.ok(kept.includes('>>'), kept);
  assert.ok(!/[≫≪]/.test(kept), kept);
  const broken = '  return [(n ≫ 16) & 255, (n ≫ 8) & 255, n & 255];';
  const fixed = repairJsxBareGt(broken);
  assert.equal(fixed, bit);
  assert.equal(parseTsxSyntaxIssues(`const x = 1;\n${fixed}\n`).length, 0);
  const text = '  Step A >> Step B';
  const jsxText = repairJsxBareGt(text);
  assert.ok(jsxText.includes('≫'), jsxText);
  assert.ok(!/>>/.test(jsxText), jsxText);
});

smoke('repair: vo-*.mp3 不进 assets/', () => {
  const bad = `const assetSrc = (f: string) => staticFile(f.includes('/') ? f : \`assets/\${f}\`);
{narration ? <Audio src={assetSrc(narration)} /> : null}`;
  const fixed = repairMediaStaticPaths(bad);
  assert.ok(/vo-\\d\|narration/.test(fixed) || /\^\(vo-/.test(fixed), fixed);
  assert.ok(!/f\.includes\(['"]\/['"]\)\s*\?\s*f\s*:\s*`assets/.test(fixed), fixed);
});

console.log('\nsmokeFormModes: all passed');
