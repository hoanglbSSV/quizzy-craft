// Render HTML -> MP4 (60fps) cho cả 2 định dạng: Shorts 1080x1920 và ngang 1920x1080.
// Xem hướng dẫn: node tools/render.mjs --help
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync, renameSync } from 'node:fs';
import { dirname, resolve, basename, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/* ---------- tham số ---------- */
const opt = {};
for (const a of process.argv.slice(2)) {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  if (m) opt[m[1]] = m[2] ?? true;
}
if (opt.help) {
  console.log(`
Dùng: node tools/render.mjs [tuỳ chọn]

  --data=quiz-data.js        file dữ liệu video (mặc định quiz-data.js)
  --formats=shorts,landscape định dạng cần render (mặc định cả hai)
  --out=out                  thư mục xuất (mặc định ./out)
  --fps=60                   số khung hình/giây
  --limit=8                  chỉ render N giây đầu (để test nhanh)
  --snap=1.5,4,20            KHÔNG render video, chỉ chụp PNG tại các giây này (kiểm tra bố cục)
  --fast                     chụp JPEG thay PNG: nhanh hơn ~2x, chất lượng hơi thấp hơn
  --no-sfx / --no-voice / --no-music   bỏ từng lớp âm thanh khi ghép (file _sfx.wav vẫn được xuất riêng)
  --audio-only               chỉ dựng âm thanh (không quay hình, ~10 giây) -> out/<tên>_mix.wav để nghe thử
  --crf=16                   chất lượng x264 (thấp = đẹp hơn, nặng hơn; mặc định 16)

Biến môi trường: CHROME_PATH (đường dẫn Chrome/Edge), FFMPEG_PATH (đường dẫn ffmpeg)
`);
  process.exit(0);
}

const FORMATS = {
  shorts: { w: 1080, h: 1920, query: 'shorts' },
  landscape: { w: 1920, h: 1080, query: 'landscape' },
};
const dataFile = String(opt.data || 'quiz-data.js');
const formats = String(opt.formats || 'shorts,landscape').split(',').map((s) => s.trim()).filter(Boolean);
const outDir = resolve(String(opt.out || 'out'));
const fps = Number(opt.fps || 60);
const crf = String(opt.crf || 16);
const slug = basename(dataFile, '.js');
for (const f of formats) if (!FORMATS[f]) { console.error(`Định dạng không hợp lệ: ${f} (chỉ có: ${Object.keys(FORMATS).join(', ')})`); process.exit(1); }
if (!existsSync(resolve(ROOT, dataFile))) { console.error(`Không thấy file dữ liệu: ${dataFile}`); process.exit(1); }
mkdirSync(outDir, { recursive: true });

/* ---------- tìm Chrome & ffmpeg ---------- */
function findChrome() {
  const c = [process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
  return c.find((p) => p && existsSync(p));
}
const chromePath = findChrome();
if (!chromePath) { console.error('Không tìm thấy Chrome/Edge. Đặt biến CHROME_PATH trỏ tới chrome.exe'); process.exit(1); }
const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg';
if (!opt.snap && spawnSync(ffmpeg, ['-version']).error) {
  console.error('Không chạy được ffmpeg. Cài ffmpeg (https://www.gyan.dev/ffmpeg/builds/) và thêm vào PATH, hoặc đặt FFMPEG_PATH.');
  process.exit(1);
}

const shim = readFileSync(join(ROOT, 'tools', 'virtual-clock.js'), 'utf8');
const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/* ---------- render 1 định dạng ---------- */
async function openPage(browser, fmt) {
  const { w, h, query } = FORMATS[fmt];
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('  [page error]', e.message));
  page.on('requestfailed', (r) => { if (/\/images\//.test(r.url())) console.warn('  ! thiếu ảnh (sẽ dùng emoji):', decodeURIComponent(r.url().split('/images/')[1])); });
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) console.error('  [console]', m.text()); });
  await page.evaluateOnNewDocument(shim);
  const url = pathToFileURL(join(ROOT, 'index.html')).href + `?format=${query}&data=${encodeURIComponent(dataFile)}`;
  await page.goto(url, { waitUntil: 'load' });
  await page.evaluate(() => window.__quizReady);              // font + ảnh đã sẵn sàng
  const total = await page.evaluate(() => window.__quizTotalSeconds);
  const { audio, timeline } = await page.evaluate(() => ({ audio: window.QUIZ_DATA.audio || null, timeline: window.__quizTimeline }));
  await page.evaluate(() => { window.__quizPlay(); });        // bắt đầu timeline (đồng hồ ảo đang dừng ở 0)
  return { page, total, w, h, audio, timeline };
}

/* ---------- trộn âm thanh: SFX + thoại + nhạc nền (có ducking) ---------- */
function buildMix({ sfxWav, audio, timeline, seconds, total = seconds }) {
  const inputs = [], parts = [], mixIn = [];
  let n = 1;                                     // input 0 luôn là video
  const add = (args) => { inputs.push(...args); return n++; };
  const std = 'aresample=48000,aformat=channel_layouts=stereo';
  const A = audio || {};
  const find = (f) => { const p = resolve(ROOT, f); if (existsSync(p)) return p; console.warn('  ! không thấy file âm thanh:', f); return null; };

  if (sfxWav && !opt['no-sfx']) {
    const i = add(['-i', sfxWav]);
    parts.push(`[${i}:a]${std},volume=${A.sfxVolume ?? 0.7}[sfx]`); mixIn.push('[sfx]');
  }

  const vl = [];
  for (const [k, v] of (opt['no-voice'] ? [] : (A.voice || [])).entries()) {
    const sc = timeline.find((s) => s.id === v.scene);
    if (!sc) { console.warn(`  ! thoại "${v.file}": không có cảnh "${v.scene}"`); continue; }
    const p = find(v.file); if (!p) continue;
    const at = sc.start + (v.delay ?? 0.1);
    const dur = Number(spawnSync(ffprobeOf(), ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', p]).stdout) || 0;
    const sceneEnd = (timeline[timeline.indexOf(sc) + 1]?.start ?? total);
    if (at + dur > sceneEnd + 0.05) console.warn(`  ! thoại "${basename(p)}" dài ${dur.toFixed(2)}s, tràn ${(at + dur - sceneEnd).toFixed(2)}s sang cảnh sau (cảnh "${v.scene}" kết thúc ở ${sceneEnd.toFixed(1)}s)`);
    const i = add(['-i', p]);
    parts.push(`[${i}:a]${std},volume=${(A.voiceVolume ?? 1) * (v.volume ?? 1)},adelay=${Math.round(at * 1000)}:all=1[v${k}]`);
    vl.push(`[v${k}]`);
  }
  if (vl.length) {
    parts.push(`${vl.join('')}amix=inputs=${vl.length}:normalize=0:duration=longest,apad=whole_dur=${seconds}[voice]`);   // đệm im lặng: nếu không, ducking sẽ cắt nhạc khi hết thoại
    parts.push('[voice]asplit=2[vo][vsc]'); mixIn.push('[vo]');
  }

  const M = A.music, mp = M && !opt['no-music'] ? find(M.file) : null;
  if (mp) {
    const i = add(['-stream_loop', '-1', '-i', mp]);
    const fi = M.fadeIn ?? 0.5, fo = M.fadeOut ?? 2;
    parts.push(`[${i}:a]${std},atrim=start=${M.start ?? 0}:duration=${seconds},asetpts=PTS-STARTPTS,afade=t=in:d=${fi},afade=t=out:st=${Math.max(0, seconds - fo)}:d=${fo},volume=${M.volume ?? 0.4}[mus]`);
    // ducking: nhạc tự nhỏ đi ~9 dB mỗi khi có thoại, rồi nhẹ nhàng trở lại
    if (vl.length) { parts.push('[mus][vsc]sidechaincompress=threshold=0.04:ratio=3:attack=15:release=400[duck]'); mixIn.push('[duck]'); }
    else mixIn.push('[mus]');
  }
  if (!mixIn.length) return null;
  parts.push(`${mixIn.join('')}amix=inputs=${mixIn.length}:normalize=0:duration=longest,alimiter=limit=0.95,atrim=0:${seconds}[a]`);
  return { inputs, filter: parts.join(';') };
}
const ffprobeOf = () => (process.env.FFPROBE_PATH || (ffmpeg.replace(/ffmpeg(.exe)?$/i, 'ffprobe$1') || 'ffprobe'));

const shot = (page, jpeg) => page.screenshot(jpeg
  ? { type: 'jpeg', quality: 93, captureBeyondViewport: false }
  : { type: 'png', captureBeyondViewport: false, optimizeForSpeed: true });

async function snapFormat(browser, fmt, seconds) {
  const { page, total } = await openPage(browser, fmt);
  const want = new Map(seconds.map((s) => [Math.round(s * fps), s]));
  const last = Math.max(...want.keys());
  for (let i = 0; i <= last; i++) {
    await page.evaluate((ms) => window.__stepTo(ms), (i * 1000) / fps);
    if (want.has(i)) {
      const file = join(outDir, `snap_${fmt}_${String(want.get(i)).replace('.', '_')}s.png`);
      writeFileSync(file, await page.screenshot({ type: 'png', captureBeyondViewport: false }));
      console.log('  saved', file);
    }
  }
  await page.close();
  return total;
}

async function audioOnly(browser, fmt) {
  const { page, total, audio, timeline } = await openPage(browser, fmt);
  const seconds = opt.limit ? Math.min(total, Number(opt.limit)) : total;
  for (let i = 0; i <= Math.round(seconds * fps); i++) await page.evaluate((ms) => window.__stepTo(ms), (i * 1000) / fps);
  const b64 = await page.evaluate(() => window.__quizAudio());
  await page.close();
  const sfxWav = join(outDir, `${slug}_sfx.wav`);
  writeFileSync(sfxWav, Buffer.from(b64, 'base64'));
  const mix = buildMix({ sfxWav, audio, timeline, seconds, total });
  const out = join(outDir, `${slug}_mix.wav`);
  const r = spawnSync(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', `anullsrc=r=48000:cl=stereo`, ...mix.inputs,
    '-filter_complex', mix.filter, '-map', '[a]', '-t', String(seconds), out]);
  if (r.status !== 0) throw new Error('Trộn âm thanh lỗi: ' + r.stderr);
  console.log('  ✔', out);
}

async function renderFormat(browser, fmt) {
  const { page, total, w, h, audio, timeline } = await openPage(browser, fmt);
  const seconds = opt.limit ? Math.min(total, Number(opt.limit)) : total;
  const frames = Math.round(seconds * fps);
  const jpeg = !!opt.fast;
  const base = join(outDir, `${slug}_${fmt}`);
  const silent = `${base}.silent.mp4`, finalMp4 = `${base}.mp4`, wav = `${base}_sfx.wav`;
  console.log(`\n▶ ${fmt} ${w}x${h} — ${frames} khung (${fmtTime(seconds)}) @${fps}fps`);

  const enc = spawn(ffmpeg, ['-y', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(fps), '-c:v', jpeg ? 'mjpeg' : 'png', '-i', 'pipe:0',
    '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', crf, '-r', String(fps),
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
    '-movflags', '+faststart', silent], { stdio: ['pipe', 'inherit', 'inherit'] });
  const encDone = new Promise((res, rej) => { enc.on('exit', (c) => (c === 0 ? res() : rej(new Error('ffmpeg lỗi, mã ' + c)))); });
  enc.stdin.on('error', () => {});

  const t0 = Date.now();
  for (let i = 0; i < frames; i++) {
    await page.evaluate((ms) => window.__stepTo(ms), (i * 1000) / fps);
    const buf = await shot(page, jpeg);
    if (!enc.stdin.write(buf)) await new Promise((r) => enc.stdin.once('drain', r));
    if (i % 30 === 29 || i === frames - 1) {
      const done = i + 1, el = (Date.now() - t0) / 1000, eta = (el / done) * (frames - done);
      process.stdout.write(`\r  ${(done / frames * 100).toFixed(0).padStart(3)}%  khung ${done}/${frames}  còn ~${fmtTime(eta)}   `);
    }
  }
  enc.stdin.end();
  await encDone;
  process.stdout.write('\n');

  // Âm thanh: SFX đã được dựng offline theo đúng đồng hồ ảo
  const b64 = await page.evaluate(() => window.__quizAudio());
  await page.close();
  if (b64) writeFileSync(wav, Buffer.from(b64, 'base64'));
  const mix = buildMix({ sfxWav: b64 ? wav : null, audio, timeline, seconds, total });
  if (mix) {
    const r = spawnSync(ffmpeg, ['-y', '-loglevel', 'error', '-i', silent, ...mix.inputs,
      '-filter_complex', mix.filter, '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-t', String(seconds), finalMp4]);
    if (r.status !== 0) throw new Error('Ghép âm thanh lỗi: ' + r.stderr);
    rmSync(silent);
  } else {
    rmSync(finalMp4, { force: true });
    renameSync(silent, finalMp4);
  }
  console.log(`  ✔ ${finalMp4}${b64 ? `\n  ✔ ${wav}` : ''}   (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
}

/* ---------- main ---------- */
const browser = await puppeteer.launch({
  executablePath: chromePath, headless: true,
  args: ['--hide-scrollbars', '--mute-audio', '--force-color-profile=srgb', '--font-render-hinting=none', '--allow-file-access-from-files'],
});
try {
  for (const fmt of formats) {
    if (opt['audio-only']) { console.log('\n▶ audio-only'); await audioOnly(browser, fmt); break; }
    if (opt.snap) {
      console.log(`\n▶ snap ${fmt}`);
      await snapFormat(browser, fmt, String(opt.snap).split(',').map(Number));
    } else await renderFormat(browser, fmt);
  }
} finally {
  await browser.close();
}
console.log('\nXong.');
