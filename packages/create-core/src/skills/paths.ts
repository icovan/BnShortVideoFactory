/**
 * Skills 目录解析：BIUNOW_SKILLS_DIR → 仓库根 skills/ → vendor/skills。
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, dirname, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = (process.env.BIUNOW_ROOT || '').trim()
  || join(dirname(fileURLToPath(import.meta.url)), '../../../..');

export type SkillsStatus = {
  ready: boolean;
  dir: string;
  source: 'env' | 'skills' | 'vendor' | 'missing';
  present: string[];
  missingRequired: string[];
  required: string[];
};

function loadManifest(): { required: string[] } {
  const envDir = (process.env.BIUNOW_SKILLS_DIR || '').trim();
  const candidates = [
    join(ROOT, 'vendor', 'skills-manifest.json'),
    join(ROOT, 'skills-manifest.json'),
    envDir ? join(envDir, '..', 'skills-manifest.json') : '',
    envDir ? join(envDir, 'skills-manifest.json') : '',
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
  if (!dir || !existsSync(dir)) return false;
  try {
    const names = readdirSync(dir);
    return names.some((n) => existsSync(join(dir, n, 'SKILL.md')));
  } catch {
    return false;
  }
}

function resolveEnvSkillsDir(): string {
  const env = (process.env.BIUNOW_SKILLS_DIR || '').trim();
  if (!env) return '';
  if (isAbsolute(env)) return env;
  return join(ROOT, env);
}

export function resolveSkillsDir(): string {
  const envDir = resolveEnvSkillsDir();
  if (envDir && dirLooksLikeSkills(envDir)) return envDir;
  const rootSkills = join(ROOT, 'skills');
  if (dirLooksLikeSkills(rootSkills)) return rootSkills;
  const vendor = join(ROOT, 'vendor', 'skills');
  if (dirLooksLikeSkills(vendor)) return vendor;
  if (envDir) return envDir;
  return rootSkills;
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
  const norm = dir.replace(/\\/g, '/');
  let source: SkillsStatus['source'] = 'missing';
  if (present.length) {
    if (envSet) source = 'env';
    else if (norm.includes('/vendor/skills')) source = 'vendor';
    else source = 'skills';
  }
  return {
    ready: missingRequired.length === 0,
    dir,
    source,
    present,
    missingRequired,
    required,
  };
}
