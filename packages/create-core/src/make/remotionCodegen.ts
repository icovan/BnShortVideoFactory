import { createRequire } from 'node:module';
import { chatJson, chatText, readSkill, readSkillPack, type SkillName } from '../llm.ts';
import { craftDepthBrief, type BeatSkillRef } from '../skills/skillDepth.ts';
import type { Aspect, Settings } from '../../../shared/src/index.ts';
import {
  collectBeatKinds,
  extractConstArray,
  jsonToTsObjectLiteral,
  spliceConstArrayItems,
  surgicalDriftTooHigh,
  syncBeatsCopyFromScenes,
} from './surgicalBeats.ts';
import {
  assertFilmCraftDensity,
  assertRevealFamilyRotation,
  assertScreenAssetsDrawn,
  cinematicFloorLine,
  cinematicMotionFloor,
  filmCraftDensityLaw,
  revealFamilyHardRules,
  type CraftKind,
} from './craftFloor.ts';
import { canvasLawForAspect } from './canvas/index.ts';
import { logoCodegenHint, showreelCodegenHint } from './mgFilm.ts';
import { motifLockLaw, type MotifLock } from './directorToolkit.ts';

const requireTs = createRequire(import.meta.url);

/** esbuild/TS 语法门禁：软接受风格问题可以，语法错误绝不能放行 */
export function parseTsxSyntaxIssues(src: string, fileName = 'Active.tsx'): string[] {
  try {
    // typescript 为 create-core 的本地依赖（devDependency，安装后可用）
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ts = requireTs('typescript') as typeof import('typescript');
    const result = ts.transpileModule(src, {
      compilerOptions: {
        jsx: ts.JsxEmit.ReactJSX,
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.ESNext,
        esModuleInterop: true,
        skipLibCheck: true,
        noLib: true,
      },
      reportDiagnostics: true,
      fileName,
    });
    const diags = (result.diagnostics || []).filter(
      (d) => d.category === ts.DiagnosticCategory.Error,
    );
    return diags.slice(0, 6).map((d) => {
      const msg = ts.flattenDiagnosticMessageText(d.messageText, ' ');
      let loc = '';
      if (d.file && typeof d.start === 'number') {
        const { line } = d.file.getLineAndCharacterOfPosition(d.start);
        loc = `L${line + 1}: `;
      }
      return `syntax ${loc}${msg}`;
    });
  } catch (e) {
    return [`syntax check failed: ${e instanceof Error ? e.message : String(e)}`];
  }
}

/** Brace-matched spring({ ... }) bodies, so a nested config `}` is not the end. */
export function springObjectSpans(src: string): { open: number; close: number }[] {
  const spans: { open: number; close: number }[] = [];
  const re = /spring\s*\(\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const open = m.index + m[0].length - 1;
    let depth = 0;
    let close = -1;
    for (let i = open; i < src.length; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') {
        depth--;
        if (depth === 0) {
          close = i;
          break;
        }
      }
    }
    if (close < 0) break;
    spans.push({ open, close });
    re.lastIndex = close + 1;
  }
  return spans;
}

function springFpsProblem(body: string): 'missing' | 'bad' | null {
  const prop = body.match(/(?:^|[,{\s])fps\s*:\s*([^,}\n]+)/);
  if (prop) {
    const expr = prop[1].trim();
    if (expr === '0' || /\bframe\b/.test(expr)) return 'bad';
    return null;
  }
  if (/(?:^|[,{\s])fps\s*(?=,|\})/.test(body)) return null;
  return 'missing';
}

/**
 * 像 JS 代码行（位移/语句/泛型），不是「Step A >> Step B」这类纯文本。
 * 注意：不能用「>> 后接字母」判定位移，否则会把 JSX 文案误判成代码。
 */
function looksLikeJsExpressionLine(line: string): boolean {
  if (line.includes('{') || line.includes('</') || line.includes('/>')) return true;
  if (/>>\s*=/.test(line) || /<<\s*=/.test(line)) return true;
  if (/\b(return|const|let|var|type|interface|function|Array|Record|Map|Set|Promise|React\.FC)\b/.test(line)) {
    return true;
  }
  // 位移常伴 &|^~ / 括号 / 方括号 / 数字右操作数
  if (/[&|^~;\[\]]/.test(line)) return true;
  if (/\([^)]*(>>|<<|>>>|≫|≪)/.test(line)) return true;
  if (/(>>|<<|>>>|≫|≪)\s*\d/.test(line)) return true;
  return false;
}

/**
 * VO/bed 在 public 根；画面素材在 public/assets。
 * LLM 常写 `assetSrc(f) => staticFile(f.includes('/') ? f : \`assets/\${f}\`)`，
 * 把 `vo-0.mp3` 错挂成 `assets/vo-0.mp3` → Remotion 404。
 */
export function repairMediaStaticPaths(src: string): string {
  let s = src;
  s = s.replace(
    /const\s+(\w+)\s*=\s*\(\s*f\s*:\s*string\s*\)\s*=>\s*staticFile\(\s*f\.includes\(\s*['"]\/['"]\s*\)\s*\?\s*f\s*:\s*`assets\/\$\{f\}`\s*\)\s*;?/g,
    'const $1 = (f: string) => staticFile(!f ? \'\' : (f.includes(\'/\') || /^(vo-\\d+|narration|bed\\.|music)/i.test(f) ? f : `assets/${f}`));',
  );
  // 字面量 / 模板误加 assets/ 前缀
  s = s.replace(
    /staticFile\(\s*`assets\/\$\{([^}]*narrationFile[^}]*)\}`\s*\)/gi,
    'staticFile($1)',
  );
  s = s.replace(
    /staticFile\(\s*['"]assets\/((?:vo-\d+|narration|bed|music)[^'"]*)['"]\s*\)/gi,
    "staticFile('$1')",
  );
  return s;
}

/** Remotion interpolate.easing 必须是函数；LLM 常写成字符串 'linear' → 运行期 TypeError */
export function repairInterpolateEasing(src: string): string {
  return (src || '')
    .replace(
      /easing\s*:\s*['"]linear['"](\s+as\s+unknown\s+as\s+\w+)?/gi,
      'easing: (t: number) => t',
    )
    .replace(
      /easing\s*:\s*['"](ease(?:-in)?(?:-out)?|in|out|inOut)['"](\s+as\s+unknown\s+as\s+\w+)?/gi,
      'easing: (t: number) => t',
    );
}

/** codegen / seal 共用：位移、媒体路径、字体、spring fps、easing */
export function sealDirectedSource(src: string): string {
  return repairUnsafeGoogleFonts(
    repairMediaStaticPaths(repairJsxBareGt(repairSpringFps(repairInterpolateEasing(src)))),
  );
}

/**
 * LLM 常在 JSX 文本里写 `A >> B`，esbuild 会报 `>` invalid inside JSX.
 * 仅把「纯文本行」的 `>>` 换成 `≫`；位移 / 泛型收口必须保持 ASCII `>>`。
 * 旧逻辑误伤 `return [(n >> 16) & 255, …]` → `≫`，tsc/esbuild 必炸。
 */
export function repairJsxBareGt(src: string): string {
  // 1) 代码行里的 Unicode 位移 → ASCII（LLM 直写或旧 repair 误伤）
  let out = src
    .split('\n')
    .map((line) => {
      if (!/[≫≪]/.test(line)) return line;
      if (!looksLikeJsExpressionLine(line)) return line;
      return line.replace(/≫/g, '>>').replace(/≪/g, '<<');
    })
    .join('\n')
    // 泛型收口误伤（任意行）
    .replace(/(React\.FC<\w+)≫(\s*=)/g, '$1>>$2')
    .replace(/(Array<React\.FC<\w+)≫(\s*=)/g, '$1>>$2')
    .replace(/(Record<[^>]+)≫(\s*=)/g, '$1>>$2')
    .replace(/:\s*(Array<[^;=\n]*)≫(\s*=)/g, ': $1>>$2');
  // 2) 仅纯 JSX 文本行：裸 >> → ≫（避免 esbuild JSX 解析炸）
  return out
    .split('\n')
    .map((line) => {
      if (!/>>/.test(line)) return line;
      if (looksLikeJsExpressionLine(line)) return line;
      if (!/^\s*[^<{\n]/.test(line)) return line;
      return line.replace(/>>/g, '≫');
    })
    .join('\n');
}

/**
 * Remotion @remotion/google-fonts：NotoSerifSC / NotoSansSC 的
 * `chinese-simplified` + weight 400 在运行时经常不可用 → 首渲必炸。
 * 硬策略：一律 Inter + latin；中文靠系统字体回退（微软雅黑 / 苹方）。
 */
const FONT_SAFE = new Set(['Inter']);

export function repairUnsafeGoogleFonts(src: string): string {
  let s = src;
  const dirty = /@remotion\/google-fonts\/(?!Inter\b)/.test(s)
    || /chinese-simplified/i.test(s)
    || /NotoSerifSC|NotoSansSC/i.test(s);
  if (!dirty && /@remotion\/google-fonts\/Inter/.test(s) && /subsets:\s*\[[^\]]*latin/.test(s)) {
    // 已是 Inter+latin，补 CJK 回退栈即可
  } else if (dirty || /loadFont\s*\(/.test(s)) {
    s = s.replace(
      /import\s*\{([^}]*\bloadFont\b[^}]*)\}\s*from\s*['"]@remotion\/google-fonts\/[^'"]+['"]\s*;?/g,
      `import { loadFont } from '@remotion/google-fonts/Inter';`,
    );
    s = s.replace(
      /from\s*['"]@remotion\/google-fonts\/(?!Inter')[^'"]+['"]/g,
      `from '@remotion/google-fonts/Inter'`,
    );
    s = s.replace(
      /loadFont\(\s*(['"]normal['"])\s*,\s*\{[\s\S]*?\}\s*\)/g,
      `loadFont($1, {\n  weights: ['400', '500', '600', '700'],\n  subsets: ['latin'],\n})`,
    );
  }

  // 注入 CJK 系统字体回退栈；样式里的 fontFamily: ZH/FONT 换成栈（不动解构行）
  if (/loadFont\s*\(/.test(s) && !/FONT_CJK_STACK/.test(s)) {
    const m = s.match(/const\s*\{\s*fontFamily:\s*(\w+)\s*\}\s*=\s*loadFont/);
    const local = m?.[1];
    if (local) {
      const inject = `\n/** CJK glyphs via OS fonts (YaHei / PingFang); Google CJK subsets disabled. */\nconst FONT_CJK_STACK = [${local}, '"Microsoft YaHei"', '"PingFang SC"', 'sans-serif'].join(', ');\n`;
      s = s.replace(
        /(const\s*\{\s*fontFamily:\s*\w+\s*\}\s*=\s*loadFont\([\s\S]*?\);)/,
        `$1${inject}`,
      );
      s = s.split('\n').map((line) => {
        if (/const\s*\{/.test(line) && /fontFamily:/.test(line)) return line;
        if (/^\s*fontFamily:\s*\w+\s*,?\s*$/.test(line)) return line; // 多行解构
        return line.replace(
          new RegExp(`fontFamily:\\s*${local}\\b`, 'g'),
          'fontFamily: FONT_CJK_STACK',
        );
      }).join('\n');
    }
  }
  return s;
}

export function assertSafeGoogleFonts(src: string): string[] {
  const issues: string[] = [];
  for (const m of src.matchAll(/@remotion\/google-fonts\/([A-Za-z0-9_]+)/g)) {
    if (!FONT_SAFE.has(m[1])) {
      issues.push(`font: use @remotion/google-fonts/Inter only (got ${m[1]})`);
    }
  }
  // 只查 loadFont 选项里的子集，忽略注释
  if (/loadFont\s*\(\s*['"]normal['"]\s*,\s*\{[^}]*chinese-simplified/i.test(src)) {
    issues.push('font: chinese-simplified subset forbidden (crashes Remotion google-fonts)');
  }
  return issues;
}

export function repairSpringFps(src: string): string {
  const spans = springObjectSpans(src);
  let out = src;
  for (let i = spans.length - 1; i >= 0; i--) {
    const { open, close } = spans[i];
    const body = out.slice(open + 1, close);
    const problem = springFpsProblem(body);
    if (problem === 'bad') {
      const next = body.replace(/fps\s*:\s*([^,}\n]+)/, 'fps: useVideoConfig().fps');
      out = out.slice(0, open + 1) + next + out.slice(close);
    } else if (problem === 'missing') {
      out = out.slice(0, open + 1) + ' fps: useVideoConfig().fps,' + body + out.slice(close);
    }
  }
  if (out.includes('useVideoConfig()')) {
    out = out.replace(
      /import\s*\{([^}]+)\}\s*from\s*(['"]remotion['"])/,
      (full, names: string, quote: string) => (
        /\buseVideoConfig\b/.test(names) ? full : `import { useVideoConfig,${names}} from ${quote}`
      ),
    );
  }
  return out;
}

/**
 * spring() fps must be the composition fps. Passing `frame` is 0 on the first
 * frame of a Sequence, which still sampling skips and full encode hits.
 */
export function assertSpringFps(src: string): string[] {
  const issues: string[] = [];
  for (const span of springObjectSpans(src)) {
    const body = src.slice(span.open + 1, span.close);
    const problem = springFpsProblem(body);
    if (problem === 'bad') {
      const expr = body.match(/fps\s*:\s*([^,}\n]+)/)?.[1]?.trim() || 'frame';
      issues.push(
        `spring fps: got "${expr}" — pass useVideoConfig().fps, never frame or 0 (frame 0 crashes encode)`,
      );
    } else if (problem === 'missing') {
      issues.push('spring fps: every spring() must pass fps from useVideoConfig()');
    }
  }
  if (/\b\w+\s*\(\s*frame\s*,\s*frame\b/.test(src)) {
    issues.push(
      'spring fps: do not pass frame as the fps argument (helper(frame, frame, …) is 0 on the first frame)',
    );
  }
  return issues;
}

/**
 * Spoken beats last as long as the voice. A reveal that ends on a fixed early
 * frame leaves a frozen card while the line is still being read.
 */
export function assertMotionSpansScene(src: string, durations: number[] = []): string[] {
  const long = durations.filter((d) => Number(d) >= 6);
  if (!long.length) return [];
  if (/durationInFrames\s*\*\s*0\.[6-9]|dur\s*\*\s*0\.[6-9]|frame\s*\/\s*\(?\s*(?:dur\b|durationInFrames)|reveal\s*\(/.test(src)) {
    return [];
  }
  const ends: number[] = [];
  const re = /interpolate\s*\(\s*(?:frame|f)\s*,\s*\[\s*[\d.]+\s*,\s*([\d.]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) ends.push(Number(m[1]));
  const maxEnd = ends.length ? Math.max(...ends) : 0;
  const longest = Math.max(...long);
  const need = Math.round(longest * 30 * 0.5);
  if (maxEnd < need) {
    return [
      `motion span: a spoken beat is ${longest.toFixed(0)}s but the reveal ends by frame ${maxEnd}. Pace the main graphic to about 80% of durationInFrames (durationInFrames * 0.8). A 1.00 to 1.05 zoom does not count.`,
    ];
  }
  return [];
}

export function extractTsx(text: string): string {
  let t = (text || '').trim();
  // 完整围栏：```tsx ... ```
  const m = t.match(/```(?:tsx|typescript|ts|jsx)?\s*([\s\S]*?)```/i);
  if (m) return m[1].trim();
  // deepseek-chat 等常只开不关：残留首行 ```tsx 会让语法检查从 L1 误报连锁错误
  t = t.replace(/^```(?:tsx|typescript|ts|jsx)?\s*\r?\n?/i, '');
  t = t.replace(/\r?\n?```\s*$/i, '');
  return t.trim();
}

function parseSceneCountFromProps(propsJson: string): number {
  try {
    const j = JSON.parse(propsJson) as { scenes?: unknown[] };
    if (Array.isArray(j.scenes) && j.scenes.length) return j.scenes.length;
  } catch {
    /* fall through */
  }
  const n = (propsJson.match(/"durationSec"\s*:/g) || []).length;
  return n > 0 ? n : 4;
}

function parseBeatSkillsFromProps(propsJson: string): BeatSkillRef[] {
  try {
    const j = JSON.parse(propsJson) as {
      scenes?: Array<{
        job?: string;
        skill?: string;
        visualIntent?: string;
        keyMotion?: string;
        layoutMode?: string;
        craftMust?: string[];
      }>;
    };
    if (!Array.isArray(j.scenes)) return [];
    return j.scenes
      .filter((s) => s?.skill)
      .map((s) => ({
        job: s.job,
        skill: s.skill as SkillName,
        visualIntent: s.visualIntent,
        keyMotion: s.keyMotion,
        layoutMode: s.layoutMode,
        craftMust: s.craftMust,
      }));
  } catch {
    return [];
  }
}

export function validateNarratedTsx(src: string, sceneCount?: number): string[] {
  const issues: string[] = [];
  if (!/export\s+(const|function)\s+ActiveNarrated/.test(src)) {
    issues.push('must export ActiveNarrated');
  }
  if (!/from\s+['"]remotion['"]/.test(src)) issues.push('must import from remotion');
  if (!/NarratedProps/.test(src)) issues.push('must use NarratedProps');
  if (/from\s+['"]\.\.\/NarratedExplainer['"]/.test(src)) {
    issues.push('must NOT re-export stock NarratedExplainer — invent new scenes');
  }
  if (/fetch\s*\(/.test(src) || /setInterval|setTimeout|requestAnimationFrame/.test(src)) {
    issues.push('no fetch / timers — frame-driven only');
  }
  if (src.length < 800) issues.push('source too short — likely incomplete');
  // Boldness gates (PageOn energy) — reject timid slide decks
  if (!/spring\s*\(/.test(src)) issues.push('must use spring() for kinetic motion');
  if (!/fontSize:\s*(?:7[2-9]|[89]\d|1\d{2}|2\d{2})/.test(src)) {
    issues.push('hero type must hit ≥72px somewhere (PageOn-scale kinetic)');
  }
  if (!/(rotate|scale)\s*[`(]/.test(src) && !/transform:.*(?:rotate|scale)/.test(src)) {
    issues.push('must use scale/rotate transforms for depth (tilted UI / slam)');
  }
  issues.push(...assertRevealFamilyRotation(src, { sceneCount }));
  return issues;
}

export function validateLaunchTsx(src: string, sceneCount?: number): string[] {
  const issues: string[] = [];
  if (!/export\s+(const|function)\s+ActiveLaunch/.test(src)) {
    issues.push('must export ActiveLaunch');
  }
  if (!/from\s+['"]remotion['"]/.test(src)) issues.push('must import from remotion');
  if (!/LaunchProps/.test(src)) issues.push('must use LaunchProps');
  if (/from\s+['"]\.\.\/LaunchShowreel['"]/.test(src)) {
    issues.push('must NOT re-export stock LaunchShowreel — invent new scenes');
  }
  if (!/musicFile|dropSec/.test(src)) {
    issues.push('must reference props.musicFile and props.dropSec (sound leads picture)');
  }
  if (/fetch\s*\(/.test(src) || /setInterval|setTimeout|requestAnimationFrame/.test(src)) {
    issues.push('no fetch / timers — frame-driven only');
  }
  if (src.length < 800) issues.push('source too short — likely incomplete');
  if (!/spring\s*\(/.test(src)) issues.push('must use spring() for kinetic motion');
  if (!/fontSize:\s*(?:7[2-9]|[89]\d|1\d{2}|2\d{2})/.test(src)) {
    issues.push('hero type must hit ≥72px somewhere (portfolio-scale kinetic)');
  }
  if (!/(rotate|scale)\s*[`(]/.test(src) && !/transform:.*(?:rotate|scale)/.test(src)) {
    issues.push('must use scale/rotate transforms for depth (tilted UI / slam)');
  }
  issues.push(...assertRevealFamilyRotation(src, { sceneCount }));
  return issues;
}

/** @deprecated Use cinematicMotionFloor(aspect). Kept as 16:9 default for legacy SKU codegen. */
export const CINEMATIC_MOTION_FLOOR = cinematicMotionFloor('16:9');

/** @deprecated Use cinematicFloorLine(aspect). */
export const CINEMATIC_FLOOR_LINE = cinematicFloorLine('16:9');

export { cinematicFloorLine, cinematicMotionFloor };

const NARRATED_SKELETON = `import React from 'react';
import {
  AbsoluteFill, Audio, Series, interpolate, spring, staticFile,
  useCurrentFrame, useVideoConfig,
} from 'remotion';
import { loadFont } from '@remotion/google-fonts/Inter';
import type { NarratedProps, NarratedScene } from '../narratedSchema';
// Optional helpers (prefer inventing your own layouts):
// import { KineticWords, KineticLines, SlideCard, ChatPane, CountUp, CaptionChip } from '../ui';

const { fontFamily: FONT } = loadFont('normal', {
  weights: ['400', '500', '600', '700', '800'],
  subsets: ['latin'],
});

export const ActiveNarrated: React.FC<NarratedProps> = (props) => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: props.canvas, fontFamily: FONT }}>
      <Series>
        {props.scenes.map((scene, i) => {
          const dur = Math.max(1, Math.round(scene.durationSec * fps));
          return (
            <Series.Sequence key={i} durationInFrames={dur}>
              {scene.narrationFile ? <Audio src={staticFile(scene.narrationFile)} /> : null}
              {/* TODO: render UNIQUE visuals for scene.stage / scene.visualIntent */}
              <AbsoluteFill />
            </Series.Sequence>
          );
        })}
      </Series>
    </AbsoluteFill>
  );
};
`;

const LAUNCH_SKELETON = `import React from 'react';
import {
  AbsoluteFill, Audio, Series, interpolate, spring, staticFile,
  useCurrentFrame, useVideoConfig,
} from 'remotion';
import { loadFont } from '@remotion/google-fonts/Inter';
import type { LaunchProps } from '../launchSchema';

const { fontFamily: FONT } = loadFont('normal', {
  weights: ['400', '500', '600', '700', '800'],
  subsets: ['latin'],
});

export const ActiveLaunch: React.FC<LaunchProps> = (props) => {
  const { fps } = useVideoConfig();
  const dropSec = props.dropSec ?? 9;
  return (
    <AbsoluteFill style={{ background: props.canvas, fontFamily: FONT }}>
      {props.musicFile ? <Audio src={staticFile(props.musicFile)} /> : null}
      <Series>
        {props.scenes.map((scene, i) => {
          const dur = Math.max(1, Math.round(scene.durationSec * fps));
          return (
            <Series.Sequence key={i} durationInFrames={dur}>
              {scene.narrationFile ? <Audio src={staticFile(scene.narrationFile)} /> : null}
              {/* hook | tease | reveal@dropSec | feature | end — UNIQUE UI */}
              <AbsoluteFill />
            </Series.Sequence>
          );
        })}
      </Series>
    </AbsoluteFill>
  );
};
`;

export async function generateNarratedTsx(
  settings: Settings,
  opts: { prompt: string; propsJson: string; storyboardJson: string; lookLine?: string },
): Promise<string> {
  // Full skill packs — hard pipeline budget (no soft-flavor truncation to 14k)
  const skill = readSkill([
    'explainer-video',
    'remotion-video',
    'kinetic-typography',
    'diagram-animation',
    'presentation-video',
  ], 48000);
  const sceneCount = parseSceneCountFromProps(opts.propsJson);

  const raw = await chatText(
    settings,
    `You are a Remotion AUTHOR under a HARD skill pipeline (code-enforced later).
Skills are LAW — implement their techniques, not decorate.

=== SKILLS (verbatim) ===
${skill}

=== HARD RULES (will be statically validated) ===
1. Export: export const ActiveNarrated: React.FC<NarratedProps>
2. Import from 'remotion' + '../narratedSchema'. Font: @remotion/google-fonts/Inter. Optional '../ui'.
3. FORBIDDEN: re-export NarratedExplainer; empty AbsoluteFill placeholders; timid micro-motion.
4. Series over props.scenes; durationInFrames = round(durationSec * fps); Audio via staticFile(narrationFile).
5. REALIZE every scene.visualIntent + keyMotion with on-screen copy that matches the spoken line language (do not translate away from props).
6. Technique cores REQUIRED in code:
   - diagram/research: progressive disclosure nodes → edges → labels (SVG path strokeDash / stagger springs)
   - kinetic/problem|brand: word or line stagger — rotate reveal families (mask/blur/clip/slam), not one spring recipe
   - stat/proof: numeric count-up driven by interpolate/spring
   - chat_edit/design: chat bubble + slide update
7. Style lock from THIS job's props.canvas / ink / accent / brandBg — one grammar, prompt-owned skin.
8. No fetch/timers/setState animation.

${revealFamilyHardRules(sceneCount)}

=== MOTION LANGUAGE (quality floor, NOT official PageOn skin) ===
${opts.lookLine || 'Use props.canvas/ink/accent. Invent material from the brief.'}
${CINEMATIC_MOTION_FLOOR}
- At least ONE full-bleed accent beat using props.accent (not a hardcoded indigo).
- HOLD kinetic settles for VO when narrationFile is present.

Skeleton:
\`\`\`tsx
${NARRATED_SKELETON}
\`\`\``,
    `User brief:
${opts.prompt}

Storyboard (MUST realize visualIntent):
${opts.storyboardJson.slice(0, 14000)}

Locked props (timing + VO + styleLock):
${opts.propsJson.slice(0, 16000)}

Return complete ActiveNarrated.tsx.`,
    0.75,
  );

  let src = extractTsx(raw);
  // Ensure export name
  if (!/ActiveNarrated/.test(src) && /export\s+const\s+\w+/.test(src)) {
    src = src.replace(/export\s+const\s+\w+/, 'export const ActiveNarrated');
  }
  return src;
}

export async function fixNarratedTsx(
  settings: Settings,
  opts: { source: string; error: string; propsJson: string },
): Promise<string> {
  const raw = await chatText(
    settings,
    `You fix Remotion TSX for GeneratedNarrated. Keep export const ActiveNarrated.
Obey remotion frame-driven rules. Output complete TSX only.`,
    `Error:
${opts.error.slice(0, 2500)}

Current source:
\`\`\`tsx
${opts.source.slice(0, 16000)}
\`\`\`

Props reminder (durations/VO):
${opts.propsJson.slice(0, 4000)}`,
    0.4,
  );
  return extractTsx(raw);
}

export async function generateLaunchTsx(
  settings: Settings,
  opts: { prompt: string; propsJson: string; lookLine?: string },
): Promise<string> {
  const skill = readSkill([
    'launch-video',
    'remotion-video',
    'shot-composition',
    'kinetic-typography',
  ], 42000);
  const sceneCount = parseSceneCountFromProps(opts.propsJson);

  const raw = await chatText(
    settings,
    `You are a Remotion AUTHOR under HARD launch-video pipeline.
SOUND LEADS PICTURE. Reveal MUST snap on props.dropSec.

=== SKILLS ===
${skill}

=== HARD RULES (validated in gates) ===
1. Export: export const ActiveLaunch: React.FC<LaunchProps> from '../launchSchema'
2. Props include dropSec, musicFile, beats[], scenes[] — EACH scene has narrationFile (continuous VO in props language).
3. Root play music: <Audio src={staticFile(props.musicFile!)} /> PLUS per-scene <Audio src={staticFile(scene.narrationFile)} /> at Series.Sequence start.
4. VO SYNC: key visual change lands in the first ~40% of each scene while that scene's VO speaks — do not leave long silent holds with static frames.
5. Arc: hook → tease → reveal → feature×N → end. Reveal brand mark hits FULL at props.dropSec (scale overshoot then settle).
6. Feature montage: one benefit + one keyword per shot, hard cuts, kinetic pop — rotate reveal families across features.
7. End card logo+CTA hold ≥2s. FORBIDDEN: re-export LaunchShowreel; ignore dropSec; mute feature scenes.

${revealFamilyHardRules(sceneCount)}

=== MOTION LANGUAGE (quality floor, NOT official Linear skin) ===
${opts.lookLine || 'Use props.canvas/ink/accent. Invent chrome from the brief.'}
${CINEMATIC_MOTION_FLOOR}
- Hook/tease: dense floating chips with depth, slow camera push.
- Reveal: mark SNAP on dropSec with 1.18→1.0 overshoot.
- Product chrome oversized and tilted — not tiny centered icons.
- Forbidden: copying Linear ENG-2481 / #5E6AD2 unless the brief is Linear.

Skeleton:
\`\`\`tsx
${LAUNCH_SKELETON}
\`\`\``,
    `User brief:
${opts.prompt}

Locked props (dropSec/musicFile/beats/scenes — obey):
${opts.propsJson.slice(0, 18000)}

Return complete ActiveLaunch.tsx.`,
    0.72,
  );

  let src = extractTsx(raw);
  if (!/ActiveLaunch/.test(src) && /export\s+const\s+\w+/.test(src)) {
    src = src.replace(/export\s+const\s+\w+/, 'export const ActiveLaunch');
  }
  return src;
}

export async function fixLaunchTsx(
  settings: Settings,
  opts: { source: string; error: string; propsJson: string },
): Promise<string> {
  const raw = await chatText(
    settings,
    `Fix Remotion TSX for GeneratedLaunch. Keep export const ActiveLaunch. Complete file only.`,
    `Error:
${opts.error.slice(0, 2500)}

Source:
\`\`\`tsx
${opts.source.slice(0, 16000)}
\`\`\`

Props:
${opts.propsJson.slice(0, 4000)}`,
    0.4,
  );
  return extractTsx(raw);
}

export function validateNextWordTsx(src: string, sceneCount?: number): string[] {
  const issues: string[] = [];
  if (!/export\s+(const|function)\s+ActiveNextWord/.test(src)) issues.push('must export ActiveNextWord');
  if (!/from\s+['"]remotion['"]/.test(src)) issues.push('must import from remotion');
  if (!/NextWordProps/.test(src)) issues.push('must use NextWordProps');
  if (/from\s+['"]\.\.\/NextWordLoop['"]/.test(src)) {
    issues.push('must NOT re-export stock NextWordLoop — invent layouts from props.scenes');
  }
  if (/fetch\s*\(/.test(src) || /setInterval|setTimeout|requestAnimationFrame/.test(src)) {
    issues.push('no fetch / timers — frame-driven only');
  }
  if (src.length < 900) issues.push('source too short');
  if (!/spring\s*\(/.test(src)) issues.push('must use spring()');
  if (!/READ/.test(src) || !/ODDS/.test(src) || !/SPIN/.test(src) || !/ADD/.test(src)) {
    issues.push('must render persistent 1 READ / 2 ODDS / 3 SPIN / 4 ADD chrome');
  }
  if (!/durationSec/.test(src) || !/useCurrentFrame/.test(src)) {
    issues.push('pills must be driven off composition frame + scene durations (never remount inside Series)');
  }
  issues.push(...assertRevealFamilyRotation(src, { sceneCount }));
  return issues;
}

const NEXTWORD_SKELETON = `import React from 'react';
import {
  AbsoluteFill, Audio, Series, interpolate, spring, staticFile,
  useCurrentFrame, useVideoConfig,
} from 'remotion';
import { loadFont } from '@remotion/google-fonts/Inter';
import type { NextWordProps } from '../nextWordSchema';

const { fontFamily: FONT } = loadFont('normal', {
  weights: ['400', '500', '600', '700', '800'],
  subsets: ['latin'],
});

export const ActiveNextWord: React.FC<NextWordProps> = (props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: props.canvas, fontFamily: FONT }}>
      {/* overlay 1 READ 2 ODDS 3 SPIN 4 ADD — hide hook+type, then NEVER unmount */}
      <Series>
        {props.scenes.map((scene, i) => {
          const dur = Math.max(1, Math.round(scene.durationSec * fps));
          return (
            <Series.Sequence key={i} durationInFrames={dur}>
              {scene.narrationFile ? <Audio src={staticFile(scene.narrationFile)} /> : null}
              <AbsoluteFill />
            </Series.Sequence>
          );
        })}
      </Series>
    </AbsoluteFill>
  );
};
`;

export async function generateNextWordTsx(
  settings: Settings,
  opts: { prompt: string; propsJson: string; lookLine?: string },
): Promise<string> {
  const skill = readSkill([
    'short-form-video',
    'caption-animation',
    'chart-animation',
    'kinetic-typography',
    'diagram-animation',
    'remotion-video',
  ], 42000);
  const sceneCount = parseSceneCountFromProps(opts.propsJson);

  const raw = await chatText(
    settings,
    `You are a Remotion AUTHOR for a 9:16 (1080×1920) LLM next-word explainer.
Follow skills. Invent UNIQUE layouts from props — do NOT re-export NextWordLoop.

=== SKILLS ===
${skill}

=== HARD RULES ===
1. Export: export const ActiveNextWord: React.FC<NextWordProps> from '../nextWordSchema'
2. 1080×1920. Safe: top 120, bottom 300, left 90, right 120.
3. STEP BAR is a ROOT overlay (sibling of Series). Labels 1 READ / 2 ODDS / 3 SPIN / 4 ADD.
   Hide only on hook+type. After READ, NEVER unmount — only active color changes.
   Drive from useCurrentFrame() + cumulative scene.durationSec.
4. Series over props.scenes; Audio via staticFile(scene.narrationFile) only when set — skip Audio if missing.
5. Invent layouts from THIS job's props (question, writingText, tokens, candidates, winner).
6. Kinetic stagger headlines. Odds: bars grow + count-up. Spin: unequal wheel + labels. Add: compact writing + wheel, winner accent. Loop: nodes then edges.
7. FORBIDDEN: re-export NextWordLoop; remounting pills per scene; giant empty WRITING box; landscape layout.
8. No fetch/timers/setState.

${revealFamilyHardRules(sceneCount)}

=== LOOK + LAYOUT ===
${opts.lookLine || 'Use props.canvas/ink/accent. Invent from the brief — not a sandwich SKU.'}
- Hook: 3-line hero, last phrase in props.accent; YOU = small right pill; WRITING = short rounded bar.
- Type: typewriter in that compact box.
- READ: scanning token chips.
- ODDS: context + dashed ? + bars in the middle of the 9:16 frame.
- SPIN: large unequal wheel, biggest slice = winner, fat pointer.
- ADD: compact phrase with winner in accent AND wheel with winner slice painted.
- Grammar (READ→ODDS→SPIN→ADD) is locked. Demo topic, copy, and palette come from THIS job's props.

Skeleton:
\`\`\`tsx
${NEXTWORD_SKELETON}
\`\`\``,
    `User brief:
${opts.prompt}

Locked props:
${opts.propsJson.slice(0, 18000)}

Return complete ActiveNextWord.tsx.`,
    0.72,
  );

  let src = extractTsx(raw);
  if (!/ActiveNextWord/.test(src) && /export\s+const\s+\w+/.test(src)) {
    src = src.replace(/export\s+const\s+\w+/, 'export const ActiveNextWord');
  }
  return src;
}

export async function fixNextWordTsx(
  settings: Settings,
  opts: { source: string; error: string; propsJson: string },
): Promise<string> {
  const raw = await chatText(
    settings,
    `Fix Remotion TSX for GeneratedNextWord. Keep export const ActiveNextWord. 1080×1920. Step pills persistent overlay outside Series. Complete file only.`,
    `Error:
${opts.error.slice(0, 2500)}

Source:
\`\`\`tsx
${opts.source.slice(0, 16000)}
\`\`\`

Props:
${opts.propsJson.slice(0, 4000)}`,
    0.4,
  );
  return extractTsx(raw);
}

const DIRECTED_SKELETON = `import React from 'react';
import {
  AbsoluteFill, Audio, Sequence, Series, interpolate, spring, staticFile,
  useCurrentFrame, useVideoConfig,
} from 'remotion';
import { loadFont } from '@remotion/google-fonts/Inter';
import type { DirectedProps } from '../directedSchema';

const { fontFamily: FONT } = loadFont('normal', {
  weights: ['400', '500', '600', '700', '800'],
  subsets: ['latin'],
});

const Beat: React.FC<{ scene: DirectedProps['scenes'][number]; props: DirectedProps; dur: number }> = ({
  scene, props: P,
}) => (
  <AbsoluteFill style={{ background: P.canvas || P.brandBg || '#12141C' }}>
    {/* Agent full-frame: paint metaphor + optional caption here. layoutMode is a soft variety hint. */}
    <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 72, color: P.ink, padding: '5%' }}>{scene.headline}</div>
  </AbsoluteFill>
);

export const ActiveDirected: React.FC<DirectedProps> = (props) => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: props.canvas || props.brandBg, fontFamily: FONT }}>
      {props.musicFile ? <Audio src={staticFile(props.musicFile)} volume={0.35} /> : null}
      <Series>
        {props.scenes.map((scene, i) => {
          const dur = Math.max(1, Math.round(scene.durationSec * fps));
          const cues = props.autoSfx === false
            ? []
            : (scene.sfxCues?.length
              ? scene.sfxCues
              : scene.sfxFile
                ? [{ file: scene.sfxFile, volume: scene.sfxVolume ?? 0.4, atSec: 0 }]
                : []);
          return (
            <Series.Sequence key={i} durationInFrames={dur}>
              {scene.narrationFile ? <Audio src={staticFile(scene.narrationFile)} /> : null}
              {cues.map((cue, j) => (
                <Sequence key={j} from={Math.max(0, Math.round((cue.atSec || 0) * fps))} durationInFrames={Math.max(6, Math.round(fps * 0.9))} layout="none">
                  <Audio src={staticFile(cue.file)} volume={cue.volume ?? 0.4} />
                </Sequence>
              ))}
              <Beat scene={scene} props={props} dur={dur} />
            </Series.Sequence>
          );
        })}
      </Series>
    </AbsoluteFill>
  );
};
`;

function stickmanDirectedHint(contentLang: 'zh' | 'en' | 'bilingual' = 'zh'): string {
  const titleRule = contentLang === 'bilingual'
    ? '· When titles are needed: <BilingualTitle zh="…" en="…" y={…} /> — invent copy from THIS brief (never default to MOTIVATION/DISCIPLINE).'
    : contentLang === 'en'
      ? '· When titles are needed: English CaptionPill / KineticLine only (NO BilingualTitle, NO Chinese).'
      : '· When titles are needed: Simplified Chinese CaptionPill / KineticLine (NO default BilingualTitle).';
  return `
STICKMAN HARD LOCK (when stickman-animation is in the plan):
- MUST: import {
    Stickman, POSES, lerpPose, idleBob, walkPose, sampleClip, sampleClipForIntent, clipsForIntent,
    resolveStickInk,
    // staging props when needed: Platform, PropBlock, SignBoard, PhoneSlab, typeScale, CaptionPill…
  } from '../stickman';
- MUST: render <Stickman x={…} y={…} pose={…} ink={…} face={…} /> on every stickman-animation character beat.
- PHRASES > POSES: drive character motion with sampleClip(clipId, tLocal, { frame, fps }) or sampleClipForIntent(scene.visualIntent||scene.vo, tLocal, { frame, fps }).
  If scene.visualIntent starts with "clip:<id> —", MUST use that id in sampleClip(<id>, tLocal, { frame, fps }).
  tLocal = (frame - sequenceStart) / durationInFrames clamped 0..1. Apply sample.dx/dy onto base x/y; honor sample.face.
  Clip catalog: enter-present | explain-board | compare-sides | hesitate | agree-cheer | phone-talk | desk-work | give-take | push-heavy | pull-in | carry-across | greet-wave | think-loop | duo-debate-a | duo-debate-b.
  Intent map (examples): explain/teach→explain-board; compare/vs→compare-sides; doubt→hesitate; win→agree-cheer; phone→phone-talk; desk→desk-work; give→give-take; push/pull/carry→matching clip; 两人/辩论→duo-debate-a + duo-debate-b.
- Raw POSES.* / walkPose / wavePose only as fallback inside a clip — never invent thin SVG stick figures; never pose={undefined}.
- STAGING: rich expression = phrases + blocking + props, not a bigger pose list.
  · Dual cast: two Stickman with opposite face; duo-debate-a (left) + duo-debate-b (right); leave center for diagram/kinetic.
  · Props: SignBoard / PropBlock near hands for board/box; PhoneSlab on phone-talk; Platform or Ground under feet.
  · Mix: other plan skills (diagram/kinetic/caption) must still SHOW — stickman is an actor layer, not every beat.
- STRUCTURE: AbsoluteFill → <Series> → <Series.Sequence> per scene. Nested <Sequence layout="none"> only for timed Audio/SFX.
- LOOK: background = props.canvas; ink = props.ink || resolveStickInk(props.canvas). Capsule RIG only; glow=0.
  ${titleRule}
  · Titles optional; prefer typeScale(width).title. Do NOT force motivation ladders / ProgressTicks.
- Gap poses available if a clip needs them: push | pull | carry | handoff | desk (still prefer sampleClip).
- FORBIDDEN: local Stickman / LimbChain / RIG reimplementation; ignoring props.canvas/ink; dumping idle POSES.stand for every beat.
- Obey props.contentLang for all on-screen strings (already locked in lookLine).
`;
}

function craftKindFromSkills(skillIds: string[]): CraftKind {
  const showreel = skillIds.includes('launch-video')
    && skillIds.includes('kinetic-typography')
    && skillIds.includes('diagram-animation')
    && skillIds.includes('logo-animation');
  if (showreel) return 'showreel';
  if (skillIds.includes('logo-animation') && !skillIds.includes('stickman-animation')) return 'logo';
  return 'default';
}

/**
 * 一镜一组件：禁止 BEATS 短表 + Math.min/i% 钳位复用（vbgv：12 镜只有 Beat00–07）。
 * 硬失败，不得 soft-accept。
 */
export function assertBeatComponentCoverage(src: string, sceneCount?: number): string[] {
  const issues: string[] = [];
  const n = Math.max(0, Number(sceneCount) || 0);
  if (n < 2) return issues;

  if (/BEATS\s*\[\s*(?:index|i)\s*%\s*BEATS\.length/i.test(src)) {
    issues.push('beat recycle: BEATS[i % BEATS.length] — one distinct component per scene');
  }
  if (
    /Math\.min\s*\(\s*(?:index|i)\s*,\s*BEATS\.length/i.test(src)
    || /BEATS\s*\[\s*Math\.min/i.test(src)
    || /BEATS\s*\[\s*[^\]]*Math\.min\s*\(\s*(?:index|i)/i.test(src)
  ) {
    issues.push(
      'beat clamp: Math.min(index, BEATS.length-1) reuses the last beat for later scenes — BEATS.length must equal props.scenes.length',
    );
  }

  const beatIds = new Set<string>();
  for (const m of src.matchAll(/\bconst\s+(Beat(?:\d+|[A-Z][A-Za-z0-9]*))\s*[:=]/g)) {
    // 排除 Router / Props 等非镜头组件
    if (/^Beat(Router|Props|Shell|Stage|Frame)$/i.test(m[1])) continue;
    beatIds.add(m[1]);
  }
  const arr = src.match(/\bconst\s+BEATS\b[\s\S]{0,120}?=\s*\[([^\]]*)\]/);
  if (arr) {
    const refs = arr[1]
      .split(',')
      .map((s) => s.trim().replace(/\/\*[\s\S]*?\*\//g, ''))
      .map((s) => s.trim())
      .filter((s) => /^Beat(?:\d+|[A-Z][A-Za-z0-9]*)$/.test(s))
      .filter((s) => !/^Beat(Router|Props|Shell|Stage|Frame)$/i.test(s));
    if (refs.length > 0 && refs.length < n) {
      issues.push(
        `beat coverage: BEATS registry has ${refs.length} components but scenes=${n} — emit Beat00…Beat${String(n - 1).padStart(2, '0')} (all ${n})`,
      );
    }
  } else if (beatIds.size > 0 && beatIds.size < n) {
    const cases = (src.match(/\bcase\s+\d+\s*:/g) || []).length;
    if (cases < n) {
      issues.push(
        `beat coverage: ${beatIds.size} Beat* components / ${cases} switch cases < scenes=${n}`,
      );
    }
  }
  return issues;
}

export function validateDirectedTsx(
  src: string,
  skillIds?: string[],
  contentLang: 'zh' | 'en' | 'bilingual' = 'zh',
  aspect: Aspect = '16:9',
  sceneCount?: number,
  assetFiles?: string[],
  sceneDurations?: number[],
): string[] {
  const issues: string[] = [];
  const stickmanOn = skillIds?.includes('stickman-animation') === true;
  const craft = craftKindFromSkills(skillIds || []);
  const logoOn = craft === 'logo';
  const showreelOn = craft === 'showreel';
  if (!/export\s+(const|function)\s+ActiveDirected/.test(src)) issues.push('must export ActiveDirected');
  if (!/from\s+['"]remotion['"]/.test(src)) issues.push('must import from remotion');
  if (!/DirectedProps/.test(src)) issues.push('must use DirectedProps');
  if (/from\s+['"]\.\.\/(NarratedExplainer|LaunchShowreel|NextWordLoop)['"]/.test(src)) {
    issues.push('must NOT re-export a locked SKU');
  }
  if (src.length < 800) issues.push('source too short');
  if (!/spring\s*\(/.test(src)) issues.push('must use spring()');
  issues.push(...assertBeatComponentCoverage(src, sceneCount));
  if (logoOn) {
    if (!/(strokeDash|stroke-dash|pathLength|scale|assemble|Img\b)/i.test(src)) {
      issues.push('logo: must stroke-draw / scale-assemble the mark (or Img asset)');
    }
    if (/<Stickman\b/.test(src)) issues.push('logo: stickman forbidden on logo sting');
  }
  if (showreelOn) {
    if (!/Series\.Sequence/.test(src)) issues.push('showreel: must use Series.Sequence chapters');
    if ((src.match(/Series\.Sequence/g) || []).length < 4) {
      issues.push('showreel: need ≥4 technique chapters on screen');
    }
  }
  // CRAFT 地板改为 soft：不再因 72px / 层数 / 3D 硬失败（避免模型堆 token 过关）
  if (!logoOn) {
    if (/<AbsoluteFill\s*\/>\s*<\/Series\.Sequence>/.test(src)
      || /Series\.Sequence[^>]*>\s*<AbsoluteFill\s*\/>\s*<\/Series\.Sequence>/.test(src)) {
      issues.push('empty AbsoluteFill placeholder sequences forbidden');
    }
  }
  void aspect;
  if (stickmanOn) {
    if (!/from\s+['"]\.\.\/stickman['"]/.test(src)) {
      issues.push('stickman: must import from ../stickman');
    }
    if (!/<Stickman\b/.test(src)) {
      issues.push('stickman: must render <Stickman />');
    }
    if (/const\s+Stickman\s*[:=]|function\s+Stickman\b/.test(src)) {
      issues.push('stickman: do not redefine Stickman locally — import from ../stickman');
    }
    if (!/<Series[\s>]/.test(src) || !/Series\.Sequence/.test(src)) {
      issues.push('stickman: wrap scenes in <Series> + <Series.Sequence>');
    }
    // Prefer phrase clips; still accept legacy walkPose/POSES drivers
    if (!/sampleClip(ForIntent)?\s*\(/.test(src)
      && !/walkPose\s*\(|idleBob\s*\(|wavePose\s*\(|lerpPose\s*\(/.test(src)) {
      issues.push('stickman: drive motion with sampleClip / sampleClipForIntent (or walkPose/lerpPose)');
    }
    void contentLang;
  }
  // 揭示族 / 成片密度：仅作 prompt 软约束，不再硬失败（导演模式对齐 Agent）
  void assertRevealFamilyRotation;
  void assertFilmCraftDensity;
  void sceneCount;
  if (assetFiles?.length) {
    issues.push(...assertScreenAssetsDrawn(src, assetFiles));
  }
  issues.push(...assertSpringFps(src));
  issues.push(...assertSafeGoogleFonts(src));
  if (!logoOn && !showreelOn) {
    issues.push(...assertMotionSpansScene(src, sceneDurations));
  }
  // 裸 `>>` 在 JSX 文本里 esbuild 会炸；位移/语句行不算
  if (src.split('\n').some((l) => {
    if (!/>>/.test(l)) return false;
    if (looksLikeJsExpressionLine(l)) return false;
    return /^\s*[^<{\n].*>>/.test(l);
  })) {
    issues.push('syntax: bare >> in JSX text — use ≫ or {\'>>\'}');
  }
  // 代码行里残留 Unicode 位移（repair 应已清掉；纯文本 ≫ 合法）
  if (src.split('\n').some((l) => /[≪≫]/.test(l) && looksLikeJsExpressionLine(l))) {
    issues.push('syntax: unicode shift ≪/≫ in expression — must be <</>>');
  }
  // VO 被挂到 assets/ 会 404（repairMediaStaticPaths 应已清）
  if (
    /assets\/\$\{f\}/.test(src)
    && /assetSrc\s*\(\s*(?:scene\.)?narrationFile|assetSrc\s*\(\s*narration/i.test(src)
    && !/\^\(vo-\\d\|narration/.test(src)
  ) {
    issues.push('media: narration via assetSrc under assets/ — use public-root vo-*.mp3');
  }
  // 误伤残留：泛型里的 ≫ 会让 Remotion esbuild 报 Expected ">"
  if (/React\.FC<\w+≫\s*=|Array<React\.FC<\w+≫\s*=/.test(src)) {
    issues.push('syntax: generic close used ≫ — must be >>');
  }
  // 语法错误优先：esbuild 会在 still 阶段炸
  issues.push(...parseTsxSyntaxIssues(src, 'ActiveDirected.tsx'));
  return issues;
}

function parseAspectFromProps(propsJson: string): Aspect {
  const m = propsJson.match(/"aspect"\s*:\s*"(16:9|9:16|1:1|3:4)"/);
  return (m?.[1] as Aspect) || '16:9';
}

export async function generateDirectedTsx(
  settings: Settings,
  opts: {
    prompt: string;
    propsJson: string;
    skillIds: string[];
    lookLine?: string;
    contentLang?: 'zh' | 'en' | 'bilingual';
    aspect?: Aspect;
    /** Beat-level skill refs for CRAFT DEPTH LAW */
    beats?: BeatSkillRef[];
    /** P1: pack-aware skill load */
    primary?: SkillName;
    technique?: SkillName[];
    brandSkills?: SkillName[];
  },
): Promise<string> {
  const primary = (opts.primary || opts.skillIds[0] || 'explainer-video') as SkillName;
  const technique = (opts.technique?.length
    ? opts.technique
    : opts.skillIds.filter((id) => id !== primary && id !== 'remotion-video')) as SkillName[];
  const brandSkills = (opts.brandSkills || []) as SkillName[];
  // P1: chunked full-skill pack — primary prioritized, never one-pot truncate
  const skill = readSkillPack({
    primary,
    technique,
    brand: brandSkills,
    extra: opts.skillIds.includes('lottie-animation') || opts.skillIds.includes('gsap-web')
      ? (['lottie-animation', 'gsap-web'] as SkillName[]).filter((id) => opts.skillIds.includes(id))
      : [],
    budget: 42000,
  });
  const stickmanOn = opts.skillIds.includes('stickman-animation');
  const contentLang = opts.contentLang || 'zh';
  const aspect = opts.aspect || parseAspectFromProps(opts.propsJson);
  const craftKind = craftKindFromSkills(opts.skillIds);
  const floorHint = cinematicMotionFloor(aspect, craftKind);
  const sceneCount = parseSceneCountFromProps(opts.propsJson);
  const depthLaw = craftDepthBrief(
    [primary, ...technique] as SkillName[],
    opts.beats?.length
      ? opts.beats
      : parseBeatSkillsFromProps(opts.propsJson),
  );
  let motifFromProps: MotifLock | undefined;
  try {
    const pj = JSON.parse(opts.propsJson) as { motifLock?: MotifLock; mainTechnique?: string };
    motifFromProps = pj.motifLock;
  } catch {
    motifFromProps = undefined;
  }
  const motifLaw = motifLockLaw(motifFromProps);
  const raw = await chatText(
    settings,
    `You are a Remotion AUTHOR for FREE DIRECTED films. Skills are a DIRECTOR'S TOOLKIT — deepen the main technique, do not rotate labels for spice.
Export: export const ActiveDirected: React.FC<DirectedProps> from '../directedSchema'
Canvas from props.aspect. Series over props.scenes; Audio via staticFile(scene.narrationFile) when set. Optional props.musicFile + props.dropSec.
When props.autoSfx is on, play scene.sfxCues as timed hits (only files listed in props). Use cue.volume as given (≈0.3–0.55) — do not quiet them below 0.28.
If props.assets exist, draw EVERY asset.file with <Img src={staticFile('assets/…file')} />. Never invent URLs.
Invent UNIQUE compositions from scene.visualIntent + props colors. Prefer switch(sceneIndex) or one named component per beat.
BEAT COVERAGE (hard): props.scenes has N entries → you MUST emit N distinct beat components (Beat00…Beat{N-1} or N switch cases). Wire with BEATS[i] or switch(i) only when BEATS.length === N.
FORBIDDEN: BEATS[i % BEATS.length], Math.min(index, BEATS.length-1), or any clamp that reuses the last beat for later scenes (causes identical "fixed layout" tails).
FORBIDDEN: short BEATS registries (e.g. 8 comps for 12 scenes).
Never put skill id strings on screen. Use scene.headline / scene.vo / scene.line EXACTLY — do not translate.
REALIZE every scene.visualIntent as a concrete FULL-FRAME metaphor (object + action + space). scene.skill moves that metaphor — it does not erase it.
When props.mainTechnique is set, that technique must appear clearly on its beats — neighboring beats may rotate other leaves.
${motifLaw}
For each skill assigned on a beat, SHOW its core ON the metaphor: chat bubbles, strokeDash ink, Ken Burns, isometric, countdown, cursor/device, CTA, quote/stars, map marker, logo sting, audiogram bars, promo % off, wrapped stats, lowerThird, motionBg, dropSec reveal.
Paint each beat — no empty AbsoluteFill. A blank field, speck, or hairline fails. Full-bleed BG OK; ~5–6% soft safe pad.
VO PACE: when narrationFile is set, the main reveal still arrives until about durationInFrames * 0.8. A 1–2s spring then freeze fails. A 1.00→1.05 zoom does not count.
Every spring({ ... }) must include fps: useVideoConfig().fps. Never omit fps. Never pass frame or 0 as fps.
${stickmanOn ? stickmanDirectedHint(contentLang) : ''}
${craftKind === 'logo' ? logoCodegenHint() : ''}
${craftKind === 'showreel' ? showreelCodegenHint() : ''}
${opts.lookLine || ''}
${stickmanOn ? '\nSTICKMAN MIX: actor layer only; keep other selected skills visible on their beats.\n' : ''}

=== SELECTED SKILLS (LAW — implement their craft on the metaphors) ===
${skill}

${depthLaw}

${canvasLawForAspect(aspect)}

${craftKind === 'logo' ? '' : revealFamilyHardRules(sceneCount)}

${craftKind === 'logo' || craftKind === 'showreel' ? '' : filmCraftDensityLaw(sceneCount)}

=== MOTION LANGUAGE (brief + skills; soft) ===
${floorHint}
At least ONE near-full-bleed accent beat using props.accent. Layered Z. Rotate mask/blur/clip/slam.
FONT LOCK: ONLY @remotion/google-fonts/Inter with subsets: ['latin']. FORBIDDEN: NotoSansSC / NotoSerifSC / chinese-simplified (Remotion runtime crash). For Chinese text use fontFamily stack: Inter + "Microsoft YaHei" / "PingFang SC".
FORBIDDEN: re-export stock SKUs; fetch/timers; empty placeholders; default Linear/PageOn purple unless brief asks.
FORBIDDEN: the same Inter grid + grey bars + thin strokeDash nodes on every beat.
FORBIDDEN: spring()+translateY as the only reveal for every beat.
FORBIDDEN: spring fps = frame or 0.
FORBIDDEN: one HudShell (REC/CAM/TC/LAB) on every beat.
FORBIDDEN: forced top centered HUD pill / progress bar chrome.
FORBIDDEN: numbered 01–05 cards with empty or repeated labels (模块).
FORBIDDEN: a left-column list with a void right half.

Skeleton:
\`\`\`tsx
${DIRECTED_SKELETON}
\`\`\``,
    `User brief:
${opts.prompt}

Locked props (timing + VO + style + visualIntent — REALIZE each intent):
${opts.propsJson.slice(0, 18000)}

Return complete ActiveDirected.tsx — denser and more specific than a thin diagram card film.`,
    0.78,
  );
  let src = sealDirectedSource(extractTsx(raw));
  if (!/ActiveDirected/.test(src) && /export\s+const\s+\w+/.test(src)) {
    src = src.replace(/export\s+const\s+\w+/, 'export const ActiveDirected');
  }
  return src;
}

export async function fixDirectedTsx(
  settings: Settings,
  opts: { source: string; error: string; propsJson: string },
): Promise<string> {
  const sceneCount = parseSceneCountFromProps(opts.propsJson);
  const raw = await chatText(
    settings,
    `Fix Remotion TSX for GeneratedDirected. Keep export const ActiveDirected. Frame-driven. Complete file only.
Preserve the brief's staging / props / look (props.canvas, props.ink) — do NOT replace the film with a generic pose demo.
If error mentions empty frame: redraw that beat so the subject fills the frame. A black field, a speck, or a hairline is a failure. Keep the beat's own technique (map, room, bubbles, ink, chart, type). Do not replace it with a caption transcript.
If error mentions type on graphic / hero overlap: keep a short headline readable and rebuild the hero as a full-frame metaphor from scene.visualIntent. Do not collapse the beat into a thin node card.
If error mentions hero type / scale / rotate / timid: enlarge the composition — layered Z, fuller subject. On 9:16 keep body type readable with a modest edge pad. If logo/motion: animate the mark, do not add explainer titles.
If error mentions reveal families: ROTATE mask / blur / clip / slam across beats — add real clipPath, filter:blur, mask/RGB wipe, or scale-overshoot slam. Do NOT only retune spring+translateY.
If error mentions chrome spam / craft density: DELETE per-beat REC/CAM/TC/LAB shells; give each Sequence a distinct layout (full-bleed diagram, kinetic slam, caption bar, chart). Deepen SVG/strokeDash/split/interpolate — do not shrink the file.
If error mentions layout sandwich: stop pinning TitleBlock at left:96 top:70 on every beat. Rotate families: hook-bleed, split-compare, process-row, stacked-evidence, kinetic-type, lockup-outro. Move the title — full-bleed, right column, or none.
If error mentions canvas / safe area: keep ~5–6% soft pad; full-bleed BG OK; paint the metaphor full-frame from visualIntent — ContentSlot is optional.
If error mentions layoutMode: treat it as a soft variety hint; change composition across beats when the story allows — do not invent a forced Stage shell or top HUD pill.
If error mentions empty numbered shells: replace 01–05 with distinct nouns from visualIntent/items (分析/分镜/配音). Never a repeated 模块 under every number.
If error mentions one side of the hero well is void / title/caption: redraw so the metaphor occupies both left and right thirds, or center a full-bleed object. Do not leave a left list with an empty right half.
If error mentions beat recycle / beat clamp / beat coverage: DELETE i % BEATS.length and Math.min(index, BEATS.length-1). Count props.scenes.length (=N). Emit N distinct beat components (Beat00…Beat{N-1}), each realizing that scene's visualIntent. BEATS array length MUST equal N; router must be BEATS[i] with no clamp. Do not reuse the last beat for trailing scenes.
If error mentions screen assets: render every listed file with <Img src={staticFile('assets/…')} />. The filename must appear in source. Do not pass an unused shots array.
If error mentions skill ids on screen: delete quoted skill-id arrays. Show the story headline, never explainer-video / stickman-animation / similar ids.
If error mentions motion span: retiming the main reveal so it is still moving until about durationInFrames * 0.8. Do not only add a 1.00→1.05 zoom.
If error mentions spring fps: every spring() must use fps from useVideoConfig(). Never write spring({ fps: frame }) or helper(frame, frame, delay). The first frame is 0.
If error mentions font / weight / subset / chinese-simplified / NotoSans / NotoSerif: DELETE every @remotion/google-fonts import except Inter; loadFont MUST use subsets: ['latin'] only (never chinese-simplified). For Chinese glyphs use fontFamily stack Inter + "Microsoft YaHei" + "PingFang SC" (or FONT_CJK_STACK). Do not call loadFont on NotoSansSC/NotoSerifSC.
${revealFamilyHardRules(sceneCount)}
${filmCraftDensityLaw(sceneCount)}
If stickman / Series / pose errors:
- import { Stickman, sampleClip, sampleClipForIntent, POSES, lerpPose, idleBob, walkPose, resolveStickInk, ensurePose } from '../stickman' — never redefine Stickman locally.
- Prefer sampleClip(clipId, tLocal, { frame, fps }) / sampleClipForIntent(intent, tLocal, { frame, fps }); apply dx/dy/face onto Stickman.
- Structure MUST be AbsoluteFill → <Series> → <Series.Sequence> per scene. Series.Sequence ONLY inside Series. Use nested <Sequence layout="none"> only for timed Audio.
- Every <Stickman pose={…} /> must get a real StickPose (clip sample / POSES.* / lerpPose / ensurePose(…)). Never undefined pose.
- Background = props.canvas; body ink = props.ink || resolveStickInk(props.canvas).`,
    `Error:
${opts.error.slice(0, 2500)}

Source:
\`\`\`tsx
${opts.source.slice(0, 16000)}
\`\`\`

Props:
${opts.propsJson.slice(0, 4000)}`,
    0.35,
  );
  return sealDirectedSource(extractTsx(raw));
}

/**
 * 分镜二次创作（外科手术）：
 * 1) 有 `const BEATS = [...]` → 只让模型改选中项并拼回原文件（推荐，不会整片重写）
 * 2) 文案模式 → 只同步 BEATS 文本 / 或原样返回（props 已在管线更新）
 * 3) 无 BEATS 的旧片 → 全文件外科编辑 + 漂移检测；漂移过大则拒绝整片结果
 */
export async function remakeSelectedDirectedTsx(
  settings: Settings,
  opts: {
    source: string;
    propsJson: string;
    skillIds: string[];
    contentLang?: 'zh' | 'en' | 'bilingual';
    lookLine?: string;
    note: string;
    beatIndexes: number[];
    selectedScenesJson: string;
    mode?: 'both' | 'visual' | 'copy';
    scenes?: { headline?: string; vo?: string; line?: string }[];
  },
): Promise<string> {
  const contentLang = opts.contentLang || 'zh';
  const indexes = opts.beatIndexes;
  const mode = opts.mode || 'both';
  const prior = opts.source || '';

  if (!prior || prior.length < 400) {
    return generateDirectedTsx(settings, {
      prompt: `Remake beats [${indexes.join(', ')}]: ${opts.note}`,
      propsJson: opts.propsJson,
      skillIds: opts.skillIds,
      contentLang,
      lookLine: opts.lookLine,
    });
  }

  const beatsArr = extractConstArray(prior, 'BEATS');

  // ——— 文案向：不重画，只改选中镜文案数据 ———
  if (mode === 'copy') {
    if (beatsArr && opts.scenes?.length) {
      return syncBeatsCopyFromScenes(prior, opts.scenes, indexes) || prior;
    }
    return prior;
  }

  // ——— 有 BEATS 表：只补丁选中 index（真正的分镜级二次创作）———
  if (beatsArr && beatsArr.items.length > 0) {
    const kinds = collectBeatKinds(prior);
    const selected = indexes
      .filter((i) => i >= 0 && i < beatsArr.items.length)
      .map((i) => ({ index: i, current: beatsArr.items[i].text }));
    if (!selected.length) return prior;

    const patched = await chatJson<{
      beats?: { index?: number; beat?: Record<string, unknown> }[];
    }>(
      settings,
      `You revise ONLY selected storyboard BEATS entries for an existing Remotion film.
Return JSON only: { "beats": [ { "index": number, "beat": { ...fields } } ] }.
HARD RULES:
- Only include indexes: [${indexes.join(', ')}].
- Each "beat" must be a plain object (kind/tag/sub/chips/items/…).
- Prefer kinds already used in this film: ${kinds.slice(0, 40).join(', ') || '(any existing)'}.
- Do NOT invent a new film structure. Do NOT return TSX.
- Obey contentLang=${contentLang}. User note is LAW for these beats only.
- Keep fields you do not need to change.`,
      `User note:
${opts.note}

Selected scene props:
${opts.selectedScenesJson.slice(0, 8000)}

Current BEATS entries (TypeScript object literals — revise these):
${selected.map((s) => `--- index ${s.index} ---\n${s.current}`).join('\n\n')}
${opts.lookLine ? `\n${opts.lookLine}` : ''}`,
      0.35,
    );

    const map = new Map<number, string>();
    for (const row of patched?.beats || []) {
      const idx = Number(row?.index);
      if (!Number.isInteger(idx) || !indexes.includes(idx)) continue;
      if (!row.beat || typeof row.beat !== 'object') continue;
      if (kinds.length && typeof row.beat.kind === 'string' && !kinds.includes(row.beat.kind)) {
        // 未知 kind → 保留原 kind，避免 SceneView switch 落空
        const prev = beatsArr.items[idx]?.text || '';
        const km = prev.match(/\bkind\s*:\s*['"]([^'"]+)['"]/);
        if (km) row.beat.kind = km[1];
      }
      map.set(idx, jsonToTsObjectLiteral(row.beat));
    }
    if (!map.size) {
      throw new Error('分镜补丁为空：模型未返回可应用的 BEATS 改动，请把修改写得更具体后重试');
    }
    const merged = spliceConstArrayItems(prior, 'BEATS', map);
    if (!merged) throw new Error('无法把分镜补丁写回 ActiveDirected（BEATS 解析失败）');
    return merged;
  }

  // ——— 无 BEATS：全文件外科编辑，但拒绝「整片重写」结果 ———
  const raw = await chatText(
    settings,
    `You surgically edit an EXISTING Remotion ActiveDirected.tsx.
Return the COMPLETE file only. export const ActiveDirected.

SURGICAL HARD LOCK (fatal if broken):
1. CHANGE ONLY scene indexes [${indexes.join(', ')}] (0-based).
2. Every OTHER scene must stay character-equivalent (same helpers, layout, motion).
3. Do NOT replace the design system. Do NOT rewrite unselected beats "for quality".
4. Keep Series/Sequence/Audio wiring. Canvas uses props.canvas.
5. User note applies ONLY to selected beats. contentLang=${contentLang}.
${opts.lookLine || ''}
${opts.skillIds.includes('stickman-animation') ? stickmanDirectedHint(contentLang) : ''}`,
    `User note (selected beats only):
${opts.note}

Selected scene props:
${opts.selectedScenesJson.slice(0, 6000)}

Existing ActiveDirected.tsx (EDIT — do not invent a new film). If the file is long, preserve ALL unselected logic verbatim:
\`\`\`tsx
${prior.length > 28000 ? `${prior.slice(0, 14000)}\n\n/* … middle omitted for size — DO NOT delete middle; keep structure … */\n\n${prior.slice(-14000)}` : prior}
\`\`\`

Props (context only):
${opts.propsJson.slice(0, 8000)}`,
    0.2,
  );
  let src = extractTsx(raw);
  if (!/ActiveDirected/.test(src) && /export\s+const\s+\w+/.test(src)) {
    src = src.replace(/export\s+const\s+\w+/, 'export const ActiveDirected');
  }

  const sceneCount = Math.max(indexes.length + 1, (opts.scenes?.length || 0), 1);
  const selectedRatio = indexes.length / sceneCount;
  if (surgicalDriftTooHigh(prior, src, selectedRatio)) {
    throw new Error(
      '模型把未选中的分镜也整片重写了。请缩小修改范围或写得更具体后重试（系统已拦截整片重做）。',
    );
  }
  return sealDirectedSource(src);
}
