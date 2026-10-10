/**
 * 本机授权自检：node --import tsx src/scripts/selfcheckLicense.ts
 */
import assert from 'node:assert/strict';
import { remainingWholeDays, entitlement } from '../license/entitlement.ts';

const day = 86_400_000;
assert.equal(remainingWholeDays(Date.now() + day * 2.2, Date.now()), 3);
assert.equal(remainingWholeDays(Date.now() + day * 0.1, Date.now()), 1);
assert.equal(remainingWholeDays(Date.now() - 1000, Date.now()), 0);

const st = entitlement.status();
assert.ok(st.machineId.startsWith('m_'), 'machineId');
assert.ok(st.trialDays >= 1, 'trialDays');
assert.ok(['trial', 'active', 'expired', 'locked', 'showcase'].includes(st.status), 'status');
assert.ok(typeof st.canMake === 'boolean', 'canMake');
assert.ok(st.badge, 'badge');

if (st.canMake) {
  const r = entitlement.beginMake(`selfcheck-${Date.now()}`);
  assert.ok(r.ok);
  entitlement.commitMake(`selfcheck-${Date.now()}`);
}

console.info('[selfcheckLicense] ok', {
  machineId: st.machineId,
  status: st.status,
  badge: st.badge,
  daysLeft: st.daysLeft,
  canMake: st.canMake,
  message: st.message,
});
