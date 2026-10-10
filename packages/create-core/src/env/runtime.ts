/**
 * 本机运行环境体检 + 安装（参考 Easel EnvBoard / setup.ps1）
 * 出片硬依赖：Node、FFmpeg、Chrome/Edge（Remotion）
 */
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import { platform } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** 发布包 app/ 根（含 package.json / node_modules）；从本文件向上找，避免 src/env 比 src 多一层算错 */
function resolveAppRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 10; i++) {
    const pkg = join(dir, 'package.json');
    if (
      existsSync(pkg)
      && (
        existsSync(join(dir, 'packages', 'create-core'))
        || existsSync(join(dir, 'packages', 'shared'))
        || existsSync(join(dir, 'apps', 'server'))
      )
    ) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // 回退：本文件在 apps/server/src/env → 上四级到 monorepo 根
  return join(dirname(fileURLToPath(import.meta.url)), '../../../..');
}

const APP_ROOT = resolveAppRoot();

export type EnvToolState = 'ok' | 'missing' | 'fail';

export type EnvTool = {
  id: string;
  name: string;
  desc: string;
  group: string;
  state: EnvToolState;
  version: string | null;
  detail: string | null;
  /** winget id；非 Windows 或无可装策略时为空 */
  installId?: string;
  installHint?: string;
};

export type EnvJob = {
  jobId: string;
  id: string;
  state: 'running' | 'ok' | 'fail';
  lines: string[];
  result: { id: string; state: 'ok' | 'fail'; version?: string | null; detail?: string | null } | null;
  started: number;
  ended: number | null;
};

const TOOL_META: Record<string, Omit<EnvTool, 'state' | 'version' | 'detail'>> = {
  node: {
    id: 'node',
    name: 'Node.js',
    desc: '本机 API / Remotion 运行时，建议 ≥ 20（推荐 22）',
    group: 'core',
    installId: 'OpenJS.NodeJS.LTS',
    installHint: '请安装 Node.js 20+ 并加入 PATH',
  },
  ffmpeg: {
    id: 'ffmpeg',
    name: 'FFmpeg',
    desc: '旁白拼接、成片探测、音轨处理',
    group: 'core',
    installId: 'Gyan.FFmpeg',
    installHint: '请安装 FFmpeg 并加入 PATH（winget：Gyan.FFmpeg）',
  },
  browser: {
    id: 'browser',
    name: 'Chrome / Edge',
    desc: 'Remotion 无头渲染用浏览器',
    group: 'core',
    installId: 'Google.Chrome',
    installHint: '请安装 Google Chrome 或 Microsoft Edge',
  },
  deps: {
    id: 'deps',
    name: 'npm 依赖',
    desc: 'PC 壳运行库（tsx / Remotion 等）；安装包不自带，需联网安装',
    group: 'core',
    installHint: '在 app 目录执行 npm ci --omit=dev',
  },
  python: {
    id: 'python',
    name: 'Python',
    desc: '仅 Manim 可选引擎需要（配音已用本仓 TS EdgeTTS，不依赖 Python）',
    group: 'optional',
    installHint: '安装 Python 3.10+ 并加入 PATH（仅在使用 Manim 时需要）',
  },
  manim: {
    id: 'manim',
    name: 'Manim',
    desc: '数学/公式动画引擎（可选）',
    group: 'optional',
    installHint: 'pip install manim',
  },
};

const jobs = new Map<string, EnvJob>();
const children = new Map<string, ChildProcessWithoutNullStreams>();

function which(cmd: string): string | null {
  const isWin = platform() === 'win32';
  const r = spawnSync(isWin ? 'where' : 'which', [cmd], {
    encoding: 'utf8',
    windowsHide: true,
    shell: false,
  });
  if (r.status !== 0) return null;
  const line = String(r.stdout || '').split(/\r?\n/).map((s) => s.trim()).find(Boolean);
  return line || null;
}

function runCapture(bin: string, args: string[]): { code: number; out: string } {
  const r = spawnSync(bin, args, {
    encoding: 'utf8',
    windowsHide: true,
    shell: false,
    env: { ...process.env },
  });
  const out = `${r.stdout || ''}${r.stderr || ''}`.trim();
  return { code: r.status ?? 1, out };
}

function refreshPath() {
  if (platform() !== 'win32') return;
  try {
    const r = spawnSync(
      'powershell',
      [
        '-NoProfile',
        '-Command',
        "[Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')",
      ],
      { encoding: 'utf8', windowsHide: true },
    );
    const path = String(r.stdout || '').trim();
    if (path) process.env.Path = path;
  } catch {
    /* ignore */
  }
}

function browserHit(): { path: string; name: string } | null {
  const candidates: { path: string; name: string }[] = [
    process.env.REMOTION_BROWSER_EXECUTABLE
      ? { path: process.env.REMOTION_BROWSER_EXECUTABLE, name: '自定义浏览器' }
      : null,
    process.env.LOCALAPPDATA
      ? { path: `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`, name: 'Chrome' }
      : null,
    { path: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', name: 'Chrome' },
    { path: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', name: 'Chrome' },
    { path: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', name: 'Edge' },
    { path: 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe', name: 'Edge' },
    { path: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', name: 'Chrome' },
    { path: '/usr/bin/google-chrome', name: 'Chrome' },
    { path: '/usr/bin/chromium', name: 'Chromium' },
  ].filter(Boolean) as { path: string; name: string }[];
  for (const c of candidates) {
    if (c.path && existsSync(c.path)) return c;
  }
  return null;
}

function checkNode(): Pick<EnvTool, 'state' | 'version' | 'detail'> {
  const bin = which('node') || process.execPath;
  const { code, out } = runCapture(bin, ['-v']);
  if (code !== 0 || !out) return { state: 'missing', version: null, detail: '未找到 node' };
  const ver = out.replace(/^v/i, '').trim();
  const major = Number(ver.split('.')[0]);
  if (!Number.isFinite(major) || major < 20) {
    return { state: 'fail', version: ver, detail: `当前 ${ver}，需要 ≥ 20` };
  }
  return { state: 'ok', version: ver, detail: bin };
}

function checkFfmpeg(): Pick<EnvTool, 'state' | 'version' | 'detail'> {
  const envBin = (process.env.BIUNOW_FFMPEG || '').trim();
  const bin = (envBin && existsSync(envBin) ? envBin : null) || which('ffmpeg');
  if (!bin) return { state: 'missing', version: null, detail: 'PATH 中无 ffmpeg（可走应用内一键安装）' };
  const { code, out } = runCapture(bin, ['-version']);
  if (code !== 0) return { state: 'fail', version: null, detail: out.slice(0, 160) || 'ffmpeg 无法运行' };
  const m = out.match(/ffmpeg version\s+([^\s]+)/i);
  return { state: 'ok', version: m?.[1] || 'ok', detail: bin };
}

function checkBrowser(): Pick<EnvTool, 'state' | 'version' | 'detail'> {
  const hit = browserHit();
  if (!hit) return { state: 'missing', version: null, detail: '未找到 Chrome / Edge' };
  return { state: 'ok', version: hit.name, detail: hit.path };
}

function checkDeps(): Pick<EnvTool, 'state' | 'version' | 'detail'> {
  const tsx = join(APP_ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
  const remotion = join(APP_ROOT, 'node_modules', 'remotion');
  if (!existsSync(tsx)) {
    return { state: 'missing', version: null, detail: `未安装 · ${APP_ROOT}` };
  }
  const extra = existsSync(remotion) ? ' · remotion ok' : '';
  return { state: 'ok', version: 'installed', detail: `node_modules 就绪${extra}` };
}

function checkPython(): Pick<EnvTool, 'state' | 'version' | 'detail'> {
  const envPy = (process.env.FACTORY_PYTHON || '').trim();
  const bins = [
    envPy,
    platform() === 'win32' ? 'python' : 'python3',
    platform() === 'win32' ? 'py' : 'python',
    'python3',
    'python',
  ].filter(Boolean);
  for (const bin of bins) {
    if ((bin.includes('/') || bin.includes('\\')) && !existsSync(bin)) continue;
    const { code, out } = runCapture(bin, ['-c', 'import sys; print(sys.version.split()[0])']);
    if (code === 0 && out) {
      return {
        state: 'ok',
        version: out.split(/\r?\n/).find(Boolean) || null,
        detail: `${bin} · 可选（Manim）`,
      };
    }
  }
  return { state: 'missing', version: null, detail: '未找到 Python（仅 Manim 需要）' };
}

function checkManim(): Pick<EnvTool, 'state' | 'version' | 'detail'> {
  const py = checkPython();
  if (py.state === 'missing') {
    return { state: 'missing', version: null, detail: '需先安装 Python' };
  }
  const bins = [
    (process.env.FACTORY_PYTHON || '').trim(),
    platform() === 'win32' ? 'python' : 'python3',
    'python',
  ].filter(Boolean);
  for (const bin of bins) {
    if ((bin.includes('/') || bin.includes('\\')) && !existsSync(bin)) continue;
    const { code, out } = runCapture(bin, ['-c', 'import manim; print(getattr(manim,"__version__", "ok"))']);
    if (code === 0 && out) {
      return { state: 'ok', version: out.split(/\r?\n/).find(Boolean) || 'ok', detail: bin };
    }
  }
  return { state: 'missing', version: null, detail: '未安装 manim（可选）' };
}

function probeAll(): EnvTool[] {
  refreshPath();
  const checks: Record<string, () => Pick<EnvTool, 'state' | 'version' | 'detail'>> = {
    node: checkNode,
    ffmpeg: checkFfmpeg,
    browser: checkBrowser,
    deps: checkDeps,
    python: checkPython,
    manim: checkManim,
  };
  return (['node', 'deps', 'ffmpeg', 'browser', 'python', 'manim'] as const).map((id) => {
    const meta = TOOL_META[id];
    const hit = checks[id]();
    return { ...meta, ...hit };
  });
}

function startNpmInstall(toolId: string): EnvJob {
  const jobId = `env_${Date.now().toString(36)}_${randomBytes(2).toString('hex')}`;
  const job: EnvJob = {
    jobId,
    id: toolId,
    state: 'running',
    lines: [`在 ${APP_ROOT} 安装 npm 依赖…`],
    result: null,
    started: Date.now(),
    ended: null,
  };
  jobs.set(jobId, job);

  const lock = join(APP_ROOT, 'package-lock.json');
  const args = existsSync(lock) ? ['ci', '--omit=dev'] : ['install', '--omit=dev'];
  const npmBin = platform() === 'win32' ? 'npm.cmd' : 'npm';
  const child = spawn(npmBin, args, {
    cwd: APP_ROOT,
    windowsHide: true,
    shell: platform() === 'win32',
    env: {
      ...process.env,
      npm_config_registry: process.env.npm_config_registry || 'https://registry.npmmirror.com',
    },
  });
  children.set(jobId, child);

  const push = (chunk: Buffer) => {
    const text = String(chunk).replace(/\r/g, '\n');
    for (const line of text.split('\n')) {
      const t = line.trim();
      if (!t) continue;
      job.lines.push(t.slice(0, 240));
      if (job.lines.length > 120) job.lines.splice(0, job.lines.length - 120);
    }
  };
  child.stdout.on('data', push);
  child.stderr.on('data', push);
  child.on('error', (e) => {
    job.state = 'fail';
    job.ended = Date.now();
    job.result = { id: toolId, state: 'fail', detail: e.message };
    job.lines.push(`启动失败：${e.message}`);
    children.delete(jobId);
  });
  child.on('close', (code) => {
    const after = checkDeps();
    const finalOk = after.state === 'ok';
    job.state = finalOk ? 'ok' : 'fail';
    job.ended = Date.now();
    job.result = {
      id: toolId,
      state: finalOk ? 'ok' : 'fail',
      version: after.version,
      detail: finalOk ? after.detail : (job.lines.at(-1) || `npm 退出码 ${code}`),
    };
    job.lines.push(finalOk ? '依赖安装完成' : `依赖未就绪（exit ${code}）`);
    children.delete(jobId);
  });

  return job;
}

function hasWinget(): boolean {
  return Boolean(which('winget'));
}

function startWingetInstall(toolId: string, packageId: string): EnvJob {
  const jobId = `env_${Date.now().toString(36)}_${randomBytes(2).toString('hex')}`;
  const job: EnvJob = {
    jobId,
    id: toolId,
    state: 'running',
    lines: [`开始安装 ${packageId}…`],
    result: null,
    started: Date.now(),
    ended: null,
  };
  jobs.set(jobId, job);

  const child = spawn(
    'winget',
    [
      'install',
      '--id', packageId,
      '--exact',
      '--accept-source-agreements',
      '--accept-package-agreements',
      '--disable-interactivity',
    ],
    {
      windowsHide: true,
      shell: false,
      env: { ...process.env },
    },
  );
  children.set(jobId, child);

  const push = (chunk: Buffer) => {
    const text = String(chunk).replace(/\r/g, '\n');
    for (const line of text.split('\n')) {
      const t = line.trim();
      if (!t) continue;
      job.lines.push(t.slice(0, 240));
      if (job.lines.length > 80) job.lines.splice(0, job.lines.length - 80);
    }
  };
  child.stdout.on('data', push);
  child.stderr.on('data', push);
  child.on('error', (e) => {
    job.state = 'fail';
    job.ended = Date.now();
    job.result = { id: toolId, state: 'fail', detail: e.message };
    job.lines.push(`启动失败：${e.message}`);
    children.delete(jobId);
  });
  child.on('close', (code) => {
    refreshPath();
    const after = probeAll().find((t) => t.id === toolId);
    const ok = after?.state === 'ok' || code === 0;
    // winget 有时已装会返回非 0，以复检为准
    const finalOk = after?.state === 'ok';
    job.state = finalOk ? 'ok' : 'fail';
    job.ended = Date.now();
    job.result = {
      id: toolId,
      state: finalOk ? 'ok' : 'fail',
      version: after?.version,
      detail: finalOk
        ? after?.detail || null
        : (after?.detail || job.lines.at(-1) || `winget 退出码 ${code}`),
    };
    job.lines.push(finalOk ? `安装完成 · ${after?.version || 'ok'}` : `安装未就绪（exit ${code}）`);
    children.delete(jobId);
    void ok;
  });

  return job;
}

export const runtimeEnv = {
  list(): { platform: string; tools: EnvTool[]; okCount: number; total: number } {
    const tools = probeAll();
    return {
      platform: platform(),
      tools,
      okCount: tools.filter((t) => t.state === 'ok').length,
      total: tools.length,
    };
  },
  install(id: string): EnvJob {
    const meta = TOOL_META[id];
    if (!meta) throw new Error('未知组件');
    if (id === 'deps') {
      // 允许「已就绪」时强制重装
      return startNpmInstall(id);
    }
    const cur = probeAll().find((t) => t.id === id);
    if (cur?.state === 'ok') {
      const jobId = `env_${createHash('md5').update(id + Date.now()).digest('hex').slice(0, 10)}`;
      const done: EnvJob = {
        jobId,
        id,
        state: 'ok',
        lines: ['已就绪，无需安装'],
        result: { id, state: 'ok', version: cur.version, detail: cur.detail },
        started: Date.now(),
        ended: Date.now(),
      };
      jobs.set(jobId, done);
      return done;
    }
    if (platform() !== 'win32') {
      throw new Error(`${meta.name}：当前系统请手动安装。${meta.installHint || ''}`);
    }
    if (!hasWinget()) {
      throw new Error('未找到 winget。请先安装「应用安装程序」(App Installer)，或手动安装后点重新检测。');
    }
    if (!meta.installId) throw new Error(`${meta.name} 暂无自动安装策略`);
    return startWingetInstall(id, meta.installId);
  },
  job(jobId: string): EnvJob | null {
    return jobs.get(jobId) || null;
  },
};
