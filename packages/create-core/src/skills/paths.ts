/**
 * Skills 目录解析：优先环境变量（Electron 注入 userData / 打包路径），
 * 否则回落产品根 vendor/skills。
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../..');

export type SkillsStatus = {
  ready: boolean;
  dir: string;
  source: 'env' | 'vendor' | 'missing';
  present: string[];
  missingRequired: string[];
  required: string[];
};

function loadManifest(): { required: string[] } {
  const candidates = [
    join(ROOT, 'vendor', 'skills-manifest.json'),
    join(process.env.BIUNOW_SKILLS_DIR || '', '..', 'skills-manifest.json'),
  ];
  for (const p of candidates) {
    if (!p || !existsSync(p)) continue;
    try {
      const j = JSON.parse(readFileSync(p, 'utf8')) as { required?: string[] };
      if (j.required?.length) return { required: j.required };
    } catch {
      /* skip */
    }
  }
  return {
    required: [
      'creative-brief',
      'motion-art-direction',
      'remotion-video',
      'kinetic-typography',
      'diagram-animation',
      'explainer-video',
    ],
  };
}

function dirLooksLikeSkills(dir: string): boolean {
  if (!existsSync(dir)) return false;
  try {
    const names = readdirSync(dir);
    return names.some((n) => existsSync(join(dir, n, 'SKILL.md')));
  } catch {
    return false;
  }
}

export function resolveSkillsDir(): string {
  const env = (process.env.BIUNOW_SKILLS_DIR || '').trim();
  if (env && dirLooksLikeSkills(env)) return env;
  const vendor = join(ROOT, 'vendor', 'skills');
  if (dirLooksLikeSkills(vendor)) return vendor;
  if (env) return env;
  return vendor;
}

export function probeSkills(): SkillsStatus {
  const dir = resolveSkillsDir();
  const { required } = loadManifest();
  const present: string[] = [];
  if (existsSync(dir)) {
    try {
      for (const name of readdirSync(dir)) {
        if (existsSync(join(dir, name, 'SKILL.md'))) present.push(name);
      }
    } catch {
      /* ignore */
    }
  }
  const missingRequired = required.filter((id) => !present.includes(id));
  const envSet = Boolean((process.env.BIUNOW_SKILLS_DIR || '').trim());
  const source: SkillsStatus['source'] = !present.length
    ? 'missing'
    : envSet
      ? 'env'
      : 'vendor';
  return {
    ready: missingRequired.length === 0,
    dir,
    source,
    present,
    missingRequired,
    required,
  };
}
