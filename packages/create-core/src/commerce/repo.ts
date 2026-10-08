/** Local-open stub：无账号 / 配额体系 */
import type { CaseItem } from '../../../shared/src/index.ts';

export const ASSETS_DIR = '';

export const commerce = {
  publishedCases(): CaseItem[] {
    return [];
  },
  refundQuota(_userId: string, _projectId: string) {
    /* no-op */
  },
};
