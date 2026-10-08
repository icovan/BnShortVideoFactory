import type { PublicUser } from '../../../shared/src/index.ts';

export function isLocalOpen(): boolean {
  return true;
}

export function localOpenUser(): PublicUser {
  return {
    id: 'local-open',
    email: 'local@biunow',
    name: 'Biunow Local',
    role: 'admin',
    status: 'active',
    quotaLeft: 99999,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}
