/* =====================================================================
   Roblox Quiz Shorts – engine
   Timeline tuyệt đối (performance.now) => không bị trôi giờ giữa các cảnh.
   ===================================================================== */
(() => {
  'use strict';
  const D = window.QUIZ_DATA;
  const $ = (s) => document.querySelector(s);
  const params = new URLSearchParams(location.search);
  const FLAG = (k) => params.get(k) === '1';

  const LEVEL_COLORS = { 1: '#2ecc71', 2: '#ffb000', 3: '#ff5a1f', 4: '#e0198f' };
  const TITLE_COLORS = ['#ffe34d', '#5de3ff', '#ff7ad9'];

  /* ---------------- Định dạng: shorts 1080x1920 | landscape 1920x1080 ---------------- */
  const RENDER = !!window.__RENDER;               // true khi chạy dưới tools/render.mjs (đồng hồ ảo)
  const LAND = params.get('format') === 'landscape';
  const W = LAND ? 1920 : 1080, H = LAND ? 1080 : 1920;
  document.body.classList.toggle('land', LAND);

  /* ---------------- Scale stage vừa cửa sổ ---------------- */
  const stage = $('#stage');
  stage.style.setProperty('--w', W + 'px');
  stage.style.setProperty('--h', H + 'px');
  function fit() {
    stage.style.setProperty('--s', Math.min(innerWidth / W, innerHeight / H));
  }
  addEventListener('resize', fit); fit();

  /* ---------------- Nền: khối vuông bay lên ---------------- */
  (function makeBlocks() {
    const cols = ['#ffe34d', '#5de3ff', '#ff7ad9', '#7dff8a', '#ffffff'];
    const box = $('#blocks');
    for (let i = 0; i < 18; i++) {
      const b = document.createElement('div');
      const size = 70 + Math.random() * 130;
      b.className = 'blk';
      b.style.cssText = `width:${size}px;height:${size}px;left:${Math.random() * (W - 80)}px;` +
        `background:${cols[i % cols.length]};animation-duration:${9 + Math.random() * 9}s;` +
        `animation-delay:${-Math.random() * 18}s`;
      box.appendChild(b);
    }
  })();

  /* ---------------- SFX bằng WebAudio (không cần file) ---------------- */
  const sfx = (() => {
    // Khi render: dùng OfflineAudioContext + đồng hồ ảo => file WAV khớp từng khung hình
    let ac = null, master = null, muted = FLAG('mute'), offline = false;
    const nowS = () => (offline ? performance.now() / 1000 : ac.currentTime);
    const init = (totalSec = 60) => {
      try {
        if (!ac) {
          if (RENDER) { offline = true; ac = new OfflineAudioContext(2, Math.ceil(48000 * (totalSec + 1)), 48000); }
          else ac = new (window.AudioContext || window.webkitAudioContext)();
          master = ac.createGain(); master.gain.value = 0.8;
          const comp = ac.createDynamicsCompressor();          // chống vỡ tiếng khi nhiều âm chồng nhau
          master.connect(comp); comp.connect(ac.destination);
        }
        if (!offline && ac.state === 'suspended') ac.resume();
      } catch (err) { ac = null; console.warn('Audio unavailable:', err); }   // không có audio vẫn chạy hình
    };
    // Xuất toàn bộ SFX đã lên lịch thành WAV (base64) – chỉ dùng khi render
    const renderWav = async () => {
      if (!offline || !ac) return null;
      const buf = await ac.startRendering();
      const n = buf.length, ch = buf.numberOfChannels, sr = buf.sampleRate;
      const bytes = new Uint8Array(44 + n * ch * 2), dv = new DataView(bytes.buffer);
      const wr = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
      wr(0, 'RIFF'); dv.setUint32(4, 36 + n * ch * 2, true); wr(8, 'WAVE'); wr(12, 'fmt ');
      dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, ch, true);
      dv.setUint32(24, sr, true); dv.setUint32(28, sr * ch * 2, true); dv.setUint16(32, ch * 2, true);
      dv.setUint16(34, 16, true); wr(36, 'data'); dv.setUint32(40, n * ch * 2, true);
      const chans = []; for (let c = 0; c < ch; c++) chans.push(buf.getChannelData(c));
      let o = 44;
      for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) {
        const s = Math.max(-1, Math.min(1, chans[c][i])); dv.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true); o += 2;
      }
      let bin = '';
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      return btoa(bin);
    };
    const tone = (f, when, dur, o = {}) => {
      if (!ac || muted) return;
      const { type = 'sine', gain = 0.3, to = null } = o;
      const t = nowS() + when;
      const osc = ac.createOscillator(), g = ac.createGain();
      osc.type = type; osc.frequency.setValueAtTime(f, t);
      if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g).connect(master); osc.start(t); osc.stop(t + dur + 0.05);
    };
    const noise = (when, dur, o = {}) => {
      if (!ac || muted) return;
      const { gain = 0.2, type = 'bandpass', f = 1000, to = null, q = 1 } = o;
      const t = nowS() + when;
      const len = Math.max(1, Math.floor(ac.sampleRate * dur));
      const buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = ac.createBufferSource(); src.buffer = buf;
      const fl = ac.createBiquadFilter(); fl.type = type; fl.Q.value = q;
      fl.frequency.setValueAtTime(f, t);
      if (to) fl.frequency.exponentialRampToValueAtTime(to, t + dur);
      const g = ac.createGain();
      g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(fl).connect(g).connect(master); src.start(t);
    };
    return {
      init, renderWav,
      toggleMute() { muted = !muted; return muted; },
      pop(w = 0) { tone(380, w, 0.11, { type: 'sine', gain: 0.35, to: 900 }); },
      tick(w = 0, hi = false) { tone(hi ? 1500 : 1000, w, 0.05, { type: 'square', gain: 0.12 }); },
      whoosh(w = 0) { noise(w, 0.35, { gain: 0.25, f: 400, to: 3500, q: 0.8 }); },
      ding(w = 0) { tone(880, w, 0.6, { gain: 0.3 }); tone(1320, w + 0.07, 0.7, { gain: 0.22 }); },
      tada(w = 0) {
        [523, 659, 784, 1046].forEach((f, i) => tone(f, w + i * 0.09, 0.28, { type: 'triangle', gain: 0.28 }));
        tone(1046, w + 0.4, 0.8, { type: 'triangle', gain: 0.3 });
        tone(1318, w + 0.4, 0.8, { type: 'sine', gain: 0.18 });
      },
      applause(w = 0, secs = 3) {
        for (let i = 0; i < 90; i++) {
          noise(w + Math.random() * secs, 0.02 + Math.random() * 0.04,
            { type: 'highpass', f: 1200 + Math.random() * 1800, gain: 0.12 * (1 - i / 140) });
        }
        noise(w, secs, { type: 'bandpass', f: 2500, q: 0.4, gain: 0.05 });
      }
    };
  })();

  /* ---------------- Confetti / pháo hoa (canvas) ---------------- */
  const cv = $('#fx'); cv.width = W; cv.height = H; const cx = cv.getContext('2d');
  let parts = [];
  const COLS = ['#ffe34d', '#5de3ff', '#ff7ad9', '#7dff8a', '#ff8a3d', '#ffffff'];
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  function confetti(x, y, n = 110) {
    for (let i = 0; i < n; i++) {
      const a = rnd(-Math.PI * 0.95, -Math.PI * 0.05), v = rnd(10, 30);
      parts.push({ k: 'c', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 0.55, w: rnd(14, 30), h: rnd(8, 16),
        r: rnd(0, 6), vr: rnd(-0.3, 0.3), life: 0, max: rnd(70, 120), col: pick(COLS) });
    }
  }
  function firework(x, y) {
    const col = pick(COLS), n = 70;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, v = rnd(6, 18);
      parts.push({ k: 'f', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 0.25, w: rnd(8, 14),
        life: 0, max: rnd(45, 75), col: i % 3 ? col : pick(COLS) });
    }
  }
  function rain(n = 80) {
    for (let i = 0; i < n; i++) {
      parts.push({ k: 'c', x: rnd(0, W), y: rnd(-400, -20), vx: rnd(-3, 3), vy: rnd(6, 14), g: 0.2,
        w: rnd(14, 28), h: rnd(8, 14), r: rnd(0, 6), vr: rnd(-0.25, 0.25), life: 0, max: 200, col: pick(COLS) });
    }
  }
  let lastT = performance.now();
  (function loop(now) {
    const dt = Math.min(2.5, (now - lastT) / 16.667); lastT = now;
    cx.clearRect(0, 0, W, H);
    parts = parts.filter((p) => p.life < p.max && p.y < H + 200);
    for (const p of parts) {
      p.life += dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= p.k === 'f' ? 0.97 : 0.99;
      const alpha = Math.max(0, Math.min(1, (p.max - p.life) / 25));
      cx.globalAlpha = alpha; cx.fillStyle = p.col;
      if (p.k === 'c') {
        p.r += p.vr * dt;
        cx.save(); cx.translate(p.x, p.y); cx.rotate(p.r); cx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); cx.restore();
      } else {
        cx.beginPath(); cx.arc(p.x, p.y, p.w * (0.4 + alpha * 0.6), 0, 7); cx.fill();
      }
    }
    cx.globalAlpha = 1;
    requestAnimationFrame(loop);
  })(lastT);

  /* ---------------- Timeline helpers ---------------- */
  let runId = 0, t0 = 0;
  const CANCEL = Symbol('cancel');
  const sceneBox = $('#scene');

  // đợi tới giây thứ `sec` của video (tính từ lúc Play)
  const waitTo = (sec, id) => new Promise((res, rej) => {
    setTimeout(() => (id === runId ? res() : rej(CANCEL)), Math.max(0, t0 + sec * 1000 - performance.now()));
  });
  const later = (ms, fn) => { const id = runId; setTimeout(() => id === runId && fn(), ms); };
  const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const mount = (html) => { sceneBox.innerHTML = html; return sceneBox.firstElementChild; };
  const log = (name, sec) => { if (FLAG('debug')) console.log(`[${sec.toFixed(2)}s] ${name}`); };

  /* ---------------- Các cảnh ---------------- */
  function hookScene() {
    const lines = D.title.map((t, i) =>
      `<span class="ln ${t.length > 10 ? 'sm' : ''}" style="--c:${TITLE_COLORS[i % 3]};--d:${i * 0.18}s">${t}</span>`).join('');
    const emos = D.hookEmojis.map((e, i) => `<span style="--d:${1.1 + i * 0.12}s">${e}</span>`).join('');
    mount(`<div class="scene hook">
      <div class="hook-title">${lines}</div>
      <div class="hook-sub">${D.hookSub}</div>
      <div class="hook-emojis">${emos}</div></div>`);
    D.title.forEach((_, i) => sfx.pop(i * 0.18));
    sfx.pop(0.9); sfx.whoosh(0);
    [0, 0.45, 0.9, 1.4, 1.9, 2.4].forEach((s, i) => later(s * 1000, () => {
      firework(rnd(0.15 * W, 0.85 * W), rnd(0.12 * H, 0.42 * H));
      if (i % 2 === 0) sfx.tick(0, true);
    }));
    later(100, () => confetti(W / 2, H * 0.52, 120));
  }

  async function questionScene(q, idx, T, w) {
    const secs = q.questionSeconds, color = LEVEL_COLORS[q.level] || '#2ecc71';
    const ems = q.emojis.map((e, i) =>
      `${i ? `<span class="plus" style="--i:${i}">+</span>` : ''}<span class="em" style="--i:${i}">${e}</span>`).join('');
    mount(`<div class="scene q" style="--accent:${color};--dur:${secs}s">
      <div class="badge">LEVEL ${q.level}: ${q.difficulty.toUpperCase()}</div>
      <div class="qnum cartoon">QUESTION ${String(idx + 1).padStart(2, '0')}</div>
      <div class="prompt">${q.prompt}</div>
      <div class="emoji-card">${ems}</div>
      <div class="timer"><svg viewBox="0 0 200 200"><circle class="track" cx="100" cy="100" r="95"/>
        <circle class="bar" cx="100" cy="100" r="95"/></svg><div class="num"></div></div></div>`);
    sfx.whoosh(0); sfx.pop(0.1);
    q.emojis.forEach((_, i) => sfx.pop(0.35 + i * 0.18));
    const num = sceneBox.querySelector('.num');
    const perSec = Math.min(4, q.level);          // level càng cao tíc tắc càng dồn dập
    for (let i = 0; i < secs; i++) {
      if (i > 0) await w(T + i);
      num.textContent = secs - i;
      num.classList.remove('tick'); void num.offsetWidth; num.classList.add('tick');
      for (let k = 0; k < perSec; k++) sfx.tick(k / perSec, k === 0);
    }
  }

  async function answerScene(q, T, w) {
    const color = LEVEL_COLORS[q.level] || '#2ecc71';
    mount(`<div class="scene a" style="--accent:${color}">
      <div class="glow"></div>
      <div class="badge">LEVEL ${q.level}: ${q.difficulty.toUpperCase()}</div>
      <div class="ans-mini">${q.emojis.join(' ')}</div>
      <div class="flip"><div class="flip-inner">
        <div class="face front">?</div><div class="face back"></div></div></div>
      <div class="correct">✔ CORRECT!</div>
      <div class="aname">${q.answer} ${q.answerEmoji || ''}</div></div>`);
    sfx.whoosh(0);
    const back = sceneBox.querySelector('.back');
    const emojiFallback = () => {
      back.innerHTML = `<span class="big-emoji">${q.answerEmoji || '❓'}</span>`;
    };
    const cached = q.image && imgCache[q.image];  // ảnh đã tải sẵn từ trước khi video chạy
    if (cached) back.appendChild(cached.cloneNode());
    else emojiFallback();                         // chưa có file ảnh -> dùng emoji

    await frame();
    await w(T + 0.25);
    sceneBox.querySelector('.flip').classList.add('go');
    sfx.pop(0.2);
    await w(T + 0.6);
    sceneBox.querySelector('.correct').classList.add('show');
    sceneBox.querySelector('.aname').classList.add('show');
    sfx.ding(); sfx.tada(0.05);
    if (q.answerSfx === 'applause') sfx.applause(0.2, Math.max(2, q.answerSeconds - 1));
    confetti(W / 2, H * 0.46, 140); confetti(W * 0.2, H * 0.52, 70); confetti(W * 0.8, H * 0.52, 70);
    firework(rnd(0.18 * W, 0.82 * W), rnd(0.13 * H, 0.31 * H));
    if (q.answerSfx === 'applause') { later(500, () => rain(90)); later(1400, () => firework(rnd(0.18 * W, 0.82 * W), rnd(0.13 * H, 0.36 * H))); }
  }

  async function outroScene(T, w) {
    const O = D.outro;
    const tiles = D.questions.map((q, i) => `
      <div class="tile" style="--i:${i}"><span class="tk">✓</span>
        ${imgCache[q.image]   // có ảnh thật thì dùng ảnh, không thì emoji
          ? `<img src="${imgCache[q.image].src}" alt="">`
          : `<span class="te">${q.answerEmoji || '❓'}</span>`}
        <span class="tn">${q.answer}</span></div>`).join('');
    mount(`<div class="scene outro">
      <div class="o-title cartoon">${O.title}</div>
      <div class="o-sub">${O.sub}</div>
      <div class="tiles" style="--cols:${LAND ? Math.min(4, D.questions.length) : 2}">${tiles}</div>
      <div class="sub-wrap">
        <div class="sub-btn"><span class="play"></span><span>SUBSCRIBE</span></div>
        <div class="hand">👆</div>
        <div class="o-cta">${O.cta}</div>
      </div></div>`);
    sfx.whoosh(0); sfx.pop(0.05);
    D.questions.forEach((_, i) => sfx.pop(0.5 + i * 0.28));
    confetti(W / 2, H * 0.47, 100);
    const btn = sceneBox.querySelector('.sub-btn'), hand = sceneBox.querySelector('.hand');
    await w(T + 2.0); btn.classList.add('show'); sfx.pop();
    await w(T + 3.0); hand.classList.add('show');
    await w(T + 3.7); hand.classList.remove('show'); hand.classList.add('tap'); sfx.tick(0, true);
    await w(T + 3.95);
    btn.classList.remove('show'); btn.classList.add('done');
    btn.innerHTML = '<span>SUBSCRIBED 🔔</span>'; sfx.ding(); confetti(W / 2, H * 0.65, 90);
  }

  /* ---------------- Chạy toàn bộ video ---------------- */
  async function play() {
    const id = ++runId;
    await window.__quizReady;                    // đợi font + ảnh tải xong rồi mới tính giờ
    if (id !== runId) return;
    t0 = performance.now();
    window.__quizDone = false;
    document.body.classList.add('playing');
    $('#start').classList.add('hidden');
    parts = [];
    const w = (s) => waitTo(s, id);
    try {
      let T = 0;
      await w(0); log('HOOK', T); hookScene(); T += D.timing.hook;
      for (let i = 0; i < D.questions.length; i++) {
        const q = D.questions[i];
        await w(T); log(`Q${i + 1}`, T); await questionScene(q, i, T, w); T += q.questionSeconds;
        await w(T); log(`A${i + 1}`, T); await answerScene(q, T, w); T += q.answerSeconds;
      }
      await w(T); log('OUTRO', T); await outroScene(T, w); T += D.timing.outro;
      await w(T); log('END', T);
      window.__quizDone = true;
      document.dispatchEvent(new Event('quizdone'));
      if (FLAG('loop')) { await new Promise((r) => setTimeout(r, 800)); if (id === runId) play(); }
    } catch (e) { if (e !== CANCEL) throw e; }
  }

  // Tổng thời lượng (giây)
  const TOTAL = D.timing.hook + D.timing.outro +
    D.questions.reduce((s, q) => s + q.questionSeconds + q.answerSeconds, 0);
  window.__quizTotalSeconds = TOTAL;

  // Mốc bắt đầu từng cảnh (giây): hook, q1, a1, q2, a2, ..., outro — để tools/render.mjs đặt thoại đúng chỗ
  window.__quizTimeline = (() => {
    let t = 0; const L = [{ id: 'hook', start: 0 }]; t += D.timing.hook;
    D.questions.forEach((q, i) => {
      L.push({ id: 'q' + (i + 1), start: t }); t += q.questionSeconds;
      L.push({ id: 'a' + (i + 1), start: t }); t += q.answerSeconds;
    });
    L.push({ id: 'outro', start: t });
    return L;
  })();

  /* ---------------- Tải sẵn ảnh + font ---------------- */
  const imgCache = {};
  const preload = () => Promise.all(D.questions.filter((q) => q.image).map((q) => new Promise((res) => {
    const img = new Image();
    img.onload = () => { imgCache[q.image] = img; (img.decode ? img.decode() : Promise.resolve()).catch(() => {}).then(res); };
    img.onerror = res;                           // thiếu ảnh -> bỏ qua, sẽ dùng emoji
    img.src = q.image;
  })));
  window.__quizReady = Promise.all([preload(), document.fonts ? document.fonts.ready : null]);

  // Cổng cho tools/render.mjs
  window.__quizPlay = () => { sfx.init(TOTAL); play(); };
  window.__quizAudio = () => sfx.renderWav();

  /* ---------------- Điều khiển ---------------- */
  $('#startBtn').addEventListener('click', () => { sfx.init(TOTAL); play(); });
  addEventListener('keydown', (e) => {
    if (e.code === 'Space') { e.preventDefault(); sfx.init(TOTAL); play(); }
    if (e.key === 'm' || e.key === 'M') sfx.toggleMute();
  });
  if (FLAG('autoplay') && !RENDER) { sfx.init(TOTAL); play(); }
  if (FLAG('debug')) {
    const d = document.createElement('div'); d.id = 'dbg'; stage.appendChild(d);
    setInterval(() => { d.textContent = ((performance.now() - t0) / 1000).toFixed(1) + 's / ' + window.__quizTotalSeconds + 's'; }, 100);
  }
})();
