# Dự án: Video quiz game (Roblox...) render từ HTML → MP4

Chủ kênh làm video đố vui cho trẻ em nước ngoài (tiếng Anh). Video được dựng bằng HTML/CSS/JS rồi render
tự động ra MP4 60fps ở 2 định dạng: Shorts 1080x1920 và ngang 1920x1080. Người dùng nói tiếng Việt;
nội dung hiển thị trong video phải là **tiếng Anh**.

## Khi người dùng đưa kịch bản / yêu cầu làm video mới
→ Dùng skill **make-quiz-video** (`.claude/skills/make-quiz-video/SKILL.md`) và làm theo đúng quy trình trong đó.
Không tự sửa `quiz-data.js` (đó là video mẫu #1); mỗi video mới là một file riêng trong `videos/`.

## Cấu trúc
- `index.html`, `style.css`, `app.js` – giao diện, hiệu ứng, âm thanh SFX (WebAudio). Có cả bố cục dọc và ngang (`body.land`).
- `quiz-data.js` – dữ liệu video mẫu #1. `videos/*.js` – dữ liệu các video khác (cùng schema, xem skill).
- `images/` – ảnh đáp án (PNG nền trong suốt; bản gốc nếu đã tách nền nằm ở `images/original/`). Thiếu ảnh → tự dùng emoji. Ảnh nền trắng đặc: `node tools/remove-bg.mjs`.
- `audio/` – nhạc nền + thoại (khai báo trong khối `audio` của file dữ liệu; script tự trộn, nhạc tự hạ khi có thoại).
- `tools/render.mjs` – script Puppeteer render MP4. `tools/virtual-clock.js` – đồng hồ ảo (render xác định, không giật).
- `README.md` – hướng dẫn dùng cho chủ kênh.

## Lệnh
- `npm install` (một lần)
- `node tools/render.mjs --data=videos/<ten>.js --snap=1.5,6,10,40` – chụp PNG kiểm tra bố cục (nhanh, nên luôn chạy trước)
- `node tools/render.mjs --data=videos/<ten>.js` – render 2 MP4 vào `out/` (~5 phút mỗi định dạng cho video 43s)
- `node tools/render.mjs --data=videos/<ten>.js --audio-only` – chỉ dựng/ghép âm thanh (nhanh) -> `out/<ten>_mix.wav`
- Tuỳ chọn: `--formats=shorts|landscape`, `--limit=N`, `--fast`, `--no-sfx`, `--no-voice`, `--no-music`, `--crf=N`

## Quy tắc
- Render đầy đủ rất lâu: chỉ chạy khi người dùng yêu cầu; mặc định hướng dẫn họ tự chạy lệnh.
- Dọn file `out/snap_*.png` sau khi kiểm tra xong.
- Không hứa chuyện bản quyền: ảnh nhân vật là tài sản của nhà phát triển game, nhắc người dùng dùng ảnh gameplay tự chụp
  / ghi nguồn / ghi "fan-made, not affiliated".
- Không bịa thông tin game (tên pet, độ hiếm...). Nếu không chắc đáp án có thật không, hỏi lại hoặc đánh dấu cần kiểm tra.
