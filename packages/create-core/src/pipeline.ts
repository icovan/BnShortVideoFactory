import type { Engine, PipelineStep, StylePack } from '../../shared/src/index.ts';
import { store } from './store.ts';
import { commerce } from './commerce/repo.ts';
import { entitlement } from './license/entitlement.ts';

/** 成片后再创作（单镜/多镜重做） */
export function remakePipeline(): PipelineStep[] {
  return [
    { id: 'plan', label: '改分镜', status: 'pending', detail: '按你的意见改所选镜头' },
    { id: 'brief', label: '定风格', status: 'pending', detail: '沿用当前成片风格' },
    { id: 'voice', label: '更新旁白', status: 'pending', detail: '有改动则重配所选镜' },
    { id: 'build', label: '重画画面', status: 'pending', detail: '按新分镜生成动画' },
    { id: 'stills', label: '检查画面', status: 'pending', detail: '抽帧预览关键镜头' },
    { id: 'inspect', label: '质量验收', status: 'pending', detail: '确认改动达标' },
    { id: 'encode', label: '导出成片', status: 'pending', detail: '合成新版本' },
  ];
}

export function initialPipeline(engine: Engine, stylePack?: StylePack): PipelineStep[] {
  if (engine === 'manim') {
    return [
      { id: 'scene', label: '写 Scene', status: 'pending', detail: 'construct() · MathTex' },
      { id: 'stills', label: '验帧', status: 'pending', detail: 'manim -sql' },
      { id: 'encode', label: '成片', status: 'pending', detail: 'manim -qh + probe' },
    ];
  }
  if (engine === 'footage-remix' || stylePack === 'footage-remix') {
    return [
      { id: 'plan', label: '整理文案', status: 'pending', detail: '混剪口播文案' },
      { id: 'brief', label: '选素材', status: 'pending', detail: '分镜素材文件夹' },
      { id: 'voice', label: '配音', status: 'pending', detail: 'EdgeTTS' },
      { id: 'encode', label: 'FFmpeg 合成', status: 'pending', detail: '本机混剪台导出' },
    ];
  }
  if (stylePack === 'skill-directed' || !stylePack) {
    return [
      { id: 'plan', label: '整理需求', status: 'pending', detail: '润色提示词并规划分镜' },
      { id: 'brief', label: '定风格', status: 'pending', detail: '锁定画布与视觉调性' },
      { id: 'voice', label: '生成旁白', status: 'pending', detail: '有旁白则配音；无旁白则准备音轨' },
      { id: 'build', label: '生成画面', status: 'pending', detail: '按分镜生成动画' },
      { id: 'stills', label: '检查画面', status: 'pending', detail: '抽帧预览关键镜头' },
      { id: 'inspect', label: '质量验收', status: 'pending', detail: '确认画面与结构达标' },
      { id: 'encode', label: '导出成片', status: 'pending', detail: '合成最终视频' },
    ];
  }
  if (stylePack === 'next-word-loop') {
    return [
      { id: 'plan', label: '整理需求', status: 'pending', detail: '规划短视频节奏' },
      { id: 'brief', label: '定风格', status: 'pending', detail: '锁定竖屏视觉' },
      { id: 'voice', label: '生成旁白', status: 'pending', detail: '有旁白则配音；无旁白则准备音轨' },
      { id: 'build', label: '生成画面', status: 'pending', detail: '按分镜生成动画' },
      { id: 'stills', label: '检查画面', status: 'pending', detail: '抽帧预览关键镜头' },
      { id: 'inspect', label: '质量验收', status: 'pending', detail: '确认节奏与可读性' },
      { id: 'encode', label: '导出成片', status: 'pending', detail: '合成最终视频' },
    ];
  }
  if (stylePack === 'launch-showreel') {
    return [
      { id: 'plan', label: '整理需求', status: 'pending', detail: '规划发布片节奏' },
      { id: 'brief', label: '定风格', status: 'pending', detail: '锁定视觉与音轨' },
      { id: 'voice', label: '生成旁白', status: 'pending', detail: '有旁白则配音；无旁白则准备音轨' },
      { id: 'build', label: '生成画面', status: 'pending', detail: '按分镜生成动画' },
      { id: 'stills', label: '检查画面', status: 'pending', detail: '抽帧预览关键镜头' },
      { id: 'inspect', label: '质量验收', status: 'pending', detail: '确认节奏与卖点' },
      { id: 'encode', label: '导出成片', status: 'pending', detail: '合成最终视频' },
    ];
  }
  return [
    { id: 'plan', label: '整理需求', status: 'pending', detail: '规划解说分镜' },
    { id: 'brief', label: '定风格', status: 'pending', detail: '锁定画布与视觉调性' },
    { id: 'voice', label: '生成旁白', status: 'pending', detail: '旁白与字幕对齐' },
    { id: 'build', label: '生成画面', status: 'pending', detail: '按分镜生成动画' },
    { id: 'stills', label: '检查画面', status: 'pending', detail: '抽帧预览关键镜头' },
    { id: 'inspect', label: '质量验收', status: 'pending', detail: '确认讲解清晰可读' },
    { id: 'encode', label: '导出成片', status: 'pending', detail: '合成最终视频' },
  ];
}

/** 按最终路由重置管线，避免创建时模板引擎污染后续步骤 */
export function resetPipeline(
  projectId: string,
  engine: Engine,
  stylePack?: StylePack,
  patch?: Parameters<typeof store.patchProject>[1],
) {
  return store.patchProject(projectId, {
    ...patch,
    engine,
    stylePack: stylePack || (engine === 'manim' ? undefined : 'skill-directed'),
    pipeline: initialPipeline(engine, stylePack || 'skill-directed'),
    status: 'running',
    error: undefined,
  });
}

export function setPipelineStep(
  projectId: string,
  stepId: string,
  status: PipelineStep['status'],
  detail?: string,
) {
  const cur = store.getProject(projectId);
  if (!cur?.pipeline?.length) return null;
  // 步骤 id 对不上（例如曾被模板写成 manim 管线）时，先按当前引擎重置
  if (!cur.pipeline.some((s) => s.id === stepId)) {
    const engine = cur.engine === 'manim' ? 'manim' : 'explainer-remotion';
    const stylePack = cur.stylePack || 'skill-directed';
    resetPipeline(projectId, engine, stylePack);
  }
  const fresh = store.getProject(projectId);
  if (!fresh?.pipeline?.length) return null;
  const pipeline = fresh.pipeline.map((s) => {
    if (s.id !== stepId) {
      // 进入新步骤时，把之前 running 收成 done
      if (status === 'running' && s.status === 'running') return { ...s, status: 'done' as const };
      return s;
    }
    return { ...s, status, detail: detail ?? s.detail };
  });
  return store.patchProject(projectId, { pipeline, status: 'running' });
}

export function finishPipeline(projectId: string, patch: Parameters<typeof store.patchProject>[1]) {
  const cur = store.getProject(projectId);
  const pipeline = (cur?.pipeline || []).map((s) => (
    s.status === 'pending' || s.status === 'running' ? { ...s, status: 'done' as const } : s
  ));
  entitlement.commitMake(projectId);
  return store.patchProject(projectId, { ...patch, pipeline, status: 'ready', error: undefined });
}

export function failPipeline(projectId: string, error: string) {
  const cur = store.getProject(projectId);
  const pipeline = (cur?.pipeline || []).map((s) => (
    s.status === 'running' ? { ...s, status: 'pending' as const, detail: error.slice(0, 120) } : s
  ));
  const done = store.patchProject(projectId, { status: 'error', error, pipeline });
  entitlement.refundMake(projectId);
  if (cur?.userId) commerce.refundQuota(cur.userId, projectId);
  return done;
}
