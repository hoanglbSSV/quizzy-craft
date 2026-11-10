/* Đồng hồ ảo – được tools/render.mjs tiêm vào trang TRƯỚC khi app.js chạy.
   Thay thế mọi nguồn thời gian của trình duyệt (setTimeout, rAF, performance.now, CSS animation)
   bằng một đồng hồ do script điều khiển từng khung hình => video luôn mượt đúng 60fps,
   không phụ thuộc máy nhanh/chậm, kể cả khi mỗi khung mất 300ms để chụp. */
(() => {
  window.__RENDER = true;

  let now = 0, seq = 0, rafSeq = 0;
  const timers = [], rafs = [];
  const mc = new MessageChannel();
  const flush = () => new Promise((r) => { mc.port1.onmessage = () => r(); mc.port2.postMessage(0); });

  // ---- thời gian ----
  performance.now = () => now;
  Date.now = () => 1700000000000 + now;

  // ---- random có seed: 2 định dạng (dọc/ngang) cho ra hiệu ứng giống nhau ----
  let s = 0x9e3779b9;
  Math.random = () => {
    s |= 0; s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  // ---- timer ----
  window.setTimeout = (fn, ms = 0, ...args) => {
    const id = ++seq; timers.push({ id, due: now + Math.max(0, +ms || 0), fn, args }); return id;
  };
  window.setInterval = (fn, ms = 0, ...args) => {
    const every = Math.max(1, +ms || 1), id = ++seq; timers.push({ id, due: now + every, fn, args, every }); return id;
  };
  window.clearTimeout = window.clearInterval = (id) => {
    const i = timers.findIndex((t) => t.id === id); if (i >= 0) timers.splice(i, 1);
  };
  window.requestAnimationFrame = (cb) => { const id = ++rafSeq; rafs.push({ id, cb }); return id; };
  window.cancelAnimationFrame = (id) => { const i = rafs.findIndex((r) => r.id === id); if (i >= 0) rafs.splice(i, 1); };

  // ---- CSS animation / transition: tạm dừng và tua theo đồng hồ ảo ----
  const starts = new WeakMap();
  const track = () => {
    for (const a of document.getAnimations()) {
      if (!starts.has(a)) { starts.set(a, now); a.pause(); }
    }
  };
  const seek = () => {
    for (const a of document.getAnimations()) {
      if (!starts.has(a)) { starts.set(a, now); a.pause(); }
      a.currentTime = now - starts.get(a);
    }
  };

  const runTimers = async (target) => {
    for (;;) {
      let next = null;
      for (const t of timers) {
        if (t.due <= target && (!next || t.due < next.due || (t.due === next.due && t.id < next.id))) next = t;
      }
      if (!next) return;
      const at = next.due;
      if (next.every) next.due += next.every; else timers.splice(timers.indexOf(next), 1);
      now = Math.max(now, at);
      try { next.fn(...next.args); } catch (e) { console.error(e); }
      track();
      await flush();                  // cho các promise (await) chạy hết trước khi sang timer kế
    }
  };

  // Tiến đồng hồ tới mốc `target` (ms) và dựng xong khung hình tại mốc đó.
  window.__stepTo = async (target) => {
    await runTimers(target);
    now = Math.max(now, target);
    const cbs = rafs.splice(0);
    for (const r of cbs) { try { r.cb(now); } catch (e) { console.error(e); } }
    track();
    await flush();
    await runTimers(now);
    seek();
  };
})();
