/**
 * 创作面板 formMode：
 * - remix：独立混剪管线（此处仍返回 null，由 fromPrompt 分支）
 * - 其余（自由/解说/教程/故事/宣发/标志与类型）：技法路由与自由模式一致，不锁池
 * 形态差异只靠底部案例提示词，不硬绑 skill。
 */
import type { SkillName } from '../llm.ts';
import { SOFT_CRAFT_SKILLS, isSkillName } from '../skills/registry.ts';

export type PanelFormMode =
  | 'prompt'
  | 'narrate'
  | 'short'
  | 'tutorial'
  | 'story'
  | 'launch'
  | 'brand'
  | 'logo'
  | 'showreel'
  | 'remix'
  | 'mg'
  | 'stickman';

export type BrandSubtype = 'logo' | 'showreel';

export type FormModePool = {
  primaries: SkillName[];
  leaves: SkillName[];
  softDocs?: SkillName[];
  defaultPrimary: SkillName;
  filmKind?: 'logo' | 'showreel';
};

export function resolveBrandSubtype(
  formMode?: string,
  brandSubtype?: string,
): BrandSubtype | undefined {
  if (brandSubtype === 'logo' || brandSubtype === 'showreel') return brandSubtype;
  if (formMode === 'logo' || formMode === 'stickman') return 'logo';
  if (formMode === 'showreel' || formMode === 'mg') return 'showreel';
  if (formMode === 'brand') return 'logo';
  return undefined;
}

/** 一律不锁池；案例文案承担形态差异 */
export function poolForFormMode(
  _formMode?: string,
  _brandSubtype?: string,
): FormModePool | null {
  return null;
}

const LEAF_CAP = 3;

function isSoftDoc(id: SkillName): boolean {
  return SOFT_CRAFT_SKILLS.includes(id);
}

/**
 * 套预算：软文档进 brand；leaf ≤3。
 * 不再按 formMode 改写 primary / 过滤 leaves。
 */
export function applyFormModeSkillBudget(opts: {
  primary: SkillName;
  support: SkillName[];
  brandSkills?: SkillName[];
  formMode?: string;
  brandSubtype?: string;
}): {
  primary: SkillName;
  support: SkillName[];
  brandSkills: SkillName[];
  filmKind?: 'logo' | 'showreel';
} {
  void opts.formMode;
  void opts.brandSubtype;
  const primary = opts.primary;
  let support = [...opts.support].filter(isSkillName).filter((s) => s !== primary);
  let brand = [...(opts.brandSkills || [])].filter(isSkillName);

  const softFromSupport = support.filter(isSoftDoc);
  support = support.filter((s) => !isSoftDoc(s) && s !== primary).slice(0, LEAF_CAP);
  brand = [...new Set([...brand, ...softFromSupport])];
  return { primary, support, brandSkills: brand.filter((s) => s !== primary) };
}
