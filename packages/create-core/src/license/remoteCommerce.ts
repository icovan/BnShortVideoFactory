/**
 * 对接管理后台商业化 API（激活核销 / 公开站点配置）
 * 基址：BN_COMMERCE_URL 或 BIUNOW_COMMERCE_URL
 */
import type { LocalLicenseFile, PublicAppSite } from '../../../shared/src/index.ts';
import { siteLocalePack, type SiteSettings } from '../../../shared/src/index.ts';

export function commerceBaseUrl(): string {
  return (
    process.env.BN_COMMERCE_URL
    || process.env.BIUNOW_COMMERCE_URL
    || process.env.FACTORY_COMMERCE_URL
    || ''
  ).trim().replace(/\/$/, '');
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

export type RemoteTemplateShelf = {
  cases: unknown[];
  categories: { id: string; label: string; sort?: number }[];
  showTemplateShelf: boolean;
};

/** 拉取已发布模板货架（管理后台 cases + 分类 + 开关） */
export async function remotePublicCases(): Promise<RemoteTemplateShelf> {
  const empty: RemoteTemplateShelf = { cases: [], categories: [], showTemplateShelf: false };
  const base = commerceBaseUrl();
  if (!base) return empty;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12_000);
  try {
    const res = await fetch(`${base}/api/public/cases`, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json', 'User-Agent': 'BnShortVideoFactory' },
    });
    if (!res.ok) return empty;
    const data = await res.json();
    // 旧版返回纯数组：无开关/分类，默认不展示货架
    if (Array.isArray(data)) {
      return { cases: data, categories: [], showTemplateShelf: false };
    }
    if (data && typeof data === 'object') {
      const cases = Array.isArray((data as { cases?: unknown[] }).cases)
        ? (data as { cases: unknown[] }).cases
        : [];
      const categories = Array.isArray((data as { categories?: unknown[] }).categories)
        ? ((data as { categories: { id: string; label: string; sort?: number }[] }).categories)
        : [];
      return {
        cases,
        categories,
        showTemplateShelf: (data as { showTemplateShelf?: boolean }).showTemplateShelf === true,
      };
    }
    return empty;
  } catch {
    return empty;
  } finally {
    clearTimeout(timer);
  }
}
