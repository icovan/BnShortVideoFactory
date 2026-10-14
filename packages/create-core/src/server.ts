/**
 * BnShortVideoFactory create-core — 本机成片 API（Remotion / Manim）
 * 仅暴露 Electron UI 所需路由；无 web / admin / commerce。
 */
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  type Aspect,
  type Engine,
  type Kind,
  type Project,
  type PublicUser,
  type RemakeMode,
  type Settings,
  type StylePack,
} from '../../shared/src/index.ts';
import {
  cancelQueued,
  enqueueJob,
  pauseQueued,
  resumePaused,
  queueSnapshot,
  recoverStaleJobs,
  withQueueMeta,
} from './makeQueue.ts';
import { failPipeline, initialPipeline, remakePipeline } from './pipeline.ts';
import { OUTPUTS_DIR } from './paths.ts';
import { decorateProjects, withPoster } from './poster.ts';
import { listStyleRefs, resolveStyleLook, resolveStyleRefFile } from './make/styleLook.ts';
import { getStylePreset, listStylePresets } from './make/stylePresets.ts';
import { entitlement } from './license/entitlement.ts';
import {
  commerceBaseUrl,
  defaultPublicSite,
  remoteActivate,
  remoteCreateCatalog,
  remotePublicSite,
  remotePublicWorkflows,
} from './license/remoteCommerce.ts';
import { localOpenUser } from './shell/localOpen.ts';
import { shellInfo } from './shell/role.ts';
import { maskSettings, store } from './store.ts';

type Vars = { user: PublicUser };
const PORT = Number(process.env.PORT || 3040);
const HOST = (process.env.HOST || process.env.FACTORY_HOST || '127.0.0.1').trim() || '127.0.0.1';
const app = new Hono<{ Variables: Vars }>();

app.use(
  '/api/*',
  cors({
    origin: (origin) => origin || '*',
  }),
);

app.use('/api/*', async (c, next) => {
  c.set('user', localOpenUser());
  await next();
});

app.use(
  '/outputs/*',
  serveStatic({
    root: OUTPUTS_DIR,
    rewriteRequestPath: (p) => p.replace(/^\/outputs\/?/, '/'),
  }),
);

const STYLE_REF_MIME: Record<string, string> = {
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
};

/** 多目录候选（cankao / assets / data），按文件名解析后直出 */
app.get('/style-refs/:file', (c) => {
  const file = c.req.param('file');
  const abs = resolveStyleRefFile(file);
  if (!abs || !existsSync(abs)) return c.notFound();
  const ext = extname(abs).toLowerCase();
  const type = STYLE_REF_MIME[ext] || 'application/octet-stream';
  return c.body(readFileSync(abs), 200, {
    'Content-Type': type,
    'Cache-Control': 'public, max-age=86400',
  });
});

app.get('/api/health', (c) => {
  const s = store.settings();
  const q = queueSnapshot();
  return c.json({
    ok: true,
    name: 'File2Video create-core',
    port: PORT,
    llmConfigured: Boolean(s.llmApiKey),
    speechProvider: s.speechProvider,
    queue: {
      concurrency: q.concurrency,
      active: q.active,
      waiting: q.queued.length,
      running: q.running,
    },
    ...shellInfo(),
  });
});

app.get('/api/runtime', (c) => c.json(shellInfo()));

app.get('/api/skills/status', async (c) => {
  const { probeSkills } = await import('./skills/paths.ts');
  return c.json(probeSkills());
});

/** 瘦身包 / 本机运行环境探测 */
app.get('/api/env/status', async (c) => {
  const { probePortable } = await import('./env/portableInstall.ts');
  const { probeSkills } = await import('./skills/paths.ts');
  const deps = probePortable();
  const skills = probeSkills();
  return c.json({
    ready: deps.ok && skills.ready,
    deps,
    skills,
  });
});

/** 一键补齐 FFmpeg + 引擎 npm 依赖（走 ensure-runtime） */
app.post('/api/env/install', async (c) => {
  const { installPortableDeps, probePortable } = await import('./env/portableInstall.ts');
  const out = await installPortableDeps();
  return c.json({
    ok: out.ok,
    error: out.error,
    status: out.status || probePortable(),
  }, out.ok ? 200 : 500);
});

/** 导入 skills zip：JSON { zipPath } 或 multipart field "file" */
app.post('/api/skills/import', async (c) => {
  const { importSkillsZip } = await import('./env/portableInstall.ts');
  const { writeFileSync, rmSync } = await import('node:fs');
  const { join } = await import('node:path');
  const { tmpdir } = await import('node:os');
  const { randomBytes } = await import('node:crypto');

  const contentType = c.req.header('content-type') || '';
  let zipPath = '';
  let tmpFile = '';
  try {
    if (contentType.includes('multipart/form-data')) {
      const body = await c.req.parseBody({ all: true });
      const file = body.file;
      if (!file || typeof file === 'string') {
        return c.json({ ok: false, ready: false, error: '请选择 zip 文件' }, 400);
      }
      const buf = Buffer.from(await file.arrayBuffer());
      tmpFile = join(tmpdir(), `bn-skills-${randomBytes(6).toString('hex')}.zip`);
      writeFileSync(tmpFile, buf);
      zipPath = tmpFile;
    } else {
      const body = (await c.req.json().catch(() => ({}))) as { zipPath?: string };
      zipPath = String(body.zipPath || '').trim();
      if (!zipPath) return c.json({ ok: false, ready: false, error: '缺少 zipPath' }, 400);
    }
    const out = await importSkillsZip(zipPath);
    return c.json(out, out.ok ? 200 : 400);
  } finally {
    if (tmpFile) {
      try {
        rmSync(tmpFile, { force: true });
      } catch {
        /* ignore */
      }
    }
  }
});

app.get('/api/queue', (c) => c.json(queueSnapshot()));

app.get('/api/settings', (c) => c.json(maskSettings(store.settings())));
app.put('/api/settings', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Partial<Settings>;
  return c.json(maskSettings(store.saveSettings(body)));
});

/** 本机授权状态 */
app.get('/api/license/status', (c) => {
  const user = c.get('user');
  return c.json(entitlement.status(user?.role));
});

/** 一机一码激活（转发管理后台商业化服务） */
app.post('/api/license/activate', async (c) => {
  const user = c.get('user');
  const body = (await c.req.json().catch(() => ({}))) as { code?: string; machineId?: string };
  const code = String(body.code || '').trim();
  if (!code) return c.json({ error: '请输入激活码' }, 400);
  const machineId = (body.machineId || '').trim() || entitlement.machineId();
  if (!commerceBaseUrl()) {
    return c.json({ error: '未配置商业化服务地址（BN_COMMERCE_URL 或 config/commerce.json）' }, 503);
  }
  const out = await remoteActivate(code, machineId);
  if (!out.ok) return c.json({ error: out.error }, out.status >= 400 && out.status < 600 ? out.status as 400 : 400);
  entitlement.saveActivated(out.license);
  return c.json({
    ok: true,
    license: out.license,
    entitlement: entitlement.status(user?.role),
  });
});

/** 公开站点配置（关于 / 版权 / 下载；按语言） */
app.get('/api/site/public', async (c) => {
  const lang = String(c.req.query('lang') || 'zh-CN');
  const remote = await remotePublicSite(lang);
  return c.json(remote || defaultPublicSite(lang));
});

/** 管理后台已发布工作流配方（StylePack） */
app.get('/api/workflows/public', async (c) => {
  const rows = await remotePublicWorkflows();
  return c.json(rows);
});

/** 创作目录：类型 → 案例 → 提示词（代理管理后台） */
app.get('/api/create-catalog', async (c) => {
  const catalog = await remoteCreateCatalog();
  return c.json(catalog);
});

app.get('/api/projects', (c) => {
  return c.json(decorateProjects(store.projects()).map((p) => withQueueMeta(p)));
});

app.get('/api/projects/:id/pipeline', (c) => {
  const p = store.getProject(c.req.param('id'));
  if (!p) return c.json({ error: 'not found' }, 404);
  if (p.pipeline?.length) return c.json(p.pipeline);
  if (p.status === 'ready') {
    const engine = p.engine === 'manim' ? 'manim' : 'explainer-remotion';
    const style = p.stylePack || (engine === 'manim' ? undefined : 'skill-directed');
    return c.json(initialPipeline(engine, style).map((s) => ({ ...s, status: 'done' as const })));
  }
  const engine = p.engine === 'manim' ? 'manim' : 'explainer-remotion';
  const style = p.stylePack || (engine === 'manim' ? undefined : 'skill-directed');
  return c.json(initialPipeline(engine, style));
});

app.get('/api/projects/:id', (c) => {
  const p = store.getProject(c.req.param('id'));
  if (!p) return c.json({ error: 'not found' }, 404);
  return c.json(withQueueMeta(withPoster(p, { left: 1 })));
});

app.get('/api/projects/:id/storyboard', async (c) => {
  const p = store.getProject(c.req.param('id'));
  if (!p) return c.json({ error: 'not found' }, 404);
  const { loadStoryboard } = await import('./make/storyboard.ts');
  const board = loadStoryboard(p);
  if (!board) {
    return c.json({
      projectId: p.id,
      dir: p.dir || '',
      durationSec: p.durationSec || 0,
      versions: p.versions || [],
      currentVersionId: p.currentVersionId || 'current',
      beats: [],
    });
  }
  return c.json(board);
});

app.post('/api/projects/:id/remake-beats', async (c) => {
  const p = store.getProject(c.req.param('id'));
  if (!p) return c.json({ error: 'not found' }, 404);
  if (p.status !== 'ready' && p.status !== 'error') {
    return c.json(
      {
        error:
          p.status === 'running' || p.status === 'queued'
            ? '当前任务还在出片，请稍后再改'
            : '成片就绪后才能改分镜',
      },
      400,
    );
  }
  if (!p.dir) return c.json({ error: '找不到成片目录，无法再创作' }, 400);

  const body = (await c.req.json().catch(() => ({}))) as {
    beatIndexes?: number[];
    note?: string;
    mode?: RemakeMode | 'visual+voice' | 'voice';
  };
  const beatIndexes = Array.isArray(body.beatIndexes)
    ? body.beatIndexes.map(Number).filter((n) => Number.isFinite(n))
    : [];
  const note = (body.note || '').trim();
  if (!beatIndexes.length) return c.json({ error: '请选择要改的分镜' }, 400);
  if (!note) return c.json({ error: '请写明要怎么改' }, 400);

  const mode: RemakeMode =
    body.mode === 'visual'
      ? 'visual'
      : body.mode === 'copy' || body.mode === 'voice'
        ? 'copy'
        : 'both';

  const user = c.get('user');
  try {
    entitlement.beginMake(p.id, user?.role);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = (e as { status?: number })?.status === 402 ? 402 : 403;
    return c.json({ error: msg, entitlement: entitlement.status(user?.role) }, status);
  }

  store.patchProject(p.id, {
    status: 'queued',
    error: undefined,
    pipeline: remakePipeline(),
  });

  const settings = store.settings();
  const enqueued = enqueueJob({
    id: p.id,
    kind: 'remake',
    run: async () => {
      const { remakeBeats } = await import('./make/remakeBeats.ts');
      await remakeBeats(p.id, settings, {
        beatIndexes,
        note,
        mode,
      });
    },
  });

  return c.json(enqueued || store.getProject(p.id) || p);
});

app.post('/api/projects/:id/restore-version', async (c) => {
  const p = store.getProject(c.req.param('id'));
  if (!p) return c.json({ error: 'not found' }, 404);
  const body = (await c.req.json().catch(() => ({}))) as { versionId?: string };
  const versionId = (body.versionId || '').trim();
  if (!versionId) return c.json({ error: '缺少 versionId' }, 400);
  try {
    const { restoreProjectVersion } = await import('./make/remakeBeats.ts');
    return c.json(await restoreProjectVersion(p.id, versionId));
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 400);
  }
});

app.post('/api/speech/preview', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { voice?: string; text?: string };
  try {
    const { previewSpeech } = await import('./speechPreview.ts');
    const buf = await previewSpeech(body.text || '', body.voice || '', store.settings());
    // Electron IPC 以 utf8 传 body，统一返回 base64 JSON
    return c.json({
      mime: 'audio/mpeg',
      base64: Buffer.from(buf).toString('base64'),
    });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 400);
  }
});

app.patch('/api/projects/:id', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Partial<Project>;
  const allowed: Partial<Project> = {};
  if (typeof body.title === 'string') allowed.title = body.title.trim().slice(0, 80) || '未命名';
  if (typeof body.favorite === 'boolean') allowed.favorite = body.favorite;
  const p = store.patchProject(c.req.param('id'), allowed);
  if (!p) return c.json({ error: 'not found' }, 404);
  return c.json(p);
});

app.delete('/api/projects/:id', (c) => {
  const id = c.req.param('id');
  cancelQueued(id);
  const ok = store.deleteProject(id);
  if (!ok) return c.json({ error: 'not found' }, 404);
  return c.json({ ok: true });
});

/** 取消排队中的任务（运行中不可硬杀） */
app.post('/api/projects/:id/cancel', (c) => {
  const id = c.req.param('id');
  const p = store.getProject(id);
  if (!p) return c.json({ error: 'not found' }, 404);
  if ((p.status !== 'queued' && p.status !== 'paused') || !cancelQueued(id)) {
    return c.json({ error: p.status === 'running' ? '任务已在出片，无法取消' : '仅排队/暂停中的任务可取消' }, 400);
  }
  failPipeline(id, '已取消排队');
  return c.json(withQueueMeta(store.getProject(id)!));
});

/** 暂停排队（真暂停：摘队保留作业）。运行中不可暂停。 */
app.post('/api/projects/:id/pause', (c) => {
  const id = c.req.param('id');
  const p = store.getProject(id);
  if (!p) return c.json({ error: 'not found' }, 404);
  if (p.status !== 'queued' || !pauseQueued(id)) {
    return c.json(
      { error: p.status === 'running' ? '出片中无法暂停，请等当前任务结束' : '仅排队中的任务可暂停' },
      400,
    );
  }
  return c.json(withQueueMeta(store.getProject(id)!));
});

/** 继续已暂停任务（真继续：原作业重新入队） */
app.post('/api/projects/:id/resume', (c) => {
  const id = c.req.param('id');
  const p = store.getProject(id);
  if (!p) return c.json({ error: 'not found' }, 404);
  if (p.status !== 'paused') {
    return c.json({ error: '仅已暂停的任务可继续' }, 400);
  }
  const out = resumePaused(id);
  if (!out) return c.json({ error: '暂停作业已失效，请重新提交' }, 400);
  return c.json(out);
});

function parseAspect(v: unknown, fallback: Aspect = '16:9'): Aspect {
  if (v === '9:16' || v === '16:9' || v === '1:1' || v === '3:4') return v;
  return fallback;
}

function newId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

app.post('/api/optimize-prompt', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { prompt?: string; aspect?: Aspect };
  const prompt = (body.prompt || '').trim();
  if (!prompt) return c.json({ error: '请先填写需求' }, 400);
  const aspect = parseAspect(body.aspect);
  try {
    const { optimizePrompt } = await import('./make/optimizePrompt.ts');
    const brief = await optimizePrompt(prompt, aspect, store.settings());
    return c.json(brief);
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

app.get('/api/style-refs', (c) => c.json(listStyleRefs()));

app.get('/api/style-presets', (c) => c.json(listStylePresets()));

app.post('/api/style-refs/extract', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    styleRefId?: string;
    styleRefDataUrl?: string;
  };
  try {
    const hit = await resolveStyleLook({
      styleRefId: body.styleRefId,
      styleRefDataUrl: body.styleRefDataUrl,
      settings: store.settings(),
    });
    if (!hit) return c.json({ error: '请选择或上传设计参考图' }, 400);
    return c.json({ look: hit.look, source: hit.source });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

app.post('/api/make', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    prompt?: string;
    kind?: Kind;
    engine?: Engine;
    stylePack?: StylePack;
    aspect?: Aspect;
    autoSfx?: boolean;
    /** 口播三态：关 / 自动 / 驱动（优先） */
    voiceOver?: 'off' | 'auto' | 'drive';
    voMode?: 'on' | 'off' | 'auto';
    scriptDrive?: 'off' | 'auto' | 'polish' | 'verbatim';
    styleRefId?: string;
    styleRefDataUrl?: string;
    stylePresetId?: string;
    userAssets?: {
      name: string;
      dataUrl: string;
      kind?: 'image' | 'music' | 'doc';
      role?: 'logo' | 'product' | 'shot' | 'image';
    }[];
    contentLang?: 'zh' | 'en' | 'bilingual';
    webSearch?: boolean;
    quality?: '1080p' | '720p';
    formMode?: string;
    brandSubtype?: string;
    templateId?: string;
    footageFolder?: string;
    footagePaths?: string[];
    remixBrief?: {
      topic?: string;
      brand?: string;
      sellingPoints?: string;
      theme?: string;
    };
  };
  const prompt = (body.prompt || '').trim();
  if (!prompt) return c.json({ error: '请先填写需求' }, 400);

  const formMode = typeof body.formMode === 'string' ? body.formMode : undefined;
  const brandSubtype =
    body.brandSubtype === 'logo' || body.brandSubtype === 'showreel'
      ? body.brandSubtype
      : undefined;
  const templateId = typeof body.templateId === 'string' && body.templateId.trim()
    ? body.templateId.trim()
    : undefined;
  const requestedPack = typeof body.stylePack === 'string' ? body.stylePack.trim() : '';
  const resolveStylePack = (raw?: string): StylePack => {
    if (raw === 'footage-remix' || raw === 'launch-showreel' || raw === 'narrated-explainer'
      || raw === 'next-word-loop' || raw === 'skill-directed') {
      return raw;
    }
    return 'skill-directed';
  };
  const isRemix = formMode === 'remix' || formMode === 'footage-remix' || requestedPack === 'footage-remix';
  const stylePack: StylePack = isRemix
    ? 'footage-remix'
    : resolveStylePack(requestedPack);
  const aspect = parseAspect(
    body.aspect,
    stylePack === 'next-word-loop' || isRemix ? '9:16' : '16:9',
  );
  const quality = body.quality === '720p' ? '720p' as const : '1080p' as const;
  const autoSfx = body.autoSfx === true;
  const webSearch = body.webSearch === true;
  const voiceOver =
    body.voiceOver === 'off' || body.voiceOver === 'auto' || body.voiceOver === 'drive'
      ? body.voiceOver
      : undefined;
  const voMode =
    body.voMode === 'on' || body.voMode === 'off' || body.voMode === 'auto' ? body.voMode : 'auto';
  const scriptDrive =
    body.scriptDrive === 'off' ||
    body.scriptDrive === 'auto' ||
    body.scriptDrive === 'polish' ||
    body.scriptDrive === 'verbatim'
      ? body.scriptDrive
      : 'auto';
  const styleRefId = (body.styleRefId || '').trim() || undefined;
  const styleRefDataUrl = body.styleRefDataUrl?.startsWith('data:image/')
    ? body.styleRefDataUrl
    : undefined;
  const stylePresetRaw = (body.stylePresetId || '').trim();
  const stylePresetId = stylePresetRaw && getStylePreset(stylePresetRaw)
    ? stylePresetRaw
    : undefined;
  const userAssets = Array.isArray(body.userAssets)
    ? body.userAssets
        .filter(
          (a) =>
            a?.name
            && typeof a.dataUrl === 'string'
            && a.dataUrl.startsWith('data:')
            && a.kind !== 'music'
            && !String(a.dataUrl).startsWith('data:audio'),
        )
        .slice(0, 10)
        .map((a) => ({
          name: String(a.name).slice(0, 120),
          dataUrl: a.dataUrl,
          kind: a.kind,
          role: a.role,
        }))
    : undefined;
  const footageFolder = typeof body.footageFolder === 'string' && body.footageFolder.trim()
    ? body.footageFolder.trim()
    : undefined;
  const footagePaths = Array.isArray(body.footagePaths)
    ? body.footagePaths.map((p) => String(p || '').trim()).filter(Boolean).slice(0, 200)
    : undefined;
  const remixBriefRaw = body.remixBrief && typeof body.remixBrief === 'object' ? body.remixBrief : undefined;
  const remixBrief = remixBriefRaw
    ? {
      topic: typeof remixBriefRaw.topic === 'string' ? remixBriefRaw.topic.trim().slice(0, 40) : undefined,
      brand: typeof remixBriefRaw.brand === 'string' ? remixBriefRaw.brand.trim().slice(0, 80) : undefined,
      sellingPoints: typeof remixBriefRaw.sellingPoints === 'string'
        ? remixBriefRaw.sellingPoints.trim().slice(0, 240)
        : undefined,
      theme: typeof remixBriefRaw.theme === 'string' ? remixBriefRaw.theme.trim().slice(0, 120) : undefined,
    }
    : undefined;

  if (isRemix && !footageFolder && !(footagePaths && footagePaths.length)) {
    return c.json({ error: '混剪需要先选择分镜素材文件夹' }, 400);
  }

  const user = c.get('user');
  const settings = store.settings();
  const engine: Engine = isRemix
    ? 'footage-remix'
    : body.engine === 'manim'
      ? 'manim'
      : 'explainer-remotion';

  const project: Project = {
    id: newId(),
    title: prompt.slice(0, 28) || (isRemix ? '素材混剪' : '新创作'),
    kind: body.kind || 'explainer',
    engine,
    stylePack,
    prompt,
    status: 'queued',
    createdAt: new Date().toISOString(),
    durationSec: 0,
    aspect,
    quality,
    userId: user.id,
    pipeline: initialPipeline(engine, stylePack),
  };

  try {
    entitlement.beginMake(project.id, user?.role);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = (e as { status?: number })?.status === 402 ? 402 : 403;
    return c.json({ error: msg, entitlement: entitlement.status(user?.role) }, status);
  }

  store.upsertProject(project);

  const enqueued = enqueueJob({
    id: project.id,
    kind: 'make',
    run: async () => {
      const { makeFromPrompt } = await import('./make/fromPrompt.ts');
      await makeFromPrompt(prompt, settings, project.id, aspect, templateId, {
        autoSfx,
        voiceOver: isRemix ? 'auto' : voiceOver,
        voMode: isRemix ? 'on' : voMode,
        scriptDrive: isRemix ? (scriptDrive === 'off' ? 'auto' : scriptDrive) : scriptDrive,
        styleRefId,
        styleRefDataUrl,
        stylePresetId,
        userAssets,
        stylePack,
        webSearch: isRemix ? false : webSearch,
        quality,
        formMode,
        brandSubtype,
        footageFolder,
        footagePaths,
        remixBrief,
        contentLang:
          body.contentLang === 'zh' || body.contentLang === 'en' || body.contentLang === 'bilingual'
            ? body.contentLang
            : undefined,
      });
    },
  });

  return c.json(enqueued || withQueueMeta(project));
});

const UI_DIR = (process.env.BIUNOW_UI_DIR || '').trim();
if (UI_DIR && existsSync(UI_DIR)) {
  app.use(
    '/*',
    serveStatic({
      root: UI_DIR,
      rewriteRequestPath: (p) => (p === '/' ? '/index.html' : p),
    }),
  );
  app.get('*', (c) => {
    const index = join(UI_DIR, 'index.html');
    if (!existsSync(index)) return c.text('UI index.html missing', 404);
    return c.html(readFileSync(index, 'utf8'));
  });
  console.info(`[create-core] UI_DIR=${UI_DIR}`);
} else {
  app.get('/', (c) =>
    c.json({
      ok: true,
      service: 'File2Video create-core',
      health: '/api/health',
    }),
  );
}

const ROOT = (process.env.BIUNOW_ROOT || '').trim()
  || join(dirname(fileURLToPath(import.meta.url)), '../../..');
recoverStaleJobs();
const q0 = queueSnapshot();
console.info(`[create-core] root=${ROOT}`);
console.info(`[create-core] outputs=${OUTPUTS_DIR}`);
console.info(`[create-core] make-queue concurrency=${q0.concurrency}`);

process.on('uncaughtException', (err) => {
  console.error('[create-core] uncaughtException', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[create-core] unhandledRejection', reason);
});

try {
  serve({ fetch: app.fetch, hostname: HOST, port: PORT });
  console.info(`[create-core] listening http://${HOST}:${PORT}`);
} catch (err) {
  console.error('[create-core] bind failed', err);
  process.exit(1);
}
