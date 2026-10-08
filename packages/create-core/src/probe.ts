import { spawnSync } from 'node:child_process';
import { basename } from 'node:path';

export type ProbeResult = {
  width: number;
  height: number;
  codec: string;
  fps: number;
  duration: number;
};

function ffprobeField(mp4: string, entry: string): string {
  const r = spawnSync('ffprobe', [
    '-v', 'error',
    '-select_streams', 'v:0',
    '-show_entries', entry,
    '-of', 'default=nw=1:nk=1',
    mp4,
  ], { encoding: 'utf8', windowsHide: true });
  return (r.stdout || '').trim().split(/\r?\n/).filter(Boolean)[0] || '';
}

/** Skill 包 scripts/probe-mp4.sh 的 Node 等价：读真实编码规格并可选断言。 */
export function probeMp4(mp4: string, expect?: { res?: string; fps?: number }): ProbeResult {
  const width = Number(ffprobeField(mp4, 'stream=width')) || 0;
  const height = Number(ffprobeField(mp4, 'stream=height')) || 0;
  const codec = ffprobeField(mp4, 'stream=codec_name') || '';
  const rate = ffprobeField(mp4, 'stream=r_frame_rate') || '0/1';
  const [a, b] = rate.split('/').map(Number);
  const fps = b ? a / b : a;
  const durR = spawnSync('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', mp4,
  ], { encoding: 'utf8', windowsHide: true });
  const duration = Number((durR.stdout || '').trim()) || 0;

  const result: ProbeResult = { width, height, codec, fps, duration };
  // eslint-disable-next-line no-console
  console.log(`  ${basename(mp4)}: ${width}x${height}  ${codec}  ${fps.toFixed(2)} fps  ${duration.toFixed(2)}s`);

  if (expect?.res) {
    const got = `${width}x${height}`;
    if (got !== expect.res) throw new Error(`probe-mp4: 分辨率 ${got} ≠ ${expect.res}`);
  }
  if (expect?.fps != null) {
    if (Math.abs(fps - expect.fps) > 0.5) throw new Error(`probe-mp4: fps ${fps} ≠ ${expect.fps}`);
  }
  if (codec && codec !== 'h264') {
    // eslint-disable-next-line no-console
    console.warn(`  ⚠ codec ${codec} (not h264)`);
  }
  return result;
}

export function probeAudioDuration(path: string): number {
  const r = spawnSync('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', path,
  ], { encoding: 'utf8', windowsHide: true });
  const n = Number((r.stdout || '').trim());
  return Number.isFinite(n) ? n : 0;
}
