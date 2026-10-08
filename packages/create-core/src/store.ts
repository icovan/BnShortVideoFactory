import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_SETTINGS, type Brand, type Project, type Settings } from '../../shared/src/index.ts';
import { brands as seedBrands, projects as seedProjects } from './catalog.ts';
import { OUTPUTS_DIR } from './paths.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
export const DATA_DIR = join(ROOT, 'data');
mkdirSync(DATA_DIR, { recursive: true });

const SETTINGS_FILE = join(DATA_DIR, 'settings.json');
const PROJECTS_FILE = join(DATA_DIR, 'projects.json');
const BRANDS_FILE = join(DATA_DIR, 'brands.json');

function readJson<T>(path: string, fallback: T): T {
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

function writeJson(path: string, value: unknown) {
  writeFileSync(path, JSON.stringify(value, null, 2), 'utf8');
}

export function maskSettings(s: Settings): Settings {
  return {
    ...s,
    llmApiKey: s.llmApiKey ? '********' : '',
    speechApiKey: s.speechApiKey ? '********' : '',
    cloneApiKey: s.cloneApiKey ? '********' : '',
    myVoices: Array.isArray(s.myVoices) ? s.myVoices : [],
  };
}

export const store = {
  settings(): Settings {
    const file = readJson<Partial<Settings>>(SETTINGS_FILE, {});
    return {
      ...DEFAULT_SETTINGS,
      ...file,
      myVoices: Array.isArray(file.myVoices) ? file.myVoices : [],
    };
  },
  saveSettings(patch: Partial<Settings>) {
    const cur = this.settings();
    const next: Settings = {
      ...cur,
      ...patch,
      llmApiKey: patch.llmApiKey === '********' ? cur.llmApiKey : (patch.llmApiKey ?? cur.llmApiKey),
      speechApiKey: patch.speechApiKey === '********' ? cur.speechApiKey : (patch.speechApiKey ?? cur.speechApiKey),
      cloneApiKey: patch.cloneApiKey === '********' ? cur.cloneApiKey : (patch.cloneApiKey ?? cur.cloneApiKey),
      myVoices: Array.isArray(patch.myVoices) ? patch.myVoices : cur.myVoices,
    };
    writeJson(SETTINGS_FILE, next);
    return this.settings();
  },
  projects(): Project[] {
    const list = readJson<Project[]>(PROJECTS_FILE, []);
    if (list.length) return list;
    writeJson(PROJECTS_FILE, seedProjects);
    return seedProjects;
  },
  upsertProject(p: Project) {
    const list = this.projects().filter((x) => x.id !== p.id);
    list.unshift(p);
    writeJson(PROJECTS_FILE, list);
    return p;
  },
  getProject(id: string) {
    return this.projects().find((x) => x.id === id);
  },
  patchProject(id: string, patch: Partial<Project>) {
    const cur = this.getProject(id);
    if (!cur) return null;
    const next = { ...cur, ...patch, id: cur.id };
    const list = this.projects().map((x) => (x.id === id ? next : x));
    // 收藏置顶：收藏的排前，其余按原顺序
    list.sort((a, b) => Number(Boolean(b.favorite)) - Number(Boolean(a.favorite)));
    writeJson(PROJECTS_FILE, list);
    return next;
  },
  deleteProject(id: string) {
    const cur = this.getProject(id);
    const list = this.projects();
    const next = list.filter((x) => x.id !== id);
    if (next.length === list.length) return false;
    writeJson(PROJECTS_FILE, next);
    // 同步删除成片目录（仅允许 outputs 下相对目录名）
    const dirName = (cur?.dir || '').trim();
    if (dirName && !dirName.includes('..') && !/[\\/]/.test(dirName)) {
      const abs = join(OUTPUTS_DIR, dirName);
      try {
        if (existsSync(abs)) rmSync(abs, { recursive: true, force: true });
      } catch {
        /* ignore disk cleanup errors */
      }
    }
    return true;
  },
  duplicateProject(id: string) {
    const cur = this.getProject(id);
    if (!cur) return null;
    const copy: Project = {
      ...cur,
      id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      title: `${cur.title}（副本）`,
      favorite: false,
      createdAt: new Date().toISOString(),
    };
    this.upsertProject(copy);
    return copy;
  },
  brands(): Brand[] {
    const list = readJson<Brand[]>(BRANDS_FILE, []);
    if (list.length) return list;
    writeJson(BRANDS_FILE, seedBrands);
    return seedBrands;
  },
  saveBrands(list: Brand[]) {
    const next = list.map((b) => ({
      ...b,
      id: b.id || `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      name: (b.name || '未命名品牌').trim().slice(0, 40),
      tagline: (b.tagline || '').slice(0, 80),
      about: (b.about || '').slice(0, 400),
      audience: (b.audience || '').slice(0, 200),
      website: (b.website || '').slice(0, 120),
      canvas: b.canvas || '#F6F3EE',
      ink: b.ink || '#2C2825',
      accent: b.accent || '#B85C38',
    }));
    writeJson(BRANDS_FILE, next);
    return next;
  },
};
