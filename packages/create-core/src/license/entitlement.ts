/**
 * 本机授权：machineId + license.json + trial.json（按天体验）
 * 出片门禁：有效激活 或 体验未到期。
 */
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { hostname, networkInterfaces, platform, userInfo } from 'node:os';
import { join } from 'node:path';
import {
  TRIAL_DAYS,
  type EntitlementSnapshot,
  type FactoryRuntime,
  type LocalLicenseFile,
  type LocalTrialFile,
} from '../../../shared/src/index.ts';
import { DATA_DIR } from '../store.ts';

const DIR = join(DATA_DIR, 'license');
mkdirSync(DIR, { recursive: true });

const MACHINE_FILE = join(DIR, 'machine.json');
const LICENSE_FILE = join(DIR, 'license.json');
const TRIAL_FILE = join(DIR, 'trial.json');

type MachineFile = { machineId: string; createdAt: string; fingerprint?: string };

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

function fingerprintSeed(): string {
  const nets = networkInterfaces();
  const macs: string[] = [];
  for (const list of Object.values(nets)) {
    for (const n of list || []) {
      if (!n.internal && n.mac && n.mac !== '00:00:00:00:00:00') macs.push(n.mac.toLowerCase());
    }
  }
  macs.sort();
  let user = 'local';
  try {
    user = userInfo().username || 'local';
  } catch {
    /* ignore */
  }
  return [platform(), hostname(), user, macs.join('|') || 'nomac'].join('::');
}

function ensureMachine(): MachineFile {
  const cur = readJson<Partial<MachineFile>>(MACHINE_FILE, {});
  if (cur.machineId && /^m_[a-f0-9]{16,}$/i.test(cur.machineId)) {
    return {
      machineId: cur.machineId,
      createdAt: cur.createdAt || new Date().toISOString(),
      fingerprint: cur.fingerprint,
    };
  }
  const fp = fingerprintSeed();
  const machineId = `m_${createHash('sha256').update(fp).update(randomBytes(4)).digest('hex').slice(0, 24)}`;
  const row: MachineFile = {
    machineId,
    createdAt: new Date().toISOString(),
    fingerprint: createHash('sha256').update(fp).digest('hex').slice(0, 16),
  };
  writeJson(MACHINE_FILE, row);
  return row;
}

function trialDaysConfigured(): number {
  const fromEnv = Number(process.env.BN_TRIAL_DAYS || process.env.BIUNOW_TRIAL_DAYS || '');
  if (Number.isFinite(fromEnv) && fromEnv > 0) return Math.min(365, Math.trunc(fromEnv));
  return TRIAL_DAYS;
}

function ensureTrial(): LocalTrialFile {
  const days = trialDaysConfigured();
  const raw = readJson<Partial<LocalTrialFile> & { limit?: number; used?: number }>(TRIAL_FILE, {});
  // 迁移旧「次数」文件：首次见到无 startedAt 时开新体验窗
  if (raw.startedAt && typeof raw.startedAt === 'string') {
    const startedAt = raw.startedAt;
    const lastSeenAt = raw.lastSeenAt && typeof raw.lastSeenAt === 'string'
      ? raw.lastSeenAt
      : startedAt;
    const row: LocalTrialFile = {
      days: typeof raw.days === 'number' && raw.days > 0 ? Math.trunc(raw.days) : days,
      startedAt,
      lastSeenAt,
    };
    const now = Date.now();
    const last = new Date(row.lastSeenAt).getTime();
    if (Number.isFinite(last) && now + 60_000 < last) {
      // 时钟回拨：不延长体验，仍用 lastSeenAt 作为「现在」
      return row;
    }
    if (!Number.isFinite(last) || now > last) {
      row.lastSeenAt = new Date().toISOString();
      writeJson(TRIAL_FILE, row);
    }
    return row;
  }
  const nowIso = new Date().toISOString();
  const row: LocalTrialFile = { days, startedAt: nowIso, lastSeenAt: nowIso };
  writeJson(TRIAL_FILE, row);
  return row;
}

function effectiveNow(trial: LocalTrialFile): number {
  const wall = Date.now();
  const last = new Date(trial.lastSeenAt).getTime();
  if (Number.isFinite(last) && wall + 60_000 < last) return last;
  return wall;
}

/** 剩余整天数（至少 0）；已过期为 0 */
export function remainingWholeDays(endsAtMs: number, nowMs: number): number {
  const ms = endsAtMs - nowMs;
  if (ms <= 0) return 0;
  return Math.max(1, Math.ceil(ms / 86_400_000));
}

function trialWindow(trial: LocalTrialFile) {
  const start = new Date(trial.startedAt).getTime();
  const endsAt = start + trial.days * 86_400_000;
  const now = effectiveNow(trial);
  const left = remainingWholeDays(endsAt, now);
  return { endsAt, now, left, active: now < endsAt };
}

function readLocalLicense(): LocalLicenseFile | null {
  const raw = readJson<Partial<LocalLicenseFile> | null>(LICENSE_FILE, null);
  if (!raw || !raw.licenseId || !raw.machineId) return null;
  return {
    licenseId: raw.licenseId,
    machineId: raw.machineId,
    code: raw.code || '',
    planId: raw.planId || '',
    planTitle: raw.planTitle || '',
    status: raw.status === 'revoked' ? 'revoked' : 'active',
    activatedAt: raw.activatedAt || '',
    expiresAt: raw.expiresAt,
  };
}

export function writeLocalLicense(lic: LocalLicenseFile) {
  writeJson(LICENSE_FILE, lic);
}

function runtimeMode(): FactoryRuntime {
  const v = (process.env.FACTORY_RUNTIME || process.env.FACTORY_MODE || 'pc').toLowerCase();
  return v === 'web' || v === 'showcase' ? 'web' : 'pc';
}

function licenseAlive(
  lic: { status: string; expiresAt?: string; machineId?: string } | null | undefined,
  machineId: string,
): boolean {
  if (!lic || lic.status !== 'active') return false;
  if (lic.machineId && lic.machineId !== machineId) return false;
  if (lic.expiresAt && Date.now() > new Date(lic.expiresAt).getTime()) return false;
  return true;
}

function resolveActiveLicense(machineId: string): LocalLicenseFile | null {
  const local = readLocalLicense();
  if (local && licenseAlive(local, machineId)) return local;
  return null;
}

function skipGate(): boolean {
  const v = (process.env.BN_DEV_LICENSE || process.env.BIUNOW_DEV_LICENSE || '').trim();
  return v === '1' || v.toLowerCase() === 'true';
}

function snapshotOf(machineId: string): EntitlementSnapshot {
  const runtime = runtimeMode();
  const trial = ensureTrial();
  const win = trialWindow(trial);
  const trialEndsAt = new Date(win.endsAt).toISOString();

  if (runtime === 'web') {
    return {
      runtime,
      machineId,
      activated: false,
      status: 'showcase',
      trialDays: trial.days,
      trialStartedAt: trial.startedAt,
      trialEndsAt,
      daysLeft: 0,
      canMake: false,
      badge: 'showcase',
      message: 'Web 端仅展示，请下载 PC 端创作并激活',
    };
  }

  if (skipGate()) {
    return {
      runtime,
      machineId,
      activated: true,
      status: 'active',
      planTitle: 'DEV',
      trialDays: trial.days,
      trialStartedAt: trial.startedAt,
      trialEndsAt,
      daysLeft: null,
      canMake: true,
      badge: 'pro',
      message: '开发模式：跳过激活门禁',
    };
  }

  const active = resolveActiveLicense(machineId);
  if (active) {
    const life = !active.expiresAt;
    let daysLeft: number | null = null;
    if (!life && active.expiresAt) {
      daysLeft = remainingWholeDays(new Date(active.expiresAt).getTime(), Date.now());
    }
    return {
      runtime,
      machineId,
      activated: true,
      status: 'active',
      planId: active.planId,
      planTitle: active.planTitle,
      code: active.code,
      activatedAt: active.activatedAt,
      expiresAt: active.expiresAt,
      trialDays: trial.days,
      trialStartedAt: trial.startedAt,
      trialEndsAt,
      daysLeft,
      canMake: true,
      badge: 'pro',
      message: life
        ? '已激活 · 终身专业版'
        : `已激活 · 专业版剩余 ${daysLeft} 天`,
    };
  }

  const local = readLocalLicense();
  if (
    local
    && local.machineId === machineId
    && local.expiresAt
    && Date.now() > new Date(local.expiresAt).getTime()
  ) {
    return {
      runtime,
      machineId,
      activated: false,
      status: 'expired',
      planId: local.planId,
      planTitle: local.planTitle,
      code: local.code,
      activatedAt: local.activatedAt,
      expiresAt: local.expiresAt,
      trialDays: trial.days,
      trialStartedAt: trial.startedAt,
      trialEndsAt,
      daysLeft: win.active ? win.left : 0,
      canMake: win.active,
      badge: win.active ? 'trial' : 'expired',
      message: win.active
        ? `专业版已过期，体验剩余 ${win.left} 天`
        : '专业版已过期，请重新输入激活码',
    };
  }

  if (win.active) {
    return {
      runtime,
      machineId,
      activated: false,
      status: 'trial',
      trialDays: trial.days,
      trialStartedAt: trial.startedAt,
      trialEndsAt,
      daysLeft: win.left,
      canMake: true,
      badge: 'trial',
      message: `体验剩余 ${win.left} 天`,
    };
  }

  return {
    runtime,
    machineId,
    activated: false,
    status: 'locked',
    trialDays: trial.days,
    trialStartedAt: trial.startedAt,
    trialEndsAt,
    daysLeft: 0,
    canMake: false,
    badge: 'locked',
    message: '体验已结束，请输入激活码（一机一码）',
  };
}

export const entitlement = {
  runtime: runtimeMode,
  machineId(): string {
    return ensureMachine().machineId;
  },
  status(userRole?: string): EntitlementSnapshot {
    const machineId = ensureMachine().machineId;
    if (userRole === 'admin') {
      const base = snapshotOf(machineId);
      return {
        ...base,
        canMake: base.runtime !== 'web',
        message: base.runtime === 'web' ? base.message : '管理员跳过激活门禁',
      };
    }
    return snapshotOf(machineId);
  },
  /** 出片前校验（按天体验不扣次） */
  beginMake(jobId: string, userRole?: string) {
    void jobId;
    const st = this.status(userRole);
    if (st.runtime === 'web') throw Object.assign(new Error(st.message), { status: 402 });
    if (userRole === 'admin') return { ok: true as const, mode: 'admin' as const, entitlement: st };
    if (st.activated && st.status === 'active') {
      return { ok: true as const, mode: 'licensed' as const, entitlement: st };
    }
    if (!st.canMake) throw Object.assign(new Error(st.message || '请先激活'), { status: 402 });
    return { ok: true as const, mode: 'trial' as const, entitlement: st };
  },
  refundMake(_jobId: string) {
    /* 按天体验无需退回 */
  },
  commitMake(_jobId: string) {
    /* 按天体验无需提交占用 */
  },
  saveActivated(lic: LocalLicenseFile) {
    writeLocalLicense(lic);
  },
  clearLocalLicense() {
    if (existsSync(LICENSE_FILE)) {
      const cur = readLocalLicense();
      if (cur) writeLocalLicense({ ...cur, status: 'revoked' });
    }
  },
};
