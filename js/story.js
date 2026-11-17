/* Story tổng kết: các thẻ dọc 9:16 vẽ bằng canvas, có chuyển động, lưu thành ảnh để chia sẻ. */
const Story = (() => {
  const W = 1080, H = 1920;
  const F = '"Be Vietnam Pro", system-ui, -apple-system, "Segoe UI", sans-serif';
  const SC = '"Dancing Script", "Brush Script MT", cursive';
  const C = { pink: '#EC7FA2', deep: '#C24E78', soft: '#FBDCE6', blush: '#FDF0F4', beige: '#F5EADD', sand: '#E7D5C2', ink: '#3E2A30', muted: '#8E747B' };
  const S_LENGTH = 1650; // chiều dài chữ S theo đường chim bay Bắc – Nam, km
  const DUR = 6500;
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = x => Math.min(1, Math.max(0, x));
  const ease = x => 1 - Math.pow(1 - clamp(x), 3);
  const nf = (n, d = 0) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: d, minimumFractionDigits: d }).format(n);

  /* ---------- nét vẽ cơ bản ---------- */
  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function heart(ctx, x, y, s) {
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.3);
    ctx.bezierCurveTo(x, y, x - s * 0.5, y - s * 0.05, x - s * 0.5, y + s * 0.3);
    ctx.bezierCurveTo(x - s * 0.5, y + s * 0.6, x - s * 0.1, y + s * 0.78, x, y + s);
    ctx.bezierCurveTo(x + s * 0.1, y + s * 0.78, x + s * 0.5, y + s * 0.6, x + s * 0.5, y + s * 0.3);
    ctx.bezierCurveTo(x + s * 0.5, y - s * 0.05, x, y, x, y + s * 0.3);
    ctx.closePath();
  }
  function bg(ctx, theme, now) {
    const T = theme === 'deep'
      ? ['#B7406C', '#E46E96', '#F7B7C9']
      : theme === 'beige' ? ['#FBEFE4', '#F8DCE4', '#F2DCC4'] : ['#FCE4EC', '#F9C9D8', '#F5E3D2'];
    const g = ctx.createLinearGradient(0, 0, W * 0.4, H);
    g.addColorStop(0, T[0]); g.addColorStop(0.55, T[1]); g.addColorStop(1, T[2]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const k = calm ? 0 : now / 1000;
    const blob = (x, y, r, col) => {
      const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, col); rg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = rg;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    };
    blob(220 + Math.sin(k * 0.4) * 60, 300 + Math.cos(k * 0.3) * 50, 520, 'rgba(255,255,255,.55)');
    blob(900 + Math.cos(k * 0.35) * 70, 1150 + Math.sin(k * 0.25) * 80, 600, theme === 'deep' ? 'rgba(255,190,210,.45)' : 'rgba(255,255,255,.5)');
    blob(300 + Math.sin(k * 0.2) * 50, 1700, 480, 'rgba(245,234,221,.55)');
    // tim bay lên
    for (let i = 0; i < 14; i++) {
      const sp = 0.03 + (i % 5) * 0.012;
      const p = calm ? (i / 14) : ((k * sp + i * 0.137) % 1);
      const x = ((i * 397) % W) + Math.sin(k * 0.8 + i) * 26;
      const y = H + 60 - p * (H + 160);
      const s = 26 + (i % 4) * 14;
      ctx.globalAlpha = 0.16 + 0.22 * Math.sin(p * Math.PI);
      ctx.fillStyle = theme === 'deep' ? '#fff' : C.pink;
      heart(ctx, x, y, s);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  function glass(ctx, x, y, w, h, r = 48, a = 0.55) {
    ctx.save();
    ctx.shadowColor = 'rgba(166,72,104,.25)'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 18;
    rr(ctx, x, y, w, h, r);
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.fill();
    ctx.restore();
    rr(ctx, x, y, w, h, r);
    ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 3;
    ctx.stroke();
  }
  function txt(ctx, s, x, y, o = {}) {
    ctx.font = `${o.w || 600} ${o.size || 40}px ${o.font || F}`;
    ctx.fillStyle = o.color || C.ink;
    ctx.textAlign = o.align || 'left';
    ctx.textBaseline = o.base || 'alphabetic';
    if (o.ls && 'letterSpacing' in ctx) ctx.letterSpacing = o.ls + 'px';
    let str = String(s);
    if (o.maxW) while (str.length > 1 && ctx.measureText(str).width > o.maxW) str = str.slice(0, -2) + '…';
    ctx.fillText(str, x, y);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    return ctx.measureText(str).width;
  }
  function wrap(ctx, s, x, y, maxW, lh, o = {}, maxLines = 3) {
    ctx.font = `${o.w || 600} ${o.size || 40}px ${o.font || F}`;
    const words = String(s).split(/\s+/);
    const lines = [];
    let cur = '';
    for (const w of words) {
      const t = cur ? cur + ' ' + w : w;
      if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
    }
    if (cur) lines.push(cur);
    const out = lines.slice(0, maxLines);
    if (lines.length > maxLines) out[maxLines - 1] += '…';
    out.forEach((l, i) => txt(ctx, l, x, y + i * lh, o));
    return out.length;
  }
  function photo(ctx, img, x, y, w, h, r) {
    ctx.save();
    rr(ctx, x, y, w, h, r);
    ctx.clip();
    if (img && img.naturalWidth) {
      const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
      const iw = img.naturalWidth * s, ih = img.naturalHeight * s;
      ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
    } else {
      ctx.fillStyle = C.soft; ctx.fillRect(x, y, w, h);
    }
    ctx.restore();
    rr(ctx, x, y, w, h, r);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 6; ctx.stroke();
  }
  function hearts(ctx, n, x, y, s, color = C.pink) {
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i < n ? color : 'rgba(231,213,194,.9)';
      heart(ctx, x + i * (s * 1.15) + s / 2, y, s);
      ctx.fill();
    }
  }
  /** Chiếu toạ độ [lat,lng] vào một khung, giữ tỉ lệ. */
  function projector(pts, x, y, w, h, pad = 30) {
    const lat0 = pts.reduce((a, p) => a + p[0], 0) / pts.length;
    const k = Math.cos(lat0 * Math.PI / 180);
    const xs = pts.map(p => p[1] * k), ys = pts.map(p => -p[0]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const s = Math.min((w - pad * 2) / Math.max(1e-6, maxX - minX), (h - pad * 2) / Math.max(1e-6, maxY - minY));
    const ox = x + (w - (maxX - minX) * s) / 2, oy = y + (h - (maxY - minY) * s) / 2;
    return p => [ox + (p[1] * k - minX) * s, oy + (-p[0] - minY) * s];
  }
  function drawRoute(ctx, lines, P, color, prog, width = 12) {
    const all = lines.map(l => l.map(P));
    const len = l => l.reduce((a, p, i) => (i ? a + Math.hypot(p[0] - l[i - 1][0], p[1] - l[i - 1][1]) : 0), 0);
    const total = all.reduce((a, l) => a + len(l), 0);
    let left = total * clamp(prog);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const l of all) {
      if (left <= 0 || l.length < 2) break;
      const pts = [l[0]];
      for (let i = 1; i < l.length && left > 0; i++) {
        const d = Math.hypot(l[i][0] - l[i - 1][0], l[i][1] - l[i - 1][1]);
        if (d <= left) { pts.push(l[i]); left -= d; } else { const f = left / d; pts.push([l[i - 1][0] + (l[i][0] - l[i - 1][0]) * f, l[i - 1][1] + (l[i][1] - l[i - 1][1]) * f]); left = 0; }
      }
      for (const [col, wd] of [['#fff', width + 10], [color, width]]) {
        ctx.beginPath();
        pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
        ctx.strokeStyle = col; ctx.lineWidth = wd; ctx.stroke();
      }
      if (left <= 0 && prog < 1) {
        const h = pts[pts.length - 1];
        ctx.beginPath(); ctx.arc(h[0], h[1], width * 1.4, 0, Math.PI * 2);
        ctx.fillStyle = '#fff'; ctx.fill();
        ctx.beginPath(); ctx.arc(h[0], h[1], width * 0.9, 0, Math.PI * 2);
        ctx.fillStyle = color; ctx.fill();
      }
    }
  }
  function brand(ctx, light) {
    txt(ctx, 'Our Journey', W / 2, H - 92, { font: SC, w: 700, size: 64, color: light ? '#fff' : C.deep, align: 'center' });
  }
  function stat(ctx, x, y, w, value, label, light) {
    txt(ctx, value, x + w / 2, y, { w: 800, size: 76, color: light ? '#fff' : C.ink, align: 'center' });
    txt(ctx, label, x + w / 2, y + 54, { w: 500, size: 32, color: light ? 'rgba(255,255,255,.85)' : C.muted, align: 'center' });
  }

  /* ---------- các thẻ ---------- */
  const CARDS = {
    intro(ctx, d, t, now) {
      bg(ctx, 'pink', now);
      const a = ease(t / 0.6);
      ctx.globalAlpha = a;
      ctx.font = `700 190px ${SC}`;
      const ts = Math.min(190, 190 * 900 / Math.max(1, ctx.measureText('Our Journey').width));
      txt(ctx, 'Our Journey', W / 2, 560 - 40 * (1 - a), { font: SC, w: 700, size: ts, color: C.deep, align: 'center' });
      txt(ctx, d.who, W / 2, 680, { w: 600, size: 46, color: C.ink, align: 'center', maxW: 900 });
      txt(ctx, d.period, W / 2, 750, { w: 500, size: 36, color: C.muted, align: 'center' });
      ctx.globalAlpha = 1;
      const items = d.stats;
      items.forEach((s, i) => {
        const k = ease((t - 0.25 - i * 0.12) / 0.5);
        if (k <= 0) return;
        const col = i % 2, row = Math.floor(i / 2);
        const x = 110 + col * 440, y = 900 + row * 330 + 40 * (1 - k);
        ctx.globalAlpha = k;
        glass(ctx, x, y, 420, 290, 52);
        txt(ctx, nf(Math.round(s.v * ease(t / 1.1))), x + 210, y + 160, { w: 800, size: 112, color: C.deep, align: 'center' });
        txt(ctx, s.l, x + 210, y + 225, { w: 500, size: 36, color: C.muted, align: 'center' });
        ctx.globalAlpha = 1;
      });
      brand(ctx);
    },

    km(ctx, d, t, now) {
      bg(ctx, 'deep', now);
      txt(ctx, d.title, 100, 380, { w: 600, size: 52, color: 'rgba(255,255,255,.9)' });
      const v = d.km * ease(t / 1.2);
      const big = nf(v, v < 100 ? 1 : 0);
      const wv = txt(ctx, big, 90, 620, { w: 800, size: 230, color: '#fff', ls: -6 });
      txt(ctx, 'km', 110 + wv, 620, { w: 700, size: 80, color: 'rgba(255,255,255,.85)' });
      const ratio = d.km / S_LENGTH;
      glass(ctx, 90, 740, 900, 330, 56, 0.22);
      txt(ctx, ratio >= 1 ? `≈ ${nf(ratio, 1)} lần chiều dài chữ S` : `≈ ${nf(Math.max(1, Math.round(ratio * 100)))}% chiều dài chữ S`, 140, 840, { w: 700, size: 48, color: '#fff' });
      txt(ctx, 'Mũi Cà Mau → cột cờ Lũng Cú ≈ 1.650 km', 140, 905, { w: 500, size: 32, color: 'rgba(255,255,255,.8)' });
      rr(ctx, 140, 960, 800, 34, 17); ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fill();
      const fill = Math.min(1, ratio % 1 === 0 && ratio > 0 ? 1 : (ratio > 1 ? 1 : ratio)) * ease((t - 0.3) / 1);
      if (fill > 0) { rr(ctx, 140, 960, Math.max(34, 800 * fill), 34, 17); ctx.fillStyle = '#fff'; ctx.fill(); }
      const items = d.stats;
      items.forEach((s, i) => {
        const k = ease((t - 0.5 - i * 0.1) / 0.5);
        ctx.globalAlpha = k;
        stat(ctx, 90 + i * 300, 1260 + 30 * (1 - k), 300, nf(s.v), s.l, true);
      });
      ctx.globalAlpha = 1;
      if (d.note) wrap(ctx, d.note, W / 2, 1560, 860, 56, { w: 600, size: 46, font: SC, color: '#fff', align: 'center' }, 2);
      brand(ctx, true);
    },

    vn(ctx, d, t, now) {
      bg(ctx, 'beige', now);
      txt(ctx, `Chữ S của ${d.whose}`, 90, 300, { w: 800, size: 76, color: C.ink, maxW: 900 });
      const box = { x: 30, y: 380, w: 590, h: 1340 };
      const all = d.shape.flat();
      const P = projector(all.concat([[16.5, 112.4], [9, 114.3]]), box.x, box.y, box.w, box.h, 20);
      ctx.save();
      ctx.shadowColor = 'rgba(194,78,120,.25)'; ctx.shadowBlur = 40;
      ctx.beginPath();
      d.shape.forEach(poly => poly.forEach((p, i) => { const [x, y] = P(p); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }));
      ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fill();
      ctx.restore();
      ctx.beginPath();
      d.shape.forEach(poly => { poly.forEach((p, i) => { const [x, y] = P(p); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath(); });
      ctx.strokeStyle = C.pink; ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.stroke();
      for (const [la, ln, nm] of [[16.5, 112, 'Hoàng Sa'], [9.6, 114, 'Trường Sa']]) {
        const [x, y] = P([la, ln]);
        for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(x + (i % 2) * 18 - 9, y + Math.floor(i / 2) * 18 - 9, 4, 0, Math.PI * 2); ctx.fillStyle = C.pink; ctx.fill(); }
        txt(ctx, nm, x, y + 46, { w: 600, size: 22, color: C.muted, align: 'center' });
      }
      d.dots.forEach((p, i) => {
        const k = ease((t * 1.6 - i * 0.12) / 0.4);
        if (k <= 0) return;
        const [x, y] = P([p.lat, p.lng]);
        const pulse = calm ? 0 : Math.sin(now / 400 + i) * 4;
        ctx.beginPath(); ctx.arc(x, y, (30 + pulse) * k, 0, Math.PI * 2); ctx.fillStyle = 'rgba(236,127,162,.3)'; ctx.fill();
        ctx.beginPath(); ctx.arc(x, y, 15 * k, 0, Math.PI * 2); ctx.fillStyle = C.deep; ctx.fill();
        ctx.lineWidth = 5; ctx.strokeStyle = '#fff'; ctx.stroke();
      });
      const shown = Math.min(d.visited, Math.round(d.visited * ease(t / 1.2)));
      const xr = 650;
      txt(ctx, String(shown), xr, 600, { w: 800, size: 220, color: C.deep, ls: -6 });
      txt(ctx, `/${d.total}`, xr + 8, 690, { w: 700, size: 64, color: C.muted });
      txt(ctx, 'tỉnh thành', xr + 8, 760, { w: 600, size: 40, color: C.ink });
      d.names.slice(0, 9).forEach((n, i) => {
        const k = ease((t - 0.4 - i * 0.07) / 0.4);
        if (k <= 0) return;
        ctx.globalAlpha = k;
        rr(ctx, xr, 830 + i * 92, 370, 72, 36);
        ctx.fillStyle = i === 0 ? C.deep : 'rgba(255,255,255,.75)'; ctx.fill();
        txt(ctx, `${i + 1}. ${n}`, xr + 28, 830 + i * 92 + 48, { w: 600, size: 32, color: i === 0 ? '#fff' : C.ink, maxW: 330 });
        ctx.globalAlpha = 1;
      });
      if (d.names.length > 9) txt(ctx, `+${d.names.length - 9} nơi nữa`, xr + 28, 830 + 9 * 92 + 40, { w: 600, size: 30, color: C.muted });
      brand(ctx);
    },

    trip(ctx, d, t, now) {
      bg(ctx, 'pink', now);
      txt(ctx, d.kicker, 90, 230, { w: 700, size: 36, color: C.deep, ls: 4 });
      const n = wrap(ctx, d.name, 90, 330, 900, 100, { w: 800, size: 88, color: C.ink }, 2);
      const y0 = 330 + (n - 1) * 100;
      txt(ctx, d.dates, 90, y0 + 72, { w: 500, size: 36, color: C.muted, maxW: 900 });
      glass(ctx, 70, y0 + 120, 940, 760, 60);
      if (d.lines.length && d.lines.flat().length > 1) {
        const P = projector(d.lines.flat(), 70, y0 + 120, 940, 760, 80);
        drawRoute(ctx, d.lines, P, d.color, ease(t / 1.4), 14);
        d.stops.forEach((p, i) => {
          const k = ease((t * 1.4 - i * 0.08) / 0.3);
          if (k <= 0) return;
          const [x, y] = P(p);
          ctx.beginPath(); ctx.arc(x, y, 13 * k, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
          ctx.lineWidth = 6; ctx.strokeStyle = d.color; ctx.stroke();
        });
        if (d.from) { const [x, y] = P(d.stops[0]); txt(ctx, d.from, x, y - 34, { w: 700, size: 30, color: C.ink, align: 'center', maxW: 360 }); }
        if (d.to && d.stops.length > 1) { const [x, y] = P(d.stops[d.stops.length - 1]); txt(ctx, d.to, x, y + 60, { w: 700, size: 30, color: C.ink, align: 'center', maxW: 360 }); }
      }
      const yS = y0 + 1000;
      d.stats.forEach((s, i) => {
        const k = ease((t - 0.4 - i * 0.08) / 0.5);
        ctx.globalAlpha = k;
        stat(ctx, 70 + i * 235, yS, 235, s.v, s.l);
      });
      ctx.globalAlpha = 1;
      let y = yS + 130;
      if (d.photos.length) {
        const n2 = Math.min(3, d.photos.length), pw = (940 - (n2 - 1) * 24) / n2;
        d.photos.slice(0, 3).forEach((img, i) => {
          const k = ease((t - 0.7 - i * 0.1) / 0.5);
          if (k <= 0) return;
          ctx.globalAlpha = k;
          ctx.save(); ctx.translate(70 + i * (pw + 24) + pw / 2, y + 130); ctx.rotate((i - 1) * 0.04 * k); ctx.translate(-(70 + i * (pw + 24) + pw / 2), -(y + 130));
          photo(ctx, img, 70 + i * (pw + 24), y, pw, Math.min(260, H - 200 - y), 36);
          ctx.restore();
          ctx.globalAlpha = 1;
        });
      } else if (d.legs.length) {
        d.legs.slice(0, 4).forEach((l, i) => {
          const k = ease((t - 0.7 - i * 0.1) / 0.5);
          ctx.globalAlpha = k;
          txt(ctx, l, 90, y + 40 + i * 62, { w: 500, size: 34, color: C.ink, maxW: 900 });
        });
        ctx.globalAlpha = 1;
      }
      brand(ctx);
    },

    top(ctx, d, t, now) {
      bg(ctx, 'beige', now);
      txt(ctx, 'Những nơi', 90, 260, { w: 600, size: 52, color: C.muted });
      txt(ctx, 'được thả tim nhiều nhất', 90, 340, { w: 800, size: 66, color: C.ink, maxW: 920 });
      d.items.slice(0, 3).forEach((p, i) => {
        const k = ease((t - i * 0.18) / 0.55);
        if (k <= 0) return;
        const y = 440 + i * 440 + 50 * (1 - k);
        ctx.globalAlpha = k;
        glass(ctx, 70, y, 940, 400, 56);
        photo(ctx, p.img, 100, y + 30, 340, 340, 44);
        rr(ctx, 70 + 20, y + 20, 84, 84, 42); ctx.fillStyle = C.deep; ctx.fill();
        txt(ctx, String(i + 1), 132, y + 78, { w: 800, size: 46, color: '#fff', align: 'center' });
        wrap(ctx, p.name, 480, y + 110, 500, 60, { w: 800, size: 50, color: C.ink }, 2);
        hearts(ctx, p.rating, 480, y + 190, 44);
        txt(ctx, p.sub, 480, y + 310, { w: 500, size: 32, color: C.muted, maxW: 500 });
        ctx.globalAlpha = 1;
      });
      brand(ctx);
    },

    outro(ctx, d, t, now) {
      bg(ctx, 'deep', now);
      const a = ease(t / 0.7);
      ctx.globalAlpha = a;
      txt(ctx, d.left > 0 ? 'Còn' : 'Đã đủ', W / 2, 640, { w: 600, size: 60, color: 'rgba(255,255,255,.9)', align: 'center' });
      txt(ctx, d.left > 0 ? String(d.left) : '34/34', W / 2, 900, { w: 800, size: 300, color: '#fff', align: 'center', ls: -8 });
      txt(ctx, d.left > 0 ? `tỉnh thành đang chờ ${d.two ? 'hai đứa' : 'bạn'}` : 'tỉnh thành. Đi tiếp thế giới thôi!', W / 2, 990, { w: 700, size: 52, color: '#fff', align: 'center' });
      ctx.globalAlpha = ease((t - 0.4) / 0.6);
      if (d.next) wrap(ctx, d.next, W / 2, 1180, 860, 64, { w: 700, size: 56, font: SC, color: '#fff', align: 'center' }, 2);
      ctx.globalAlpha = 1;
      if (!calm) {
        const k = now / 1000;
        for (let i = 0; i < 3; i++) {
          const s = 70 + i * 26 + Math.sin(k * 2 + i) * 8;
          ctx.globalAlpha = 0.9 - i * 0.25;
          ctx.fillStyle = '#fff';
          heart(ctx, W / 2 + (i - 1) * 150, 1420 - i * 10, s);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      brand(ctx, true);
    }
  };

  /* ---------- trình xem ---------- */
  let st = null;
  const $ = s => document.querySelector(s);
  function fit() {
    const cv = $('#storyCanvas'), box = $('#storyStage');
    const bw = box.clientWidth, bh = box.clientHeight;
    const s = Math.min(bw / W, bh / H);
    cv.style.width = Math.floor(W * s) + 'px';
    cv.style.height = Math.floor(H * s) + 'px';
  }
  function bars() {
    $('#storyBars').innerHTML = st.cards.map((_, i) => `<i><b style="width:${i < st.i ? 100 : 0}%"></b></i>`).join('');
  }
  function go(i) {
    if (i < 0) i = 0;
    if (i >= st.cards.length) { if (st.cards.length > 1) return close(); i = st.cards.length - 1; }
    st.i = i;
    st.start = performance.now();
    st.blob = null;
    st.pausedFor = 0;
    bars();
    prerender();
  }
  function frame(now) {
    if (!st) return;
    const card = st.cards[st.i];
    const el = now - st.start - (st.pausedFor || 0);
    const t = calm ? 1 : el / 1000;
    const ctx = st.ctx;
    ctx.clearRect(0, 0, W, H);
    CARDS[card.kind](ctx, card.data, t, calm ? 0 : now);
    const bar = $('#storyBars').children[st.i];
    if (bar && st.cards.length > 1) bar.firstChild.style.width = Math.min(100, (el / DUR) * 100) + '%';
    if (st.cards.length > 1 && !st.paused && el > DUR) go(st.i + 1);
    st.raf = requestAnimationFrame(frame);
  }
  /** Vẽ sẵn ảnh của thẻ hiện tại (đã hiện đầy đủ) để bấm Chia sẻ là gửi được ngay. */
  function prerender() {
    const i = st.i, my = st;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const card = st.cards[i];
    CARDS[card.kind](cv.getContext('2d'), card.data, 9, 0);
    cv.toBlob(b => { if (my === st && st.i === i) st.blob = b; }, 'image/png');
  }
  async function share() {
    if (!st) return;
    let blob = st.blob;
    if (!blob) {
      const cv = document.createElement('canvas');
      cv.width = W; cv.height = H;
      const card = st.cards[st.i];
      CARDS[card.kind](cv.getContext('2d'), card.data, 9, 0);
      blob = await new Promise(r => cv.toBlob(r, 'image/png'));
    }
    const file = new File([blob], `our-journey-${st.i + 1}.png`, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: st.title }); return; }
      catch (e) { if (e && e.name === 'AbortError') return; }
    }
    // Không chia sẻ trực tiếp được: hiện ảnh để nhấn giữ và lưu
    const url = URL.createObjectURL(blob);
    const ov = $('#storySave');
    ov.querySelector('img').src = url;
    ov.hidden = false;
    st.paused = true;
  }
  async function open(cards, title = 'Our Journey') {
    if (!cards.length) return;
    close();
    try {
      await Promise.race([
        Promise.all([document.fonts.load(`800 100px ${F}`), document.fonts.load(`600 40px ${F}`), document.fonts.load(`700 80px ${SC}`)]),
        new Promise(r => setTimeout(r, 1500))
      ]);
    } catch { /* dùng font dự phòng */ }
    const el = $('#story');
    el.hidden = false;
    $('#storyNav').hidden = cards.length < 2;
    const cv = $('#storyCanvas');
    cv.width = W; cv.height = H;
    st = { cards, title, i: 0, ctx: cv.getContext('2d'), start: performance.now(), raf: 0, paused: false, blob: null };
    fit();
    requestAnimationFrame(() => st && fit());
    go(0);
    st.raf = requestAnimationFrame(frame);
  }
  function close() {
    if (!st) return;
    cancelAnimationFrame(st.raf);
    st = null;
    $('#story').hidden = true;
    $('#storySave').hidden = true;
  }
  function bind() {
    $('#storyClose').onclick = close;
    $('#storyShare').onclick = share;
    let downAt = 0, pauseAt = 0;
    const tap = () => performance.now() - downAt < 350; // giữ lâu là tạm dừng, không chuyển thẻ
    $('#storyPrev').onclick = () => st && tap() && go(st.i - 1);
    $('#storyNext').onclick = () => st && tap() && go(st.i + 1);
    $('#storySaveClose').onclick = () => { $('#storySave').hidden = true; if (st) st.paused = false; };
    const stage = $('#storyStage');
    stage.addEventListener('pointerdown', () => { if (!st) return; downAt = performance.now(); pauseAt = downAt; st.paused = true; });
    const up = () => { if (!st || !st.paused || !$('#storySave').hidden) return; st.paused = false; st.pausedFor = (st.pausedFor || 0) + (performance.now() - pauseAt); };
    stage.addEventListener('pointerup', up);
    stage.addEventListener('pointercancel', up);
    window.addEventListener('resize', () => st && fit());
    document.addEventListener('keydown', e => {
      if (!st) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') go(st.i + 1);
      else if (e.key === 'ArrowLeft') go(st.i - 1);
    });
  }
  return { open, close, bind, get isOpen() { return !!st; } };
})();
