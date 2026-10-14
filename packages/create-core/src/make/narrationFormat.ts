/**
 * 口播文案 → a2e / e2m narration.txt 风格（只定文案时钟，不换画面管线 / 不开 NarrationFilm）
 */
import { chatText } from '../llm.ts';
import type { Settings } from '../../../shared/src/index.ts';
import { stripDocChrome } from './scriptDrive.ts';

const FORMAT_SYSTEM = `You format spoken narration into anything2explainer narration.txt style.

Output ONLY the formatted script body (no markdown fences, no commentary).

HARD SHOT CONTRACT (must obey — this is the film's picture cut list):
- Blank line = ONE picture shot (画面单元). Shot count follows content length (short film fewer, long lesson more) — do NOT invent an artificial total cap.
- Each shot = 2–4 sentence lines. Chinese each line ≤35 characters (split longer sentences onto new lines INSIDE the same shot — do NOT insert a blank line after every sentence).
- Forbidden: one sentence per blank-line block. Group related sentences into picture units.
- Optional: use | only to split SUBTITLE chunks inside one spoken line (each chunk ≤16 Chinese chars). | does NOT change what is spoken.
- Optional chapter headers: "# CHAPTER n 章名" with 章名 ≤6 Chinese characters — only if the source clearly has chapters.
- Strip filenames, 【doc titles】, stage directions like「画面：」.
- Keep the author's meaning and order. Do not invent new claims.
- Language: keep the source language (zh or en).`;

/** LLM 把乱序/大段口播整理成 narration.txt；失败则本地粗切（仍遵守 2–4 句/镜） */
export async function formatToNarrationTxt(
  settings: Settings,
  raw: string,
  opts?: { userAsk?: string },
): Promise<string> {
  const src = stripDocChrome(raw).trim().slice(0, 14_000);
  if (!src) return '';
  if (!settings.llmApiKey) return localCoarseNarration(src);

  try {
    const out = await chatText(
      settings,
      FORMAT_SYSTEM,
      `User ask (context only):\n${(opts?.userAsk || '').slice(0, 600)}\n\nSOURCE:\n${src}`,
      0.2,
    );
    const cleaned = stripDocChrome(out.replace(/^```[\s\S]*?\n/, '').replace(/```\s*$/, '')).trim();
    if (cleaned.length >= 8 && cleaned.split(/\n\s*\n+/).filter((b) => b.trim()).length >= 2) {
      return cleaned;
    }
  } catch {
    /* fall through */
  }
  return localCoarseNarration(src);
}

/** 无 API / LLM 失败：句切后按 2–4 句装袋，空行分镜 */
export function localCoarseNarration(src: string): string {
  const sentences = stripDocChrome(src)
    .split(/(?<=[。！？!?；;])\s*/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2)
    .flatMap((s) => {
      if (/[\u4e00-\u9fff]/.test(s) && s.length > 35) {
        const parts: string[] = [];
        let cur = '';
        for (const ch of s) {
          cur += ch;
          if (cur.length >= 30 && /[，、；;]/.test(ch)) {
            parts.push(cur.trim());
            cur = '';
          } else if (cur.length >= 35) {
            parts.push(cur.trim());
            cur = '';
          }
        }
        if (cur.trim()) parts.push(cur.trim());
        return parts.length ? parts : [s];
      }
      return [s];
    });

  const shots: string[] = [];
  let buf: string[] = [];
  let bufChars = 0;
  const flush = () => {
    if (!buf.length) return;
    shots.push(buf.join('\n'));
    buf = [];
    bufChars = 0;
  };
  for (const s of sentences) {
    const next = bufChars + s.length;
    if (buf.length && (buf.length >= 4 || next > 100)) flush();
    buf.push(s);
    bufChars += s.length;
    if (buf.length >= 2 && bufChars >= 48) flush();
  }
  flush();
  return shots.join('\n\n');
}
