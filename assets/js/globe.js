/* ─────────────────────────────────────────────────────────────
   제품 지구본 — 캔버스 렌더러
   · 제품 29종 썸네일을 구면 위에 고르게 배치(피보나치 구)
   · 스크롤 진행도 p
       0 → .80  회전(0.85바퀴)하며 커진다
       .74 → .90 회전을 마친 뒤 setFrame()으로 받은 빈 영역으로 물러나 자리잡는다
   · 드래그 회전 + 관성, 유휴 시 느린 자전
   · 처음부터 앞면 썸네일 아래에 짧은 제품명. 라벨끼리·앞쪽 썸네일과 겹치면 생략
   · 호버 시 onHover(sprite), 클릭 시 onPick(id)
   ───────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => (t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const seg = (p, a, b) => clamp((p - a) / (b - a), 0, 1);
  const FONT = '"Noto Sans KR", "Malgun Gothic", sans-serif';

  class Globe {
    constructor(canvas, opts) {
      this.c = canvas;
      this.ctx = canvas.getContext('2d');
      this.o = Object.assign({ products: [], units: [], onPick: () => {}, onHover: () => {},
        onDrag: () => {}, reduce: false }, opts);
      this.p = 0;
      this.yaw = 0; this.pitch = -0.18;
      this.spin = 0; this.vy = 0; this.vp = 0;
      this.drag = null; this.moved = 0;
      this.hover = null; this.focusUnit = null;
      this.running = false;
      this.frame = null;                       // 자리잡을 영역 {x0,x1,y0,y1}
      this.dpr = Math.min(2, window.devicePixelRatio || 1);
      this.build(); this.loadImages(); this.resize(); this.bind();
    }

    build() {
      const N = this.o.products.length;
      const unitOf = {}; this.o.units.forEach(u => u.ids.forEach(i => unitOf[i] = u));
      const golden = Math.PI * (3 - Math.sqrt(5));
      const ordered = []; this.o.units.forEach(u => u.ids.forEach(i => ordered.push(i)));
      this.sp = ordered.map((id, k) => {
        const y = 1 - (k / (N - 1)) * 2, r = Math.sqrt(1 - y * y), th = golden * k;
        const p = this.o.products.find(x => x.i === id), u = unitOf[id];
        return { id, x: Math.cos(th) * r, y, z: Math.sin(th) * r, unit: u.key, color: u.color,
          name: p.name, short: p.short || p.name, model: p.model, img: p.img,
          el: null, sx: 0, sy: 0, sr: 0, depth: 0, vis: 1, tw: 0 };
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
      this.sp.forEach(s => { s.tw = 0; });     // 글자 폭 다시 잼
      this.draw();
    }
    setFrame(f) { this.frame = f; }

    bind() {
      addEventListener('resize', () => this.resize());
      const c = this.c;
      c.addEventListener('pointerdown', e => {
        this.drag = { x: e.clientX, y: e.clientY, yaw: this.yaw, pitch: this.pitch };
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
          this.yaw = ny; this.pitch = np;
          this.setHover(null); return;
        }
        this.pick(e.clientX - r.left, e.clientY - r.top, false);
      });
      const up = e => {
        if (!this.drag) return;
        const r = c.getBoundingClientRect(), click = this.moved < 6;
        this.drag = null; this.o.onDrag(false);
        if (click) this.pick(e.clientX - r.left, e.clientY - r.top, true);
      };
      c.addEventListener('pointerup', up);
      c.addEventListener('pointercancel', up);
      c.addEventListener('pointerleave', () => { if (!this.drag) this.setHover(null); });
    }

    pick(px, py, click) {
      let best = null;
      for (const s of this.sp) {
        if (s.depth < -.05 || s.vis < .5) continue;
        const dx = s.sx - px, dy = s.sy - py;
        if (dx * dx + dy * dy < (s.sr + 6) ** 2 && (!best || s.depth > best.depth)) best = s;
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

    rot(x, y, z, yaw, pitch) {
      const cy = Math.cos(yaw), sy = Math.sin(yaw);
      const X = x * cy + z * sy; let Z = -x * sy + z * cy;
      const cp = Math.cos(pitch), sp = Math.sin(pitch);
      const Y = y * cp - Z * sp; Z = y * sp + Z * cp;
      return [X, Y, Z];
    }
    proj(v, R, cx, cy) { const k = 1 + v[2] * .26; return { x: cx + v[0] * R * k, y: cy - v[1] * R * k, z: v[2] }; }

    /* 현재 진행도에서의 중심·반지름 */
    layout() {
      const w = this.w, h = this.h, p = this.p, m = Math.min(w, h);
      const grow = ease(seg(p, 0, .42));
      // 회전 중에는 위쪽 안내 문구와 겹치지 않도록 조금 아래·작게
      const R0 = m * .27, R1 = m * .32;
      let R = lerp(R0, R1, grow), cx = w * .5, cy = h * .59;
      const f = this.frame;
      if (f) {
        const s = ease(seg(p, .74, .90));
        const pad = 34;                                    // 라벨이 들어갈 아래 여유
        // 1.24 = 원근으로 앞면이 커지는 몫(≈8%) + 썸네일 반지름(≈16%)
        const fR = Math.max(60, Math.min((f.x1 - f.x0) / 2, (f.y1 - f.y0 - pad) / 2) / 1.24);
        const fcx = (f.x0 + f.x1) / 2, fcy = f.y0 + (f.y1 - f.y0 - pad) / 2;
        R = lerp(R, fR, s); cx = lerp(cx, fcx, s); cy = lerp(cy, fcy, s);
      }
      return { R, cx, cy };
    }

    draw() {
      const ctx = this.ctx, w = this.w, h = this.h;
      if (!this.drag) {
        this.yaw += this.vy; this.pitch = clamp(this.pitch + this.vp, -.75, .75);
        this.vy *= .94; this.vp *= .90;
        if (!this.o.reduce) this.spin += .0018;
      }
      const p = this.p;
      const turn = ease(seg(p, 0, .80));
      const yaw = this.yaw + this.spin + turn * TAU * .85, pitch = this.pitch;
      const { R, cx, cy } = this.layout();
      const dimAll = .4 + .6 * seg(p, 0, .24);              // 헤드라인이 걷히는 동안 또렷해진다

      ctx.clearRect(0, 0, w, h);

      /* 구체 */
      let g = ctx.createRadialGradient(cx - R * .35, cy - R * .4, R * .1, cx, cy, R * 1.05);
      g.addColorStop(0, 'rgba(70,100,210,.22)'); g.addColorStop(.6, 'rgba(30,50,120,.13)'); g.addColorStop(1, 'rgba(12,18,40,.04)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(140,170,255,.2)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();

      /* 경위선 — 앞면만 */
      ctx.strokeStyle = '#a8bdfd';
      const line = pts => {
        let open = false;
        for (const q of pts) {
          if (q.z < -.02) { if (open) { ctx.stroke(); open = false; } continue; }
          ctx.globalAlpha = (.05 + .13 * clamp(q.z, 0, 1)) * dimAll;
          if (!open) { ctx.beginPath(); ctx.moveTo(q.x, q.y); open = true; } else ctx.lineTo(q.x, q.y);
        }
        if (open) ctx.stroke();
      };
      for (let la = -60; la <= 60; la += 30) {
        const r = Math.cos(la * Math.PI / 180), y = Math.sin(la * Math.PI / 180), pts = [];
        for (let a = 0; a <= 72; a++) { const th = a / 72 * TAU; pts.push(this.proj(this.rot(Math.cos(th) * r, y, Math.sin(th) * r, yaw, pitch), R, cx, cy)); }
        line(pts);
      }
      for (let lo = 0; lo < 180; lo += 30) {
        const th = lo * Math.PI / 180, pts = [];
        for (let a = 0; a <= 72; a++) { const ph = a / 72 * TAU; pts.push(this.proj(this.rot(Math.cos(th) * Math.cos(ph), Math.sin(ph), Math.sin(th) * Math.cos(ph), yaw, pitch), R, cx, cy)); }
        line(pts);
      }
      ctx.globalAlpha = 1;

      /* 썸네일 크기 — 이전보다 약 25% 크게 */
      const base = clamp(R * .2, 27, 60);
      const items = this.sp.map(s => {
        const q = this.proj(this.rot(s.x, s.y, s.z, yaw, pitch), R, cx, cy);
        s.sx = q.x; s.sy = q.y; s.depth = q.z; s.sr = base * (.55 + .45 * (q.z + 1) / 2);
        return s;
      }).sort((a, b) => a.depth - b.depth);

      const focus = this.focusUnit;
      for (const s of items) {
        const front = s.depth > 0, dim = focus && focus !== s.unit, hov = this.hover === s;
        s.vis = dim ? .3 : 1;
        const r = s.sr * (hov ? 1.16 : 1);
        const a = (front ? .55 + .45 * s.depth : .16 + .24 * (s.depth + 1)) * (dim ? .35 : 1) * dimAll;
        ctx.globalAlpha = a;
        if (front) {
          const gg = ctx.createRadialGradient(s.sx, s.sy, r * .9, s.sx, s.sy, r * 1.8);
          gg.addColorStop(0, s.color + (hov ? '66' : '30')); gg.addColorStop(1, s.color + '00');
          ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(s.sx, s.sy, r * 1.8, 0, TAU); ctx.fill();
        }
        ctx.save(); ctx.beginPath(); ctx.arc(s.sx, s.sy, r, 0, TAU); ctx.closePath(); ctx.clip();
        if (s.el) {
          const im = s.el, side = Math.min(im.naturalWidth, im.naturalHeight);
          ctx.drawImage(im, (im.naturalWidth - side) / 2, (im.naturalHeight - side) / 2, side, side, s.sx - r, s.sy - r, r * 2, r * 2);
        } else { ctx.fillStyle = '#1f2633'; ctx.fillRect(s.sx - r, s.sy - r, r * 2, r * 2); }
        if (!front) { ctx.fillStyle = 'rgba(12,16,24,.48)'; ctx.fillRect(s.sx - r, s.sy - r, r * 2, r * 2); }
        ctx.restore();
        ctx.lineWidth = hov ? 2.5 : 1.5;
        ctx.strokeStyle = hov ? '#ffffff' : s.color;
        ctx.globalAlpha = a * (front ? .95 : .5);
        ctx.beginPath(); ctx.arc(s.sx, s.sy, r, 0, TAU); ctx.stroke();
      }

      /* 라벨 — 가장 앞쪽부터 자리를 차지하고, 겹치면 생략 */
      const fs = w < 600 ? 10.5 : 11.5, lh = fs + 9;
      ctx.font = `500 ${fs}px ${FONT}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const placed = [];
      const front = items.filter(s => s.depth > .12).sort((a, b) => b.depth - a.depth);
      const hitsThumb = (rc, self) => front.some(o => {
        if (o === self || o.depth < self.depth) return false;
        const nx = clamp(o.sx, rc.x, rc.x + rc.w), ny = clamp(o.sy, rc.y, rc.y + rc.h);
        return (o.sx - nx) ** 2 + (o.sy - ny) ** 2 < (o.sr * .92) ** 2;
      });
      for (const s of front) {
        if (s === this.hover || (focus && focus !== s.unit)) continue;
        if (!s.tw) s.tw = ctx.measureText(s.short).width;
        const rc = { x: s.sx - s.tw / 2 - 7, y: s.sy + s.sr + 5, w: s.tw + 14, h: lh };
        if (rc.x < 4 || rc.x + rc.w > w - 4 || rc.y + rc.h > h - 4) continue;
        if (placed.some(o => rc.x < o.x + o.w + 4 && o.x < rc.x + rc.w + 4 && rc.y < o.y + o.h + 2 && o.y < rc.y + rc.h + 2)) continue;
        if (hitsThumb(rc, s)) continue;
        placed.push(rc);
        const a = clamp((s.depth - .12) / .32, 0, 1) * dimAll;
        ctx.globalAlpha = a * .78;
        ctx.fillStyle = 'rgba(11,14,20,.82)';
        const rr = rc.h / 2;
        ctx.beginPath();
        ctx.moveTo(rc.x + rr, rc.y); ctx.lineTo(rc.x + rc.w - rr, rc.y);
        ctx.arc(rc.x + rc.w - rr, rc.y + rr, rr, -Math.PI / 2, Math.PI / 2);
        ctx.lineTo(rc.x + rr, rc.y + rc.h);
        ctx.arc(rc.x + rr, rc.y + rr, rr, Math.PI / 2, Math.PI * 1.5);
        ctx.fill();
        ctx.globalAlpha = a;
        ctx.fillStyle = '#eef2fb';
        ctx.fillText(s.short, s.sx, rc.y + rc.h / 2 + .5);
      }
      ctx.globalAlpha = 1;

      g = ctx.createRadialGradient(cx - R * .45, cy - R * .5, 0, cx - R * .45, cy - R * .5, R * .7);
      g.addColorStop(0, 'rgba(255,255,255,.06)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
    }
  }
  window.NFGlobe = Globe;
})();
