export type UserRole = 'user' | 'admin';
export type UserStatus = 'active' | 'banned';
export type PlanCycle = 'month' | 'year' | 'life';
export type OtpPurpose = 'register' | 'login';

/** 新机器免费体验天数（日历天） */
export const TRIAL_DAYS = 3;

/** @deprecated 已改为按天体验；保留别名避免旧引用报错 */
export const TRIAL_LIMIT = TRIAL_DAYS;

export type FactoryRuntime = 'pc' | 'web';

/** 本机授权快照（激活弹窗 / 状态条 / 门禁共用） */
export type EntitlementSnapshot = {
  runtime: FactoryRuntime;
  machineId: string;
  activated: boolean;
  status: 'trial' | 'active' | 'expired' | 'locked' | 'showcase';
  planId?: string;
  planTitle?: string;
  code?: string;
  activatedAt?: string;
  /** 专业版到期；缺省且已激活 = 终身 */
  expiresAt?: string;
  trialDays: number;
  trialStartedAt?: string;
  trialEndsAt?: string;
  /**
   * 体验或专业版剩余整天数（向上取整天展示用 floor）。
   * 终身专业版为 null。
   */
  daysLeft: number | null;
  canMake: boolean;
  message: string;
  /** 状态条徽章语义 */
  badge: 'trial' | 'pro' | 'locked' | 'expired' | 'showcase';
};

export type PublicUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  quotaLeft: number;
  createdAt: string;
  planId?: string;
  planTitle?: string;
  licenseStatus?: 'active' | 'revoked';
  licenseExpires?: string;
  machineId?: string;
};

export type Plan = {
  id: string;
  cycle: PlanCycle;
  title: string;
  price: number;
  days: number;
  note: string;
};

export type ActivationCode = {
  id: string;
  code: string;
  planId: string;
  batch: string;
  status: 'unused' | 'used' | 'void';
  createdAt: string;
  expiresAt?: string;
  usedBy?: string;
  usedByEmail?: string;
  usedAt?: string;
  /** 一机一码：核销时绑定的机器指纹 */
  machineId?: string;
  planTitle?: string;
};

export type License = {
  id: string;
  /** 可选：账号核销时写入；纯本机激活可为空串 */
  userId: string;
  userEmail?: string;
  /** 一机一码 */
  machineId?: string;
  planId: string;
  planTitle?: string;
  codeId: string;
  code?: string;
  quotaTotal: number;
  quotaLeft: number;
  status: 'active' | 'revoked';
  createdAt: string;
  expiresAt?: string;
};

export type Redemption = {
  id: string;
  userId: string;
  code: string;
  planId: string;
  at: string;
  machineId?: string;
};

/** 本机落盘的授权文件形状 */
export type LocalLicenseFile = {
  licenseId: string;
  machineId: string;
  code: string;
  planId: string;
  planTitle: string;
  status: 'active' | 'revoked';
  activatedAt: string;
  expiresAt?: string;
};

/** 本机体验窗（按天，非次数） */
export type LocalTrialFile = {
  days: number;
  startedAt: string;
  /** 防简单系统时钟回拨 */
  lastSeenAt: string;
};

/** APP 创作页本地入口形态（非后台工作流） */
export type AppFormMode =
  | 'prompt'
  | 'narrate'
  | 'short'
  | 'tutorial'
  | 'story'
  | 'launch'
  | 'brand'
  | 'remix'
  | 'logo'
  | 'showreel';

export type AppEngine = 'explainer-remotion' | 'manim' | 'footage-remix';
export type AspectRatio = '9:16' | '16:9' | '1:1' | '3:4';

/** 成片工作流配方（老厂 StylePack） */
export type CommerceStylePack =
  | 'skill-directed'
  | 'launch-showreel'
  | 'narrated-explainer'
  | 'next-word-loop'
  | 'footage-remix';

export const STYLE_PACK_OPTIONS: {
  id: CommerceStylePack;
  labelZh: string;
  labelEn: string;
  defaultAspect: AspectRatio;
  defaultEngine: AppEngine;
}[] = [
  { id: 'skill-directed', labelZh: '技能导向', labelEn: 'Skill-directed', defaultAspect: '16:9', defaultEngine: 'explainer-remotion' },
  { id: 'launch-showreel', labelZh: '发布秀卷', labelEn: 'Launch showreel', defaultAspect: '16:9', defaultEngine: 'explainer-remotion' },
  { id: 'narrated-explainer', labelZh: '旁白解说', labelEn: 'Narrated explainer', defaultAspect: '16:9', defaultEngine: 'explainer-remotion' },
  { id: 'next-word-loop', labelZh: '下一词回路', labelEn: 'Next-word loop', defaultAspect: '9:16', defaultEngine: 'explainer-remotion' },
  { id: 'footage-remix', labelZh: '素材混剪', labelEn: 'Footage remix', defaultAspect: '9:16', defaultEngine: 'footage-remix' },
];

export function normalizeStylePack(raw?: string): CommerceStylePack {
  const id = String(raw || '').trim() as CommerceStylePack;
  if (STYLE_PACK_OPTIONS.some((o) => o.id === id)) return id;
  if (raw === 'remix' || raw === 'footage-remix') return 'footage-remix';
  if (raw === 'narrate' || raw === 'tutorial') return 'narrated-explainer';
  if (raw === 'short') return 'next-word-loop';
  if (raw === 'launch' || raw === 'showreel' || raw === 'logo' || raw === 'brand' || raw === 'story') {
    return raw === 'story' ? 'skill-directed' : 'launch-showreel';
  }
  return 'skill-directed';
}

export function engineForStylePack(stylePack: CommerceStylePack, override?: AppEngine): AppEngine {
  if (stylePack === 'footage-remix') return 'footage-remix';
  if (override === 'manim') return 'manim';
  if (override === 'footage-remix') return 'explainer-remotion';
  return override || 'explainer-remotion';
}

/** 模板货架条目：种子提示词 + 绑定工作流 */
export type CaseItem = {
  id: string;
  title: string;
  subtitle: string;
  prompt: string;
  category: string;
  aspect: AspectRatio;
  engine?: AppEngine | 'explainer-remotion' | 'manim';
  stylePack: CommerceStylePack;
  workflowId?: string;
  cover: string;
  previewVideo?: string;
  tall: number;
  kind: string;
  published: boolean;
};

export type CaseCategory = {
  id: string;
  label: string;
  sort: number;
};

/** 管理后台下发的成片工作流配方（StylePack） */
export type WorkflowItem = {
  id: string;
  titleZh: string;
  titleEn: string;
  subtitleZh?: string;
  subtitleEn?: string;
  stylePack: CommerceStylePack;
  engine: AppEngine;
  aspect?: AspectRatio;
  voMode?: 'on' | 'off' | 'auto';
  scriptDrive?: 'off' | 'auto' | 'polish' | 'verbatim';
  cover?: string;
  previewVideo?: string;
  promptTemplateZh: string;
  promptTemplateEn: string;
  published: boolean;
  sort: number;
  updatedAt: string;
};

export type Announcement = {
  id: string;
  title: string;
  body: string;
  at: string;
};

export type AuditLog = {
  id: string;
  actor: string;
  action: string;
  detail: string;
  at: string;
};

export type Me = PublicUser & {
  license?: License | null;
  entitlement?: EntitlementSnapshot;
  machineId?: string;
};

/** 按语言的站点运营字段 */
export type SiteLocalePack = {
  aboutUrl: string;
  downloadUrl: string;
  updateCheckUrl: string;
  copyright: string;
};

export type SiteSettings = {
  siteName: string;
  siteSubtitle: string;
  siteTitle: string;
  metaKeywords: string;
  metaDescription: string;
  logoUrl: string;
  faviconUrl: string;
  icpNumber: string;
  tutorialUrl: string;
  /** @deprecated 使用 downloadUrlZh / downloadUrlEn */
  downloadUrl: string;
  /** @deprecated 使用 updateCheckUrlZh / updateCheckUrlEn */
  updateCheckUrl: string;
  aboutUrlZh: string;
  aboutUrlEn: string;
  downloadUrlZh: string;
  downloadUrlEn: string;
  updateCheckUrlZh: string;
  updateCheckUrlEn: string;
  copyrightZh: string;
  copyrightEn: string;
  /** 新机体验天数；默认 TRIAL_DAYS */
  trialDays: number;
  /** APP 是否展示模板货架（默认关） */
  showTemplateShelf: boolean;
  contactWechat: string;
  /** 客服微信二维码图片 URL（/assets/…） */
  contactWechatQrUrl: string;
  contactDouyin: string;
  contactWebsite: string;
  contactPhone: string;
  contactEmail: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPass?: string;
  smtpFrom: string;
  smtpFromName: string;
  otpRegisterSubject: string;
  otpRegisterHtml: string;
  otpLoginSubject: string;
  otpLoginHtml: string;
};

export type PublicSiteSettings = Omit<SiteSettings, 'smtpPass'> & {
  smtpConfigured: boolean;
  hasSmtpPass: boolean;
};

/** APP 拉取的公开站点配置（已按语言折叠） */
export type PublicAppSite = {
  lang: 'zh-CN' | 'en';
  siteName: string;
  aboutUrl: string;
  downloadUrl: string;
  updateCheckUrl: string;
  copyright: string;
  trialDays: number;
  showTemplateShelf: boolean;
  contactWechat: string;
  contactWebsite: string;
};

export type StorageDriver = 'local' | 'tencent' | 'aliyun';

export type StorageConfig = {
  driver: StorageDriver;
  pathPrefix: string;
  customDomain: string;
  tencent: {
    secretId: string;
    secretKey: string;
    secretKeySet?: boolean;
    region: string;
    bucket: string;
  };
  aliyun: {
    accessKeyId: string;
    accessKeySecret: string;
    accessKeySecretSet?: boolean;
    endpoint: string;
    bucket: string;
  };
};

export type PublicBrand = {
  siteName: string;
  siteSubtitle: string;
  siteTitle: string;
  logoUrl: string;
  faviconUrl: string;
  icpNumber: string;
  tutorialUrl: string;
  downloadUrl: string;
  updateCheckUrl: string;
  aboutUrl: string;
  copyright: string;
  contactWechat: string;
  contactWechatQrUrl: string;
  contactDouyin: string;
  contactWebsite: string;
  contactPhone: string;
  contactEmail: string;
};

export function siteLocalePack(settings: Pick<
  SiteSettings,
  | 'aboutUrlZh'
  | 'aboutUrlEn'
  | 'downloadUrlZh'
  | 'downloadUrlEn'
  | 'downloadUrl'
  | 'updateCheckUrlZh'
  | 'updateCheckUrlEn'
  | 'updateCheckUrl'
  | 'copyrightZh'
  | 'copyrightEn'
>, lang: string): SiteLocalePack {
  const zh = lang === 'zh' || lang.toLowerCase().startsWith('zh');
  return {
    aboutUrl: (zh ? settings.aboutUrlZh : settings.aboutUrlEn) || '',
    downloadUrl:
      (zh ? settings.downloadUrlZh : settings.downloadUrlEn)
      || settings.downloadUrl
      || '',
    updateCheckUrl:
      (zh ? settings.updateCheckUrlZh : settings.updateCheckUrlEn)
      || settings.updateCheckUrl
      || '',
    copyright:
      (zh ? settings.copyrightZh : settings.copyrightEn)
      || (zh ? '©2026 在线信息 版权所有。' : '©2026 Online Info. All rights reserved.'),
  };
}
