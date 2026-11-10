---
name: make-quiz-video
description: Tạo video quiz mới (Shorts 9:16 + ngang 16:9) từ một kịch bản người dùng dán vào. Dùng khi người dùng đưa kịch bản/ý tưởng quiz (đoán nhân vật, pet, vật phẩm qua emoji...) và muốn làm video mới trong dự án này.
argument-hint: <dán kịch bản quiz vào đây>
---

# Tạo video quiz mới từ kịch bản

Đầu vào: kịch bản người dùng dán (tiếng Việt hoặc Anh, định dạng tự do: bảng, danh sách, đoạn văn).
Đầu ra: file dữ liệu `videos/<slug>.js`, danh sách ảnh cần tìm, ảnh chụp kiểm tra bố cục, lệnh để render, và metadata YouTube.

## Bước 1 – Đọc hiểu kịch bản
Đọc `CLAUDE.md`, `README.md`, `quiz-data.js` (mẫu chuẩn) trước. Rút ra từ kịch bản: chủ đề/tiêu đề, các câu hỏi
(emoji gợi ý, câu dẫn, đáp án), độ khó từng câu, thời lượng nếu có. Điền giá trị mặc định cho phần thiếu
và nói rõ trong báo cáo cuối những gì bạn tự suy ra.

Chỉ hỏi lại người dùng khi thật sự cần (ví dụ không rõ đáp án có tồn tại trong game không). Còn lại cứ làm.

## Bước 2 – Tạo `videos/<slug>.js`
`<slug>` là chữ thường, gạch ngang, ví dụ `roblox-pets-02`. Copy cấu trúc `quiz-data.js`:

```js
window.QUIZ_DATA = {
  title: ["GUESS THE", "ROBLOX", "CHARACTER!"],     // tối đa 3 dòng, mỗi dòng ≤ ~10 ký tự IN HOA (dòng dài hơn 10 sẽ tự thu nhỏ)
  hookSub: "Can you guess them in 5 seconds?",      // câu hook; số giây phải khớp thời gian suy nghĩ thực tế
  hookEmojis: ["🎮","🐶","🐱","🐉","🦄"],            // ≤ 5 emoji
  timing: { hook: 3, outro: 6 },
  questions: [{
    level: 1, difficulty: "Easy",                   // level 1-4: màu badge (xanh/vàng/cam/hồng) + tiếng tíc tắc dồn dập hơn theo level
    emojis: ["🐶","🦴","👑"],                       // ĐÚNG 3 emoji (4 sẽ tràn khung)
    prompt: "Which Adopt Me pet is this?",          // câu hỏi tiếng Anh, ≤ 2 dòng, LUÔN nêu tên game
    answer: "Dog", answerEmoji: "🐶",              // MỘT đáp án duy nhất; emoji dự phòng khi chưa có ảnh
    image: "images/dog.png",                      // ảnh đáp án; thiếu file thì tự dùng answerEmoji
    answerSfx: "applause",                          // tuỳ chọn; mặc định "tada". Dùng "applause" cho câu cuối
    questionSeconds: 5, answerSeconds: 3            // quy ước: suy nghĩ 5s (câu cuối khó: 6s), đáp án 3s (câu cuối 4s)
  }],
  outro: { title: "HOW MANY DID YOU GET RIGHT?", sub: "Comment your score! 👇", cta: "Subscribe for more Roblox Quizzes!" }
};
```

Quy tắc nội dung:
- Mọi chữ hiển thị trong video là **tiếng Anh**, phù hợp trẻ 5–14 tuổi, không từ ngữ người lớn/gây sợ.
- **Mỗi câu đúng MỘT đáp án** (không "A / B"), nêu rõ game trong câu hỏi. Emoji phải gợi đúng đáp án đó (vd 🌑🐉 → Shadow Dragon) và nếu đáp án có phiên bản (Neon/Mega) thì thêm emoji/câu hỏi gợi phiên bản. Không dùng emoji mới (Unicode ≥ 13, vd 🥷) vì Windows 10 không hiển thị. Không gọi đáp án là "rarest/best" nếu không có nguồn.
- **Xác minh tên nhân vật/pet có thật** bằng WebSearch (wiki của game) trước khi đưa vào dữ liệu; không chắc thì hỏi người dùng.
- Độ khó tăng dần theo thứ tự câu (Easy → Medium → Hard → Expert).
- Tên ảnh: `images/<ten-dap-an-kebab>.png`.
- Tổng thời lượng = hook + Σ(questionSeconds + answerSeconds) + outro. Với Shorts nên **≤ 58 giây**; vượt thì báo người dùng.
- Đã kiểm thử với **4 câu**. Số câu khác (đặc biệt > 4 ở bản dọc hoặc > 8 ở bản ngang) có thể làm phần Outro tràn
  màn hình → bắt buộc kiểm tra bằng ảnh chụp ở Bước 4 và chỉnh CSS (`.tiles`, `.tile`) nếu cần.
- Không sửa `quiz-data.js`.

## Bước 2b – Âm thanh (nếu người dùng có file thoại/nhạc trong `audio/`)
Thêm khối `audio` vào cuối file dữ liệu theo mẫu trong `quiz-data.js`: `music` (file, volume 0.4, fadeIn 0.6, fadeOut 2.5) và `voice` — mỗi phần tử `{scene, file, delay}`.
- `scene` = `hook`, `q1..qN`, `a1..aN`, `outro`. Mốc giây tự tính từ thời lượng cảnh, KHÔNG gõ cứng giây.
- `delay`: câu hỏi 0.1, đáp án 0.8 (sau khi thẻ lật + tiếng ding), outro 0.3. Hook 0.1.
- Ghép tên file thoại với cảnh theo tên (Q1→q1, A2→a2, Last/Outro→outro). Liệt kê file nào chưa khớp cảnh nào để hỏi lại.
- Đo độ dài bằng `ffprobe`; thoại phải nằm gọn trong cảnh (câu hỏi ~5s, đáp án ~3s, trừ `delay`). Nếu tràn: báo, đề nghị rút lời hoặc tăng `questionSeconds`/`answerSeconds`.
- Nghe thử số liệu bằng `node tools/render.mjs --data=videos/<slug>.js --audio-only` (ra `out/<slug>_mix.wav`), đo `ffmpeg -af volumedetect` ở các cửa sổ có/không thoại để xác nhận thoại đúng chỗ và nhạc đã hạ.
- Kiểm tra cảnh báo `!` từ script (file thiếu, thoại tràn cảnh).

## Bước 3 – Danh sách ảnh cần tìm
Lập bảng cho người dùng: **tên file | nhân vật/đáp án | từ khoá Google**. Từ khoá dạng
`<game> <tên nhân vật> transparent png` (gợi ý: Google Images → Công cụ → Màu → Trong suốt; wiki Fandom của game).
Yêu cầu ảnh: PNG nền trong suốt, vuông, ≥ 800px, nhân vật ở giữa có chút lề.
Nhắc ngắn về bản quyền (xem `CLAUDE.md`). Nếu người dùng muốn render khi chưa có ảnh vẫn được (dùng emoji).
Nếu tên nhân vật/pet có thể không có thật trong game, đánh dấu "cần kiểm tra trên wiki".

## Bước 4 – Kiểm tra bố cục (luôn làm)
```bash
node tools/render.mjs --data=videos/<slug>.js --snap=<giây>,...
```
Chọn các mốc: 1.5 (hook), giữa mỗi cảnh hỏi (vd 1 giây trước khi hết giờ), giữa mỗi cảnh đáp án,
và 1.5 giây sau khi Outro bắt đầu. Công thức: hook=3s; câu i bắt đầu tại `3 + Σ(các câu trước)`; đáp án bắt đầu sau `questionSeconds`.
Dùng Read để xem PNG trong `out/` (cả `snap_shorts_*` và `snap_landscape_*`). Tìm: chữ tràn/cắt, emoji tràn thẻ,
chồng lấp, vùng an toàn Shorts (đáy 380px không được có nội dung quan trọng). Sửa dữ liệu hoặc CSS rồi chụp lại.
Xong thì xoá `out/snap_*.png`.

Lưu ý: khung đúng giây bắt đầu một cảnh sẽ gần như trống (các phần tử đang nảy vào) – chọn mốc muộn hơn ~0.8s.

## Bước 5 – Báo cáo cho người dùng (ngắn gọn, tiếng Việt)
1. File đã tạo, tổng thời lượng, những gì bạn tự suy ra / cần họ xác nhận.
2. Bảng ảnh cần tìm (Bước 3).
3. Lệnh render (người dùng tự chạy, ~5 phút/định dạng):
   `node tools/render.mjs --data=videos/<slug>.js` → `out/<slug>_shorts.mp4`, `out/<slug>_landscape.mp4`, kèm `_sfx.wav`.
   Chỉ tự chạy render đầy đủ nếu người dùng yêu cầu. Gợi ý `--fast` để duyệt nháp.
4. Metadata YouTube (tiếng Anh): tiêu đề (≤ 70 ký tự, emoji + #shorts cho bản dọc), mô tả (kèm dòng
   "Fan-made quiz, not affiliated with Roblox." hoặc tên game tương ứng), hashtags. Nhắc chọn "Made for Kids".
5. Hậu kỳ còn lại: thêm nhạc nền + lồng tiếng (mốc thời gian từng cảnh theo bảng thời lượng).

## Khi kịch bản cần thứ mà template chưa có
Template hiện chỉ có 4 loại cảnh: Hook → (Câu hỏi 3 emoji + đếm ngược → Đáp án lật thẻ) × N → Outro.
Nếu kịch bản cần dạng khác (đoán bóng đen, chọn A/B/C, so sánh 2 ảnh, đoán qua ảnh zoom...):
1. Nói rõ với người dùng đây là thay đổi code, không chỉ dữ liệu.
2. Thêm kiểu câu hỏi mới vào `app.js` (`questionScene`/`answerScene`, chọn theo trường `type` của câu hỏi, mặc định giữ hành vi cũ)
   và CSS tương ứng trong `style.css` **cho cả dọc lẫn ngang** (phần `.land`).
3. Giữ nguyên nguyên tắc render xác định: không dùng `fetch`, `Date`, `Math.random` ngoài các hàm đã có; mọi chờ đợi
   đi qua `waitTo`/`later`; hiệu ứng bằng CSS animation/transition hoặc canvas trong vòng lặp `requestAnimationFrame` có sẵn.
   Thêm âm thanh mới vào đối tượng `sfx` (WebAudio) – chúng tự được dựng offline khi render.
4. Kiểm tra lại video mẫu `quiz-data.js` vẫn chạy bình thường (chụp snap) trước khi báo xong.
