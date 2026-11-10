// Tách nền trắng của ảnh PNG (flood-fill từ mép ảnh (qua cả vùng trong suốt), nên phần trắng BÊN TRONG nhân vật được giữ lại).
// Dùng: node tools/remove-bg.mjs images/dog.png images/mega-neon-unicorn.png   (hoặc không tham số = cả thư mục images/)
// Bản gốc được lưu ở images/original/ (không ghi đè nếu đã có).
// Nhân vật màu trắng (kỳ lân, cừu...) mà bị lẹm vào thân: chạy lại với ngưỡng chặt hơn:  TOL=3 node tools/remove-bg.mjs images/x.png
// (nhớ copy bản gốc từ images/original/ ra trước khi chạy lại)
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync, copyFileSync } from 'node:fs';
import { join, basename, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(ROOT, 'images');
const files = process.argv.length > 2 ? process.argv.slice(2).map((f) => resolve(f))
  : readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.png')).map((f) => join(dir, f));
const TOL = Number(process.env.TOL || 28);   // độ lệch so với trắng được coi là "nền"

for (const file of files) {
  const png = PNG.sync.read(readFileSync(file));
  const { width: w, height: h, data } = png;
  const px = (x, y) => (y * w + x) * 4;
  const isBg = (i) => data[i + 3] === 0 || (255 - data[i] <= TOL && 255 - data[i + 1] <= TOL && 255 - data[i + 2] <= TOL);
  const seen = new Uint8Array(w * h), stack = [];
  const push = (x, y) => { if (x < 0 || y < 0 || x >= w || y >= h) return; const k = y * w + x; if (seen[k] || !isBg(k * 4)) return; seen[k] = 1; stack.push(k); };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (stack.length) { const k = stack.pop(), x = k % w, y = (k / w) | 0; push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1); }

  let opaqueWhite = 0;
  for (let k = 0; k < w * h; k++) if (seen[k] && data[k * 4 + 3] > 0) opaqueWhite++;
  if (opaqueWhite < w * h * 0.01) { console.log('bỏ qua (không có nền trắng đặc):', basename(file)); continue; }

  // viền mềm: điểm ảnh sát nền và còn khá sáng -> bán trong suốt, tránh quầng trắng
  const out = Buffer.from(data);
  let removed = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = y * w + x, i = k * 4;
    if (seen[k]) { out[i + 3] = 0; removed++; continue; }
    let near = false;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < w && ny < h && seen[ny * w + nx]) near = true; }
    if (near) { const lum = Math.min(data[i], data[i + 1], data[i + 2]); if (lum > 200) out[i + 3] = Math.round(255 * (255 - lum) / 55); }
  }
  mkdirSync(join(dir, 'original'), { recursive: true });
  const bak = join(dir, 'original', basename(file));
  if (!existsSync(bak)) copyFileSync(file, bak);
  png.data = out; writeFileSync(file, PNG.sync.write(png));
  console.log(`✔ ${basename(file)}: tách ${(removed / (w * h) * 100).toFixed(0)}% điểm ảnh nền`);
}
