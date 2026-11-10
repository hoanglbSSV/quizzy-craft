# Roblox Quiz – HTML → MP4 (Shorts 9:16 + YouTube ngang 16:9)

## Cài đặt (1 lần)

Cần: **Node.js ≥ 18**, **Chrome hoặc Edge**, **ffmpeg** (trong PATH).

```bash
npm install
```

## Quy trình mỗi video

1. **Tạo dữ liệu**: copy `quiz-data.js` thành `videos/video02.js`, sửa câu hỏi/emoji/đáp án.
2. **Bỏ ảnh** vào `images/` (PNG nền trong suốt, vuông, ≥ 800px) – tên file khớp trường `image`.
   Thiếu ảnh thì tự dùng emoji.
3. **Xem thử** trong trình duyệt: mở `index.html?data=videos/video02.js`
   (thêm `&format=landscape` để xem bản ngang).
4. **Kiểm tra bố cục nhanh** (vài giây, không render video):
   ```bash
   node tools/render.mjs --data=videos/video02.js --snap=1.5,6,10,40
   ```
   → ảnh PNG ở `out/snap_*.png`.
5. **Render**:
   ```bash
   node tools/render.mjs --data=videos/video02.js
   ```
   Ra 2 video trong `out/`:
   - `video02_shorts.mp4` (1080×1920, 60fps)
   - `video02_landscape.mp4` (1920×1080, 60fps)
   - `video02_shorts_sfx.wav`, `video02_landscape_sfx.wav` (track SFX riêng để bạn mix lại)

   Video 43s mất khoảng 4–5 phút mỗi định dạng.

## Tuỳ chọn

| Tuỳ chọn | Ý nghĩa |
|---|---|
| `--formats=shorts` | chỉ render 1 định dạng |
| `--limit=10` | chỉ render 10 giây đầu (test) |
| `--fast` | chụp JPEG, nhanh gấp ~2 lần, chất lượng hơi giảm (dùng để duyệt bản nháp) |
| `--no-sfx` | MP4 không có tiếng SFX (nếu muốn tự làm âm thanh hoàn toàn) |
| `--crf=16` | chất lượng x264 (14 = rất nét, 20 = nhẹ hơn) |
| `--out=thu-muc` | thư mục xuất |

Biến môi trường: `CHROME_PATH`, `FFMPEG_PATH` nếu script không tự tìm thấy.

## Thoại + nhạc nền (tự động)

Khối `audio` cuối file dữ liệu (xem `quiz-data.js`) khai báo nhạc nền và file thoại theo **cảnh** (`hook`, `q1..qN`, `a1..aN`, `outro`).
Khi render, script đặt thoại đúng giây bắt đầu của cảnh (+`delay`), trộn với SFX, và nhạc nền tự **hạ nhỏ khi có thoại** (ducking), fade vào/ra, tự lặp/cắt cho vừa video.
Thoại dài hơn cảnh thì script cảnh báo cụ thể.

Nghe thử âm thanh trong ~10 giây (không quay hình):
```bash
node tools/render.mjs --audio-only      # -> out/quiz-data_mix.wav
```
Chỉnh âm lượng: `music.volume`, `voiceVolume`, `sfxVolume` trong khối `audio`. Bỏ từng lớp: `--no-music`, `--no-voice`, `--no-sfx`.

## Hậu kỳ

- Nếu muốn tự dựng thêm: render với `--no-music --no-voice` rồi thêm trong CapCut/DaVinci.
- Mốc thời gian để lồng tiếng: mở `index.html?debug=1` hoặc xem bảng cảnh trong `ideal youtube.md`
  (Hook 0–3s, mỗi câu hỏi 5s + đáp án 3s, câu 4: 6s + 4s, Outro 6s).

## Vì sao video luôn mượt 60fps?

Script không "quay màn hình". Nó **điều khiển đồng hồ của trang web** (`tools/virtual-clock.js`),
tiến từng 1/60 giây, chụp một khung, rồi ghép bằng ffmpeg. Máy chậm chỉ làm render lâu hơn,
không làm video giật. Tiếng SFX cũng được dựng offline theo đúng đồng hồ đó nên khớp từng khung.
Hiệu ứng ngẫu nhiên (confetti, khối bay) dùng seed cố định nên 2 định dạng giống nhau.

## Cấu trúc

```
index.html  style.css  app.js     giao diện + hiệu ứng (shorts & landscape)
quiz-data.js                       dữ liệu video mặc định
videos/                            các file dữ liệu video khác
images/                            ảnh đáp án
fonts/                             font tải sẵn (render offline)
tools/render.mjs                   script Puppeteer
tools/virtual-clock.js             đồng hồ ảo
```
