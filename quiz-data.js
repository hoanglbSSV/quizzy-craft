/* =====================================================================
   DỮ LIỆU VIDEO — chỉ cần sửa file này để làm video mới.
   (Dùng .js thay vì .json để mở index.html bằng double-click vẫn chạy,
    vì trình duyệt chặn fetch() file JSON khi mở qua file://)

   - Mỗi câu CHỈ MỘT đáp án, và câu hỏi phải nêu rõ game (vd "Adopt Me").
   - image      : (tuỳ chọn) đường dẫn ảnh PNG nền trong suốt, vd "images/dog.png".
                  Nếu thiếu file ảnh -> tự động hiện emoji `answerEmoji` thật to.
   - level      : 1..4 -> quyết định màu badge & độ "dồn dập" của tiếng tíc tắc
   - answerSfx  : "tada" (mặc định) | "applause"
   - Thời lượng mỗi cảnh tính bằng giây.
   ===================================================================== */
window.QUIZ_DATA = {
  title: ["ROBLOX", "ADOPT ME", "PET QUIZ!"],
  hookSub: "Can you guess them in 5 seconds?",
  hookEmojis: ["🎮", "🐶", "🐵", "🐉", "🦄"],

  timing: { hook: 3, outro: 6 },

  questions: [
    {
      level: 1, difficulty: "Easy",
      emojis: ["🐶", "🦴", "🐾"],
      prompt: "Which Adopt Me pet is this?",
      answer: "Dog", answerEmoji: "🐶",
      image: "images/dog.png",
      questionSeconds: 5, answerSeconds: 3
    },
    {
      level: 2, difficulty: "Medium",
      emojis: ["🐵", "🗡️", "📜"],
      prompt: "Which Adopt Me pet is this?",
      answer: "Ninja Monkey", answerEmoji: "🐵",
      image: "images/ninja-monkey.png",
      questionSeconds: 5, answerSeconds: 3
    },
    {
      level: 3, difficulty: "Hard",
      emojis: ["🌑", "🐉", "🖤"],
      prompt: "Which Legendary Adopt Me pet?",
      answer: "Shadow Dragon", answerEmoji: "🐉",
      image: "images/shadow-dragon.png",
      questionSeconds: 5, answerSeconds: 3
    },
    {
      level: 4, difficulty: "Expert",
      emojis: ["🦄", "💡", "🌈"],
      prompt: "Final round! Name the pet AND its version!",
      answer: "Mega Neon Unicorn", answerEmoji: "🦄",
      image: "images/mega-neon-unicorn.png",
      answerSfx: "applause",
      questionSeconds: 6, answerSeconds: 4
    }
  ],

  outro: {
    title: "HOW MANY DID YOU GET RIGHT?",
    sub: "Comment your score! 👇",
    cta: "Subscribe for more Roblox Quizzes!"
  },

  /* ---------------- ÂM THANH (tools/render.mjs tự trộn khi render) ----------------
     scene : hook | q1..qN | a1..aN | outro  — thoại tự dịch theo nếu bạn đổi thời lượng cảnh
     delay : giây sau khi cảnh bắt đầu. Câu hỏi 0.1 (nói cùng lúc emoji nảy vào);
             đáp án 0.8 (đợi thẻ lật + tiếng "ding" xong rồi mới đọc tên).
     Nhạc nền tự lặp/cắt cho vừa video, có fade vào/ra và TỰ HẠ nhỏ khi có thoại (ducking). */
  audio: {
    music: {
      file: "audio/bluelike_u-3-cream-soda-cute-bgm-271159.mp3",
      volume: 0.4, start: 0, fadeIn: 0.6, fadeOut: 2.5
    },
    voice: [
      { scene: "hook",  file: "audio/video 1/hook.mp3", delay: 0.1 },
      { scene: "q1",    file: "audio/video 1/Q1.mp3",   delay: 0.1 },
      { scene: "a1",    file: "audio/video 1/A1.mp3",   delay: 0.8 },
      { scene: "q2",    file: "audio/video 1/Q2.mp3",   delay: 0.1 },
      { scene: "a2",    file: "audio/video 1/A2.mp3",   delay: 0.8 },
      { scene: "q3",    file: "audio/video 1/Q3.mp3",   delay: 0.1 },
      { scene: "a3",    file: "audio/video 1/A3.mp3",   delay: 0.8 },
      { scene: "q4",    file: "audio/video 1/Q4.mp3",   delay: 0.1 },
      { scene: "a4",    file: "audio/video 1/A4.mp3",   delay: 0.8 },
      { scene: "outro", file: "audio/video 1/Last.mp3", delay: 0.3 }
    ],
    voiceVolume: 1.0,   // thoại gốc khá to (đỉnh ~ -1 dB) nên giữ 1.0
    sfxVolume: 0.7      // tiếng pop/tíc tắc/ding hạ nhẹ để không lấn thoại
  }
};
