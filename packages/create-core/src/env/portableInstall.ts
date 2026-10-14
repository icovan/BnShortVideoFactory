/**
 * 瘦身包运行时探测 / 一键补齐（FFmpeg + 引擎 npm 依赖）
 * 与 build/launcher/ensure-runtime.mjs 逻辑对齐，供 UI /api/env 调用。
 */
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

function resolveProductRoot(): string {
  const envRoot = (process.env.BIUNOW_ROOT || '').trim();
  if (envRoot && existsSync(envRoot)) return envRoot;
  // packages/create-core/src/env → 上四级到产品根
  return join(dirname(fileURLToPath(import.meta.url)), '../../../..');
}

function runtimeDir(): string {
  const override = (process.env.BIUNOW_USER_DATA || '').trim();
  if (override) return join(override, 'runtime');
  if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
    return join(process.env.LOCALAPPDATA, 'BnShortVideoFactory', 'runtime');
  }
  return join(resolveProductRoot(), 'runtime');
}

function which(cmd: string): string | null {
  const isWin = process.platform === 'win32';
  const r = spawnSync(isWin ? 'where' : 'which', [cmd], {
    encoding: 'utf8',
    windowsHide: true,
    shell: false,
  });
  if (r.status !== 0) return null;
  const line = String(r.stdout || '').split(/\r?\n/).map((s) => s.trim()).find(Boolean);
  return line || null;
}

function ffmpegPath(): string {
  const envBin = (process.env.BIUNOW_FFMPEG || '').trim();
  if (envBin && existsSync(envBin)) return envBin;
  const portable = join(runtimeDir(), 'ffmpeg', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
  if (existsSync(portable)) return portable;
  return which('ffmpeg') || '';
}

function browserOk(): boolean {
  const candidates = [
    process.env.REMOTION_BROWSER_EXECUTABLE,
    process.env.LOCALAPPDATA
      ? `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`
      : '',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ].filter(Boolean) as string[];
  return candidates.some((p) => existsSync(p));
}

export type PortableStatus = {
  ok: boolean;
  hasNode: boolean;
  hasFfmpeg: boolean;
  hasEngineDeps: boolean;
  hasBrowser: boolean;
  node: string;
  ffmpeg: string;
  root: string;
  detail?: string;
};

export function probePortable(): PortableStatus {
  const root = resolveProductRoot();
  const coreTsx = join(root, 'packages', 'create-core', 'node_modules', 'tsx', 'dist', 'cli.mjs');
  const remotion = join(root, 'packages', 'remotion-explainer', 'node_modules', '@remotion', 'renderer');
  // 开发态：也可能在仓库根已装好
  const hasEngineDeps = existsSync(coreTsx) && existsSync(remotion);
  const ff = ffmpegPath();
  const node = process.execPath;
  const hasNode = Boolean(node);
  const hasFfmpeg = Boolean(ff);
  const hasBrowser = browserOk();
  const ok = hasNode && hasFfmpeg && hasEngineDeps;
  return {
    ok,
    hasNode,
    hasFfmpeg,
    hasEngineDeps,
    hasBrowser,
    node,
    ffmpeg: ff,
    root,
    detail: ok ? 'ready' : 'missing runtime pieces',
  };
}

/**
 * 调用同布局下的 ensure-runtime.mjs（瘦身包）或仓库 build/launcher。
 */
export async function installPortableDeps(
  onChunk?: (chunk: string) => void,
): Promise<{ ok: boolean; error?: string; status?: PortableStatus }> {
  const root = resolveProductRoot();
  const candidates = [
    join(root, 'launcher', 'ensure-runtime.mjs'),
    join(root, 'build', 'launcher', 'ensure-runtime.mjs'),
  ];
  const script = candidates.find((p) => existsSync(p));
  if (!script) {
    // 开发态回退：提示用 pnpm engine:install；仍尝试只补 ffmpeg 无脚本时失败说明
    return {
      ok: false,
      error: '未找到 ensure-runtime.mjs。请使用瘦身安装包启动，或开发态执行 pnpm engine:install',
      status: probePortable(),
    };
  }

  mkdirSync(runtimeDir(), { recursive: true });
  const r = spawnSync(process.execPath, [script], {
    cwd: dirname(script),
    env: { ...process.env, BIUNOW_ROOT: root },
    encoding: 'utf8',
    windowsHide: true,
  });
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  if (onChunk && out) onChunk(out.slice(-4000));
  const status = probePortable();
  if ((r.status ?? 1) !== 0) {
    return { ok: false, error: out.slice(-800) || `ensure-runtime exit ${r.status}`, status };
  }
  return { ok: status.ok, error: status.ok ? undefined : '依赖仍未就绪', status };
}

/** 解压 skills zip 到 BIUNOW_SKILLS_DIR / 用户 skills 目录 */
export async function importSkillsZip(zipPath: string): Promise<{
  ok: boolean;
  ready: boolean;
  error?: string;
  status?: unknown;
}> {
  const { probeSkills, resolveSkillsDir } = await import('../skills/paths.ts');
  const dest = resolveSkillsDir();
  mkdirSync(dest, { recursive: true });
  if (!existsSync(zipPath)) {
    return { ok: false, ready: false, error: `zip 不存在: ${zipPath}` };
  }

  if (process.platform === 'win32') {
    const r = spawnSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        `Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${dest.replace(/'/g, "''")}' -Force`,
      ],
      { encoding: 'utf8', windowsHide: true },
    );
    if ((r.status ?? 1) !== 0) {
      return {
        ok: false,
        ready: false,
        error: `${r.stderr || r.stdout || '解压失败'}`.slice(0, 400),
      };
    }
  } else {
    const r = spawnSync('unzip', ['-o', zipPath, '-d', dest], { encoding: 'utf8' });
    if ((r.status ?? 1) !== 0) {
      return { ok: false, ready: false, error: `${r.stderr || 'unzip failed'}`.slice(0, 400) };
    }
  }

  // zip 可能内含一层 biunow-skills-x/ 目录：若 dest 下没有 SKILL.md，尝试上提一层
  const st = probeSkills();
  if (!st.ready) {
    try {
      for (const name of readdirSync(dest)) {
        const sub = join(dest, name);
        if (!statSync(sub).isDirectory()) continue;
        const looksLikePack =
          existsSync(join(sub, 'SKILL.md'))
          || readdirSync(sub).some((n) => existsSync(join(sub, n, 'SKILL.md')));
        if (!looksLikePack) continue;
        for (const child of readdirSync(sub)) {
          cpSync(join(sub, child), join(dest, child), { recursive: true });
        }
        break;
      }
    } catch {
      /* ignore */
    }
  }

  const after = probeSkills();
  return { ok: after.ready, ready: after.ready, status: after };
}
