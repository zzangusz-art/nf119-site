/* ─────────────────────────────────────────────────────────────
   제품 지구본 — 캔버스 렌더러
   · 제품 29종의 썸네일을 구면 위에 고르게 배치(피보나치 구)
   · 드래그로 회전(관성 포함), 스크롤 진행도로 자동 회전·확대, 유휴 시 느린 자전
   · 앞면 썸네일은 크고 선명하게, 뒷면은 작고 흐리게 — 깊이순으로 그림
   · 호버 시 onHover(sprite), 클릭 시 onPick(id)
   ───────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const ease = t => (t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

  class Globe {
    constructor(canvas, opts) {
      this.c = canvas;
      this.ctx = canvas.getContext('2d');
      this.o = Object.assign({ products: [], units: [], onPick: () => {}, onHover: () => {},
        onDrag: () => {}, reduce: false }, opts);
      this.p = 0;                      // 스크롤 진행도
      this.yaw = 0; this.pitch = -0.18; // 사용자 회전
      this.spin = 0;                   // 유휴 자전
      this.vy = 0; this.vp = 0;        // 관성
      this.drag = null; this.moved = 0;
      this.hover = null; this.focusUnit = null;
      this.running = false; this.userTouched = false;
      this.dpr = Math.min(2, window.devicePixelRatio || 1);
      this.t0 = performance.now();
      this.build(); this.loadImages(); this.resize(); this.bind();
    }

    /* ── 구면 배치 ─────────────────────── */
    build() {
      const N = this.o.products.length;
      const unitOf = {}; this.o.units.forEach(u => u.ids.forEach(i => unitOf[i] = u));
      const golden = Math.PI * (3 - Math.sqrt(5));
      // 제품군끼리 가까이 모이도록 제품군 순서대로 구면을 따라 배치
      const ordered = []; this.o.units.forEach(u => u.ids.forEach(i => ordered.push(i)));
      this.sp = ordered.map((id, k) => {
        const y = 1 - (k / (N - 1)) * 2;            // -1..1
        const r = Math.sqrt(1 - y * y);
        const th = golden * k;
        const p = this.o.products.find(x => x.i === id), u = unitOf[id];
        return { id, x: Math.cos(th) * r, y, z: Math.sin(th) * r, unit: u.key, color: u.color,
          name: p.name, model: p.model, img: p.img, el: null, sx: 0, sy: 0, sr: 0, depth: 0, vis: 1 };
      });
    }
    loadImages() {
      for (const s of this.sp) { const im = new Image(); im.decoding = 'async'; im.src = s.img; im.onload = () => { s.el = im; }; }
    }

    resize() {
      const r = this.c.getBoundingClientRect();
      this.w = Math.max(1, r.width); this.h = Math.max(1, r.height);
      this.c.width = Math.round(this.w * this.dpr); this.c.height = Math.round(this.h * this.dpr);
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this.draw();
    }

    bind() {
      addEventListener('resize', () => this.resize());
      const c = this.c;
      c.addEventListener('pointerdown', e => {
        this.drag = { x: e.clientX, y: e.clientY, yaw: this.yaw, pitch: this.pitch, t: performance.now() };
        this.moved = 0; this.vy = this.vp = 0; c.setPointerCapture(e.pointerId);
        this.o.onDrag(true);
      });
      c.addEventListener('pointermove', e => {
        const r = c.getBoundingClientRect();
        if (this.drag) {
          const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
          this.moved = Math.max(this.moved, Math.abs(dx) + Math.abs(dy));
          const ny = this.drag.yaw + dx * .0062, np = clamp(this.drag.pitch - dy * .0045, -.75, .75);
          this.vy = clamp((ny - this.yaw) * .55, -.12, .12); this.vp = clamp((np - this.pitch) * .55, -.08, .08);
          this.yaw = ny; this.pitch = np; this.userTouched = true;
          this.setHover(null); return;
        }
        this.pick(e.clientX - r.left, e.clientY - r.top, false);
      });
      const up = e => {
        if (!this.drag) return;
        const r = c.getBoundingClientRect();
        const click = this.moved < 6;
        this.drag = null; this.o.onDrag(false);
        if (click) this.pick(e.clientX - r.left, e.clientY - r.top, true);
      };
      c.addEventListener('pointerup', up);
      c.addEventListener('pointercancel', up);
      c.addEventListener('pointerleave', () => { if (!this.drag) { this.setHover(null); } });
    }

    pick(px, py, click) {
      let best = null, bd = Infinity;
      for (const s of this.sp) {
        if (s.depth < -.05 || s.vis < .5) continue;
        const dx = s.sx - px, dy = s.sy - py, d = dx * dx + dy * dy, rr = (s.sr + 6) ** 2;
        if (d < rr && (best === null || s.depth > best.depth)) { best = s; bd = d; }
      }
      if (click) { if (best) this.o.onPick(best.id); return; }
      this.setHover(best);
    }
    setHover(s) { if (this.hover !== s) { this.hover = s; this.o.onHover(s); } else if (s) this.o.onHover(s, true); }

    setProgress(p) { this.p = clamp(p, 0, 1); }
    setFocus(k) { this.focusUnit = k; }
    start() { if (!this.running) { this.running = true; this.loop(); } }
    stop() { this.running = false; }
    loop() { if (!this.running) return; this.draw(); requestAnimationFrame(() => this.loop()); }

    /* ── 회전·투영 ─────────────────────── */
    rot(x, y, z, yaw, pitch) {
      const cy = Math.cos(yaw), sy = Math.sin(yaw);
      let X = x * cy + z * sy, Z = -x * sy + z * cy;
      const cp = Math.cos(pitch), sp = Math.sin(pitch);
      let Y = y * cp - Z * sp; Z = y * sp + Z * cp;
      return [X, Y, Z];
    }
    proj(v, R, cx, cy) {
      const k = 1 + v[2] * .28;      // 앞(+z)이 커 보이게
      return { x: cx + v[0] * R * k, y: cy - v[1] * R * k, k, z: v[2] };
    }

    draw() {
      const ctx = this.ctx, w = this.w, h = this.h;
      const t = (performance.now() - this.t0) / 1000;
      const pe = ease(this.p);
      // 관성 · 자전
      if (!this.drag) {
        this.yaw += this.vy; this.pitch = clamp(this.pitch + this.vp, -.75, .75);
        this.vy *= .94; this.vp *= .90;
        if (!this.o.reduce) this.spin += .0022;
      }
      const yaw = this.yaw + this.spin + pe * TAU * .8;
      const pitch = this.pitch;
      const intro = clamp(this.p / .28, 0, 1);          // 헤드라인이 걷히는 동안 또렷해진다
      const R = Math.min(w, h) * (0.26 + pe * .11);
      const cx = w * .5 + (w > 820 ? pe * Math.min(110, w * .08) : 0),   // 범례 자리를 비켜 준다
            cy = h * (0.53 - pe * .02);
      const dimAll = 0.42 + 0.58 * intro;

      ctx.clearRect(0, 0, w, h);

      /* 구체 — 유리구슬 느낌의 그라데이션 + 림 */
      let g = ctx.createRadialGradient(cx - R * .35, cy - R * .4, R * .1, cx, cy, R * 1.05);
      g.addColorStop(0, 'rgba(70,100,210,.22)');
      g.addColorStop(.6, 'rgba(30,50,120,.14)');
      g.addColorStop(1, 'rgba(12,18,40,.05)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(140,170,255,.22)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();

      /* 경위선 — 앞면만 또렷하게 */
      ctx.lineWidth = 1;
      const line = (pts) => {
        let open = false;
        for (let i = 0; i < pts.length; i++) {
          const q = pts[i];
          if (q.z < -.02) { if (open) { ctx.stroke(); open = false; } continue; }
          ctx.globalAlpha = (.06 + .14 * clamp(q.z, 0, 1)) * dimAll;
          if (!open) { ctx.beginPath(); ctx.moveTo(q.x, q.y); open = true; } else ctx.lineTo(q.x, q.y);
        }
        if (open) ctx.stroke();
      };
      ctx.strokeStyle = '#a8bdfd';
      for (let la = -60; la <= 60; la += 30) {                 // 위도
        const r = Math.cos(la * Math.PI / 180), y = Math.sin(la * Math.PI / 180), pts = [];
        for (let a = 0; a <= 72; a++) { const th = a / 72 * TAU; pts.push(this.proj(this.rot(Math.cos(th) * r, y, Math.sin(th) * r, yaw, pitch), R, cx, cy)); }
        line(pts);
      }
      for (let lo = 0; lo < 180; lo += 30) {                   // 경도
        const th = lo * Math.PI / 180, pts = [];
        for (let a = 0; a <= 72; a++) { const ph = a / 72 * TAU; pts.push(this.proj(this.rot(Math.cos(th) * Math.cos(ph), Math.sin(ph), Math.sin(th) * Math.cos(ph), yaw, pitch), R, cx, cy)); }
        line(pts);
      }
      ctx.globalAlpha = 1;

      /* 썸네일 — 깊이순 */
      const base = clamp(R * .135, 22, 44) * (0.92 + pe * .12);
      const focus = this.focusUnit, labelsOn = pe > .8 && w > 820;
      const items = this.sp.map(s => { const q = this.proj(this.rot(s.x, s.y, s.z, yaw, pitch), R, cx, cy); s.sx = q.x; s.sy = q.y; s.depth = q.z; s.sr = base * (0.55 + 0.45 * (q.z + 1) / 2); return s; })
        .sort((a, b) => a.depth - b.depth);
      for (const s of items) {
        const front = s.depth > 0;
        const dim = focus && focus !== s.unit;
        s.vis = dim ? .3 : 1;
        const hov = this.hover === s;
        const r = s.sr * (hov ? 1.18 : 1);
        const a = (front ? .55 + .45 * s.depth : .18 + .25 * (s.depth + 1)) * (dim ? .35 : 1) * dimAll;
        ctx.globalAlpha = a;
        // 글로우 링
        if (front) {
          const gg = ctx.createRadialGradient(s.sx, s.sy, r * .9, s.sx, s.sy, r * 1.9);
          gg.addColorStop(0, s.color + (hov ? '66' : '33')); gg.addColorStop(1, s.color + '00');
          ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(s.sx, s.sy, r * 1.9, 0, TAU); ctx.fill();
        }
        // 원형 썸네일
        ctx.save(); ctx.beginPath(); ctx.arc(s.sx, s.sy, r, 0, TAU); ctx.closePath(); ctx.clip();
        if (s.el) {
          const im = s.el, side = Math.min(im.naturalWidth, im.naturalHeight);
          ctx.drawImage(im, (im.naturalWidth - side) / 2, (im.naturalHeight - side) / 2, side, side, s.sx - r, s.sy - r, r * 2, r * 2);
        } else { ctx.fillStyle = '#1f2633'; ctx.fillRect(s.sx - r, s.sy - r, r * 2, r * 2); }
        if (!front) { ctx.fillStyle = 'rgba(12,16,24,.45)'; ctx.fillRect(s.sx - r, s.sy - r, r * 2, r * 2); }
        ctx.restore();
        // 테두리
        ctx.lineWidth = hov ? 2.5 : 1.5;
        ctx.strokeStyle = hov ? '#ffffff' : s.color;
        ctx.globalAlpha = a * (front ? .95 : .5);
        ctx.beginPath(); ctx.arc(s.sx, s.sy, r, 0, TAU); ctx.stroke();
        // 라벨
        if (labelsOn && front && s.depth > .45 && !dim && !hov) {
          ctx.globalAlpha = .55 * clamp((pe - .8) / .2, 0, 1) * clamp((s.depth - .45) / .3, 0, 1);
          ctx.fillStyle = '#e6ecfa'; ctx.font = '500 11px "Noto Sans KR", sans-serif';
          ctx.textAlign = 'center'; ctx.textBaseline = 'top';
          ctx.fillText(s.name, s.sx, s.sy + r + 6);
        }
      }
      ctx.globalAlpha = 1;
      // 하이라이트 반사
      g = ctx.createRadialGradient(cx - R * .45, cy - R * .5, 0, cx - R * .45, cy - R * .5, R * .7);
      g.addColorStop(0, 'rgba(255,255,255,.07)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
    }
  }
  window.NFGlobe = Globe;
})();
