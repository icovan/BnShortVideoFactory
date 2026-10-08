export type UserRole = 'user' | 'admin';
export type UserStatus = 'active' | 'banned';
export type PlanCycle = 'month' | 'year' | 'life';
export type OtpPurpose = 'register' | 'login';

/** 本机免费体验次数（成功开片计数；失败退回） */
export const TRIAL_LIMIT = 5;

export type FactoryRuntime = 'pc' | 'web';

/** 本机授权快照（激活页 / 侧栏 / 门禁共用） */
export type EntitlementSnapshot = {
  runtime: FactoryRuntime;
  machineId: string;
  activated: boolean;
  status: 'trial' | 'active' | 'expired' | 'locked' | 'showcase';
  planId?: string;
  planTitle?: string;
  code?: string;
  activatedAt?: string;
  expiresAt?: string;
  trialLimit: number;
  trialUsed: number;
  trialLeft: number;
  canMake: boolean;
  message: string;
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

export type LocalTrialFile = {
  limit: number;
  used: number;
  /** 已占用的 jobId → 便于失败退回 */
  pendingJobs: string[];
};

export type CaseItem = {
  id: string;
  title: string;
  subtitle: string;
  prompt: string;
  category: string;
  aspect: '9:16' | '16:9' | '1:1' | '3:4';
  engine?: 'explainer-remotion' | 'manim';
  stylePack?: string;
  cover: string;
  /** 可选成片预览；有则创作页可点击播放 */
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
  downloadUrl: string;
  /** PC 更新检测：latest.json 完整 URL */
  updateCheckUrl: string;
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
  contactWechat: string;
  contactWechatQrUrl: string;
  contactDouyin: string;
  contactWebsite: string;
  contactPhone: string;
  contactEmail: string;
};
