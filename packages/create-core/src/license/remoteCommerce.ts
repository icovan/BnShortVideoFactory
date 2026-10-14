/**
 * 对接管理后台商业化 API（激活核销 / 公开站点配置）
 * 基址优先序：环境变量 → config/commerce.json
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { LocalLicenseFile, PublicAppSite } from '../../../shared/src/index.ts';
import { siteLocalePack, type SiteSettings } from '../../../shared/src/index.ts';
import {
  defaultCreateCatalog,
  type CreateCatalog,
  type CreateCase,
  type CreateFormType,
  type CreatePrompt,
  isUnmanagedFormTypeId,
} from '../../../shared/src/createCatalog.ts';

/** packages/create-core/src/license → 仓库根 */
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../..');

let cachedCommerceFileUrl: string | undefined;

function commerceJsonCandidates(): string[] {
  const fromEnv = (process.env.BIUNOW_COMMERCE_CONFIG || '').trim();
  const root = (process.env.BIUNOW_ROOT || '').trim() || REPO_ROOT;
  return [
    fromEnv,
    join(root, 'config', 'commerce.json'),
    join(REPO_ROOT, 'config', 'commerce.json'),
  ].filter(Boolean);
}

/** 读正式包打入的管理端地址（可被环境变量覆盖） */
function readCommerceJsonUrl(): string {
  if (cachedCommerceFileUrl !== undefined) return cachedCommerceFileUrl;
  try {
    for (const p of commerceJsonCandidates()) {
      if (!existsSync(p)) continue;
      const j = JSON.parse(readFileSync(p, 'utf8')) as { url?: string };
      cachedCommerceFileUrl = String(j?.url || '').trim().replace(/\/$/, '');
      return cachedCommerceFileUrl;
    }
    cachedCommerceFileUrl = '';
    return '';
  } catch {
    cachedCommerceFileUrl = '';
    return '';
  }
}

export function commerceBaseUrl(): string {
  const fromEnv = (
    process.env.BN_COMMERCE_URL
    || process.env.BIUNOW_COMMERCE_URL
    || process.env.FACTORY_COMMERCE_URL
    || ''
  ).trim().replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  return readCommerceJsonUrl();
}

async function fetchJson<T>(
  path: string,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; data: T }> {
  const base = commerceBaseUrl();
  if (!base) {
    return { ok: false, status: 503, data: { error: '未配置商业化服务地址（BN_COMMERCE_URL）' } as T };
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12_000);
  try {
    const res = await fetch(`${base}${path}`, {
      ...init,
      signal: ctrl.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'BnShortVideoFactory',
        ...(init?.headers || {}),
      },
    });
    const text = await res.text();
    let data: T = {} as T;
    try {
      data = text ? (JSON.parse(text) as T) : ({} as T);
    } catch {
      data = { error: text.slice(0, 200) } as T;
    }
    return { ok: res.ok, status: res.status, data };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, status: 502, data: { error: message } as T };
  } finally {
    clearTimeout(timer);
  }
}

type ActivateOk = {
  license?: {
    id?: string;
    machineId?: string;
    code?: string;
    planId?: string;
    planTitle?: string;
    createdAt?: string;
    expiresAt?: string;
  };
  code?: string;
  error?: string;
};

export async function remoteActivate(
  code: string,
  machineId: string,
): Promise<{ ok: true; license: LocalLicenseFile } | { ok: false; error: string; status: number }> {
  const { ok, status, data } = await fetchJson<ActivateOk>('/api/license/activate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, machineId }),
  });
  if (!ok) {
    return {
      ok: false,
      status,
      error: (data as { error?: string }).error || `激活失败 HTTP ${status}`,
    };
  }
  const lic = data.license;
  if (!lic?.id) {
    return { ok: false, status: 502, error: '商业化服务未返回授权信息' };
  }
  return {
    ok: true,
    license: {
      licenseId: String(lic.id),
      machineId: String(lic.machineId || machineId),
      code: String(lic.code || data.code || code),
      planId: String(lic.planId || ''),
      planTitle: String(lic.planTitle || lic.planId || ''),
      status: 'active',
      activatedAt: String(lic.createdAt || new Date().toISOString()),
      expiresAt: lic.expiresAt ? String(lic.expiresAt) : undefined,
    },
  };
}

/** 公开站点：优先 /api/public/site?lang=；回落 /api/site/brand 再本地折叠 */
export async function remotePublicSite(lang: string): Promise<PublicAppSite | null> {
  const lng = lang.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';
  const direct = await fetchJson<PublicAppSite & { error?: string }>(
    `/api/public/site?lang=${encodeURIComponent(lng)}`,
  );
  if (direct.ok && direct.data && !direct.data.error && (direct.data.aboutUrl !== undefined || direct.data.copyright)) {
    return {
      lang: lng,
      siteName: direct.data.siteName || 'BnShortVideoFactory',
      aboutUrl: direct.data.aboutUrl || '',
      downloadUrl: direct.data.downloadUrl || '',
      updateCheckUrl: direct.data.updateCheckUrl || '',
      copyright: direct.data.copyright || (lng === 'zh-CN' ? '©2026 在线信息 版权所有。' : '©2026 Online Info. All rights reserved.'),
      trialDays: typeof direct.data.trialDays === 'number' ? direct.data.trialDays : 3,
      showTemplateShelf: direct.data.showTemplateShelf === true,
      contactWechat: direct.data.contactWechat || '',
      contactWebsite: direct.data.contactWebsite || '',
    };
  }

  const brand = await fetchJson<Partial<SiteSettings> & { error?: string }>('/api/site-brand');
  if (!brand.ok || !brand.data || brand.data.error) return null;
  const s = brand.data as SiteSettings;
  const pack = siteLocalePack(
    {
      aboutUrlZh: s.aboutUrlZh || '',
      aboutUrlEn: s.aboutUrlEn || '',
      downloadUrlZh: s.downloadUrlZh || '',
      downloadUrlEn: s.downloadUrlEn || '',
      downloadUrl: s.downloadUrl || '',
      updateCheckUrlZh: s.updateCheckUrlZh || '',
      updateCheckUrlEn: s.updateCheckUrlEn || '',
      updateCheckUrl: s.updateCheckUrl || '',
      copyrightZh: s.copyrightZh || '',
      copyrightEn: s.copyrightEn || '',
    },
    lng,
  );
  return {
    lang: lng,
    siteName: s.siteName || 'BnShortVideoFactory',
    aboutUrl: pack.aboutUrl,
    downloadUrl: pack.downloadUrl,
    updateCheckUrl: pack.updateCheckUrl,
    copyright: pack.copyright,
    trialDays: typeof s.trialDays === 'number' && s.trialDays > 0 ? s.trialDays : 3,
    showTemplateShelf: s.showTemplateShelf === true,
    contactWechat: s.contactWechat || '',
    contactWebsite: s.contactWebsite || '',
  };
}

export function defaultPublicSite(lang: string): PublicAppSite {
  const lng = lang.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';
  return {
    lang: lng,
    siteName: 'BnShortVideoFactory',
    aboutUrl: '',
    downloadUrl: '',
    updateCheckUrl: '',
    copyright: lng === 'zh-CN' ? '©2026 在线信息 版权所有。' : '©2026 Online Info. All rights reserved.',
    trialDays: 3,
    showTemplateShelf: false,
    contactWechat: '',
    contactWebsite: '',
  };
}

/** 拉取已发布工作流配方（管理后台） */
export async function remotePublicWorkflows(): Promise<unknown[]> {
  const base = commerceBaseUrl();
  if (!base) return [];
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12_000);
  try {
    const res = await fetch(`${base}/api/public/workflows`, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json', 'User-Agent': 'BnShortVideoFactory' },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

function normalizePrompt(raw: unknown, index: number): CreatePrompt | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Partial<CreatePrompt>;
  const id = String(p.id || '').trim() || `p-${index}`;
  const lang = p.lang === 'en' ? 'en' : 'zh';
  const body = String(p.body || '').trim();
  if (!body) return null;
  if (p.enabled === false) return null;
  return {
    id,
    lang,
    body,
    sort: typeof p.sort === 'number' ? p.sort : index,
    enabled: true,
  };
}

function normalizeCase(raw: unknown, index: number): CreateCase | null {
  if (!raw || typeof raw !== 'object') return null;
  const c = raw as Partial<CreateCase>;
  const id = String(c.id || '').trim();
  if (!id || c.enabled === false) return null;
  const prompts = (Array.isArray(c.prompts) ? c.prompts : [])
    .map((p, i) => normalizePrompt(p, i))
    .filter((p): p is CreatePrompt => !!p)
    .sort((a, b) => a.sort - b.sort);
  return {
    id,
    titleZh: String(c.titleZh || c.id || '').trim() || id,
    titleEn: String(c.titleEn || c.titleZh || c.id || '').trim() || id,
    sort: typeof c.sort === 'number' ? c.sort : index,
    enabled: true,
    prompts,
  };
}

function normalizeType(raw: unknown, index: number): CreateFormType | null {
  if (!raw || typeof raw !== 'object') return null;
  const t = raw as Partial<CreateFormType>;
  const id = String(t.id || '').trim();
  if (!id || isUnmanagedFormTypeId(id) || t.enabled === false) return null;
  const cases = (Array.isArray(t.cases) ? t.cases : [])
    .map((c, i) => normalizeCase(c, i))
    .filter((c): c is CreateCase => !!c)
    .sort((a, b) => a.sort - b.sort);
  return {
    id,
    labelZh: String(t.labelZh || id).trim() || id,
    labelEn: String(t.labelEn || t.labelZh || id).trim() || id,
    tipZh: String(t.tipZh || '').trim(),
    tipEn: String(t.tipEn || '').trim(),
    sort: typeof t.sort === 'number' ? t.sort : index,
    enabled: true,
    cases,
    updatedAt: String(t.updatedAt || '').trim() || new Date().toISOString(),
  };
}

/** 拉取创作目录（类型 → 案例 → 提示词）；失败回落官方种子 */
export async function remoteCreateCatalog(): Promise<CreateCatalog> {
  const fallback = defaultCreateCatalog();
  const base = commerceBaseUrl();
  if (!base) return fallback;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12_000);
  try {
    const res = await fetch(`${base}/api/public/create-catalog`, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json', 'User-Agent': 'BnShortVideoFactory' },
    });
    if (!res.ok) return fallback;
    const data = await res.json();
    if (!data || typeof data !== 'object') return fallback;
    const types = (Array.isArray((data as CreateCatalog).types) ? (data as CreateCatalog).types : [])
      .map((t, i) => normalizeType(t, i))
      .filter((t): t is CreateFormType => !!t)
      .sort((a, b) => a.sort - b.sort);
    if (!types.length) return fallback;
    return {
      types,
      updatedAt: String((data as CreateCatalog).updatedAt || '').trim() || new Date().toISOString(),
    };
  } catch {
    return fallback;
  } finally {
    clearTimeout(timer);
  }
}
