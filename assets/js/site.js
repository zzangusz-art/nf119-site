/* ─────────────────────────────────────────────────────────────
   NF방재 제품 홈페이지 — 동작
   히어로 스크롤 시퀀스 · 제품 필터/검색/스켈레톤 · 모달 · 드로어(문의/비교/메뉴)
   · 아코디언 · 토스트 · 목차 활성 · 진행 바
   ───────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  const D = window.NF;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 제품군 색 — 지구본 썸네일 테두리와 카드 점 색을 공유
  const UNIT_COLOR = { ev: '#5ad0ff', haz: '#ffb454', fire: '#c9d4ff', sup: '#ff6b6b', parts: '#6fe3a8', infra: '#b48cff' };
  D.units.forEach(u => { u.color = UNIT_COLOR[u.key] || '#fff'; });
  const unitOf = {}; D.units.forEach(u => u.ids.forEach(i => unitOf[i] = u));
  const byId = {}; D.products.forEach(p => byId[p.i] = p);

  /* ── 토스트 ────────────────────────────── */
  const toasts = $('#toasts');
  function toast(msg, kind, icon, link) {
    const t = el('div', 'toast' + (kind ? ' ' + kind : ''),
      `<span class="ms">${icon || 'info'}</span><span>${msg}</span>` + (link ? `<a href="${link.href}">${link.label}</a>` : ''));
    toasts.appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 260); }, 3400);
  }
  window.nfToast = toast;

  /* ── 헤더 · 진행 바 · 활성 목차 ─────────── */
  const hdr = $('#hdr'), prog = $('#prog'), hero = $('#hero'), stage = $('#stage');
  const navLinks = $$('.nav a[href^="#"]');
  const secIds = navLinks.map(a => a.getAttribute('href').slice(1));
  function onScroll() {
    const y = scrollY;
    const heroEnd = hero.offsetTop + hero.offsetHeight - innerHeight;
    hdr.classList.toggle('solid', y > heroEnd + 12);
    const docH = document.documentElement.scrollHeight - innerHeight;
    prog.style.width = (docH > 0 ? y / docH * 100 : 0) + '%';
    $('#toTop').classList.toggle('on', y > heroEnd + innerHeight * .5);   // 히어로 화면 위에는 띄우지 않는다
    let act = null;
    for (const id of secIds) { const s = document.getElementById(id); if (s && s.getBoundingClientRect().top <= innerHeight * .4) act = id; }
    navLinks.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + act));
    seq();
  }
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);

  /* ── 히어로 스크롤 시퀀스 ─────────────── */
  const gal = new NFGlobe($('#galaxy'), {
    products: D.products, units: D.units, reduce,
    onPick: id => openModal(id),
    onDrag: on => stage.classList.toggle('drag', on),
    onHover: (s) => {
      const tip = $('#tip');
      stage.classList.toggle('grab', !!s);
      if (!s) { tip.classList.remove('on'); return; }
      $('small', tip).textContent = unitOf[s.id].ko;
      $('b', tip).textContent = s.name;
      $('em', tip).textContent = s.model;
      tip.style.left = s.sx + 'px'; tip.style.top = (s.sy - s.sr) + 'px';
      tip.classList.add('on');
    }
  });
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const seg = (p, a, b) => clamp((p - a) / (b - a), 0, 1);
  const easeOut = t => 1 - Math.pow(1 - t, 3);

  // 지구본이 자리잡을 칸(.h-globe)을 실측해 넘긴다 — 화면 폭이 바뀌면 다시 잰다
  function measureFrame() {
    const sr = stage.getBoundingClientRect(), r = $('#hGlobe').getBoundingClientRect();
    gal.setFrame({ x0: r.left - sr.left, x1: r.right - sr.left, y0: r.top - sr.top + 6, y1: r.bottom - sr.top - 2 });
  }
  addEventListener('resize', measureFrame);
  if (document.fonts) document.fonts.ready.then(measureFrame);

  // 지표 카운트업
  const kpis = $$('.b-kpi .k').map(k => ({ el: $('b', k), n: +k.dataset.n, u: k.dataset.u || '', last: -1 }));
  function setKpi(k, t) {
    const v = Math.round(k.n * easeOut(t));
    if (v === k.last) return; k.last = v;
    k.el.innerHTML = v.toLocaleString('ko-KR') + (k.u ? `<i>${k.u}</i>` : '');
  }

  /* 타임라인 (p = 히어로 스크롤 진행도)
     .04–.24 헤드라인 퇴장 · .26–.68 중간 안내 · 0–.80 회전 · .74–.90 지구본 자리잡기
     .80–.92 범례 · .84–.93 소개글 · .86–.97 지표 4개(차례로, 숫자 카운트업) */
  function seq() {
    const total = hero.offsetHeight - innerHeight;
    const raw = total <= 0 ? 1 : clamp((scrollY - hero.offsetTop) / total, 0, 1);
    const p = reduce ? (raw < .5 ? 0 : 1) : raw;         // 동작 줄이기: 두 장면만, 중간 움직임 없음
    gal.setProgress(p);
    const s = stage.style;
    s.setProperty('--hl-o', (1 - seg(p, .04, .24)).toFixed(3));
    s.setProperty('--cue-o', (1 - seg(p, .02, .10)).toFixed(3));
    s.setProperty('--hm-o', (seg(p, .26, .36) * (1 - seg(p, .56, .68))).toFixed(3));
    s.setProperty('--fd-o', seg(p, .76, .92).toFixed(3));
    const sd = seg(p, .80, .92);
    s.setProperty('--sd-o', sd.toFixed(3));
    s.setProperty('--sd-pe', sd > .6 ? 'auto' : 'none');
    s.setProperty('--bl-o', easeOut(seg(p, .84, .93)).toFixed(3));
    kpis.forEach((k, i) => {
      const t = seg(p, .86 + i * .025, .95 + i * .008);
      s.setProperty('--k' + i, easeOut(t).toFixed(3));
      setKpi(k, t);
    });
    $('.h-lock').style.pointerEvents = p < .2 ? 'auto' : 'none';
  }
  // 화면에 있을 때만 렌더 루프
  new IntersectionObserver(es => { es[0].isIntersecting ? gal.start() : gal.stop(); }, { threshold: 0 }).observe(stage);
  $('#explore').addEventListener('click', () => {
    scrollTo({ top: hero.offsetTop + hero.offsetHeight - innerHeight, behavior: reduce ? 'auto' : 'smooth' });
  });

  // 범례
  const legend = $('#legend');
  D.units.forEach(u => {
    const b = el('button', 'lg', `<i style="--c:${u.color}"></i><b>${u.short}</b><small>${u.ids.length}종</small>`);
    b.title = u.ko;
    b.dataset.unit = u.key;
    b.addEventListener('mouseenter', () => focusUnit(u.key));
    b.addEventListener('mouseleave', () => focusUnit(null));
    b.addEventListener('click', () => { setUnit(u.key); document.getElementById('products').scrollIntoView({ behavior: 'smooth' }); });
    legend.appendChild(b);
  });
  function focusUnit(k) {
    gal.setFocus(k);
    $$('.lg', legend).forEach(b => { b.classList.toggle('on', b.dataset.unit === k); b.classList.toggle('dim', !!k && b.dataset.unit !== k); });
  }

  /* ── 제품군 카드 ───────────────────────── */
  const units = $('#unitsGrid');
  D.units.forEach((u, k) => {
    const b = el('button', 'unit reveal',
      `<i class="dot"></i><span class="ms">${u.icon}</span><small>${u.en}</small><strong>${u.ko}</strong><p>${u.desc}</p>
       <span class="n">${u.ids.length}종 보기 <span class="ms">arrow_forward</span></span>`);
    b.style.setProperty('--c', u.color);
    b.style.transitionDelay = (k * 60) + 'ms';
    b.addEventListener('click', () => { setUnit(u.key); document.getElementById('products').scrollIntoView({ behavior: 'smooth' }); });
    units.appendChild(b);
  });

  /* ── 제품 목록 ─────────────────────────── */
  const grid = $('#grid'), cnt = $('#cnt'), none = $('#none'), q = $('#q'), tabs = $('#tabs');
  let unit = '*', qtext = '', pick = null, view = [], skTimer = null;
  tabs.appendChild(el('button', 'tab on', `전체 <b>${D.products.length}</b>`)).dataset.unit = '*';
  D.units.forEach(u => { const t = el('button', 'tab', `${u.short} <b>${u.ids.length}</b>`); t.dataset.unit = u.key; t.title = u.ko; tabs.appendChild(t); });
  // 탭이 한 줄에 다 들어가면 오른쪽 흐림 효과를 끈다
  const fitTabs = () => tabs.classList.toggle('fit', tabs.scrollWidth <= tabs.clientWidth + 1);
  addEventListener('resize', fitTabs);
  tabs.addEventListener('click', e => { const t = e.target.closest('.tab'); if (t) setUnit(t.dataset.unit); });
  q.addEventListener('input', () => { qtext = q.value.trim().toLowerCase(); pick = null; render(); });
  function setUnit(k) {
    unit = k; pick = null; qtext = ''; q.value = '';
    $$('.tab', tabs).forEach(t => t.classList.toggle('on', t.dataset.unit === k));
    render();
  }
  function match(p) {
    if (pick) return pick.includes(p.i);
    if (unit !== '*' && p.unit !== unit) return false;
    if (!qtext) return true;
    const hay = [p.name, p.en, p.model, p.unitko, ...p.use, ...p.feat].join(' ').toLowerCase();
    return hay.includes(qtext);
  }
  function skeleton(n) {
    grid.innerHTML = '';
    for (let i = 0; i < n; i++) grid.appendChild(el('div', 'card sk', `<div class="th"></div><div class="l w1"></div><div class="l w2"></div><div class="l w3"></div><div class="l w4"></div>`));
  }
  function render() {
    view = D.products.filter(match);
    clearTimeout(skTimer);
    skeleton(Math.min(view.length || 3, 8));
    none.hidden = true;
    cnt.innerHTML = pick
      ? `<span>${view.length}종</span><span class="chipx"><span class="ms">place</span>${esc(pick.label)} 구성 — <button id="clearPick" style="text-decoration:underline">해제</button></span>`
      : `<span>${view.length}종</span>`;
    skTimer = setTimeout(() => {
      grid.innerHTML = '';
      view.forEach((p, k) => {
        const u = unitOf[p.i];
        const c = el('button', 'card', `
          <span class="th"><img src="${p.img}" alt="${esc(p.name)}" loading="lazy" decoding="async"></span>
          <span class="ut"><i style="--c:${u.color}"></i>${u.ko}</span>
          <h3>${esc(p.name)}</h3><span class="mdl">${esc(p.model)}</span>
          <p>${esc(p.ov)}</p>`);
        c.addEventListener('click', () => openModal(p.i));
        grid.appendChild(c);
      });
      none.hidden = view.length > 0;
      const cp = $('#clearPick'); if (cp) cp.addEventListener('click', () => setUnit('*'));
    }, reduce ? 0 : 420);
  }

  /* ── 모달 ──────────────────────────────── */
  const ov = $('#ov'), md = $('#md');
  let cur = -1, lastFocus = null;
  function openModal(id) {
    const list = view.length ? view : D.products;
    const idx = list.findIndex(p => p.i === id);
    const arr = idx >= 0 ? list : D.products;
    cur = arr.findIndex(p => p.i === id);
    const p = arr[cur], u = unitOf[p.i];
    const inCmp = cmp.includes(p.i);
    md.innerHTML = `
      <div class="mimg">
        <div class="bar">
          <button class="ico-btn" data-go="-1" aria-label="이전 제품"><span class="ms">chevron_left</span></button>
          <button class="ico-btn" data-go="1" aria-label="다음 제품"><span class="ms">chevron_right</span></button>
          <span class="pos">${String(cur + 1).padStart(2, '0')} / ${String(arr.length).padStart(2, '0')}</span>
          <button class="ico-btn" data-close aria-label="닫기"><span class="ms">close</span></button>
        </div>
        <div class="sk-img" id="mSk"></div>
        <img src="${p.img}" alt="${esc(p.name)}" style="display:none" id="mImg">
        <div class="mspec">
          <div class="lbl" style="margin-top:0">규격</div>
          <table class="sp">${p.spec.map(s => `<tr><th>${esc(s[0])}</th><td>${esc(s[1])}</td></tr>`).join('')}</table>
          <p class="mnote"><b>인증 · 비고</b><br>${esc(p.note)}</p>
        </div>
      </div>
      <div class="mtxt">
        <div class="ut"><i style="--c:${u.color}"></i>${u.en} · ${u.ko}</div>
        <h3>${esc(p.name)}</h3><div class="men">${esc(p.en)}</div>
        <div class="model">${esc(p.model)}</div>
        <p class="ov-p">${esc(p.ov)}</p>
        <div class="lbl">용도 · 적용 현장</div><ul class="bl">${p.use.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
        <div class="lbl">주요 특징</div><ul class="bl">${p.feat.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
        <div class="mact">
          <button class="btn btn-brand" data-ask="${p.i}"><span class="ms" style="font-size:18px">mail</span>이 제품 문의</button>
          <button class="btn btn-line" data-cmp="${p.i}"><span class="ms" style="font-size:18px">${inCmp ? 'check' : 'compare_arrows'}</span>${inCmp ? '비교함에 있음' : '비교함 담기'}</button>
          <button class="btn btn-line" data-share="${p.i}"><span class="ms" style="font-size:18px">link</span>링크 복사</button>
        </div>
      </div>`;
    const im = $('#mImg'), sk = $('#mSk');
    const show = () => { sk.remove(); im.style.display = ''; };
    im.complete ? show() : (im.onload = show, im.onerror = show);
    if (!ov.classList.contains('on')) lastFocus = document.activeElement;
    ov.classList.add('on'); document.body.classList.add('lock');
    $('[data-close]', md).focus();
    history.replaceState(null, '', '#p' + p.i);
    md._arr = arr;
  }
  function closeModal() { ov.classList.remove('on'); document.body.classList.remove('lock'); cur = -1; history.replaceState(null, '', location.pathname); if (lastFocus) lastFocus.focus(); }
  ov.addEventListener('click', e => {
    if (e.target === ov || e.target.closest('[data-close]')) return closeModal();
    const g = e.target.closest('[data-go]'); if (g) { const arr = md._arr; openModal(arr[(cur + +g.dataset.go + arr.length) % arr.length].i); ov.scrollTop = 0; return; }
    const a = e.target.closest('[data-ask]'); if (a) { closeModal(); openAsk([+a.dataset.ask]); return; }
    const c = e.target.closest('[data-cmp]'); if (c) { toggleCmp(+c.dataset.cmp); openModal(+c.dataset.cmp); return; }
    const s = e.target.closest('[data-share]'); if (s) { copy(location.origin + location.pathname + '#p' + s.dataset.share, '제품 링크를 복사했습니다'); }
  });
  document.addEventListener('keydown', e => {
    if (cur < 0) return;
    if (e.key === 'Escape') closeModal();
    else if (e.key === 'ArrowRight') $('[data-go="1"]', md).click();
    else if (e.key === 'ArrowLeft') $('[data-go="-1"]', md).click();
  });
  function copy(text, msg) {
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => toast(msg, 'ok', 'check_circle'), () => toast('복사에 실패했습니다', 'warn', 'error'));
    else toast('이 환경에서는 복사할 수 없습니다', 'warn', 'error');
  }

  /* ── 비교함 (드로어) ───────────────────── */
  let cmp = [];
  const cmpBtn = $('#cmpBtn'), cmpDr = $('#drCmp');
  function toggleCmp(id) {
    if (cmp.includes(id)) { cmp = cmp.filter(x => x !== id); toast('비교함에서 뺐습니다', null, 'remove_circle'); }
    else if (cmp.length >= 4) { toast('비교는 최대 4개까지 가능합니다', 'warn', 'error'); return; }
    else { cmp.push(id); toast(`<b>${esc(byId[id].name)}</b> 비교함에 담았습니다`, 'ok', 'check_circle', { href: '#', label: '열기' }); const a = toasts.lastChild.querySelector('a'); a.addEventListener('click', e => { e.preventDefault(); openDrawer(cmpDr); }); }
    cmpBtn.classList.toggle('on', cmp.length > 0); $('b', cmpBtn).textContent = cmp.length;
    renderCmp();
  }
  function renderCmp() {
    const b = $('.dr-b', cmpDr);
    if (!cmp.length) { b.innerHTML = `<div class="empty"><span class="ms">compare_arrows</span>비교할 제품을 담아 주세요.<br>제품 상세에서 <b>비교함 담기</b>를 누르면 됩니다.</div>`; return; }
    const ps = cmp.map(i => byId[i]);
    const keys = []; ps.forEach(p => p.spec.forEach(s => { if (!keys.includes(s[0])) keys.push(s[0]); }));
    b.innerHTML = `<div style="overflow:auto"><table class="cmp-t"><thead><tr><th></th>${ps.map(p => `<th><img src="${p.img}" alt="">${esc(p.name)}<br><button data-rm="${p.i}"><span class="ms">close</span>빼기</button></th>`).join('')}</tr></thead>
      <tbody><tr><th>제품군</th>${ps.map(p => `<td>${unitOf[p.i].ko}</td>`).join('')}</tr>
      <tr><th>모델</th>${ps.map(p => `<td>${esc(p.model)}</td>`).join('')}</tr>
      ${keys.map(k => `<tr><th>${esc(k)}</th>${ps.map(p => { const s = p.spec.find(x => x[0] === k); return `<td>${s ? esc(s[1]) : '<span style="color:var(--mut2)">—</span>'}</td>`; }).join('')}</tr>`).join('')}
      </tbody></table></div>`;
  }
  cmpDr.addEventListener('click', e => { const r = e.target.closest('[data-rm]'); if (r) toggleCmp(+r.dataset.rm); });
  cmpBtn.addEventListener('click', () => openDrawer(cmpDr));
  $('#cmpAsk').addEventListener('click', () => { if (!cmp.length) return toast('담긴 제품이 없습니다', 'warn', 'error'); closeDrawer(); openAsk(cmp.slice()); });
  $('#cmpClear').addEventListener('click', () => { cmp = []; cmpBtn.classList.remove('on'); renderCmp(); toast('비교함을 비웠습니다', null, 'delete'); });
  renderCmp();

  /* ── 드로어 공통 ───────────────────────── */
  const drOv = $('#drOv'); let openDr = null;
  function openDrawer(d) { if (openDr && openDr !== d) openDr.classList.remove('on'); openDr = d; d.classList.add('on'); drOv.classList.add('on'); document.body.classList.add('lock'); setTimeout(() => { const f = $('input,textarea,button.ico-btn', d); if (f) f.focus(); }, 380); }
  function closeDrawer() { if (!openDr) return; openDr.classList.remove('on'); drOv.classList.remove('on'); document.body.classList.remove('lock'); openDr = null; }
  drOv.addEventListener('click', closeDrawer);
  $$('[data-dr-close]').forEach(b => b.addEventListener('click', closeDrawer));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && openDr) closeDrawer(); });

  // 메뉴 드로어 (모바일)
  const drNav = $('#drNav');
  $('#burger').addEventListener('click', () => openDrawer(drNav));
  $$('a', drNav).forEach(a => a.addEventListener('click', closeDrawer));

  /* ── 문의 드로어 ───────────────────────── */
  const drAsk = $('#drAsk'), picks = $('#picks');
  let askIds = [];
  function openAsk(ids, site) {
    askIds = [...new Set([...(askIds), ...(ids || [])])];
    if (site) $('#fSite').value = site;
    renderPicks(); openDrawer(drAsk);
  }
  function renderPicks() {
    picks.innerHTML = askIds.length ? askIds.map(i => `<span class="pick">${esc(byId[i].name)}<button data-un="${i}" aria-label="제외"><span class="ms">close</span></button></span>`).join('')
      : '<span style="font-size:12.5px;color:var(--mut2)">선택한 제품이 없습니다. 현장 유형만 알려주셔도 됩니다.</span>';
  }
  picks.addEventListener('click', e => { const b = e.target.closest('[data-un]'); if (b) { askIds = askIds.filter(x => x !== +b.dataset.un); renderPicks(); } });
  $$('[data-ask-open]').forEach(b => b.addEventListener('click', () => openAsk([])));
  const form = $('#askForm');
  function buildMail() {
    const v = id => $('#' + id).value.trim();
    const body = [`회사/기관: ${v('fCo')}`, `담당자: ${v('fName')}`, `연락처: ${v('fTel')}`, `현장 유형: ${v('fSite') || '-'}`,
      `관심 제품: ${askIds.map(i => byId[i].name).join(', ') || '-'}`, '', '문의 내용:', v('fMsg')].join('\n');
    return { subject: `[제품 문의] ${v('fCo')} — ${askIds.length ? askIds.length + '종' : '현장 검토 요청'}`, body };
  }
  function validate() {
    let ok = true;
    [['fCo', '회사명 또는 기관명을 입력해 주세요'], ['fName', '담당자 성함을 입력해 주세요'], ['fTel', '연락 가능한 번호나 이메일을 입력해 주세요'], ['fMsg', '문의 내용을 한 줄이라도 적어 주세요']].forEach(([id, m]) => {
      const f = $('#' + id).closest('.fld'); const bad = !$('#' + id).value.trim();
      f.classList.toggle('bad', bad); $('.err', f).textContent = m; if (bad) ok = false;
    });
    return ok;
  }
  form.addEventListener('submit', e => {
    e.preventDefault();
    if (!validate()) return toast('입력하지 않은 항목이 있습니다', 'warn', 'error');
    const m = buildMail();
    location.href = `mailto:${D.company.email}?subject=${encodeURIComponent(m.subject)}&body=${encodeURIComponent(m.body)}`;
    toast('메일 앱으로 문의 내용을 넘겼습니다', 'ok', 'send');
  });
  $('#askCopy').addEventListener('click', () => { if (!validate()) return toast('입력하지 않은 항목이 있습니다', 'warn', 'error'); const m = buildMail(); copy(`${m.subject}\n\n${m.body}\n\n받는 곳: ${D.company.email} / ${D.company.tel}`, '문의 내용을 복사했습니다'); });

  /* ── 아코디언 ──────────────────────────── */
  function accordion(root, single) {
    root.addEventListener('click', e => {
      const h = e.target.closest('.acc-h'); if (!h) return;
      const it = h.parentElement, open = it.classList.contains('open');
      if (single) $$('.acc-i', root).forEach(x => { x.classList.remove('open'); $('.acc-h', x).setAttribute('aria-expanded', 'false'); });
      it.classList.toggle('open', !open); h.setAttribute('aria-expanded', String(!open));
    });
  }
  const tech = $('#tech-acc');
  D.tech.forEach((t, k) => {
    tech.appendChild(el('div', 'acc-i' + (k === 0 ? ' open' : ''), `
      <button class="acc-h" aria-expanded="${k === 0}"><span class="num">TECH ${k + 1}</span>
        <span class="t">${esc(t.ko)}<small>${esc(t.en)}</small></span><span class="ms">expand_more</span></button>
      <div class="acc-b"><div><div class="acc-c"><p>${esc(t.body)}</p>
        <div class="ap"><small>적용 제품</small><b>${esc(t.applies)}</b></div></div></div></div>`));
  });
  accordion(tech, false);
  const faq = $('#faq-acc');
  D.faq.forEach(([qq, a]) => faq.appendChild(el('div', 'acc-i', `
    <button class="acc-h" aria-expanded="false"><span class="t">${esc(qq)}</span><span class="ms">expand_more</span></button>
    <div class="acc-b"><div><div class="acc-c"><p>${esc(a)}</p></div></div></div>`)));
  accordion(faq, true);

  /* ── 인증 표 ───────────────────────────── */
  $('#patents').innerHTML = D.patents.map(([a, b]) => `<tr><th>${esc(a)}</th><td>${esc(b)}</td></tr>`).join('');
  $('#astm').innerHTML = D.astm.map(([a, m, r]) => `<tr><th>${esc(a)}<span>${esc(m)}</span></th><td>${esc(r)}</td></tr>`).join('');
  $('#certs').innerHTML = D.certs.map(([a, s, ok]) => `<tr><th>${esc(a)}</th><td><span class="pill ${ok ? 'ok' : 'wip'}">${esc(s)}</span></td></tr>`).join('');

  /* ── 현장별 ─────────────────────────────── */
  const segEl = $('#seg'), pane = $('#sitePane');
  D.sites.forEach((s, k) => { const b = el('button', k === 0 ? 'on' : '', esc(s.name)); b.dataset.k = k; segEl.appendChild(b); });
  segEl.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; $$('button', segEl).forEach(x => x.classList.toggle('on', x === b)); showSite(+b.dataset.k); });
  function showSite(k) {
    const s = D.sites[k];
    pane.innerHTML = `
      <div><div class="eye">SITE ${String(k + 1).padStart(2, '0')}</div><h3 style="margin-top:10px">${esc(s.name)}</h3>
        <p class="d">이 현장 유형에 함께 제안하는 ${s.ids.length}종 구성입니다. 실제 구성은 현장 실사 후 조정합니다.</p>
        <div class="cta"><button class="btn btn-brand" id="siteAsk"><span class="ms" style="font-size:18px">mail</span>이 구성으로 문의</button>
        <button class="btn btn-line" id="siteList">목록에서 보기</button></div></div>
      <div class="site-list">${s.ids.map(i => { const p = byId[i]; return `<button class="sitem" data-id="${i}"><img src="${p.img}" alt=""><span><b>${esc(p.name)}</b><small>${esc(p.model)}</small></span><span class="ms">chevron_right</span></button>`; }).join('')}</div>`;
    $('#siteAsk').addEventListener('click', () => openAsk(s.ids.slice(), s.name));
    $('#siteList').addEventListener('click', () => { pick = s.ids.slice(); pick.label = s.name; unit = '*'; qtext = ''; q.value = ''; $$('.tab', tabs).forEach(t => t.classList.remove('on')); render(); document.getElementById('products').scrollIntoView({ behavior: 'smooth' }); });
    $$('.sitem', pane).forEach(b => b.addEventListener('click', () => openModal(+b.dataset.id)));
  }
  showSite(0);
  $('#fSite').innerHTML = '<option value="">선택 안 함</option>' + D.sites.map(s => `<option>${esc(s.name)}</option>`).join('');

  /* ── 절차 ───────────────────────────────── */
  $('#steps').innerHTML = D.steps.map((s, k) => `<div class="step reveal" style="transition-delay:${k * 70}ms"><div class="n">STEP ${k + 1}</div><h3>${esc(s.title)}</h3><div class="tag">${esc(s.tag)}</div><p>${esc(s.body)}</p></div>`).join('');

  /* ── 등장 애니메이션 ─────────────────────── */
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
  $$('.reveal').forEach(x => io.observe(x));

  /* ── 맨 위로 · 초기화 ───────────────────── */
  $('#toTop').addEventListener('click', () => scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }));
  render();
  measureFrame();
  fitTabs();
  onScroll();
  if (document.fonts) document.fonts.ready.then(fitTabs);
  // 딥링크 (#p12)
  const m = location.hash.match(/^#p(\d+)$/);
  if (m && byId[+m[1]]) setTimeout(() => openModal(+m[1]), 600);
})();
