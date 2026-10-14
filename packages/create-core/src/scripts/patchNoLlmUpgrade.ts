/**
 * No-LLM upgrade for an existing directed project:
 * - rebuild louder multi-hit sfxCues
 * - patch local Cues → a2e stroke subtitle (NO title/content chrome sandwich)
 *
 * Usage: npx tsx src/scripts/patchNoLlmUpgrade.ts <dirName|projectId>
 */
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { OUTPUTS_DIR } from '../paths.ts';
import { store } from '../store.ts';
import { buildSceneSfxTimeline, SfxPicker } from '../sfx/catalog.ts';
import { copySfxIntoProject, ensureSfxAssets, SFX_PUBLIC_DIR } from '../sfx/ensureAssets.ts';

const key = process.argv[2] || '2026-10-13-directed-contentlang-zh-primary-s-f5xf';

function findDir(): { id?: string; dir: string } {
  const list = store.projects();
  const p = list.find((x) => x.id === key || x.dir === key || x.dir?.includes(key));
  if (p?.dir) return { id: p.id, dir: p.dir };
  return { dir: key };
}

function rebuildSfx(props: any) {
  const picker = new SfxPicker();
  const primary = props.primary || 'explainer-video';
  const scenes = Array.isArray(props.scenes) ? props.scenes : [];
  let hits = 0;
  props.autoSfx = true;
  props.scenes = scenes.map((sc: any, i: number) => {
    const durationSec = Math.max(0.6, Number(sc.durationSec) || 2);
    const raw = buildSceneSfxTimeline({
      skill: sc.skill,
      job: sc.job,
      index: i,
      total: scenes.length,
      primary,
      durationSec,
      items: sc.items,
      keyMotion: sc.keyMotion,
    }, picker);
    const cues = raw.filter((c) => existsSync(join(SFX_PUBLIC_DIR, c.file.replace(/^sfx\//, ''))));
    hits += cues.length;
    const head = cues[0];
    return {
      ...sc,
      ...(cues.length
        ? {
          sfxCues: cues,
          sfxFile: head.file,
          sfxVolume: head.volume,
          sfxRole: head.role,
        }
        : {}),
    };
  });
  return hits;
}

/** Replace opaque Cues chrome with a2e SubtitleLine style (top 956 = 637×1.5). */
function patchCuesToA2e(src: string): string {
  if (/top:\s*956/.test(src) && /strokeShadow/.test(src) && !/background: A\(p\.brandBg/.test(src.match(/const Cues:[\s\S]*?\n\};/)?.[0] || '')) {
    return src;
  }
  const a2eCues = `/* a2e Subtitle.tsx — white + black strokeShadow, top 637×1.5; NO background box */
const strokeShadow = (() => {
  const ring = (r: number, k: number, col: string) =>
    Array.from({ length: k }, (_, i) => {
      const a = (i / k) * Math.PI * 2;
      return \`\${(Math.cos(a) * r).toFixed(2)}px \${(Math.sin(a) * r).toFixed(2)}px 0 \${col}\`;
    });
  return [...ring(4, 16, '#000'), ...ring(2.4, 8, '#000'), ...ring(1.2, 4, '#000')].join(', ');
})();

const Cues: React.FC<{ vo: string; dur: number; p: Pal }> = ({ vo, dur }) => {
  const f = useCurrentFrame();
  const cues = React.useMemo(() => buildCues(vo || '', dur), [vo, dur]);
  const active = cues.findIndex((c) => f >= c.from && f < c.to);
  if (active < 0) return null;
  const c = cues[active];
  return (
    <div
      key={active}
      style={{
        position: 'absolute',
        left: '50%',
        top: 956,
        transform: 'translateX(-50%)',
        maxWidth: 1740,
        textAlign: 'center',
        whiteSpace: 'nowrap',
        fontFamily: FONT,
        fontSize: 66,
        lineHeight: 1.2,
        fontWeight: 700,
        color: '#FFFFFF',
        textShadow: strokeShadow,
        background: 'transparent',
        pointerEvents: 'none',
      }}
    >
      {c.text}
    </div>
  );
};`;

  if (!/const Cues: React\.FC/.test(src)) return src;
  return src.replace(/const Cues: React\.FC<\{ vo: string; dur: number; p: Pal \}> = \([\s\S]*?\n\};/, a2eCues);
}

async function main() {
  const found = findDir();
  const dir = join(OUTPUTS_DIR, found.dir);
  const propsPath = join(dir, 'props.json');
  const tsxPath = join(dir, 'ActiveDirected.tsx');
  const publicDir = join(dir, 'public');
  if (!existsSync(propsPath) || !existsSync(tsxPath)) {
    throw new Error(`missing props/tsx under ${dir}`);
  }

  await ensureSfxAssets();
  const props = JSON.parse(readFileSync(propsPath, 'utf8'));
  const hits = rebuildSfx(props);
  writeFileSync(propsPath, JSON.stringify(props, null, 2), 'utf8');
  writeFileSync(join(publicDir, 'props.render.json'), JSON.stringify(props), 'utf8');

  const files = (props.scenes || []).flatMap((s: any) =>
    (s.sfxCues || []).map((c: any) => c.file).concat(s.sfxFile ? [s.sfxFile] : []),
  );
  copySfxIntoProject(publicDir, files.filter(Boolean));

  const bak = join(dir, 'ActiveDirected.pre-nolm.tsx');
  if (!existsSync(bak)) copyFileSync(tsxPath, bak);
  const patched = patchCuesToA2e(readFileSync(tsxPath, 'utf8'));
  writeFileSync(tsxPath, patched, 'utf8');

  console.log(JSON.stringify({
    id: found.id,
    dir: found.dir,
    sfxHits: hits,
    scene0: props.scenes?.[0]?.sfxCues,
    a2eCaption: /top:\s*956/.test(patched) && /strokeShadow/.test(patched),
    noTitleCarve: !/TitleSlot/.test(patched),
  }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
