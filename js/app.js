/* Our Journey — logic chính.
   Quy hoạch: Bản đồ (ở đâu) · Cung đường (mỗi chuyến đi, tổng kết theo chặng) · Nhật ký (lịch theo ngày, album ảnh) · Tổng kết (số liệu, dùng chung).
   Nút + ở giữa là check-in một chạm. */
(() => {
  'use strict';

  /* ================= Hằng số ================= */
  const CATS = [
    { id: 'food', label: 'Quán ăn', e: '🍜' },
    { id: 'cafe', label: 'Cà phê', e: '☕' },
    { id: 'sight', label: 'Tham quan', e: '📸' },
    { id: 'nature', label: 'Thiên nhiên', e: '🌿' },
    { id: 'shop', label: 'Mua sắm', e: '🛍️' },
    { id: 'stay', label: 'Lưu trú', e: '🏨' },
    { id: 'fun', label: 'Vui chơi', e: '🎡' },
    { id: 'other', label: 'Khác', e: '📍' }
  ];
  const CAT = Object.fromEntries(CATS.map(c => [c.id, c]));
  const catOf = c => CAT[c.cat] || CAT.other;
  const MOODS = [
    { v: 5, e: '😍', l: 'Mê mẩn' },
    { v: 4, e: '😊', l: 'Vui' },
    { v: 3, e: '😌', l: 'Bình yên' },
    { v: 2, e: '😐', l: 'Tạm ổn' },
    { v: 1, e: '😢', l: 'Hơi buồn' }
  ];
  const MOOD = Object.fromEntries(MOODS.map(m => [m.v, m]));
  const TAGS = ['Đáng quay lại', 'Đồ ăn ngon', 'View đẹp', 'Giá hợp lý', 'Phục vụ tốt', 'Không gian xinh', 'Chụp ảnh đẹp', 'Yên tĩnh', 'Hơi đắt', 'Đông đúc', 'Khó tìm', 'Phục vụ chậm'];
  const PRICES = ['Miễn phí', '₫', '₫₫', '₫₫₫', '₫₫₫₫'];
  const WEEKDAYS = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  const STRIDE_M = 0.7; // độ dài trung bình một bước chân

  // Ngưỡng zoom cho từng cấp hiển thị
  const Z_COUNTRY = 4.5;  // nhỏ hơn: gom theo quốc gia
  const Z_LOCAL = 8.5;    // từ đây: ghim từng địa điểm (dưới đó gom theo tỉnh/thành)
  const Z_DETAIL = 14.5;  // từ đây: ghim có ảnh và tên
  const Z_ROUTES = 10;    // từ đây: hiện các lộ trình đã đi
  const VN_VIEW = [[8.3, 101.8], [23.5, 111.2]];
  const ISLES = [
    { lat: 16.45, lng: 111.9, name: 'Q.đ. Hoàng Sa<br>(Việt Nam)' },
    { lat: 9.9, lng: 114.2, name: 'Q.đ. Trường Sa<br>(Việt Nam)' }
  ];

  const TILES = {
    voyager: { name: 'Bản đồ phố', url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', opt: { subdomains: 'abcd', maxZoom: 20 }, by: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> · © <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>' },
    light: { name: 'Tối giản', url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', opt: { subdomains: 'abcd', maxZoom: 20 }, by: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> · © <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>' },
    sat: { name: 'Vệ tinh', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', opt: { maxZoom: 19 }, by: 'Ảnh vệ tinh © Esri' }
  };

  /* ================= Trạng thái ================= */
  const S = {
    view: 'map',
    journeys: [],
    checkins: [],
    trips: [],            // các cung đường (chuyến đi có tên)
    rev: 0,               // tăng mỗi khi dữ liệu đổi, để biết lúc nào cần vẽ lại
    _places: null,
    active: null,         // hành trình đang ghi / tạm dừng
    me: null,
    watchId: null,
    follow: false,
    gpsMsg: '',
    gpsWarn: false,
    tile: 'voyager',
    focusId: null,
    focusTripId: null,    // cung đang xem riêng trên bản đồ
    openTripId: null,
    _stages: null,
    diaryMode: 'cal',     // 'cal' lịch | 'album' ảnh
    filter: 'all',        // bộ lọc địa điểm trên bản đồ
    trail: true,          // hiện đường nối theo thời gian
    replay: null,         // đang phát lại hành trình
    scopeKey: '',         // vùng đang xem trên bản đồ
    cal: null,            // { y, m, day } tháng/ngày đang xem trong Nhật ký
    albumMode: 'month',
    albumIds: [],
    placeSort: 'recent',
    quick: null,          // thẻ check-in nhanh đang hiện
    quickBusy: false,
    pickDate: null,       // ngày định sẵn khi thêm kỉ niệm cho một ngày cũ
    lb: null,
    draft: null,
    picking: false,
    sheetOpen: false,
    sheetHist: false,
    sheetKind: null,
    ignorePop: 0,
    wakeLock: null,
    lastSave: 0
  };

  /* ================= Tiện ích ================= */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = n => String(n).padStart(2, '0');
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const nf = new Intl.NumberFormat('vi-VN');
  const nf1 = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1, minimumFractionDigits: 1 });

  function hav(a, b) {
    const R = 6371000, toR = Math.PI / 180;
    const dLat = (b[0] - a[0]) * toR, dLng = (b[1] - a[1]) * toR;
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * toR) * Math.cos(b[0] * toR) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
  }
  const kmNum = m => (m / 1000 < 100 ? nf1.format(m / 1000) : nf.format(Math.round(m / 1000)));
  const km = m => (m < 1000 ? `${Math.round(m)} m` : `${kmNum(m)} km`);
  function dur(ms, withSec = false) {
    const t = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
    if (withSec) return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
    if (h) return `${h} giờ${m ? ` ${m} phút` : ''}`;
    return `${m} phút`;
  }
  const dDate = t => { const d = new Date(t); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`; };
  const dTime = t => { const d = new Date(t); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const dayKey = t => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const toLocalInput = t => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const hearts = n => `<span class="hearts" aria-label="${n}/5 tim">${[1, 2, 3, 4, 5].map(i => icon('heart', i <= n ? 'on' : 'off')).join('')}</span>`;
  const mode = arr => {
    const m = new Map();
    let best = null, bn = 0;
    for (const x of arr) { const n = (m.get(x) || 0) + 1; m.set(x, n); if (n > bn) { bn = n; best = x; } }
    return best;
  };
  const groupBy = (arr, fn) => {
    const m = new Map();
    for (const x of arr) { const k = fn(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); }
    return m;
  };
  const centroid = list => [list.reduce((a, p) => a + p.lat, 0) / list.length, list.reduce((a, p) => a + p.lng, 0) / list.length];

  /** Ghi/xoá một bản ghi trong máy và báo cho phần dùng chung gửi đi. */
  async function saveRec(store, rec) {
    if (store === 'journeys' || store === 'trips') rec.updatedAt = Date.now();
    await DB.put(store, rec);
    Sync.push(store, rec);
  }
  async function delRec(store, id) {
    await DB.del(store, id);
    Sync.remove(store, id);
  }

  let toastTimer;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  function ask(title, text, yes = 'Xoá', danger = true) {
    return new Promise(resolve => {
      const m = $('#modal');
      $('#modalTitle').textContent = title;
      $('#modalText').textContent = text;
      const y = $('#modalYes'), n = $('#modalNo');
      y.textContent = yes;
      y.className = `btn ${danger ? 'danger' : 'primary'}`;
      m.hidden = false;
      const done = v => { m.hidden = true; y.onclick = n.onclick = m.onclick = null; resolve(v); };
      y.onclick = () => done(true);
      n.onclick = () => done(false);
      m.onclick = e => { if (e.target === m) done(false); };
    });
  }

  /* ================= Khu vực: quốc gia › tỉnh/thành › địa điểm ================= */
  const cKey = c => c.cc || (c.country ? 'x:' + Geo.norm(c.country) : '??');
  const rKey = c => `${cKey(c)}|${c.province || ''}`;
  const rLabel = c => c.province || c.country || 'Chưa rõ khu vực';
  const cLabel = c => c.country || 'Chưa rõ khu vực';
  const whereText = c => [c.province, c.country].filter(Boolean).join(', ');
  const flagOf = c => Geo.flag(c.cc);

  /** Gộp các lần check-in cùng tên, cùng tỉnh và cách nhau dưới 300 m thành một địa điểm. */
  function places() {
    if (S._places) return S._places;
    const byName = new Map();
    const out = [];
    for (const c of S.checkins) { // đã sắp mới nhất trước
      const k = c.name.trim().toLowerCase() + '|' + rKey(c);
      const cands = byName.get(k) || [];
      let p = cands.find(x => hav([x.lat, x.lng], [c.lat, c.lng]) < 300);
      if (!p) {
        p = { key: k + '#' + cands.length, latest: c, visits: [], lat: c.lat, lng: c.lng, name: c.name, cat: c.cat, cc: c.cc, country: c.country, province: c.province, demo: c.demo };
        cands.push(p);
        byName.set(k, cands);
        out.push(p);
      }
      p.visits.push(c);
    }
    out.forEach(p => {
      p.rating = (p.visits.find(v => v.rating) || {}).rating || 0;
      p.photoId = (p.visits.find(v => v.photoIds.length) || { photoIds: [] }).photoIds[0] || null;
      p.price = (p.visits.find(v => v.price != null) || {}).price ?? null;
      p.tags = [...new Set(p.visits.flatMap(v => v.tags))];
      p.feedback = (p.visits.find(v => v.feedback) || {}).feedback || '';
      p.photos = p.visits.reduce((a, v) => a + v.photoIds.length, 0);
    });
    return (S._places = out);
  }
  const placeOf = id => places().find(p => p.visits.some(v => v.id === id));

  const geoCache = new Map();
  async function reverse(lat, lng) {
    const key = lat.toFixed(4) + ',' + lng.toFixed(4);
    if (geoCache.has(key)) return geoCache.get(key);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=vi`);
      if (!res.ok) return null;
      const r = await res.json();
      geoCache.set(key, r);
      return r;
    } catch { return null; }
  }

  /** Điền tỉnh/quốc gia cho các check-in cũ chưa có: đoán ngay, rồi hỏi lại dịch vụ bản đồ khi có mạng. */
  async function backfillRegions() {
    let changed = false;
    for (const c of S.checkins) {
      if (c.regionSrc) continue;
      const g = Geo.guess(c.lat, c.lng);
      if (g) Object.assign(c, { province: g.province, country: g.country, cc: g.cc, regionSrc: 'guess' });
      else c.regionSrc = 'none';
      await DB.put('checkins', c);
      changed = true;
    }
    if (changed) bump();
    const todo = S.checkins.filter(c => c.regionSrc === 'guess' || c.regionSrc === 'none').slice(0, 12);
    for (const c of todo) {
      const r = await reverse(c.lat, c.lng);
      if (!r) break; // không có mạng: để lần sau
      const reg = Geo.fromAddress(r.address, c.lat, c.lng);
      if (reg) {
        Object.assign(c, { province: reg.province, country: reg.country, cc: reg.cc, regionSrc: 'geo' });
        await DB.put('checkins', c);
        changed = true;
      }
      await sleep(1200);
    }
    if (todo.length && changed) bump();
  }

  /* ================= Ảnh ================= */
  const urlCache = new Map();
  async function photoUrl(id, size = 'thumb') {
    const key = id + ':' + size;
    if (urlCache.has(key)) return urlCache.get(key);
    const p = await DB.get('photos', id);
    if (!p) return '';
    const u = URL.createObjectURL(size === 'thumb' ? (p.thumb || p.blob) : (p.blob || p.thumb));
    urlCache.set(key, u);
    return u;
  }
  function dropUrls(id) {
    ['thumb', 'full'].forEach(s => {
      const k = id + ':' + s;
      if (urlCache.has(k)) { URL.revokeObjectURL(urlCache.get(k)); urlCache.delete(k); }
    });
  }
  function hydratePhotos(root) {
    $$('img[data-photo]', root).forEach(async img => {
      if (img.getAttribute('src')) return;
      const u = await photoUrl(img.dataset.photo, img.dataset.size || 'thumb');
      if (u) img.src = u;
    });
  }
  function loadImage(file) {
    return new Promise((res, rej) => {
      const u = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { res(img); setTimeout(() => URL.revokeObjectURL(u), 1000); };
      img.onerror = () => { URL.revokeObjectURL(u); rej(new Error('decode')); };
      img.src = u;
    });
  }
  function resize(img, max, q) {
    const r = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * r), h = Math.round(img.naturalHeight * r);
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    cv.getContext('2d').drawImage(img, 0, 0, w, h);
    return new Promise(res => cv.toBlob(res, 'image/jpeg', q));
  }
  async function processImage(file) {
    try {
      const img = await loadImage(file);
      const [blob, thumb] = await Promise.all([resize(img, 1600, 0.82), resize(img, 420, 0.78)]);
      if (!blob || !thumb) throw new Error('encode');
      return { blob, thumb };
    } catch {
      return { blob: file, thumb: file }; // định dạng trình duyệt không đọc được: giữ nguyên tệp
    }
  }

  /* ================= Bản đồ ================= */
  let map, tileLayer, meMarker, accCircle, activeLine, tempMarker, vnOutline;
  const L_pins = L.layerGroup();
  const L_routes = L.layerGroup();
  const L_focus = L.layerGroup();
  const L_isles = L.layerGroup();
  const L_trail = L.layerGroup();

  const level = () => { const z = map.getZoom(); return z < Z_COUNTRY ? 'world' : z < Z_LOCAL ? 'country' : 'local'; };
  // Phần bản đồ bị các tấm kính che: trên là ô tìm kiếm, dưới là thẻ ngữ cảnh + thanh tab.
  const padTL = () => L.point(16, 96);
  const padBR = () => L.point(16, Math.min(360, ($('.map-bottom').offsetHeight || 150) + 96));

  function initMap() {
    map = L.map('map', { zoomControl: false, attributionControl: false, zoomSnap: 0.25, zoomDelta: 0.5, minZoom: 2, maxZoom: 19, worldCopyJump: true });
    map.fitBounds(VN_VIEW, { paddingTopLeft: padTL(), paddingBottomRight: L.point(16, 250), animate: false });
    setTile(S.tile);

    vnOutline = L.polygon(VN_SHAPE, { color: '#EC7FA2', weight: 2, opacity: .85, fillColor: '#F6AFC6', fillOpacity: .13, interactive: false, smoothFactor: 0.5 });
    ISLES.forEach(i => L.marker([i.lat, i.lng], { interactive: false, icon: L.divIcon({ className: 'mk', html: `<span class="isle">${i.name}</span>`, iconSize: [0, 0] }) }).addTo(L_isles));
    L_trail.addTo(map);
    L_focus.addTo(map);
    L_pins.addTo(map);
    activeLine = L.polyline([], { color: '#EC7FA2', weight: 6, opacity: .95, lineCap: 'round', lineJoin: 'round' }).addTo(map);

    map.on('dragstart', () => { S.follow = false; $('#btnLocate').classList.remove('is-on'); });
    map.on('contextmenu', e => { if (!S.picking) openCheckinForm({ lat: e.latlng.lat, lng: e.latlng.lng, fromMap: true }); });
    map.on('click', () => { $('#searchResults').hidden = true; $('#layerMenu').hidden = true; });
    map.on('zoomend', () => { syncLayers(); drawPins(); drawTrail(); renderScope(); });
    let mt;
    map.on('moveend', () => { clearTimeout(mt); mt = setTimeout(renderScope, 120); });
    syncLayers();
  }

  function syncLayers() {
    const z = map.getZoom();
    const toggle = (layer, on) => { if (on && !map.hasLayer(layer)) layer.addTo(map); else if (!on && map.hasLayer(layer)) map.removeLayer(layer); };
    toggle(vnOutline, z < Z_LOCAL && S.tile !== 'sat');
    toggle(L_isles, z >= Z_COUNTRY && z < Z_LOCAL + 1);
    toggle(L_routes, z >= Z_ROUTES);
    if (meMarker) meMarker.setZIndexOffset(z < Z_LOCAL ? -1000 : 1000);
  }

  function setTile(key) {
    if (!TILES[key]) key = 'voyager';
    if (tileLayer) map.removeLayer(tileLayer);
    const t = TILES[key];
    tileLayer = L.tileLayer(t.url, t.opt).addTo(map);
    tileLayer.bringToBack();
    $('#map').classList.toggle('is-sat', key === 'sat');
    $('#attrib').innerHTML = t.by;
    S.tile = key;
    if (vnOutline) syncLayers();
  }

  function addMarker(lat, lng, html, size, anchor, onClick, z = 0) {
    const m = L.marker([lat, lng], { icon: L.divIcon({ className: 'mk', html, iconSize: [size, size], iconAnchor: anchor || [size / 2, size / 2] }), zIndexOffset: z, keyboard: false });
    if (onClick) m.on('click', onClick);
    return m.addTo(L_pins);
  }
  const bubSize = n => Math.round(40 + Math.min(22, Math.sqrt(n) * 6));

  /** Đẩy nhẹ các bong bóng (kèm nhãn tên) ra xa nhau để không che nhau khi hai vùng nằm sát. */
  function spread(items, z) {
    items.forEach(it => {
      it.pt = map.project(it.at, z);
      it.w = Math.max(it.s, Math.min(170, it.label.length * 7.2 + 20)) + 6;
      it.h = it.s + 30;
    });
    for (let n = 0; n < 10; n++) {
      let moved = false;
      for (let i = 0; i < items.length; i++) for (let k = i + 1; k < items.length; k++) {
        const a = items[i], b = items[k];
        const dx = b.pt.x - a.pt.x, dy = b.pt.y - a.pt.y;
        const ox = (a.w + b.w) / 2 - Math.abs(dx), oy = (a.h + b.h) / 2 - Math.abs(dy);
        if (ox <= 0 || oy <= 0) continue;
        moved = true;
        if (ox < oy) { const m = (ox / 2) * (dx < 0 ? -1 : 1); a.pt.x -= m; b.pt.x += m; }
        else { const m = (oy / 2) * (dy < 0 ? -1 : 1); a.pt.y -= m; b.pt.y += m; }
      }
      if (!moved) break;
    }
    items.forEach(it => { const ll = map.unproject(it.pt, z); it.at = [ll.lat, ll.lng]; });
    return items;
  }

  /** Vẽ ghim theo cấp zoom: quốc gia → tỉnh/thành → cụm gần nhau → từng địa điểm. */
  function drawPins() {
    L_pins.clearLayers();
    const P = shown();
    if (!P.length) return;
    const lv = level(), z = map.getZoom();

    if (lv === 'world') {
      const items = [...groupBy(P, cKey)].map(([ck, list]) => ({ ck, list, s: 52, label: cLabel(list[0]), at: ck === 'VN' ? [16.2, 106.6] : centroid(list) }));
      spread(items, z).forEach(it => addMarker(it.at[0], it.at[1], `<div class="bub country">${flagOf(it.list[0])}<em>${it.list.length}</em></div><span class="mk-name">${esc(it.label)}</span>`, 52, null, () => flyCountry(it.ck), it.list.length));
      return;
    }
    if (lv === 'country') {
      const ord = S.trail && S.filter === 'all' ? visitOrder(rKey) : null; // số thứ tự đặt chân
      const items = [...groupBy(P, rKey)].map(([rk, list]) => ({ rk, list, s: bubSize(list.length), label: rLabel(list[0]), at: centroid(list) }));
      spread(items, z).forEach(it => addMarker(it.at[0], it.at[1], `<div class="bub">${it.list.length}${ord ? `<i class="ord">${ord.get(it.rk)}</i>` : ''}</div><span class="mk-name">${esc(it.label)}</span>`, it.s, null, () => flyRegion(it.rk), it.list.length));
      return;
    }

    // Cấp địa phương: gom các điểm sát nhau trên màn hình, zoom đủ gần thì tách hết.
    const clusters = [];
    const R = z >= 16.5 ? 0 : 46;
    for (const p of P) {
      const pt = map.project([p.lat, p.lng], z);
      let c = R ? clusters.find(k => Math.abs(k.pt.x - pt.x) < R && Math.abs(k.pt.y - pt.y) < R) : null;
      if (!c) clusters.push(c = { pt, list: [] });
      c.list.push(p);
    }
    const detail = z >= Z_DETAIL;
    for (const c of clusters) {
      if (c.list.length > 1) {
        const [lat, lng] = centroid(c.list);
        addMarker(lat, lng, `<div class="bub mini">${c.list.length}</div>`, 36, null, () => {
          const b = L.latLngBounds(c.list.map(p => [p.lat, p.lng]));
          map.flyToBounds(b.pad(0.4), { paddingTopLeft: padTL(), paddingBottomRight: padBR(), maxZoom: 18, duration: .7 });
        }, 500);
        continue;
      }
      const p = c.list[0];
      const e = catOf(p).e;
      const fav = p.rating >= 5 ? 'fav' : '';
      if (detail) {
        addMarker(p.lat, p.lng, `<div class="pin photo ${fav}">${p.photoId ? `<img data-photo="${p.photoId}" alt="">` : `<span>${e}</span>`}</div><span class="mk-name">${esc(p.name)}</span>`, 46, null, () => openDetail(p.latest.id));
      } else {
        addMarker(p.lat, p.lng, `<div class="pin ${fav}"><span>${e}</span></div>`, 36, [18, 45], () => openDetail(p.latest.id));
      }
    }
    if (detail) hydratePhotos(map.getPanes().markerPane);
  }

  function segLines(points) {
    const lines = [];
    let cur = null, seg = null;
    for (const p of points) {
      if (p[3] !== seg) { cur = []; lines.push(cur); seg = p[3]; }
      cur.push([p[0], p[1]]);
    }
    return lines;
  }
  function drawRoutes() {
    L_routes.clearLayers();
    S.journeys.filter(j => j.status === 'done' && j.points.length > 1).forEach(j => {
      L.polyline(segLines(j.points), { color: '#C24E78', weight: 4, opacity: .5, dashArray: '1 8', lineCap: 'round' })
        .bindTooltip(j.name, { sticky: true, className: 'route-tip' })
        .on('click', () => openJourney(j.id))
        .addTo(L_routes);
    });
  }
  const drawActive = () => activeLine.setLatLngs(S.active ? segLines(S.active.points) : []);

  function updateMe(lat, lng, acc) {
    S.me = { lat, lng, acc, t: Date.now() };
    if (!meMarker) {
      meMarker = L.marker([lat, lng], { icon: L.divIcon({ className: 'mk', html: '<div class="me-dot"></div>', iconSize: [18, 18], iconAnchor: [9, 9] }), interactive: false, zIndexOffset: 1000 }).addTo(map);
      accCircle = L.circle([lat, lng], { radius: acc, color: '#EC7FA2', weight: 1, opacity: .4, fillColor: '#FBDCE6', fillOpacity: .25, interactive: false }).addTo(map);
      meMarker.setZIndexOffset(map.getZoom() < Z_LOCAL ? -1000 : 1000);
    } else {
      meMarker.setLatLng([lat, lng]);
      accCircle.setLatLng([lat, lng]).setRadius(acc);
    }
  }

  /* --- bộ lọc trên bản đồ: lọc cả ghim, thẻ ngữ cảnh và danh sách --- */
  const FILTERS = { all: () => true, fav: p => p.rating >= 5, again: p => p.tags.includes('Đáng quay lại') };
  const passFilter = p => (FILTERS[S.filter] ? FILTERS[S.filter](p) : p.cat === S.filter);
  const shown = () => (S.filter === 'all' ? places() : places().filter(passFilter));
  function filterOpts() {
    const counts = {};
    places().forEach(p => { counts[p.cat] = (counts[p.cat] || 0) + 1; });
    if (S.filter !== 'all' && !FILTERS[S.filter] && !counts[S.filter]) S.filter = 'all';
    return [{ id: 'all', label: 'Tất cả' }, { id: 'fav', label: '♥ Yêu thích' }, { id: 'again', label: 'Đáng quay lại' }]
      .concat(CATS.filter(c => counts[c.id]).map(c => ({ id: c.id, label: `${c.e} ${c.label}` })));
  }
  /** Trên bản đồ chỉ hiện một nhãn khi đang lọc; chọn bộ lọc trong Danh sách. */
  function renderFilters() {
    const el = $('#mapFilters');
    const cur = filterOpts().find(o => o.id === S.filter);
    el.hidden = S.filter === 'all' || S.picking || !!S.replay;
    if (el.hidden) return;
    el.innerHTML = `<button type="button" class="chip is-on" data-filter="all">Đang lọc: ${cur ? cur.label : ''} ${icon('x')}</button>`;
  }

  /* --- đường đi theo đường thật: hỏi dịch vụ dẫn đường một lần rồi lưu lại trong máy --- */
  const OSRM = 'https://router.project-osrm.org/route/v1/driving/';
  const routes = new Map();       // khoá → { coords, dist, legs }
  const routeWant = new Map();
  const routeQueue = [];
  const routeFailed = new Set();
  let routeBusy = false, routeTimer;
  const wayKey = pts => pts.map(p => p[0].toFixed(4) + ',' + p[1].toFixed(4)).join(';');
  function straight(pts) {
    const legs = [];
    for (let i = 1; i < pts.length; i++) legs.push(hav(pts[i - 1], pts[i]));
    return { coords: pts, dist: legs.reduce((a, b) => a + b, 0), legs, est: true };
  }
  /** Đường đi qua các điểm theo thứ tự. Chưa có sẵn thì tạm nối thẳng và xếp hàng hỏi dịch vụ dẫn đường. */
  function routeThrough(pts) {
    if (pts.length < 2) return { coords: pts, dist: 0, legs: [], est: false };
    const key = wayKey(pts);
    const hit = routes.get(key);
    if (hit) return hit;
    const flat = straight(pts);
    if (flat.dist < 60) return { ...flat, est: false }; // loanh quanh một chỗ, không cần hỏi
    if (!routeFailed.has(key) && !routeWant.has(key)) { routeWant.set(key, pts); routeQueue.push(key); pumpRoutes(); }
    return flat;
  }
  async function pumpRoutes() {
    if (routeBusy) return;
    routeBusy = true;
    while (routeQueue.length) {
      const key = routeQueue.shift();
      const pts = routeWant.get(key);
      try {
        const res = await fetch(OSRM + pts.map(p => `${p[1].toFixed(5)},${p[0].toFixed(5)}`).join(';') + '?overview=simplified&geometries=geojson&steps=false');
        const j = res.ok ? await res.json() : null;
        const r = j && j.code === 'Ok' && j.routes && j.routes[0];
        const flat = straight(pts).dist;
        if (!r || r.distance > flat * 4 + 20000) throw new Error('no route'); // không có đường bộ hợp lý (qua biển, bay…)
        const rec = { key, coords: r.geometry.coordinates.map(c => [+c[1].toFixed(5), +c[0].toFixed(5)]), dist: r.distance, legs: r.legs.map(l => l.distance), at: Date.now() };
        routes.set(key, rec);
        DB.put('routes', rec).catch(() => {});
        clearTimeout(routeTimer);
        routeTimer = setTimeout(routesChanged, 250);
      } catch { routeFailed.add(key); }
      routeWant.delete(key);
      if (routeQueue.length) await sleep(1100); // giữ nhịp chậm cho dịch vụ miễn phí
    }
    routeBusy = false;
  }
  function routesChanged() {
    S._stages = null;
    drawTrail();
    if (S.view === 'trips') renderTrips();
    if (S.sheetOpen && S.sheetKind === 'trip' && S.openTripId) openTrip(S.openTripId, true);
    renderTripBar();
  }

  /* --- cung đường: mỗi chuyến đi có tên, chia chặng theo ngày --- */
  const TRIP_COLORS = ['#C2185B', '#7B4FB8', '#1F8A7A', '#C07A1C', '#2F6FB5'];
  const chrono = () => S.checkins.slice().sort((a, b) => a.visitedAt - b.visitedAt);
  const activeTrip = () => S.trips.find(t => !t.endedAt) || null;
  const tripById = id => S.trips.find(t => t.id === id) || null;
  const tripCheckins = id => S.checkins.filter(c => c.tripId === id).sort((a, b) => a.visitedAt - b.visitedAt);
  function tripColor(t) {
    const order = S.trips.slice().sort((a, b) => a.startedAt - b.startedAt);
    return TRIP_COLORS[Math.max(0, order.indexOf(t)) % TRIP_COLORS.length];
  }
  /** Cung mà một thời điểm rơi vào: ưu tiên cung đang đi. */
  function tripAt(time) {
    const act = activeTrip();
    if (act && time >= act.startedAt) return act;
    return S.trips.find(t => t.endedAt && time >= t.startedAt && time <= t.endedAt) || null;
  }
  /** Các chặng của một cung: mỗi ngày một chặng, nối tiếp từ điểm dừng cuối của ngày trước. */
  function tripStages(t) {
    if (!S._stages) S._stages = new Map();
    if (S._stages.has(t.id)) return S._stages.get(t.id);
    const days = [...groupBy(tripCheckins(t.id), c => dayKey(c.visitedAt))];
    let prev = null;
    const stages = days.map(([day, list], i) => {
      const pts = list.map(c => [c.lat, c.lng]);
      const lead = !!(prev && hav([prev.lat, prev.lng], pts[0]) > 30);
      const route = routeThrough(lead ? [[prev.lat, prev.lng]].concat(pts) : pts);
      const from = lead ? prev : list[0];
      prev = list[list.length - 1];
      return { n: i + 1, day, list, lead, route, dist: route.dist, est: !!route.est, from, to: prev };
    });
    S._stages.set(t.id, stages);
    return stages;
  }
  function tripStats(t) {
    const stages = tripStages(t);
    const cs = stages.flatMap(s => s.list);
    return {
      stages, cs,
      dist: stages.reduce((a, s) => a + s.dist, 0),
      est: stages.some(s => s.est),
      days: stages.length,
      photos: cs.reduce((a, c) => a + c.photoIds.length, 0),
      regions: [...new Set(cs.map(rLabel))],
      from: cs[0] ? cs[0].visitedAt : t.startedAt,
      to: cs.length ? cs[cs.length - 1].visitedAt : (t.endedAt || t.startedAt)
    };
  }
  const kmText = (m, est) => (est ? '≈ ' : '') + km(m);
  function dateRange(a, b) {
    const x = new Date(a), y = new Date(b);
    if (dayKey(a) === dayKey(b)) return dDate(a);
    if (x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth()) return `${pad(x.getDate())}–${dDate(b)}`;
    if (x.getFullYear() === y.getFullYear()) return `${pad(x.getDate())}/${pad(x.getMonth() + 1)} – ${dDate(b)}`;
    return `${dDate(a)} – ${dDate(b)}`;
  }

  /** Thứ tự đặt chân: vùng nào check-in sớm nhất thì mang số 1. */
  function visitOrder(keyFn) {
    const m = new Map();
    chrono().forEach(c => { const k = keyFn(c); if (!m.has(k)) m.set(k, m.size + 1); });
    return m;
  }

  /* --- vẽ đường: mỗi cung một màu, nét dày viền trắng, có mũi tên hướng và số chặng --- */
  function arrowsAlong(coords, z, color, every) {
    const px = coords.map(p => map.project(p, z));
    const cum = [0];
    for (let i = 1; i < px.length; i++) cum.push(cum[i - 1] + px[i].distanceTo(px[i - 1]));
    const total = cum[cum.length - 1];
    const n = Math.min(8, Math.floor(total / every));
    for (let k = 1; k <= n; k++) {
      const d = total * k / (n + 1);
      let i = 1;
      while (i < cum.length - 1 && cum[i] < d) i++;
      const f = (d - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1]);
      const pos = map.unproject(L.point(px[i - 1].x + (px[i].x - px[i - 1].x) * f, px[i - 1].y + (px[i].y - px[i - 1].y) * f), z);
      const ang = Math.atan2(px[i].y - px[i - 1].y, px[i].x - px[i - 1].x) * 180 / Math.PI;
      L.marker(pos, { interactive: false, keyboard: false, zIndexOffset: -600, icon: L.divIcon({ className: 'mk', html: `<span class="arrow" style="--c:${color};transform:translate(-50%,-50%) rotate(${ang.toFixed(1)}deg)"></span>`, iconSize: [0, 0] }) }).addTo(L_trail);
    }
  }
  function drawTrail() {
    L_trail.clearLayers();
    if (!map || S.replay) return;
    const z = map.getZoom(), local = z >= Z_LOCAL;
    const only = S.focusTripId;
    if (!S.trail && !only) return;
    for (const t of S.trips) {
      if (only && t.id !== only) continue;
      const color = tripColor(t);
      const stages = tripStages(t);
      stages.forEach(st => {
        const c = st.route.coords;
        if (c.length < 2) return;
        L.polyline(c, { color: '#fff', weight: local ? 9 : 7, opacity: .95, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(L_trail);
        L.polyline(c, { color, weight: local ? 5 : 4, opacity: 1, dashArray: st.est ? '1 10' : null, lineCap: 'round', lineJoin: 'round' })
          .bindTooltip(`${t.name} · chặng ${st.n}`, { sticky: true, className: 'route-tip' })
          .on('click', () => openTrip(t.id))
          .addTo(L_trail);
        arrowsAlong(c, z, color, local ? 150 : 110);
      });
      // số chặng đặt ở điểm xuất phát của mỗi chặng
      if (stages.length > 1 && z >= 6.5) {
        stages.forEach(st => {
          const p = st.route.coords[0];
          if (!p) return;
          L.marker(p, { keyboard: false, zIndexOffset: 400, icon: L.divIcon({ className: 'mk', html: `<span class="stage-no" style="--c:${color}">${st.n}</span>`, iconSize: [0, 0] }) })
            .on('click', () => openTrip(t.id)).addTo(L_trail);
        });
      }
    }
    if (only) return;
    // check-in lẻ ngoài các cung: chỉ nối những điểm trong cùng một ngày, nét mảnh
    const loose = chrono().filter(c => !c.tripId);
    for (let i = 1; i < loose.length; i++) {
      const a = loose[i - 1], b = loose[i];
      if (dayKey(a.visitedAt) !== dayKey(b.visitedAt)) continue;
      const d = hav([a.lat, a.lng], [b.lat, b.lng]);
      if (d < 30 || (!local && d < 4000)) continue;
      L.polyline([[a.lat, a.lng], [b.lat, b.lng]], { color: '#fff', weight: 6, opacity: .9, lineCap: 'round', interactive: false }).addTo(L_trail);
      L.polyline([[a.lat, a.lng], [b.lat, b.lng]], { color: '#C24E78', weight: 3, opacity: .9, dashArray: '2 8', lineCap: 'round', interactive: false }).addTo(L_trail);
    }
  }

  /* --- xem một cung trên bản đồ --- */
  function focusTrip(id, fit = true) {
    const t = tripById(id);
    if (!t) return;
    unfocus();
    S.focusTripId = id;
    const st = tripStats(t);
    $('#focusTitle').textContent = `${t.name} · ${kmText(st.dist, st.est)}`;
    $('#focusBanner').hidden = false;
    $('#view-map').classList.add('has-focus');
    go('map');
    S.follow = false;
    drawTrail();
    const pts = st.stages.flatMap(s => s.route.coords).concat(st.cs.map(c => [c.lat, c.lng]));
    if (fit && pts.length) map.fitBounds(L.latLngBounds(pts).pad(0.15), { maxZoom: 16, paddingTopLeft: L.point(20, 150), paddingBottomRight: padBR() });
  }

  /* --- phát lại một cung: đường tự vẽ dần theo đúng lộ trình, tới điểm nào hiện tên điểm đó --- */
  function startReplay(tripId) {
    stopReplay();
    const t = tripById(tripId);
    const stages = t ? tripStages(t).filter(s => s.route.coords.length > 1) : [];
    if (!stages.length) { toast('Cung này cần ít nhất 2 điểm check-in để phát lại'); return; }
    focusTrip(tripId);
    const pts = [], marks = [];
    stages.forEach(st => {
      let from = pts.length;
      st.route.coords.forEach(p => pts.push(p));
      st.list.forEach(c => {
        let best = from, bd = Infinity;
        for (let i = from; i < pts.length; i++) { const d = hav(pts[i], [c.lat, c.lng]); if (d < bd) { bd = d; best = i; } }
        from = best;
        marks.push({ i: best, label: `Chặng ${st.n} · ${dTime(c.visitedAt)} · ${c.name}` });
      });
    });
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + hav(pts[i - 1], pts[i]));
    const total = cum[cum.length - 1] || 1;
    const T = Math.max(7000, Math.min(30000, marks.length * 1300));
    const color = tripColor(t);
    const ghost = L.polyline(pts, { color, weight: 4, opacity: .22, lineCap: 'round', interactive: false }).addTo(map);
    const casing = L.polyline([], { color: '#fff', weight: 9, opacity: .95, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(map);
    const line = L.polyline([], { color, weight: 5, opacity: 1, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(map);
    const dot = L.marker(pts[0], { interactive: false, zIndexOffset: 3000, icon: L.divIcon({ className: 'mk', html: `<div class="replay-dot" style="--c:${color}"></div>`, iconSize: [22, 22], iconAnchor: [11, 11] }) }).addTo(map);
    S.replay = { layers: [ghost, casing, line, dot], raf: 0 };
    L_trail.clearLayers();
    $('#focusBanner').hidden = true;
    $('#replayBar').hidden = false;
    renderTripBar();
    $('#replayTitle').textContent = `${t.name} · ${marks[0].label}`;
    let k = 0, mi = 0;
    const t0 = performance.now() + 600;
    const tick = now => {
      if (!S.replay) return;
      const f = Math.max(0, Math.min(1, (now - t0) / T));
      const d = f * total;
      while (k < cum.length - 2 && cum[k + 1] < d) k++;
      const r = Math.min(1, (d - cum[k]) / Math.max(1e-6, cum[k + 1] - cum[k]));
      const head = [pts[k][0] + (pts[k + 1][0] - pts[k][0]) * r, pts[k][1] + (pts[k + 1][1] - pts[k][1]) * r];
      const part = pts.slice(0, k + 1).concat([head]);
      casing.setLatLngs(part);
      line.setLatLngs(part);
      dot.setLatLng(head);
      while (mi < marks.length - 1 && marks[mi + 1].i <= k) mi++;
      $('#replayTitle').textContent = marks[f >= 1 ? marks.length - 1 : mi].label;
      if (f >= 1) { S.replay.raf = 0; setTimeout(() => S.replay && S.replay.layers[2] === line && stopReplay(), 1800); return; }
      S.replay.raf = requestAnimationFrame(tick);
    };
    S.replay.raf = requestAnimationFrame(tick);
  }
  function stopReplay() {
    if (!S.replay) return;
    cancelAnimationFrame(S.replay.raf);
    S.replay.layers.forEach(l => map.removeLayer(l));
    S.replay = null;
    $('#replayBar').hidden = true;
    if (S.focusTripId) $('#focusBanner').hidden = false;
    else if (!S.focusId) $('#view-map').classList.remove('has-focus');
    renderTripBar();
    drawTrail();
  }

  /* --- di chuyển giữa các cấp --- */
  const flyOpt = () => ({ paddingTopLeft: padTL(), paddingBottomRight: padBR(), duration: .9 });
  // Dời tâm xuống một chút để vùng cần xem nằm giữa phần bản đồ không bị che.
  function offsetCenter(latlng, z) {
    const dy = (padBR().y - padTL().y) / 2;
    return map.unproject(map.project(latlng, z).add([0, dy]), z);
  }
  function showS(animate = true) {
    S.follow = false;
    if (animate) map.flyToBounds(VN_VIEW, flyOpt());
    else map.fitBounds(VN_VIEW, { paddingTopLeft: padTL(), paddingBottomRight: padBR(), animate: false });
  }
  function showWorld() {
    S.follow = false;
    const P = places();
    if (!P.length) { map.flyTo([16, 106], 3.5, { duration: .9 }); return; }
    const b = L.latLngBounds(P.map(p => [p.lat, p.lng])).pad(0.5);
    const z = Math.max(2.5, Math.min(Z_COUNTRY - 0.5, map.getBoundsZoom(b, false, L.point(40, 360))));
    map.flyTo(offsetCenter(b.getCenter(), z), z, { duration: .9 });
  }
  function flyCountry(ck) {
    S.follow = false;
    if (ck === 'VN') return showS();
    const list = places().filter(p => cKey(p) === ck);
    if (!list.length) return;
    const b = L.latLngBounds(list.map(p => [p.lat, p.lng])).pad(0.8);
    const z = Math.max(Z_COUNTRY + 0.5, Math.min(Z_LOCAL - 1, map.getBoundsZoom(b, false, L.point(40, 360))));
    map.flyTo(offsetCenter(b.getCenter(), z), z, { duration: .9 });
  }
  function flyRegion(rk) {
    S.follow = false;
    const list = places().filter(p => rKey(p) === rk);
    if (!list.length) return;
    const b = L.latLngBounds(list.map(p => [p.lat, p.lng])).pad(0.35);
    const z = Math.max(Z_LOCAL + 0.5, Math.min(15, map.getBoundsZoom(b, false, L.point(60, 380))));
    map.flyTo(offsetCenter(b.getCenter(), z), z, { duration: .9 });
  }
  function flyPlace(p, open = true) {
    S.follow = false;
    const z = Math.max(map.getZoom(), 16);
    map.flyTo(offsetCenter([p.lat, p.lng], z), z, { duration: .8 });
    if (open) openDetail(p.latest.id);
  }

  /* --- thẻ ngữ cảnh ở đáy bản đồ --- */
  const scopeActs = () => `<span class="scope-acts"><button type="button" data-act="list">${icon('list')}Danh sách</button></span>`;
  const crumbs = parts => `<div class="scope-top"><nav class="crumbs">${parts.map((p, i) => `${i ? icon('chevron') : ''}<button type="button" ${p.attr || 'disabled'}>${p.label}</button>`).join('')}</nav>${scopeActs()}</div>`;

  function renderScope(force) {
    const el = $('#scopeCard');
    el.hidden = S.picking || S.view !== 'map';
    if (el.hidden || !map) return;
    const P = shown();
    let key, html;

    if (places().length && !P.length) {
      key = 'nomatch';
      html = `
        <div class="scope-head"><h2>Không có nơi nào khớp bộ lọc</h2></div>
        <div class="hscroll"><button type="button" class="reg-chip" data-act="nofilter"><i>${icon('x')}</i>Bỏ lọc</button></div>`;
    } else if (!P.length) {
      key = 'empty';
      html = `
        <div class="scope-head"><h2>Bản đồ chữ S của bạn</h2><span class="num"><b>0</b>/${Geo.UNITS.length} tỉnh thành</span></div>
        <p>Chưa có nơi nào. Bấm nút <b>+</b> để check-in ngay chỗ bạn đang đứng, hoặc xem thử với dữ liệu mẫu.</p>
        <div><button type="button" class="btn soft sm" data-act="demo">${icon('sparkle')}Xem thử dữ liệu mẫu</button></div>`;
    } else {
      const lv = level();
      const b = map.getBounds();
      const inView = P.filter(p => b.contains([p.lat, p.lng]));
      const ctr = map.getCenter();

      if (lv === 'world') {
        const groups = [...groupBy(P, cKey)].sort((a, b2) => b2[1].length - a[1].length);
        key = 'world';
        html = `
          ${crumbs([{ label: 'Thế giới' }])}
          <div class="scope-head"><h2>Thế giới của bạn</h2><span class="num"><b>${groups.length}</b> quốc gia · ${P.length} địa điểm</span></div>
          <div class="hscroll">${groups.map(([ck, list]) => `<button type="button" class="reg-chip" data-cc="${esc(ck)}"><i class="flag">${flagOf(list[0])}</i>${esc(cLabel(list[0]))}<em>${list.length}</em></button>`).join('')}</div>`;
      } else if (lv === 'country') {
        let ck = mode(inView.map(cKey));
        if (!ck && Geo.inVietnam(ctr.lat, ctr.lng)) ck = 'VN';
        const list = ck ? P.filter(p => cKey(p) === ck) : [];
        key = 'country:' + ck;
        if (ck === 'VN') {
          const groups = [...groupBy(list, rKey)].sort((a, b2) => b2[1].length - a[1].length);
          html = `
            ${crumbs([{ label: 'Thế giới', attr: 'data-act="world"' }, { label: 'Việt Nam' }])}
            <div class="scope-head"><h2>Việt Nam</h2><span class="num"><b>${groups.length}</b>/${Geo.UNITS.length} tỉnh thành</span></div>
            <div class="meter"><span style="width:${(groups.length / Geo.UNITS.length) * 100}%"></span></div>
            ${groups.length
              ? `<div class="hscroll">${groups.map(([rk, l]) => `<button type="button" class="reg-chip" data-rk="${esc(rk)}"><i>${l.length}</i>${esc(rLabel(l[0]))}</button>`).join('')}</div>`
              : '<p>Bạn chưa ghim nơi nào ở Việt Nam. Bấm <b>+</b> để bắt đầu.</p>'}`;
        } else if (ck) {
          const groups = [...groupBy(list, rKey)].sort((a, b2) => b2[1].length - a[1].length);
          html = `
            ${crumbs([{ label: 'Thế giới', attr: 'data-act="world"' }, { label: esc(cLabel(list[0])) }])}
            <div class="scope-head"><h2>${flagOf(list[0])} ${esc(cLabel(list[0]))}</h2><span class="num"><b>${list.length}</b> địa điểm</span></div>
            <div class="hscroll">${groups.map(([rk, l]) => `<button type="button" class="reg-chip" data-rk="${esc(rk)}"><i>${l.length}</i>${esc(rLabel(l[0]))}</button>`).join('')}</div>`;
        } else {
          html = `
            ${crumbs([{ label: 'Thế giới', attr: 'data-act="world"' }])}
            <div class="scope-head"><h2>Vùng này chưa có nơi nào</h2></div>
            <div class="hscroll"><button type="button" class="reg-chip" data-act="home"><i class="flag">🇻🇳</i>Về bản đồ chữ S</button></div>`;
        }
      } else {
        const rk = mode(inView.map(rKey));
        if (rk) {
          const list = P.filter(p => rKey(p) === rk);
          const first = list[0];
          const rated = list.filter(p => p.rating);
          const avg = rated.length ? rated.reduce((a, p) => a + p.rating, 0) / rated.length : 0;
          const ordered = list.filter(p => inView.includes(p)).concat(list.filter(p => !inView.includes(p)));
          key = 'region:' + rk;
          html = `
            ${crumbs([{ label: 'Thế giới', attr: 'data-act="world"' }, { label: esc(cLabel(first)), attr: `data-cc="${esc(cKey(first))}"` }, { label: esc(rLabel(first)) }])}
            <div class="scope-head"><h2>${esc(rLabel(first))}</h2><span class="num"><b>${list.length}</b> địa điểm${avg ? ` · ♥ ${nf1.format(avg)}` : ''}</span></div>
            <div class="hscroll">${ordered.map(p => `
              <button type="button" class="place-chip" data-place="${p.latest.id}">
                <span class="th">${p.photoId ? `<img data-photo="${p.photoId}" alt="">` : catOf(p).e}</span>
                <span><b>${esc(p.name)}</b><small>${catOf(p).e} ${p.rating ? '♥'.repeat(p.rating) : catOf(p).label}</small></span>
              </button>`).join('')}</div>`;
        } else {
          let near = null, nd = Infinity;
          for (const p of P) { const d = hav([ctr.lat, ctr.lng], [p.lat, p.lng]); if (d < nd) { nd = d; near = p; } }
          const inVN = Geo.inVietnam(ctr.lat, ctr.lng);
          key = 'none:' + near.key;
          html = `
            ${crumbs([{ label: 'Thế giới', attr: 'data-act="world"' }].concat(inVN ? [{ label: 'Việt Nam', attr: 'data-cc="VN"' }] : []))}
            <div class="scope-head"><h2>Chưa check-in nơi nào quanh đây</h2></div>
            <div class="hscroll">
              <button type="button" class="reg-chip" data-act="pickpin"><i>${icon('plus')}</i>Ghim nơi này</button>
              <button type="button" class="reg-chip" data-place="${near.latest.id}"><i class="flag">${catOf(near).e}</i>Gần nhất: ${esc(near.name)}<em>${km(nd)}</em></button>
            </div>`;
        }
      }
    }
    S.scopeKey = key;
    key += '|' + S.rev + '|' + S.filter + '|' + S.trail;
    if (!force && el.dataset.key === key) return;
    el.dataset.key = key;
    el.innerHTML = html;
    hydratePhotos(el);
  }

  /* ================= Định vị ================= */
  const geoOk = 'geolocation' in navigator;
  const GEO_OPT = { enableHighAccuracy: true, maximumAge: 3000, timeout: 20000 };

  function geoError(err) {
    const msgs = {
      1: 'Chưa có quyền vị trí. Hãy bật quyền vị trí cho trang này trong cài đặt trình duyệt.',
      2: 'Không xác định được vị trí. Hãy ra chỗ thoáng hoặc bật GPS.',
      3: 'Lấy vị trí quá lâu, đang thử lại…'
    };
    S.gpsMsg = msgs[err.code] || 'Không lấy được vị trí.';
    S.gpsWarn = true;
    renderRec();
    if (err.code === 1) toast('Cần quyền truy cập vị trí');
    else if (!S.active) toast(S.gpsMsg);
  }

  function locateOnce(fly = true) {
    if (!geoOk) { toast('Trình duyệt không hỗ trợ định vị'); return Promise.resolve(null); }
    return new Promise(resolve => {
      navigator.geolocation.getCurrentPosition(pos => {
        const { latitude: lat, longitude: lng, accuracy } = pos.coords;
        updateMe(lat, lng, accuracy);
        if (fly) { const z = Math.max(map.getZoom(), 16); map.flyTo(offsetCenter([lat, lng], z), z, { duration: .8 }); }
        resolve(S.me);
      }, err => { geoError(err); resolve(null); }, GEO_OPT);
    });
  }
  function startWatch() {
    if (!geoOk || S.watchId !== null) return;
    S.watchId = navigator.geolocation.watchPosition(onPosition, geoError, GEO_OPT);
  }
  function stopWatch() {
    if (S.watchId !== null) navigator.geolocation.clearWatch(S.watchId);
    S.watchId = null;
  }

  function onPosition(pos) {
    const { latitude: lat, longitude: lng, accuracy } = pos.coords;
    updateMe(lat, lng, accuracy);
    const j = S.active;
    if (S.follow && S.view === 'map' && !S.picking) {
      if (map.getZoom() < 15) map.setView(offsetCenter([lat, lng], 16), 16);
      else map.panTo(offsetCenter([lat, lng], map.getZoom()), { animate: true });
    }
    if (!j || j.status !== 'active') return;

    if (accuracy > 50) {
      S.gpsMsg = `GPS yếu (±${Math.round(accuracy)} m), đang chờ chính xác hơn`;
      S.gpsWarn = true;
      renderRec();
      return;
    }
    S.gpsMsg = '';
    S.gpsWarn = false;

    const now = pos.timestamp || Date.now();
    const last = j.points[j.points.length - 1];
    if (!last || last[3] !== j.seg) {
      j.points.push([+lat.toFixed(6), +lng.toFixed(6), now, j.seg]);
    } else {
      const d = hav(last, [lat, lng]);
      const dt = Math.max(1, (now - last[2]) / 1000);
      if (d < 8 || d / dt > 70) { renderRec(); return; } // đứng yên hoặc nhảy điểm bất thường
      j.points.push([+lat.toFixed(6), +lng.toFixed(6), now, j.seg]);
      j.distance += d;
    }
    drawActive();
    renderRec();
    if (Date.now() - S.lastSave > 8000) saveActive();
  }

  async function saveActive() {
    if (!S.active) return;
    S.lastSave = Date.now();
    await DB.put('journeys', S.active);
  }
  async function wake(on) {
    try {
      if (on && 'wakeLock' in navigator && !S.wakeLock) {
        S.wakeLock = await navigator.wakeLock.request('screen');
        S.wakeLock.addEventListener('release', () => { S.wakeLock = null; });
      } else if (!on && S.wakeLock) {
        await S.wakeLock.release();
        S.wakeLock = null;
      }
    } catch { /* không hỗ trợ: bỏ qua */ }
  }

  /* ================= Hành trình ================= */
  const elapsed = j => j.activeMs + (j.status === 'active' && j.resumedAt ? Date.now() - j.resumedAt : 0);
  const jCheckins = id => S.checkins.filter(c => c.journeyId === id);
  function jRegion(j) {
    const cs = jCheckins(j.id);
    if (cs.length) { const rk = mode(cs.map(rKey)); return cs.find(c => rKey(c) === rk); }
    if (j.province || j.country) return j;
    return j.points.length ? Geo.guess(j.points[0][0], j.points[0][1]) : null;
  }

  async function startJourney() {
    if (!geoOk) { toast('Trình duyệt không hỗ trợ định vị'); return; }
    const now = Date.now();
    const d = new Date(now);
    const part = d.getHours() < 11 ? 'Buổi sáng' : d.getHours() < 14 ? 'Buổi trưa' : d.getHours() < 18 ? 'Buổi chiều' : 'Buổi tối';
    S.active = {
      id: uid(), name: `${part} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`, note: '',
      startedAt: now, endedAt: null, points: [], distance: 0, activeMs: 0, resumedAt: now, status: 'active', seg: 0
    };
    S.journeys.unshift(S.active);
    S.follow = true;
    $('#btnLocate').classList.add('is-on');
    S.gpsMsg = 'Đang bắt tín hiệu GPS…';
    S.gpsWarn = false;
    await saveActive();
    go('map');
    startWatch();
    wake(true);
    renderRec();
    toast('Bắt đầu ghi hành trình. Giữ màn hình mở nhé.');
  }
  async function pauseJourney() {
    const j = S.active;
    j.activeMs = elapsed(j);
    j.resumedAt = null;
    j.status = 'paused';
    stopWatch();
    wake(false);
    await saveActive();
    renderRec();
  }
  async function resumeJourney() {
    const j = S.active;
    j.status = 'active';
    j.resumedAt = Date.now();
    j.seg = (j.seg || 0) + 1; // đoạn mới, không nối thẳng qua khoảng tạm dừng
    S.follow = true;
    await saveActive();
    startWatch();
    wake(true);
    renderRec();
  }
  async function endJourney() {
    const j = S.active;
    if (!j) return;
    j.activeMs = elapsed(j);
    j.resumedAt = null;
    j.status = 'done';
    j.endedAt = Date.now();
    stopWatch();
    wake(false);
    await saveRec('journeys', j);
    S.active = null;
    drawActive();
    drawRoutes();
    bump();
    openJourneySummary(j);
  }
  const askEnd = () => ask('Kết thúc hành trình?', 'Lộ trình sẽ được lưu vào Nhật ký. Bạn có thể đặt tên và ghi cảm nhận.', 'Kết thúc', false).then(ok => ok && endJourney());

  function openJourneySummary(j) {
    const cs = jCheckins(j.id);
    const empty = j.distance < 30 && !cs.length;
    openSheet(`
      <div class="sheet-head"><h2>Hoàn thành hành trình</h2></div>
      <div class="jstats">
        <div><b>${km(j.distance)}</b><span>Quãng đường</span></div>
        <div><b>${dur(j.activeMs)}</b><span>Thời gian di chuyển</span></div>
        <div><b>${cs.length}</b><span>Điểm check-in</span></div>
        <div><b>${nf.format(Math.round(j.distance / STRIDE_M))}</b><span>Bước chân (ước tính)</span></div>
      </div>
      <div class="field"><label for="jName">Đặt tên cho hành trình</label><input class="input" id="jName" value="${esc(j.name)}" maxlength="80"></div>
      <div class="field"><label for="jNote">Cảm nhận về chuyến đi <span class="hint">· không bắt buộc</span></label><textarea class="input script" id="jNote" placeholder="Hôm nay mình đã…">${esc(j.note)}</textarea></div>
      ${empty ? '<p class="foot-note">Hành trình này gần như chưa di chuyển. Bạn có thể bỏ nó đi.</p>' : ''}
    `, `
      ${empty ? '<button type="button" class="btn ghost" data-act="discard">Bỏ hành trình</button>' : ''}
      <button type="button" class="btn primary" data-act="save">Lưu vào Nhật ký</button>
    `, 'summary');
    $('#sheetFoot').onclick = async e => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'save') {
        j.name = $('#jName').value.trim() || j.name;
        j.note = $('#jNote').value.trim();
        await saveRec('journeys', j);
        closeSheet();
        toast('Đã lưu hành trình vào Nhật ký');
        bump();
      } else if (act === 'discard') {
        await deleteJourney(j.id, true);
        closeSheet();
      }
    };
  }

  async function deleteJourney(id, silent = false) {
    for (const c of jCheckins(id)) { c.journeyId = null; c.updatedAt = Date.now(); await saveRec('checkins', c); }
    await delRec('journeys', id);
    S.journeys = S.journeys.filter(j => j.id !== id);
    if (S.focusId === id) unfocus();
    drawRoutes();
    bump();
    if (!silent) toast('Đã xoá hành trình');
  }

  /* --- thanh ghi hành trình trên bản đồ --- */
  function renderRec() {
    const el = $('#recBar');
    const j = S.active;
    $('.tab[data-go="map"]').classList.toggle('rec', !!j && j.status === 'active');
    el.hidden = !j || S.picking || S.view !== 'map';
    if (!j) { el.dataset.key = ''; return; }
    const ms = elapsed(j);
    const paused = j.status === 'paused';
    const vals = [kmNum(j.distance), dur(ms, true), jCheckins(j.id).length];
    const sub = paused ? `${j.name} · đang tạm dừng` : (S.gpsMsg || `${j.name} · đang ghi`);
    const key = [j.id, j.status, sub, S.gpsWarn].join('|');
    if (el.dataset.key === key) { // chỉ cập nhật số, giữ nguyên các nút
      $$('[data-v]', el).forEach((b, i) => { b.textContent = vals[i]; });
      return;
    }
    el.dataset.key = key;
    el.innerHTML = `
      <span class="rec-dot ${paused ? 'paused' : ''}"></span>
      <span class="t">
        <span class="nums"><b data-v>${vals[0]}</b><span>km</span><b data-v>${vals[1]}</b><span></span><b data-v>${vals[2]}</b><span>điểm</span></span>
        <span class="nm ${S.gpsWarn && !paused ? 'warn' : ''}">${esc(sub)}</span>
      </span>
      ${paused
        ? `<button type="button" class="sq soft" data-act="resume" aria-label="Tiếp tục">${icon('play')}</button>`
        : `<button type="button" class="sq soft" data-act="pause" aria-label="Tạm dừng">${icon('pause')}</button>`}
      <button type="button" class="sq stop" data-act="end" aria-label="Kết thúc hành trình">${icon('stop')}</button>`;
  }

  /* ================= Tuỳ chọn bản đồ & hành động chung ================= */
  function openMenu() {
    const j = S.active;
    const row = (attr, label, on, ic) => `<button type="button" ${attr} class="${on ? 'is-on' : ''}">${ic ? icon(ic) : ''}<span>${label}</span>${on ? icon('check') : ''}</button>`;
    $('#layerMenu').innerHTML =
      '<p>Kiểu bản đồ</p>' + Object.entries(TILES).map(([k, t]) => row(`data-tile="${k}"`, t.name, S.tile === k)).join('')
      + '<p>Hiển thị</p>' + row('data-act="trail"', 'Đường đi của các cung', S.trail)
      + '<p>Thêm</p>' + (activeTrip() ? '' : row('data-act="newtrip"', 'Bắt đầu cung mới', false, 'route'))
      + row('data-act="pickpin"', 'Ghim một nơi khác', false, 'pin')
      + (!j ? row('data-act="start"', 'Ghi đường đi bằng GPS', false, 'route') : row('data-act="end"', 'Kết thúc ghi đường đi', false, 'stop'));
    $('#layerMenu').hidden = false;
  }
  const closeMenu = () => { $('#layerMenu').hidden = true; };

  function doAct(act) {
    if (act === 'checkin') quickCheckin();
    else if (act === 'pickpin') pickNew();
    else if (act === 'start') startJourney();
    else if (act === 'pause') pauseJourney();
    else if (act === 'resume') resumeJourney();
    else if (act === 'end') askEnd();
    else if (act === 'demo') addDemo();
    else if (act === 'cleardemo') clearDemo();
    else if (act === 'export') exportData();
    else if (act === 'import') $('#fileImport').click();
    else if (act === 'wipe') wipeAll();
    else if (act === 'world') showWorld();
    else if (act === 'home') { go('map'); showS(); }
    else if (act === 'newtrip') openTripForm();
    else if (act === 'endtrip') endTrip();
    else if (act === 'list') openPlaceList();
    else if (act === 'nofilter') { S.filter = 'all'; bump(); }
    else if (act === 'share') openShare();
    else if (act === 'trail') {
      S.trail = !S.trail;
      DB.setMeta('trail', S.trail).catch(() => {});
      drawTrail(); drawPins(); renderScope(true);
      toast(S.trail ? 'Hiện đường đi của các cung' : 'Ẩn đường đi');
    } else return false;
    return true;
  }

  /* ================= Check-in một chạm ================= */
  function locateQuick() {
    if (!geoOk) return Promise.resolve(null);
    return new Promise(resolve => navigator.geolocation.getCurrentPosition(pos => {
      const { latitude: lat, longitude: lng, accuracy } = pos.coords;
      updateMe(lat, lng, accuracy);
      resolve(S.me);
    }, () => resolve(null), { enableHighAccuracy: true, maximumAge: 4000, timeout: 9000 }));
  }

  /** Bấm + là lưu ngay vị trí và giờ hiện tại. Tên, ảnh, cảm nhận bổ sung sau. */
  async function quickCheckin() {
    if (S.quickBusy || S.picking) return;
    closeMenu();
    S.quickBusy = true;
    $('#btnAdd').classList.add('busy');
    const me = (await locateQuick()) || (S.me && Date.now() - S.me.t < 60000 ? S.me : null); // đang chạy xe thì vị trí cũ vài chục giây đã lệch xa
    S.quickBusy = false;
    $('#btnAdd').classList.remove('busy');
    if (!me) { toast('Chưa lấy được vị trí. Hãy đặt ghim vào đúng chỗ.'); pickNew(); return; }
    await createQuick(me.lat, me.lng);
  }

  async function createQuick(lat, lng) {
    const d = newDraft(lat, lng, { source: 'gps' });
    let near = null, nd = 100; // trong 100 m quanh một nơi đã ghé thì coi là ghé lại nơi đó
    for (const p of places()) { const dist = hav([p.lat, p.lng], [lat, lng]); if (dist < nd) { nd = dist; near = p; } }
    let repeat = null;
    if (near) {
      const l = near.latest;
      repeat = { visits: near.visits.length, last: l };
      Object.assign(d, { name: near.name, cat: near.cat, price: near.price, address: l.address || '', province: l.province || d.province, country: l.country || d.country, cc: l.cc || d.cc, regionSrc: l.regionSrc || d.regionSrc });
    } else {
      d.name = `Điểm dừng ${dTime(d.visitedAt)}`;
      d.draft = true;
    }
    const c = recordOf(d);
    await saveRec('checkins', c);
    S.checkins.push(c);
    S.checkins.sort((a, b) => b.visitedAt - a.visitedAt);
    bump();
    if (navigator.vibrate) navigator.vibrate(25);
    showQuick(c.id, repeat);
    if (S.view === 'map') { const z = Math.max(map.getZoom(), 16); map.flyTo(offsetCenter([lat, lng], z), z, { duration: .7 }); }
    if (!near) enrichQuick(c.id);
  }

  /** Nơi mới: hỏi dịch vụ bản đồ để tự điền tên quán, địa chỉ, tỉnh và loại địa điểm. */
  async function enrichQuick(id) {
    const c0 = S.checkins.find(x => x.id === id);
    if (!c0) return;
    const r = await reverse(c0.lat, c0.lng);
    const c = S.checkins.find(x => x.id === id);
    if (!r || !c || !c.draft) return;
    const a = r.address || {};
    const poi = r.name && r.name !== a.road ? r.name : '';
    const reg = Geo.fromAddress(a, c.lat, c.lng);
    if (reg) Object.assign(c, { province: reg.province, country: reg.country, cc: reg.cc, regionSrc: 'geo' });
    c.address = [a.road && (a.house_number ? a.house_number + ' ' : '') + a.road, a.suburb || a.quarter || a.village || a.town].filter(Boolean).join(', ');
    if (poi) { c.name = poi; c.cat = guessCat(r) || c.cat; }
    else if (a.road) c.name = `Gần ${a.road}`;
    c.updatedAt = Date.now();
    await saveRec('checkins', c);
    bump();
    if (S.quick && S.quick.id === id) renderQuick();
  }

  /* --- thẻ nhỏ sau khi check-in: chấm tim, thêm ảnh, bổ sung, hoàn tác --- */
  let quickTimer;
  const armQuick = () => { clearTimeout(quickTimer); quickTimer = setTimeout(hideQuick, 15000); };
  function showQuick(id, repeat) {
    S.quick = { id, repeat, msg: '' };
    renderQuick();
    armQuick();
  }
  function hideQuick() {
    clearTimeout(quickTimer);
    S.quick = null;
    $('#quickCard').hidden = true;
  }
  function renderQuick() {
    const q = S.quick, el = $('#quickCard');
    const c = q && S.checkins.find(x => x.id === q.id);
    if (!c) { hideQuick(); return; }
    const last = q.repeat && q.repeat.last;
    const note = q.msg || (last
      ? `Lần thứ ${q.repeat.visits + 1} bạn ghé nơi này · lần trước ${dDate(last.visitedAt)}${last.rating ? ' · ' + '♥'.repeat(last.rating) : ''}${last.feedback ? ` · “${last.feedback.slice(0, 70)}${last.feedback.length > 70 ? '…' : ''}”` : ''}`
      : 'Đã lưu vị trí và thời gian. Tên, ảnh và cảm nhận bổ sung lúc nào cũng được.');
    el.innerHTML = `
      <div class="qc-head">
        <span class="qc-ok">${icon('check')}</span>
        <span class="t"><small>Đã check-in · ${dTime(c.visitedAt)}${c.province ? ' · ' + esc(c.province) : ''}${tripById(c.tripId) ? ' · ' + esc(tripById(c.tripId).name) : ''}</small><b>${esc(c.name)}</b></span>
        <button type="button" class="icon-btn" data-q="close" aria-label="Đóng">${icon('x')}</button>
      </div>
      <p class="qc-note">${esc(note)}</p>
      <div class="rate-input">${[1, 2, 3, 4, 5].map(i => `<button type="button" data-q-rate="${i}" class="${i <= c.rating ? 'on' : ''}" aria-label="${i} tim">${icon('heart')}</button>`).join('')}</div>
      <div class="qc-acts">
        <button type="button" class="btn soft sm" data-q="photo">${icon('camera')}Ảnh${c.photoIds.length ? ` (${c.photoIds.length})` : ''}</button>
        <button type="button" class="btn soft sm" data-q="edit">${icon('edit')}Bổ sung</button>
        <button type="button" class="btn ghost sm" data-q="undo">Hoàn tác</button>
      </div>`;
    el.hidden = false;
  }
  async function quickAct(b) {
    const q = S.quick;
    const c = q && S.checkins.find(x => x.id === q.id);
    if (!c) { hideQuick(); return; }
    armQuick();
    if (b.dataset.qRate) {
      const v = +b.dataset.qRate;
      c.rating = c.rating === v ? 0 : v;
      c.updatedAt = Date.now();
      await saveRec('checkins', c);
      bump();
      renderQuick();
    } else if (b.dataset.q === 'close') hideQuick();
    else if (b.dataset.q === 'photo') $('#quickFile').click();
    else if (b.dataset.q === 'edit') { hideQuick(); openCheckinForm({ edit: c.id }); }
    else if (b.dataset.q === 'undo') { hideQuick(); await deleteCheckin(c.id); toast('Đã bỏ check-in vừa rồi'); }
  }
  async function quickPhotos(files) {
    const q = S.quick;
    const c = q && S.checkins.find(x => x.id === q.id);
    if (!c || !files.length) return;
    clearTimeout(quickTimer);
    q.msg = 'Đang nén ảnh…';
    renderQuick();
    for (const f of files.slice(0, 12 - c.photoIds.length)) {
      const { blob, thumb } = await processImage(f);
      const pid = uid();
      await saveRec('photos', { id: pid, checkinId: c.id, blob, thumb, createdAt: Date.now() });
      c.photoIds.push(pid);
    }
    c.updatedAt = Date.now();
    await saveRec('checkins', c);
    bump();
    if (S.quick === q) { q.msg = `Đã thêm ảnh, hiện có ${c.photoIds.length} ảnh.`; renderQuick(); armQuick(); }
  }

  /* ================= Bottom sheet ================= */
  function openSheet(html, foot = '', kind = null) {
    closeMenu();
    S.sheetKind = kind;
    const inner = $('#sheetInner');
    inner.innerHTML = html;
    inner.onclick = null;
    const f = $('#sheetFoot');
    f.innerHTML = foot;
    f.hidden = !foot;
    f.onclick = null;
    $('#sheet').classList.toggle('has-foot', !!foot);
    $('#sheet').hidden = false;
    $('#scrim').hidden = false;
    inner.scrollTop = 0;
    hydratePhotos($('#sheet'));
    if (!S.sheetHist) { history.pushState({ sheet: 1 }, ''); S.sheetHist = true; }
    S.sheetOpen = true;
  }
  function closeSheet(fromPop = false) {
    if (!S.sheetOpen) return;
    S.sheetOpen = false;
    S.sheetKind = null;
    $('#sheet').hidden = true;
    $('#scrim').hidden = true;
    if (!fromPop && S.sheetHist) { S.ignorePop++; history.back(); }
    S.sheetHist = false;
  }
  async function dismissSheet() {
    if (S.sheetKind === 'form' && S.draft?.dirty) {
      if (!(await ask('Bỏ check-in này?', 'Những gì bạn vừa nhập sẽ không được lưu.', 'Bỏ đi'))) return;
    }
    if (S.sheetKind === 'form') S.draft = null;
    closeSheet();
  }

  /* ================= Check-in ================= */
  const OSM_CAT = [
    [/^(restaurant|fast_food|food_court|biergarten)$/, 'food'],
    [/^(cafe|ice_cream|bar|pub|bakery|tea|coffee)$/, 'cafe'],
    [/^(hotel|hostel|guest_house|motel|resort|apartment|chalet|camp_site)$/, 'stay'],
    [/^(attraction|museum|viewpoint|artwork|gallery|place_of_worship|monument|memorial|castle|ruins)$/, 'sight'],
    [/^(theme_park|zoo|aquarium|cinema|theatre|nightclub|amusement_arcade|water_park)$/, 'fun'],
    [/^(park|garden|beach|nature_reserve|peak|waterfall|wood|water|bay|cave_entrance)$/, 'nature'],
    [/^(marketplace|mall|supermarket|convenience)$/, 'shop']
  ];
  function guessCat(r) {
    if (!r) return null;
    for (const [re, cat] of OSM_CAT) if (re.test(r.type || '')) return cat;
    if (r.category === 'shop') return 'shop';
    if (r.category === 'natural') return 'nature';
    if (r.category === 'historic') return 'sight';
    return null;
  }

  function newDraft(lat, lng, opt = {}) {
    const g = Geo.guess(lat, lng) || {};
    return {
      id: uid(), journeyId: S.active ? S.active.id : null, tripId: (tripAt(Date.now()) || {}).id || null, tripTouched: false,
      lat, lng, name: opt.name || '', address: opt.address || '',
      cat: opt.cat || 'food', catTouched: !!opt.cat, rating: 0, price: null, tags: [], feedback: '', memory: '', mood: null,
      visitedAt: Date.now(), photos: [], removed: [], editing: false, dirty: false, locating: false, source: opt.source || 'map',
      province: g.province || '', country: g.country || '', cc: g.cc || '', regionSrc: g.cc ? 'guess' : 'none', moreOpen: false
    };
  }

  async function openCheckinForm(opt = {}) {
    if (opt.edit) {
      const c = S.checkins.find(x => x.id === opt.edit);
      const photos = await Promise.all(c.photoIds.map(async id => ({ id, url: await photoUrl(id), isNew: false })));
      S.draft = { ...c, tags: [...c.tags], photos, removed: [], editing: true, dirty: false, locating: false, catTouched: true, moreOpen: true, source: 'map' };
    } else {
      const fresh = S.me && Date.now() - S.me.t < 120000;
      let lat = opt.lat, lng = opt.lng, locating = false, source = 'map';
      if (lat == null) {
        if (fresh) { ({ lat, lng } = S.me); source = 'gps'; }
        else { const c = map.getCenter(); lat = c.lat; lng = c.lng; locating = geoOk; }
      }
      const d = S.draft = newDraft(lat, lng, { ...opt, source });
      d.locating = locating;
      if (locating) {
        locateOnce(false).then(me => {
          if (S.draft !== d) return;
          d.locating = false;
          if (me) { setDraftPos(me.lat, me.lng, 'gps'); return; }
          renderLocBox();
          fillFromGeocoder();
        });
      } else fillFromGeocoder();
    }
    renderForm();
  }

  function setDraftPos(lat, lng, source) {
    const d = S.draft;
    const g = Geo.guess(lat, lng) || {};
    Object.assign(d, { lat, lng, source, address: '', province: g.province || '', country: g.country || '', cc: g.cc || '', regionSrc: g.cc ? 'guess' : 'none' });
    renderLocBox();
    renderPrev();
    syncRegionInputs();
    fillFromGeocoder();
  }

  async function fillFromGeocoder() {
    const d = S.draft;
    if (!d) return;
    const r = await reverse(d.lat, d.lng);
    if (!r || S.draft !== d) return;
    const a = r.address || {};
    if (!d.address) d.address = [a.road && (a.house_number ? a.house_number + ' ' : '') + a.road, a.suburb || a.quarter || a.village || a.town, a.city_district || a.county].filter(Boolean).slice(0, 2).join(', ');
    if (d.regionSrc !== 'manual') {
      const reg = Geo.fromAddress(a, d.lat, d.lng);
      if (reg) Object.assign(d, { province: reg.province, country: reg.country, cc: reg.cc, regionSrc: 'geo' });
    }
    if (!d.editing) {
      const poi = r.name && r.name !== a.road ? r.name : '';
      if (!d.name && poi) { d.name = poi; const n = $('#fName'); if (n && !n.value) n.value = poi; }
      const gc = guessCat(r);
      if (gc && !d.catTouched && poi) { d.cat = gc; $$('#fCat .chip').forEach(x => x.classList.toggle('is-on', x.dataset.cat === gc)); }
    }
    renderLocBox();
    syncRegionInputs();
  }

  function renderLocBox() {
    const d = S.draft, el = $('#locBox');
    if (!d || !el) return;
    const where = whereText(d);
    el.innerHTML = `
      <span class="ic">${icon(d.locating ? 'locate' : 'pin')}</span>
      <span class="t">
        <b>${d.locating ? 'Đang lấy vị trí của bạn…' : esc(d.address || (d.source === 'gps' ? 'Vị trí hiện tại' : 'Vị trí đã chọn'))}</b>
        <small>${where ? esc(where) : `${d.lat.toFixed(5)}, ${d.lng.toFixed(5)}`}</small>
      </span>
      <button type="button" class="btn line sm" data-act="pick">Đổi</button>`;
  }
  function syncRegionInputs() {
    const d = S.draft;
    const p = $('#fProvince'), c = $('#fCountry');
    if (!d || !p) return;
    if (document.activeElement !== p) p.value = d.province || '';
    if (document.activeElement !== c) c.value = d.country || '';
  }
  /** Gợi ý nơi đã từng ghé trong bán kính 80 m để khỏi gõ lại. */
  function renderPrev() {
    const d = S.draft, el = $('#fPrev');
    if (!d || !el) return;
    const near = d.editing ? [] : places().filter(p => hav([p.lat, p.lng], [d.lat, d.lng]) < 80).slice(0, 3);
    el.hidden = !near.length;
    el.innerHTML = near.length ? `Bạn từng ghé gần đây: ${near.map(p => `<button type="button" class="chip" data-prev="${p.latest.id}">${catOf(p).e} ${esc(p.name)}</button>`).join('')}` : '';
  }

  function renderForm() {
    const d = S.draft;
    const extra = [d.price != null ? PRICES[d.price] : '', d.tags.length ? `${d.tags.length} thẻ` : '', d.mood ? MOOD[d.mood].e : ''].filter(Boolean).join(' · ');
    openSheet(`
      <div class="sheet-head">
        <h2>${d.editing ? 'Sửa check-in' : 'Check-in'}</h2>
        <button type="button" class="icon-btn" data-act="close" aria-label="Đóng">${icon('x')}</button>
      </div>
      <div class="loc-box" id="locBox"></div>
      <div class="field">
        <span class="label">Ảnh <span class="hint">· tối đa 12 ảnh, tự nén cho nhẹ</span></span>
        <div class="photo-grid" id="fPhotos"></div>
      </div>
      <div class="field">
        <label for="fName">Tên địa điểm</label>
        <input class="input" id="fName" value="${esc(d.name)}" placeholder="VD: Quán bún bò cô Ba" maxlength="100" autocomplete="off">
        <div class="prev-row" id="fPrev" hidden></div>
      </div>
      <div class="field">
        <span class="label">Loại địa điểm</span>
        <div class="chips" id="fCat">${CATS.map(c => `<button type="button" class="chip ${d.cat === c.id ? 'is-on' : ''}" data-cat="${c.id}">${c.e} ${c.label}</button>`).join('')}</div>
      </div>
      <div class="field">
        <span class="label">Bạn chấm mấy tim?</span>
        <div class="rate-input" id="fRate">${[1, 2, 3, 4, 5].map(i => `<button type="button" data-rate="${i}" class="${i <= d.rating ? 'on' : ''}" aria-label="${i} tim">${icon('heart')}</button>`).join('')}</div>
      </div>
      <div class="field">
        <label for="fFeedback">Feedback về địa điểm</label>
        <textarea class="input" id="fFeedback" placeholder="Món nào ngon, giá ra sao, phục vụ thế nào, có nên quay lại không…">${esc(d.feedback)}</textarea>
      </div>
      <div class="field">
        <label for="fMemory">Kỉ niệm ở đây</label>
        <textarea class="input script" id="fMemory" placeholder="Điều mình muốn nhớ mãi…">${esc(d.memory)}</textarea>
      </div>
      <details class="more" id="fMore" ${d.moreOpen ? 'open' : ''}>
        <summary>Thêm chi tiết <small id="fMoreSum">${esc(extra || 'giá, thẻ, tâm trạng, giờ')}</small>${icon('down')}</summary>
        <div class="in">
          <div class="field">
            <span class="label">Mức giá</span>
            <div class="chips" id="fPrice">${PRICES.map((p, i) => `<button type="button" class="chip ${d.price === i ? 'is-on' : ''}" data-price="${i}">${p}</button>`).join('')}</div>
          </div>
          <div class="field">
            <span class="label">Nhận xét nhanh</span>
            <div class="chips" id="fTags">${TAGS.map(t => `<button type="button" class="chip ${d.tags.includes(t) ? 'is-on' : ''}" data-tag="${esc(t)}">${esc(t)}</button>`).join('')}</div>
          </div>
          <div class="field">
            <span class="label">Tâm trạng</span>
            <div class="mood-input" id="fMood">${MOODS.map(m => `<button type="button" data-mood="${m.v}" class="${d.mood === m.v ? 'on' : ''}" aria-label="${m.l}" title="${m.l}">${m.e}</button>`).join('')}</div>
          </div>
          ${S.trips.length ? `<div class="field">
            <label for="fTrip">Thuộc cung</label>
            <label class="select wide"><select id="fTrip"><option value="">Không thuộc cung nào</option>${S.trips.map(t => `<option value="${t.id}"${d.tripId === t.id ? ' selected' : ''}>${esc(t.name)}</option>`).join('')}</select></label>
          </div>` : ''}
          <div class="field">
            <label for="fTime">Thời gian</label>
            <input class="input" type="datetime-local" id="fTime" value="${toLocalInput(d.visitedAt)}">
          </div>
          <div class="field">
            <label for="fProvince">Tỉnh / thành phố <span class="hint">· tự nhận theo vị trí, sửa nếu chưa đúng</span></label>
            <input class="input" id="fProvince" list="vnUnits" value="${esc(d.province)}" placeholder="VD: Lâm Đồng" autocomplete="off">
          </div>
          <div class="field">
            <label for="fCountry">Quốc gia</label>
            <input class="input" id="fCountry" value="${esc(d.country)}" placeholder="VD: Việt Nam" autocomplete="off">
          </div>
        </div>
      </details>
    `, `
      <button type="button" class="btn ghost" data-act="close">Huỷ</button>
      <button type="button" class="btn primary" data-act="save">${icon('check')}${d.editing ? 'Lưu thay đổi' : 'Lưu check-in'}</button>
    `, 'form');
    renderLocBox();
    renderPrev();
    renderFormPhotos();
    bindForm();
  }

  function renderFormPhotos() {
    const d = S.draft, el = $('#fPhotos');
    if (!el) return;
    el.innerHTML = d.photos.map((p, i) => `
      <div class="ph">${p.busy ? '<span class="busy">Đang nén…</span>' : `<img src="${p.url}" alt="">`}
        <button type="button" class="rm" data-rm="${i}" aria-label="Bỏ ảnh">${icon('x')}</button></div>`).join('')
      + (d.photos.length < 12 ? `<label class="add" for="fFile">${icon('camera')}<span>Thêm ảnh</span><input type="file" id="fFile" accept="image/*" multiple></label>` : '');
    const f = $('#fFile');
    if (f) f.onchange = e => addPhotos([...e.target.files]);
  }
  async function addPhotos(files) {
    const d = S.draft;
    files = files.slice(0, 12 - d.photos.length);
    if (!files.length) return;
    d.dirty = true;
    const slots = files.map(() => ({ id: uid(), busy: true, isNew: true }));
    d.photos.push(...slots);
    renderFormPhotos();
    for (let i = 0; i < files.length; i++) {
      const { blob, thumb } = await processImage(files[i]);
      if (S.draft !== d) return;
      Object.assign(slots[i], { blob, thumb, url: URL.createObjectURL(thumb), busy: false });
      renderFormPhotos();
    }
  }

  function bindForm() {
    const d = S.draft;
    const mark = () => { d.dirty = true; };
    $('#fName').oninput = e => { d.name = e.target.value; mark(); };
    $('#fFeedback').oninput = e => { d.feedback = e.target.value; mark(); };
    $('#fMemory').oninput = e => { d.memory = e.target.value; mark(); };
    const fTrip = $('#fTrip');
    if (fTrip) fTrip.onchange = e => { d.tripId = e.target.value || null; d.tripTouched = true; mark(); };
    $('#fTime').onchange = e => {
      const t = new Date(e.target.value).getTime();
      if (!isNaN(t)) d.visitedAt = t;
      if (!d.editing && !d.tripTouched) { d.tripId = (tripAt(d.visitedAt) || {}).id || null; if (fTrip) fTrip.value = d.tripId || ''; } // đổi ngày thì tự xếp lại vào cung của ngày đó
      mark();
    };
    $('#fMore').ontoggle = e => { d.moreOpen = e.target.open; };
    $('#fProvince').onchange = e => {
      const v = e.target.value.trim();
      const unit = Geo.vnUnit(v);
      if (unit) Object.assign(d, { province: unit, country: 'Việt Nam', cc: 'VN' });
      else d.province = v;
      d.regionSrc = 'manual';
      syncRegionInputs(); renderLocBox(); mark();
    };
    $('#fCountry').onchange = e => {
      const v = e.target.value.trim();
      if (Geo.norm(v) === 'viet nam' || Geo.norm(v) === 'vietnam') Object.assign(d, { country: 'Việt Nam', cc: 'VN' });
      else if (v !== d.country) Object.assign(d, { country: v, cc: '' });
      d.regionSrc = 'manual';
      syncRegionInputs(); renderLocBox(); mark();
    };

    $('#sheetInner').onclick = e => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.cat) { d.cat = b.dataset.cat; d.catTouched = true; $$('#fCat .chip').forEach(x => x.classList.toggle('is-on', x === b)); mark(); }
      else if (b.dataset.rate) {
        const v = +b.dataset.rate;
        d.rating = d.rating === v ? 0 : v;
        $$('#fRate button').forEach(x => x.classList.toggle('on', +x.dataset.rate <= d.rating)); mark();
      } else if (b.dataset.price) {
        const v = +b.dataset.price;
        d.price = d.price === v ? null : v;
        $$('#fPrice .chip').forEach(x => x.classList.toggle('is-on', +x.dataset.price === d.price)); mark();
      } else if (b.dataset.tag) {
        const t = b.dataset.tag;
        d.tags = d.tags.includes(t) ? d.tags.filter(x => x !== t) : [...d.tags, t];
        b.classList.toggle('is-on'); mark();
      } else if (b.dataset.mood) {
        const v = +b.dataset.mood;
        d.mood = d.mood === v ? null : v;
        $$('#fMood button').forEach(x => x.classList.toggle('on', +x.dataset.mood === d.mood)); mark();
      } else if (b.dataset.rm) {
        const p = d.photos.splice(+b.dataset.rm, 1)[0];
        if (p && !p.isNew) d.removed.push(p.id);
        renderFormPhotos(); mark();
      } else if (b.dataset.prev) {
        const c = S.checkins.find(x => x.id === b.dataset.prev);
        Object.assign(d, { name: c.name, cat: c.cat, catTouched: true, price: c.price });
        $('#fName').value = c.name;
        $$('#fCat .chip').forEach(x => x.classList.toggle('is-on', x.dataset.cat === c.cat));
        $$('#fPrice .chip').forEach(x => x.classList.toggle('is-on', +x.dataset.price === d.price));
        mark();
      } else if (b.dataset.act === 'pick') startPick();
      else if (b.dataset.act === 'close') dismissSheet();
    };
    $('#sheetFoot').onclick = e => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'save') saveCheckin();
      else if (act === 'close') dismissSheet();
    };
  }

  /** Bản ghi check-in từ bản nháp trong form hoặc từ check-in nhanh. */
  function recordOf(d) {
    const now = Date.now();
    const me = Sync.profile;
    const c = {
      id: d.id, journeyId: d.journeyId, tripId: d.tripId || null, lat: d.lat, lng: d.lng, name: d.name.trim(), address: d.address || '',
      province: d.province, country: d.country, cc: d.cc, regionSrc: d.regionSrc,
      cat: d.cat, rating: d.rating, price: d.price, tags: d.tags, feedback: (d.feedback || '').trim(), memory: (d.memory || '').trim(),
      mood: d.mood, photoIds: (d.photos || []).map(p => p.id), visitedAt: d.visitedAt,
      createdAt: d.createdAt || now, updatedAt: now,
      by: d.by || (me ? me.id : null), byName: d.byName || (me ? me.name : '')
    };
    if (d.draft) c.draft = true;
    if (d.editing && d.demo) c.demo = true;
    return c;
  }

  async function saveCheckin() {
    const d = S.draft;
    if (d.photos.some(p => p.busy)) { toast('Đợi ảnh nén xong một chút nhé'); return; }
    if (!d.name.trim()) {
      const n = $('#fName');
      n.scrollIntoView({ block: 'center' });
      n.focus();
      toast('Hãy đặt tên cho địa điểm');
      return;
    }
    for (const p of d.photos.filter(p => p.isNew)) {
      await saveRec('photos', { id: p.id, checkinId: d.id, blob: p.blob, thumb: p.thumb, createdAt: Date.now() });
    }
    for (const id of d.removed) { await delRec('photos', id); dropUrls(id); }
    d.draft = false; // đã tự tay bổ sung
    const c = recordOf(d);
    await saveRec('checkins', c);
    const i = S.checkins.findIndex(x => x.id === c.id);
    if (i >= 0) S.checkins[i] = c; else S.checkins.push(c);
    S.checkins.sort((a, b) => b.visitedAt - a.visitedAt);
    S.draft = null;
    closeSheet();
    bump();
    toast(d.editing ? 'Đã cập nhật check-in' : `Đã check-in ${c.name}${c.province ? ' · ' + c.province : ''}`);
    if (!d.editing && S.view === 'map') {
      const z = Math.max(map.getZoom(), 16);
      map.flyTo(offsetCenter([c.lat, c.lng], z), z, { duration: .7 });
    }
  }

  /* --- chọn vị trí trên bản đồ --- */
  function pickNew() {
    const c = map.getCenter();
    S.draft = newDraft(c.lat, c.lng);
    S.draft.fromPick = true;
    if (S.pickDate) { S.draft.visitedAt = S.pickDate; S.draft.journeyId = null; S.draft.tripId = (tripAt(S.pickDate) || {}).id || null; S.pickDate = null; }
    startPick();
  }
  function startPick() {
    const d = S.draft;
    stopReplay();
    hideQuick();
    S.picking = true;
    closeSheet();
    go('map');
    if (!d.fromPick || map.getZoom() < 14) {
      if (d.fromPick) toast('Phóng to để đặt ghim cho chính xác');
      else map.setView([d.lat, d.lng], Math.max(map.getZoom(), 16));
    }
    $('#pickCross').hidden = false;
    $('#pickBar').hidden = false;
    renderFilters();
    renderTripBar();
    renderRec();
    renderScope();
  }
  function endPick(ok) {
    S.picking = false;
    $('#pickCross').hidden = true;
    $('#pickBar').hidden = true;
    renderFilters();
    renderTripBar();
    renderRec();
    renderScope();
    const d = S.draft;
    if (!d) return;
    const fresh = d.fromPick;
    d.fromPick = false;
    if (!ok && fresh) { S.draft = null; return; }
    renderForm();
    if (ok) {
      const c = map.getCenter();
      d.dirty = true;
      setDraftPos(c.lat, c.lng, 'map');
    }
  }

  /* ================= Chi tiết check-in ================= */
  function openDetail(id) {
    const c = S.checkins.find(x => x.id === id);
    if (!c) return;
    const cat = catOf(c);
    const j = c.journeyId && S.journeys.find(x => x.id === c.journeyId);
    const mood = MOOD[c.mood];
    const others = (placeOf(id)?.visits || []).filter(v => v.id !== id);
    const where = whereText(c);
    openSheet(`
      ${c.photoIds.length ? `<div class="carousel">${c.photoIds.map((p, i) => `<button type="button" data-lb="${i}"><img data-photo="${p}" data-size="full" alt=""></button>`).join('')}</div>` : ''}
      <div class="detail-title">
        ${where ? `<span class="where">${icon('pin')}${esc(where)}</span>` : ''}
        <h2>${esc(c.name)} ${c.demo ? '<span class="badge beige">Mẫu</span>' : ''}</h2>
        <span class="sub">${esc(c.address || `${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}`)}</span>
        ${avatar(c) ? `<span class="by">${avatar(c)}${esc(byName(c))} đăng</span>` : ''}
      </div>
      ${c.draft ? `<p class="todo">${icon('edit')}Check-in nhanh, chưa bổ sung. Bấm Sửa để thêm tên, ảnh và cảm nhận.</p>` : ''}
      <div class="kv">
        <div><span>Loại</span><b>${cat.e} ${cat.label}</b></div>
        <div><span>Đánh giá</span><b>${c.rating ? hearts(c.rating) : 'Chưa chấm'}</b></div>
        <div><span>Giá</span><b>${c.price != null ? PRICES[c.price] : '—'}</b></div>
        <div><span>Ngày</span><b>${dDate(c.visitedAt)}</b></div>
        <div><span>Giờ</span><b>${dTime(c.visitedAt)}</b></div>
        <div><span>Tâm trạng</span><b>${mood ? `${mood.e} ${mood.l}` : '—'}</b></div>
      </div>
      ${c.tags.length ? `<div class="tags">${c.tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
      ${c.feedback ? `<p class="sec-label">Feedback</p><p class="fb-box">${esc(c.feedback)}</p>` : ''}
      ${c.memory ? `<p class="sec-label">Kỉ niệm</p><blockquote class="quote">${esc(c.memory)}</blockquote>` : ''}
      ${tripById(c.tripId) ? `<button type="button" class="top-item" data-trip="${c.tripId}"><span class="rank">${icon('route')}</span><span class="t"><b>${esc(tripById(c.tripId).name)}</b><small>Thuộc cung này · xem tổng kết</small></span>${icon('chevron')}</button>` : ''}
      ${j ? `<button type="button" class="top-item" data-journey="${j.id}"><span class="rank">${icon('route')}</span><span class="t"><b>${esc(j.name)}</b><small>Thuộc hành trình · ${km(j.distance)}</small></span>${icon('chevron')}</button>` : ''}
      ${others.length ? `<p class="sec-label">Những lần ghé khác · ${others.length}</p><div class="mini-list">${others.map(v => `
        <button type="button" class="top-item" data-ci="${v.id}"><span class="rank">${icon('clock')}</span><span class="t"><b>${dDate(v.visitedAt)} · ${dTime(v.visitedAt)}</b><small>${v.rating ? '♥'.repeat(v.rating) + ' · ' : ''}${esc(v.feedback || v.memory || 'Không có ghi chú')}</small></span>${icon('chevron')}</button>`).join('')}</div>` : ''}
      <div class="actions-row">
        <button type="button" class="btn soft" data-act="show">${icon('map')}Trên bản đồ</button>
        <a class="btn line" href="https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}" target="_blank" rel="noopener">${icon('nav')}Chỉ đường</a>
      </div>
    `, `
      <button type="button" class="btn ghost icon-only" data-act="del" aria-label="Xoá">${icon('trash')}</button>
      <button type="button" class="btn ghost" data-act="again">${icon('plus')}Ghé lại</button>
      <button type="button" class="btn primary" data-act="edit">${icon('edit')}Sửa</button>
    `, 'detail');
    $('#sheetInner').onclick = e => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.lb != null) openLightbox(c.photoIds, +b.dataset.lb, c.name);
      else if (b.dataset.trip) openTrip(b.dataset.trip);
      else if (b.dataset.journey) openJourney(b.dataset.journey);
      else if (b.dataset.ci) openDetail(b.dataset.ci);
      else if (b.dataset.act === 'show') { closeSheet(); go('map'); const z = Math.max(map.getZoom(), 16.5); map.flyTo(offsetCenter([c.lat, c.lng], z), z, { duration: .8 }); }
    };
    $('#sheetFoot').onclick = async e => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'edit') openCheckinForm({ edit: c.id });
      else if (act === 'again') {
        S.draft = Object.assign(newDraft(c.lat, c.lng, { name: c.name, cat: c.cat, address: c.address }), { price: c.price, province: c.province, country: c.country, cc: c.cc, regionSrc: c.regionSrc || 'none' });
        renderForm();
      } else if (act === 'del') {
        if (!(await ask('Xoá check-in này?', `“${c.name}” và ${c.photoIds.length} ảnh sẽ bị xoá vĩnh viễn.`))) return;
        await deleteCheckin(c.id);
        closeSheet();
        toast('Đã xoá check-in');
      }
    };
  }

  async function deleteCheckin(id) {
    const c = S.checkins.find(x => x.id === id);
    for (const p of c.photoIds) { await delRec('photos', p); dropUrls(p); }
    await delRec('checkins', id);
    S.checkins = S.checkins.filter(x => x.id !== id);
    bump();
  }

  /* ================= Lightbox ================= */
  function openLightbox(ids, start = 0, cap = '') {
    const lb = $('#lightbox'), tr = $('#lbTrack');
    S.lb = { ids, i: start };
    tr.innerHTML = ids.map(id => `<figure><img data-photo="${id}" data-size="full" alt=""></figure>`).join('');
    const setCap = i => { $('#lbCap').textContent = (typeof cap === 'function' ? cap(i) : cap) + '  ›'; };
    setCap(start);
    lb.hidden = false;
    hydratePhotos(tr);
    requestAnimationFrame(() => { tr.scrollLeft = start * tr.clientWidth; });
    tr.onscroll = () => {
      const i = Math.round(tr.scrollLeft / tr.clientWidth);
      if (i === S.lb.i) return;
      S.lb.i = i;
      setCap(i);
    };
  }
  function photoCaption(pid) {
    const c = S.checkins.find(x => x.photoIds.includes(pid));
    return c ? `${c.name} · ${dDate(c.visitedAt)}` : '';
  }

  /* ================= Hình thu nhỏ lộ trình ================= */
  function routeSvg(j, w = 92, h = 92) {
    const pts = j.points;
    const cs = jCheckins(j.id);
    const all = pts.map(p => [p[0], p[1]]).concat(cs.map(c => [c.lat, c.lng]));
    if (all.length < 2) return `<svg viewBox="0 0 ${w} ${h}"><circle cx="${w / 2}" cy="${h / 2}" r="5" fill="#EC7FA2"/></svg>`;
    const lat0 = all.reduce((a, p) => a + p[0], 0) / all.length;
    const k = Math.cos(lat0 * Math.PI / 180);
    const xs = all.map(p => p[1] * k), ys = all.map(p => -p[0]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const span = Math.max(maxX - minX, maxY - minY) || 1e-6;
    const padd = 12, s = (w - padd * 2) / span;
    const ox = padd + ((w - padd * 2) - (maxX - minX) * s) / 2, oy = padd + ((h - padd * 2) - (maxY - minY) * s) / 2;
    const P = p => [(ox + (p[1] * k - minX) * s).toFixed(1), (oy + (-p[0] - minY) * s).toFixed(1)];
    const lines = segLines(pts).map(l => `<polyline points="${l.map(p => P(p).join(',')).join(' ')}" fill="none" stroke="#EC7FA2" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
    const dots = cs.map(c => { const [x, y] = P([c.lat, c.lng]); return `<circle cx="${x}" cy="${y}" r="3.6" fill="#fff" stroke="#C24E78" stroke-width="2"/>`; }).join('');
    const st = pts.length ? P(pts[0]) : null;
    return `<svg viewBox="0 0 ${w} ${h}">${lines}${dots}${st ? `<circle cx="${st[0]}" cy="${st[1]}" r="4" fill="#C24E78"/>` : ''}</svg>`;
  }

  /* ================= Nhật ký: lịch tháng, bấm một ngày thì lịch thu gọn và hiện kỉ niệm ngày đó ================= */
  function calInit() {
    if (S.cal) return;
    const d = new Date(S.checkins[0] ? S.checkins[0].visitedAt : Date.now());
    S.cal = { y: d.getFullYear(), m: d.getMonth(), day: null };
  }
  function calGo(y, m, day = null) {
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    S.cal = { y, m, day };
    renderDiary();
    $('#view-diary').scrollTop = 0;
  }
  /** Gom check-in và hành trình theo từng ngày. */
  function dayIndex() {
    const m = new Map();
    const at = t => { const k = dayKey(t); if (!m.has(k)) m.set(k, { t, cs: [], js: [] }); return m.get(k); };
    S.checkins.forEach(c => at(c.visitedAt).cs.push(c));
    S.journeys.forEach(j => at(j.startedAt).js.push(j));
    return m;
  }

  function renderCal(idx) {
    const { y, m, day } = S.cal;
    const prefix = `${y}-${pad(m + 1)}-`;
    const daysIn = new Date(y, m + 1, 0).getDate();
    const lead = (new Date(y, m, 1).getDay() + 6) % 7; // tuần bắt đầu từ thứ Hai
    const today = dayKey(Date.now());
    const cells = Array(lead).fill(0);
    for (let d = 1; d <= daysIn; d++) cells.push(d);
    while (cells.length % 7) cells.push(0);
    let rows = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    if (day) rows = rows.filter(r => r.includes(+day.slice(8))); // đã chọn ngày: chỉ giữ tuần chứa ngày đó

    const count = k => { const e = idx.get(k); return e ? (e.cs.length || (e.js.length ? 1 : 0)) : 0; };
    let maxN = 1, monthCs = [];
    for (let d = 1; d <= daysIn; d++) { const e = idx.get(prefix + pad(d)); if (e) { maxN = Math.max(maxN, count(prefix + pad(d))); monthCs = monthCs.concat(e.cs); } }
    const cell = d => {
      if (!d) return '<span class="cal-d off"></span>';
      const k = prefix + pad(d), n = count(k);
      return `<button type="button" class="cal-d ${n ? 'has' : ''} ${k === day ? 'sel' : ''} ${k === today ? 'today' : ''}" data-day="${k}"${n ? ` style="--a:${(0.16 + 0.5 * (n / maxN)).toFixed(2)}"` : ''} aria-label="Ngày ${d}${n ? `, ${n} kỉ niệm` : ''}"><b>${d}</b>${n ? `<i>${n}</i>` : ''}</button>`;
    };
    const sel = day ? new Date(`${day}T12:00:00`) : null;
    const title = sel ? `${WEEKDAYS[sel.getDay()]}, ${pad(sel.getDate())}/${pad(m + 1)}/${y}` : `Tháng ${m + 1}, ${y}`;
    const sum = monthCs.length
      ? `${monthCs.length} lần check-in · ${new Set(monthCs.map(rKey)).size} tỉnh thành · ${monthCs.reduce((a, c) => a + c.photoIds.length, 0)} ảnh`
      : 'Tháng này chưa có kỉ niệm';
    const isThisMonth = today.startsWith(prefix);
    $('#calBox').innerHTML = `
      <div class="cal-head">
        <button type="button" class="icon-btn" data-cal="prev" aria-label="Tháng trước">${icon('back')}</button>
        <button type="button" class="cal-title" data-cal="toggle" ${day ? 'aria-expanded="false"' : 'disabled'}>${title}${day ? icon('down') : ''}</button>
        <button type="button" class="icon-btn" data-cal="next" aria-label="Tháng sau">${icon('chevron')}</button>
      </div>
      <div class="cal-grid dow">${['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(x => `<span>${x}</span>`).join('')}</div>
      <div class="cal-grid">${rows.flat().map(cell).join('')}</div>
      <div class="cal-foot">
        <span>${day ? `Tháng ${m + 1}: ${sum}` : sum}</span>
        ${day ? '<button type="button" class="chip-btn" data-cal="toggle">Xem cả tháng</button>' : (isThisMonth ? '' : '<button type="button" class="chip-btn" data-cal="today">Hôm nay</button>')}
      </div>`;
  }

  function dayHtml(D) {
    const d = new Date(D.t);
    const regs = [...new Set(D.cs.map(rLabel).concat(D.js.map(j => { const r = jRegion(j); return r ? rLabel(r) : null; }).filter(Boolean)))];
    const cs = D.cs.slice().sort((a, b) => a.visitedAt - b.visitedAt);
    const js = D.js.slice().sort((a, b) => a.startedAt - b.startedAt);
    const dayTrips = [...new Set(cs.map(c => c.tripId).filter(Boolean))].map(tripById).filter(Boolean);
    return `
      <section class="day">
        <header class="day-head">
          <span class="dnum">${pad(d.getDate())}</span>
          <span class="dd"><strong>${WEEKDAYS[d.getDay()]}</strong><small>Tháng ${d.getMonth() + 1}, ${d.getFullYear()}</small></span>
          ${dayTrips.slice(0, 1).map(t => `<button type="button" class="badge trip" data-trip="${t.id}" style="--c:${tripColor(t)}">${esc(t.name)}</button>`).join('')}${regs.slice(0, dayTrips.length ? 1 : 2).map(r => `<span class="badge">${esc(r)}</span>`).join('')}
        </header>
        ${js.map(j => `<button type="button" class="jstrip" data-journey="${j.id}">
            <span class="thumb">${routeSvg(j, 54, 54)}</span>
            <span><span class="ttl">${esc(j.name)} ${j.status !== 'done' ? '<span class="badge">Đang ghi</span>' : ''}${j.demo ? ' <span class="badge beige">Mẫu</span>' : ''}</span>
              <span class="nums"><span>${icon('route')}${km(j.distance)}</span><span>${icon('clock')}${dur(elapsed(j))}</span><span>${icon('pin')}${jCheckins(j.id).length}</span></span></span>
            ${icon('chevron')}
          </button>`).join('')}
        ${cs.length ? `<div class="rail">${cs.map(c => {
          const cat = catOf(c);
          const ph = c.photoIds.slice(0, 3);
          const more = c.photoIds.length - 3;
          return `<div class="stop"><span class="time">${dTime(c.visitedAt)}</span>
            <button type="button" class="card mcard" data-ci="${c.id}">
              ${ph.length ? `<span class="photos">${ph.map((p, i) => `<span class="${i === 2 && more > 0 ? 'more' : ''}" data-more="+${more}"><img data-photo="${p}" alt=""></span>`).join('')}</span>` : ''}
              <span class="body">
                <span class="top">
                  <span class="cat">${cat.e}</span>
                  <span class="t"><span class="ttl">${esc(c.name)}</span><span class="sub">${cat.label}${c.price != null ? ' · ' + PRICES[c.price] : ''}${c.rating ? ' · ' + '♥'.repeat(c.rating) : ''}${c.demo ? ' · mẫu' : ''}</span></span>
                  ${c.mood ? `<span class="mood" title="${MOOD[c.mood].l}">${MOOD[c.mood].e}</span>` : ''}${avatar(c)}
                </span>
                ${c.memory ? `<span class="memo">${esc(c.memory)}</span>` : ''}
                ${c.feedback ? `<span class="fb">${esc(c.feedback)}</span>` : ''}
                ${c.draft ? `<span class="todo">${icon('edit')}Chưa bổ sung. Chạm để thêm tên, ảnh, cảm nhận.</span>` : ''}
              </span>
            </button></div>`;
        }).join('')}</div>` : ''}
      </section>`;
  }

  function renderDiary() {
    const album = S.diaryMode === 'album';
    $$('[data-diarymode]').forEach(b => b.classList.toggle('is-on', b.dataset.diarymode === S.diaryMode));
    $('#calBox').hidden = album;
    $('#diaryList').hidden = album;
    $('#albumBox').hidden = !album;
    if (album) { renderAlbum(); return; }
    calInit();
    const idx = dayIndex();
    renderCal(idx);
    const el = $('#diaryList');
    const { y, m, day } = S.cal;
    const prefix = `${y}-${pad(m + 1)}-`;
    if (!S.checkins.length && !S.journeys.length) {
      el.innerHTML = emptyState('book', 'Nhật ký còn trống', 'Mỗi lần check-in sẽ hiện ở đây theo từng ngày, có chấm trên lịch.', true);
      return;
    }
    const keys = [...idx.keys()].filter(k => (day ? k === day : k.startsWith(prefix))).sort().reverse();
    const addBtn = day ? `<button type="button" class="btn line" data-addday="${day}">${icon('plus')}Thêm kỉ niệm cho ngày này</button>` : '';
    if (!keys.length) {
      const all = [...idx.keys()].sort();
      const before = all.filter(k => k < prefix + '00').pop(), after = all.find(k => k > prefix + '99');
      const jump = k => { const d = new Date(`${k}T12:00:00`); return `<button type="button" class="btn soft sm" data-jump="${k}">Tháng ${d.getMonth() + 1}, ${d.getFullYear()}</button>`; };
      el.innerHTML = `<div class="empty-state">
        <span class="art">${icon('calendar')}</span>
        <h3>${day ? 'Ngày này chưa có kỉ niệm' : 'Tháng này chưa có kỉ niệm'}</h3>
        <p>${day ? 'Bạn có thể thêm lại một nơi đã đến vào ngày này.' : 'Chuyển tới tháng gần nhất có kỉ niệm:'}</p>
        <div class="row">${day ? addBtn : (before ? jump(before) : '') + (after ? jump(after) : '')}</div>
      </div>`;
      return;
    }
    el.innerHTML = keys.map(k => dayHtml(idx.get(k))).join('') + addBtn;
    hydratePhotos(el);
  }

  function addForDay(day) {
    S.pickDate = new Date(`${day}T12:00:00`).getTime();
    pickNew();
    toast('Đặt ghim vào nơi bạn đã đến hôm đó');
  }

  function openJourney(id) {
    const j = S.journeys.find(x => x.id === id);
    if (!j) return;
    const cs = jCheckins(id).sort((a, b) => a.visitedAt - b.visitedAt);
    const ms = elapsed(j);
    const speed = ms > 60000 ? (j.distance / 1000) / (ms / 3600000) : 0;
    const photos = cs.flatMap(c => c.photoIds);
    const reg = jRegion(j);
    openSheet(`
      <div class="sheet-head">
        <h2>${esc(j.name)}</h2>
        <button type="button" class="icon-btn" data-act="close" aria-label="Đóng">${icon('x')}</button>
      </div>
      <p class="foot-note left" style="margin-top:-10px">${reg ? esc(whereText(reg)) + ' · ' : ''}${WEEKDAYS[new Date(j.startedAt).getDay()]}, ${dDate(j.startedAt)} · ${dTime(j.startedAt)}${j.endedAt ? `–${dTime(j.endedAt)}` : ''}${j.demo ? ' · <span class="badge beige">Mẫu</span>' : ''}</p>
      <div class="jstats">
        <div><b>${km(j.distance)}</b><span>Quãng đường</span></div>
        <div><b>${dur(ms)}</b><span>Thời gian di chuyển</span></div>
        <div><b>${nf1.format(speed)} km/h</b><span>Tốc độ trung bình</span></div>
        <div><b>${nf.format(Math.round(j.distance / STRIDE_M))}</b><span>Bước chân (ước tính)</span></div>
      </div>
      ${j.note ? `<blockquote class="quote">${esc(j.note)}</blockquote>` : ''}
      ${photos.length ? `<p class="sec-label">Ảnh trong hành trình · ${photos.length}</p><div class="gallery">${photos.slice(0, 9).map((p, i) => `<button type="button" data-lb="${i}"><img data-photo="${p}" alt=""></button>`).join('')}</div>` : ''}
      <p class="sec-label">Điểm đã check-in · ${cs.length}</p>
      ${cs.length ? `<div class="mini-list">${cs.map((c, i) => `
        <button type="button" class="top-item" data-ci="${c.id}">
          <span class="rank">${i + 1}</span>
          <span class="t"><b>${esc(c.name)}</b><small>${catOf(c).e} ${dTime(c.visitedAt)}${c.rating ? ' · ' + '♥'.repeat(c.rating) : ''}</small></span>
          ${icon('chevron')}
        </button>`).join('')}</div>` : '<p class="foot-note left">Chưa check-in điểm nào trong hành trình này.</p>'}
    `, `
      <button type="button" class="btn ghost icon-only" data-act="del" aria-label="Xoá hành trình">${icon('trash')}</button>
      <button type="button" class="btn ghost" data-act="rename">${icon('edit')}Sửa</button>
      <button type="button" class="btn primary" data-act="map">${icon('map')}Xem lộ trình</button>
    `, 'journey');
    $('#sheetInner').onclick = e => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.ci) openDetail(b.dataset.ci);
      else if (b.dataset.lb != null) openLightbox(photos, +b.dataset.lb, i => photoCaption(photos[i]));
      else if (b.dataset.act === 'close') closeSheet();
    };
    $('#sheetFoot').onclick = async e => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'map') { closeSheet(); focusJourney(j.id); }
      else if (act === 'rename') editJourney(j);
      else if (act === 'del') {
        if (j.status !== 'done') { toast('Hãy kết thúc hành trình trước khi xoá'); return; }
        if (!(await ask('Xoá hành trình này?', 'Lộ trình sẽ bị xoá. Các check-in và ảnh vẫn được giữ lại.'))) return;
        closeSheet();
        await deleteJourney(j.id);
      }
    };
  }

  function editJourney(j) {
    openSheet(`
      <div class="sheet-head"><h2>Sửa hành trình</h2></div>
      <div class="field"><label for="jName">Tên hành trình</label><input class="input" id="jName" value="${esc(j.name)}" maxlength="80"></div>
      <div class="field"><label for="jNote">Cảm nhận</label><textarea class="input script" id="jNote" placeholder="Hôm nay mình đã…">${esc(j.note)}</textarea></div>
    `, `
      <button type="button" class="btn ghost" data-act="back">Huỷ</button>
      <button type="button" class="btn primary" data-act="save">Lưu</button>
    `, 'jedit');
    $('#sheetFoot').onclick = async e => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'save') {
        j.name = $('#jName').value.trim() || j.name;
        j.note = $('#jNote').value.trim();
        await saveRec('journeys', j);
        drawRoutes();
        bump();
        toast('Đã lưu');
        openJourney(j.id);
      } else if (act === 'back') openJourney(j.id);
    };
  }

  function focusJourney(id) {
    const j = S.journeys.find(x => x.id === id);
    if (!j) return;
    S.focusId = id;
    L_focus.clearLayers();
    const lines = segLines(j.points);
    const pts = j.points.map(p => [p[0], p[1]]).concat(jCheckins(id).map(c => [c.lat, c.lng]));
    if (lines.length) {
      L.polyline(lines, { color: '#fff', weight: 10, opacity: .9, lineCap: 'round', lineJoin: 'round' }).addTo(L_focus);
      L.polyline(lines, { color: '#C24E78', weight: 5, opacity: 1, lineCap: 'round', lineJoin: 'round' }).addTo(L_focus);
      const first = j.points[0], last = j.points[j.points.length - 1];
      L.circleMarker([first[0], first[1]], { radius: 7, color: '#fff', weight: 3, fillColor: '#5FA98A', fillOpacity: 1 }).bindTooltip('Xuất phát', { className: 'route-tip' }).addTo(L_focus);
      L.circleMarker([last[0], last[1]], { radius: 7, color: '#fff', weight: 3, fillColor: '#C24E78', fillOpacity: 1 }).bindTooltip('Kết thúc', { className: 'route-tip' }).addTo(L_focus);
    }
    $('#focusTitle').textContent = `${j.name} · ${km(j.distance)}`;
    $('#focusBanner').hidden = false;
    $('#view-map').classList.add('has-focus');
    go('map');
    S.follow = false;
    if (pts.length) map.fitBounds(L.latLngBounds(pts).pad(0.2), { maxZoom: 17, paddingTopLeft: L.point(16, 150), paddingBottomRight: padBR() });
  }
  function unfocus() {
    const hadTrip = !!S.focusTripId;
    S.focusId = null;
    S.focusTripId = null;
    L_focus.clearLayers();
    $('#focusBanner').hidden = true;
    $('#view-map').classList.remove('has-focus');
    if (hadTrip) drawTrail();
  }

  /* ================= Danh sách địa điểm: mở từ thẻ ở đáy bản đồ, theo vùng và bộ lọc đang xem ================= */
  function placeRow(p) {
    return `<button type="button" class="prow" data-ci="${p.latest.id}">
      <span class="th">${p.photoId ? `<img data-photo="${p.photoId}" alt="">` : catOf(p).e}</span>
      <span class="t">
        <span class="ttl">${esc(p.name)}</span>
        <span class="sub">${catOf(p).e} ${catOf(p).label}${p.price != null ? ' · ' + PRICES[p.price] : ''}${p.visits.length > 1 ? ` · ghé ${p.visits.length} lần` : ''}${p.demo ? ' · mẫu' : ''}</span>
        ${p.feedback ? `<span class="fb">${esc(p.feedback)}</span>` : (p.tags.length ? `<span class="fb">${esc(p.tags.slice(0, 3).join(' · '))}</span>` : '')}
      </span>
      ${p.rating ? `<span class="score">${p.rating}${icon('heart')}</span>` : ''}
    </button>`;
  }
  function openPlaceList() {
    const k = S.scopeKey || '';
    let list = shown(), title = 'Tất cả địa điểm';
    if (k.startsWith('region:')) { const l = list.filter(p => rKey(p) === k.slice(7)); if (l.length) { list = l; title = rLabel(l[0]); } }
    else if (k.startsWith('country:')) { const l = list.filter(p => cKey(p) === k.slice(8)); if (l.length) { list = l; title = cLabel(l[0]); } }
    const sorters = {
      recent: (a, b) => b.latest.visitedAt - a.latest.visitedAt,
      rating: (a, b) => b.rating - a.rating || b.visits.length - a.visits.length || b.latest.visitedAt - a.latest.visitedAt,
      name: (a, b) => a.name.localeCompare(b.name, 'vi')
    };
    const rows = () => {
      const sorted = list.slice().sort(sorters[S.placeSort]);
      const regs = [...groupBy(sorted, rKey)];
      if (regs.length < 2) return `<div class="rows">${sorted.map(placeRow).join('')}</div>`;
      return regs.sort((a, b) => b[1].length - a[1].length).map(([, l]) => `<p class="sec-label">${l[0].cc && l[0].cc !== 'VN' ? flagOf(l[0]) + ' ' : ''}${esc(rLabel(l[0]))} · ${l.length}</p><div class="rows">${l.map(placeRow).join('')}</div>`).join('');
    };
    openSheet(`
      <div class="sheet-head">
        <h2>${esc(title)}</h2>
        <button type="button" class="icon-btn" data-act="close" aria-label="Đóng">${icon('x')}</button>
      </div>
      <div class="chips scroll-x">${filterOpts().map(o => `<button type="button" class="chip ${S.filter === o.id ? 'is-on' : ''}" data-filter="${o.id}">${o.label}</button>`).join('')}</div>
      <div class="list-tools">
        <span class="foot-note left">${list.length} địa điểm${S.filter !== 'all' ? ' · đang lọc' : ''}</span>
        <label class="select"><span class="sr">Sắp xếp</span>
          <select id="plSort">
            <option value="recent"${S.placeSort === 'recent' ? ' selected' : ''}>Mới ghé nhất</option>
            <option value="rating"${S.placeSort === 'rating' ? ' selected' : ''}>Tim cao nhất</option>
            <option value="name"${S.placeSort === 'name' ? ' selected' : ''}>Tên A–Z</option>
          </select></label>
      </div>
      <div id="plRows" class="pl-rows">${rows()}</div>
    `, '', 'places');
    $('#plSort').onchange = e => { S.placeSort = e.target.value; $('#plRows').innerHTML = rows(); hydratePhotos($('#plRows')); };
    $('#sheetInner').onclick = e => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.ci) openDetail(b.dataset.ci);
      else if (b.dataset.filter) { S.filter = b.dataset.filter; bump(); openPlaceList(); }
      else if (b.dataset.act === 'close') closeSheet();
    };
  }

  /* ================= Cung đường: danh sách, tổng kết theo chặng, tạo/sửa ================= */
  const dayStart = k => new Date(`${k}T00:00:00`).getTime();
  const dayEnd = k => new Date(`${k}T23:59:59`).getTime();
  const dayGap = (a, b) => Math.round((dayStart(dayKey(b)) - dayStart(dayKey(a))) / 86400000);

  function tripSvg(t, w = 92, h = 92) {
    const color = tripColor(t);
    const stages = tripStages(t);
    const stops = tripCheckins(t.id).map(c => [c.lat, c.lng]);
    const thin = c => (c.length > 160 ? c.filter((_, i) => i % Math.ceil(c.length / 160) === 0 || i === c.length - 1) : c);
    const lines = stages.map(s => thin(s.route.coords)).filter(c => c.length > 1);
    const all = lines.flat().concat(stops);
    if (all.length < 2) return `<svg viewBox="0 0 ${w} ${h}"><circle cx="${w / 2}" cy="${h / 2}" r="5" fill="${color}"/></svg>`;
    const lat0 = all.reduce((a, p) => a + p[0], 0) / all.length;
    const k = Math.cos(lat0 * Math.PI / 180);
    const xs = all.map(p => p[1] * k), ys = all.map(p => -p[0]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const span = Math.max(maxX - minX, maxY - minY) || 1e-6;
    const padd = 12, s = (w - padd * 2) / span;
    const ox = padd + ((w - padd * 2) - (maxX - minX) * s) / 2, oy = padd + ((h - padd * 2) - (maxY - minY) * s) / 2;
    const P = p => [(ox + (p[1] * k - minX) * s).toFixed(1), (oy + (-p[0] - minY) * s).toFixed(1)];
    return `<svg viewBox="0 0 ${w} ${h}">
      ${lines.map(l => `<polyline points="${l.map(p => P(p).join(',')).join(' ')}" fill="none" stroke="${color}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>`).join('')}
      ${stops.map(p => { const [x, y] = P(p); return `<circle cx="${x}" cy="${y}" r="3.4" fill="#fff" stroke="${color}" stroke-width="2"/>`; }).join('')}
    </svg>`;
  }

  /** Gợi ý cung từ các check-in cũ chưa thuộc cung nào: những ngày liền nhau có từ 3 điểm trở lên. */
  function tripSuggestions() {
    const loose = chrono().filter(c => !c.tripId);
    const groups = [];
    let cur = null;
    for (const c of loose) {
      if (!cur || dayGap(cur[cur.length - 1].visitedAt, c.visitedAt) > 1) groups.push(cur = []);
      cur.push(c);
    }
    return groups.filter(g => g.length >= 3).slice(-3).reverse().map(g => {
      const regions = [...new Set(g.map(rLabel))];
      const d = new Date(g[0].visitedAt);
      return { from: g[0].visitedAt, to: g[g.length - 1].visitedAt, n: g.length, regions, name: `${regions.slice(0, 2).join(' – ')} ${d.getMonth() + 1}/${d.getFullYear()}` };
    });
  }

  function tripCard(t) {
    const st = tripStats(t);
    return `<button type="button" class="card tcard" data-trip="${t.id}">
      <span class="thumb">${tripSvg(t)}</span>
      <span class="meta">
        <span class="ttl">${esc(t.name)}${t.demo ? ' <span class="badge beige">Mẫu</span>' : ''}</span>
        <span class="date">${dateRange(st.from, st.to)}${st.regions.length ? ' · ' + esc(st.regions.slice(0, 3).join(' → ')) : ''}</span>
        <span class="nums">
          <span>${icon('route')}${kmText(st.dist, st.est)}</span>
          <span>${icon('calendar')}${st.days} chặng</span>
          <span>${icon('pin')}${st.cs.length}</span>
          <span>${icon('camera')}${st.photos}</span>
        </span>
      </span>
    </button>`;
  }

  function renderTrips() {
    const el = $('#tripsBody');
    const act = activeTrip();
    const done = S.trips.filter(t => t.endedAt).sort((a, b) => b.startedAt - a.startedAt);
    const sug = tripSuggestions();
    let html = '';
    if (act) {
      const st = tripStats(act);
      const dayN = Math.max(1, dayGap(act.startedAt, Date.now()) + 1);
      html += `<section class="card trip-live">
        <span class="lbl"><span class="rec-dot"></span>Đang đi · ngày ${dayN}</span>
        <h2>${esc(act.name)}</h2>
        <div class="bignums">
          <div><b>${kmNum(st.dist)}</b><span>km${st.est ? ' (ước tính)' : ''}</span></div>
          <div><b>${st.days}</b><span>chặng</span></div>
          <div><b>${st.cs.length}</b><span>điểm dừng</span></div>
          <div><b>${st.photos}</b><span>ảnh</span></div>
        </div>
        <div class="row">
          <button type="button" class="btn line" data-trip="${act.id}">Xem tổng kết</button>
          <button type="button" class="btn primary" data-act="endtrip">Kết thúc cung</button>
        </div>
        <p class="foot-note left">Mỗi lần bấm Check-in trên đường, điểm đó tự vào cung này.</p>
      </section>`;
    } else {
      html += `<button type="button" class="btn primary block" data-act="newtrip">${icon('plus')}Bắt đầu cung mới</button>`;
    }
    if (done.length) html += `<p class="sec-label">Các cung đã đi · ${done.length}</p>${done.map(tripCard).join('')}`;
    if (sug.length) {
      html += `<p class="sec-label">Gợi ý từ check-in cũ</p>${sug.map(g => `
        <div class="card sug">
          <span class="t"><b>${dateRange(g.from, g.to)} · ${esc(g.regions.slice(0, 2).join(', '))}</b><small>${g.n} điểm check-in chưa thuộc cung nào</small></span>
          <button type="button" class="btn soft sm" data-sug="${g.from}|${g.to}|${esc(g.name)}">Tạo cung</button>
        </div>`).join('')}`;
    }
    if (!S.trips.length && !sug.length) {
      html += emptyState('route', 'Chưa có cung nào', 'Bấm “Bắt đầu cung mới” trước khi lên đường. Mọi check-in sau đó tự vào cung, và bạn có bản tổng kết theo từng chặng.', true);
    }
    el.innerHTML = html;
  }

  /** Thanh nhỏ trên bản đồ khi đang đi một cung. */
  function renderTripBar() {
    const el = $('#tripBar');
    const t = activeTrip();
    el.hidden = !t || S.picking || S.view !== 'map' || !!S.replay;
    if (el.hidden) return;
    const st = tripStats(t);
    el.innerHTML = `
      <span class="rec-dot" style="background:${tripColor(t)}"></span>
      <span class="t">
        <span class="nums"><b>${kmNum(st.dist)}</b><span>km</span><b>${st.cs.length}</b><span>điểm</span><b>${st.days || 1}</b><span>chặng</span></span>
        <span class="nm">${esc(t.name)} · đang đi</span>
      </span>
      <button type="button" class="chip-btn" data-trip="${t.id}">Tổng kết</button>`;
  }

  /* --- trang tổng kết một cung --- */
  function openTrip(id, keepScroll = false) {
    const t = tripById(id);
    if (!t) return;
    const st = tripStats(t);
    const color = tripColor(t);
    const scroll = keepScroll ? $('#sheetInner').scrollTop : 0;
    const photos = st.cs.flatMap(c => c.photoIds);
    const best = st.cs.filter(c => c.rating >= 4).sort((a, b) => b.rating - a.rating || b.photoIds.length - a.photoIds.length).slice(0, 3);
    const stop = (c, k) => `<button type="button" class="top-item" data-ci="${c.id}">
        <span class="rank">${k + 1}</span>
        ${c.photoIds[0] ? `<img data-photo="${c.photoIds[0]}" alt="">` : `<span class="ph">${catOf(c).e}</span>`}
        <span class="t"><b>${esc(c.name)}</b><small>${dTime(c.visitedAt)} · ${catOf(c).label}${c.rating ? ' · ' + '♥'.repeat(c.rating) : ''}</small></span>
        ${avatar(c)}
      </button>`;
    const stageHtml = st.stages.map((s, i) => {
      const d = new Date(s.list[0].visitedAt);
      const legs = s.route.legs || [];
      const off = s.lead ? 1 : 0;
      return `<details class="stage" ${i === 0 || st.stages.length <= 3 ? 'open' : ''}>
        <summary>
          <span class="stage-no" style="--c:${color}">${s.n}</span>
          <span class="t"><b>Chặng ${s.n} · ${WEEKDAYS[d.getDay()]} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}</b><small>${esc(s.from.name)}${s.from !== s.to ? ' → ' + esc(s.to.name) : ''}</small></span>
          <span class="kmv">${kmText(s.dist, s.est)}</span>${icon('down')}
        </summary>
        <div class="stops">
          ${s.lead ? `<div class="leg">${icon('down')}từ ${esc(s.from.name)} · ${km(legs[0] || 0)}</div>` : ''}
          ${s.list.map((c, k) => `${k > 0 ? `<div class="leg">${icon('down')}${km(legs[k - 1 + off] || 0)}</div>` : ''}${stop(c, k)}`).join('')}
        </div>
      </details>`;
    }).join('');

    S.openTripId = id;
    openSheet(`
      ${photos.length ? `<div class="carousel">${photos.slice(0, 8).map((p, i) => `<button type="button" data-lb="${i}"><img data-photo="${p}" data-size="full" alt=""></button>`).join('')}</div>` : ''}
      <div class="sheet-head">
        <h2>${esc(t.name)}${t.demo ? ' <span class="badge beige">Mẫu</span>' : ''}</h2>
        <button type="button" class="icon-btn" data-tr="close" aria-label="Đóng">${icon('x')}</button>
      </div>
      <p class="foot-note left" style="margin-top:-10px">${dateRange(st.from, st.to)}${st.regions.length ? ' · ' + esc(st.regions.join(' → ')) : ''}${!t.endedAt ? ' · <span class="badge">Đang đi</span>' : ''}</p>
      <div class="bignums">
        <div><b>${kmNum(st.dist)}</b><span>km${st.est ? ' (ước tính)' : ''}</span></div>
        <div><b>${st.days}</b><span>chặng</span></div>
        <div><b>${st.cs.length}</b><span>điểm dừng</span></div>
        <div><b>${st.photos}</b><span>ảnh</span></div>
      </div>
      ${t.note ? `<blockquote class="quote">${esc(t.note)}</blockquote>` : ''}
      ${st.cs.length > 1 ? `<div class="actions-row">
        <button type="button" class="btn soft" data-tr="map">${icon('map')}Trên bản đồ</button>
        <button type="button" class="btn soft" data-tr="replay">${icon('play')}Phát lại</button>
      </div>` : ''}
      <p class="sec-label">Các chặng · ${st.stages.length}</p>
      ${stageHtml || '<p class="foot-note left">Chưa có điểm nào trong cung này. Bấm Check-in trên đường đi, điểm đó sẽ tự vào đây.</p>'}
      ${best.length ? `<p class="sec-label">Đáng nhớ nhất</p><div class="mini-list">${best.map(stop).join('')}</div>` : ''}
      ${st.est ? '<p class="foot-note left">Số km có dấu ≈ đang ước tính theo đường thẳng. App tự tính lại theo đường bộ khi có mạng.</p>' : ''}
    `, `
      <button type="button" class="btn ghost icon-only" data-tr="del" aria-label="Xoá cung">${icon('trash')}</button>
      <button type="button" class="btn ghost" data-tr="edit">${icon('edit')}Sửa</button>
      ${!t.endedAt ? '<button type="button" class="btn primary" data-tr="end">Kết thúc cung</button>' : ''}
    `, 'trip');
    if (scroll) $('#sheetInner').scrollTop = scroll;
    const onClick = async e => {
      const b = e.target.closest('button');
      if (!b) return;
      const a = b.dataset.tr;
      if (b.dataset.ci) openDetail(b.dataset.ci);
      else if (b.dataset.lb != null) openLightbox(photos, +b.dataset.lb, i => photoCaption(photos[i]));
      else if (a === 'close') closeSheet();
      else if (a === 'map') { closeSheet(); focusTrip(id); }
      else if (a === 'replay') { closeSheet(); startReplay(id); }
      else if (a === 'edit') openTripForm({ edit: id });
      else if (a === 'end') endTrip(id);
      else if (a === 'del') {
        if (!(await ask('Xoá cung này?', 'Chỉ xoá tên cung và bản tổng kết. Các check-in và ảnh vẫn được giữ lại.'))) return;
        closeSheet();
        await deleteTrip(id);
      }
    };
    $('#sheetInner').onclick = onClick;
    $('#sheetFoot').onclick = onClick;
  }

  /* --- tạo / sửa cung --- */
  function openTripForm(opt = {}) {
    const t = opt.edit ? tripById(opt.edit) : null;
    const fromK = t ? dayKey(t.startedAt) : dayKey(opt.from || Date.now());
    const toK = t ? (t.endedAt ? dayKey(t.endedAt) : '') : (opt.to ? dayKey(opt.to) : '');
    openSheet(`
      <div class="sheet-head"><h2>${t ? 'Sửa cung' : 'Cung mới'}</h2><button type="button" class="icon-btn" data-tf="close" aria-label="Đóng">${icon('x')}</button></div>
      <div class="field"><label for="tfName">Tên cung</label><input class="input" id="tfName" value="${esc(t ? t.name : opt.name || '')}" placeholder="VD: Cung Hà Giang tháng 11" maxlength="80" autocomplete="off"></div>
      <div class="two">
        <div class="field"><label for="tfFrom">Từ ngày</label><input class="input" type="date" id="tfFrom" value="${fromK}"></div>
        <div class="field"><label for="tfTo">Đến ngày</label><input class="input" type="date" id="tfTo" value="${toK}"></div>
      </div>
      <div class="field"><label for="tfNote">Cảm nhận về chuyến đi <span class="hint">· không bắt buộc</span></label><textarea class="input script" id="tfNote" placeholder="Chuyến này tụi mình…">${esc(t ? t.note || '' : '')}</textarea></div>
      <p class="foot-note left" id="tfInfo"></p>
      <p class="foot-note left bad" id="tfErr" hidden></p>
    `, `
      <button type="button" class="btn ghost" data-tf="close">Huỷ</button>
      <button type="button" class="btn primary" data-tf="save" id="tfSave"></button>
    `, 'tripform');
    const range = () => {
      const f = $('#tfFrom').value, to = $('#tfTo').value;
      return { ok: !!f && (!to || to >= f), from: f ? dayStart(f) : 0, to: to ? dayEnd(to) : null };
    };
    const info = () => {
      const r = range();
      const n = r.ok ? S.checkins.filter(c => (!c.tripId || (t && c.tripId === t.id)) && c.visitedAt >= r.from && c.visitedAt <= (r.to || Infinity)).length : 0;
      $('#tfInfo').textContent = !r.ok ? 'Ngày kết thúc phải sau ngày bắt đầu.'
        : r.to ? `${n} điểm check-in trong khoảng ngày này sẽ nằm trong cung.`
          : `Chưa chọn “Đến ngày” nghĩa là cung đang đi: từ giờ mỗi lần bấm Check-in, điểm đó tự vào cung này${n ? ` (đã có sẵn ${n} điểm)` : ''}.`;
      $('#tfSave').textContent = t ? 'Lưu' : (r.to ? 'Tạo cung' : 'Bắt đầu cung');
    };
    info();
    $('#tfFrom').onchange = info;
    $('#tfTo').onchange = info;
    const onClick = async e => {
      const a = e.target.closest('[data-tf]')?.dataset.tf;
      if (a === 'close') { if (t) openTrip(t.id); else closeSheet(); }
      else if (a === 'save') {
        const name = $('#tfName').value.trim();
        const r = range();
        const err = !name ? 'Hãy đặt tên cho cung.' : !r.ok ? 'Ngày kết thúc phải sau ngày bắt đầu.' : '';
        if (err) { const el = $('#tfErr'); el.textContent = err; el.hidden = false; if (!name) $('#tfName').focus(); return; }
        const id = await saveTrip(t, { name, startedAt: r.from, endedAt: r.to, note: $('#tfNote').value.trim() });
        toast(t ? 'Đã lưu cung' : (r.to ? 'Đã tạo cung' : 'Bắt đầu cung. Lên đường thôi!'));
        openTrip(id);
      }
    };
    $('#sheetInner').onclick = onClick;
    $('#sheetFoot').onclick = onClick;
  }

  async function saveTrip(t, fields) {
    const now = Date.now();
    const me = Sync.profile;
    if (!fields.endedAt) { // chỉ có một cung đang đi tại một thời điểm
      for (const o of S.trips) if (!o.endedAt && o !== t) { o.endedAt = now - 1; await saveRec('trips', o); }
    }
    const rec = t || { id: uid(), createdAt: now, by: me ? me.id : null, byName: me ? me.name : '' };
    Object.assign(rec, fields);
    const join = S.checkins.filter(c => !c.tripId && c.visitedAt >= rec.startedAt && c.visitedAt <= (rec.endedAt || Infinity));
    if (!t && join.length && join.every(c => c.demo)) rec.demo = true;
    await saveRec('trips', rec);
    if (!t) S.trips.push(rec);
    for (const c of join) {
      c.tripId = rec.id; c.updatedAt = now;
      await saveRec('checkins', c);
    }
    bump();
    return rec.id;
  }
  async function endTrip(id) {
    const t = tripById(id) || activeTrip();
    if (!t || t.endedAt) return;
    if (!(await ask('Kết thúc cung này?', 'Các check-in sau đó sẽ không vào cung nữa. Bạn vẫn sửa được tên, ngày và ghi chú.', 'Kết thúc', false))) return;
    t.endedAt = Date.now();
    await saveRec('trips', t);
    bump();
    toast('Đã kết thúc cung');
    openTrip(t.id);
  }
  async function deleteTrip(id) {
    for (const c of S.checkins) if (c.tripId === id) { c.tripId = null; c.updatedAt = Date.now(); await saveRec('checkins', c); }
    await delRec('trips', id);
    S.trips = S.trips.filter(t => t.id !== id);
    if (S.focusTripId === id) unfocus();
    bump();
    toast('Đã xoá cung');
  }

  /* ================= Album: tường ảnh theo tháng hoặc theo nơi ================= */
  function renderAlbum() {
    const el = $('#albumBody');
    $$('[data-albummode]').forEach(b => b.classList.toggle('is-on', b.dataset.albummode === S.albumMode));
    const withPhotos = S.checkins.filter(c => c.photoIds.length);
    if (!withPhotos.length) {
      el.innerHTML = emptyState('image', 'Album còn trống', 'Ảnh bạn thêm khi check-in sẽ được xếp thành album ở đây.', true);
      S.albumIds = [];
      return;
    }
    const monthKey = c => { const d = new Date(c.visitedAt); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
    const groups = S.albumMode === 'place'
      ? [...groupBy(withPhotos, rKey)].map(([, l]) => ({ title: rLabel(l[0]), sub: cLabel(l[0]), list: l })).sort((a, b) => b.list.length - a.list.length)
      : [...groupBy(withPhotos, monthKey)].sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([k, l]) => ({ title: `Tháng ${+k.slice(5)}, ${k.slice(0, 4)}`, sub: [...new Set(l.map(rLabel))].slice(0, 3).join(' · '), list: l }));
    const ids = [];
    el.innerHTML = groups.map(g => {
      const photos = g.list.flatMap(c => c.photoIds);
      const start = ids.length;
      ids.push(...photos);
      return `<section class="alb">
        <header><h2>${esc(g.title)}</h2><small>${photos.length} ảnh · ${esc(g.sub)}</small></header>
        <div class="alb-grid">${photos.map((p, i) => `<button type="button" data-lb="${start + i}" class="${i === 0 && photos.length >= 3 ? 'big' : ''}"><img data-photo="${p}" data-size="${i === 0 ? 'full' : 'thumb'}" alt=""></button>`).join('')}</div>
      </section>`;
    }).join('');
    S.albumIds = ids;
    hydratePhotos(el);
  }

  /* ================= Tổng kết: hộ chiếu tỉnh thành + số liệu ================= */
  function vnSvg(groups) {
    const minLng = 101.8, maxLat = 23.7, k = 0.96, s = 20;
    const W = (115.3 - minLng) * k * s, H = (maxLat - 7.9) * s;
    const X = lng => ((lng - minLng) * k * s).toFixed(1), Y = lat => ((maxLat - lat) * s).toFixed(1);
    const d = VN_SHAPE.map(poly => 'M' + poly.map(p => `${X(p[1])} ${Y(p[0])}`).join('L') + 'Z').join('');
    const isle = (pts, label, lx, ly) => pts.map(([la, ln]) => `<circle cx="${X(ln)}" cy="${Y(la)}" r="1.5" fill="#EC7FA2"/>`).join('')
      + `<text x="${X(lx)}" y="${Y(ly)}" font-size="8.5" font-weight="600" fill="#8E747B" text-anchor="middle">${label}</text>`;
    const dots = groups.map(([, l]) => {
      const [la, ln] = centroid(l);
      return `<circle cx="${X(ln)}" cy="${Y(la)}" r="${(7 + Math.sqrt(l.length) * 2.4).toFixed(1)}" fill="#EC7FA2" fill-opacity=".28"/><circle cx="${X(ln)}" cy="${Y(la)}" r="4.6" fill="#C24E78" stroke="#fff" stroke-width="1.6"/>`;
    }).join('');
    return `<svg viewBox="0 0 ${W.toFixed(0)} ${H.toFixed(0)}" role="img" aria-label="Bản đồ Việt Nam với các tỉnh thành đã đến">
      <path d="${d}" fill="#fff" fill-opacity=".8" stroke="#EC7FA2" stroke-width="1.3" stroke-linejoin="round"/>
      ${isle([[16.5, 111.6], [16.9, 112.3], [16.2, 112.0], [15.8, 111.3]], 'Hoàng Sa', 112.6, 15.1)}
      ${isle([[10.4, 114.3], [9.7, 113.7], [8.9, 113.3], [11.0, 114.6], [8.7, 112.0], [9.9, 114.6]], 'Trường Sa', 113.4, 7.6)}
      ${dots}
    </svg>`;
  }

  /* --- ai đăng: chữ cái đầu tên trong vòng tròn màu --- */
  const AV_COLORS = ['#C24E78', '#B08968', '#5FA98A', '#9C7BC0'];
  function avatarOf(id, name) {
    let h = 0;
    for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return `<span class="av" style="--c:${AV_COLORS[h % AV_COLORS.length]}" title="${esc(name)}">${esc((name || '?').trim().charAt(0).toUpperCase())}</span>`;
  }
  function authors() {
    if (S._authorsRev !== S.rev) { S._authors = new Set(S.checkins.map(c => c.by).filter(Boolean)); S._authorsRev = S.rev; }
    return S._authors;
  }
  const byName = c => Sync.nameOf(c.by, c.byName || '');
  function avatar(c) {
    if (!c.by || !(Sync.on || authors().size > 1)) return '';
    return avatarOf(c.by, byName(c) || '?');
  }

  function renderMe() {
    const el = $('#meBody');
    const J = S.journeys, C = S.checkins, P = places();
    if (!J.length && !C.length) {
      el.innerHTML = `
        <section class="card passport">
          <div class="l"><span class="lbl">Việt Nam của bạn</span><span class="big">0<small>/${Geo.UNITS.length}</small></span><span class="cap">tỉnh thành đã đặt chân</span>
            <button type="button" class="btn soft sm" data-act="demo">${icon('sparkle')}Xem thử dữ liệu mẫu</button></div>
          ${vnSvg([])}
        </section><div id="shareBox">${sharePanel()}</div>` + dataPanel();
      return;
    }
    const vn = P.filter(p => p.cc === 'VN');
    const vnGroups = [...groupBy(vn, rKey)];
    const visited = new Map(vnGroups.map(([, l]) => [l[0].province, l.length]));
    const countries = [...groupBy(P, cKey)].sort((a, b) => b[1].length - a[1].length);
    const dist = J.reduce((a, j) => a + j.distance, 0);
    const photos = C.reduce((a, c) => a + c.photoIds.length, 0);
    const days = new Set(C.map(c => dayKey(c.visitedAt)).concat(J.map(j => dayKey(j.startedAt)))).size;
    const first = chrono()[0];
    const since = first ? Math.max(0, Math.floor((Date.now() - first.visitedAt) / 86400000)) : 0;

    const byCat = CATS.map(c => ({ ...c, n: P.filter(x => x.cat === c.id).length })).filter(c => c.n).sort((a, b) => b.n - a.n);
    const maxCat = Math.max(1, ...byCat.map(c => c.n));
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); months.push({ y: d.getFullYear(), m: d.getMonth(), n: 0 }); }
    C.forEach(c => { const d = new Date(c.visitedAt); const mm = months.find(x => x.y === d.getFullYear() && x.m === d.getMonth()); if (mm) mm.n++; });
    const maxM = Math.max(1, ...months.map(m => m.n));
    const rated = P.filter(p => p.rating);
    const avg = rated.length ? rated.reduce((a, p) => a + p.rating, 0) / rated.length : 0;
    const top = rated.slice().sort((a, b) => b.rating - a.rating || b.visits.length - a.visits.length || b.photos - a.photos).slice(0, 3);
    const moodN = MOODS.map(m => ({ ...m, n: C.filter(c => c.mood === m.v).length }));
    const people = [...groupBy(C.filter(c => c.by), c => c.by)];

    const regionBlock = r => {
      const units = Geo.UNITS.filter(u => u.region === r);
      const n = units.filter(u => visited.has(u.name)).length;
      return `<h3><span>Miền ${r}</span><span>${n}/${units.length}</span></h3>
        <div class="chips">${units.map(u => visited.has(u.name)
          ? `<button type="button" class="stamp on" data-rk="VN|${esc(u.name)}">${esc(u.name)}<i>${visited.get(u.name)}</i></button>`
          : `<span class="stamp">${esc(u.name)}</span>`).join('')}</div>`;
    };

    el.innerHTML = `
      <section class="card passport">
        <div class="l">
          <span class="lbl">Việt Nam của ${people.length > 1 || Sync.on ? 'hai đứa' : 'bạn'}</span>
          <span class="big">${visited.size}<small>/${Geo.UNITS.length}</small></span>
          <span class="cap">tỉnh thành đã đặt chân</span>
          <div class="meter"><span style="width:${(visited.size / Geo.UNITS.length) * 100}%"></span></div>
          <span class="mini">${first ? `${nf.format(since)} ngày kể từ lần check-in đầu tiên (${dDate(first.visitedAt)})` : ''}</span>
          <button type="button" class="btn primary sm" data-act="home">${icon('vn')}Mở bản đồ chữ S</button>
        </div>
        ${vnSvg(vnGroups)}
      </section>

      <div class="bignums">
        <div><b>${P.length}</b><span>địa điểm</span></div>
        <div><b>${S.trips.length}</b><span>cung đường</span></div>
        <div><b>${photos}</b><span>ảnh</span></div>
        <div><b>${kmNum(S.trips.reduce((a, t) => a + tripStats(t).dist, 0))}</b><span>km các cung</span></div>
      </div>

      <div id="shareBox">${sharePanel()}</div>

      ${people.length > 1 ? `<section class="card panel">
        <h2>Ai check-in nhiều hơn?</h2>
        <div class="bars">${people.sort((a, b) => b[1].length - a[1].length).map(([id, l]) => `<div class="bar-row who"><span class="name">${avatarOf(id, byName(l[0]) || '?')}${esc(byName(l[0]) || 'Chưa rõ')}</span><span class="track"><span class="fill" style="width:${(l.length / C.length) * 100}%"></span></span><span class="n">${l.length}</span></div>`).join('')}</div>
      </section>` : ''}

      <section class="card panel stamps">
        <h2>Sổ đóng dấu <small>chạm dấu để mở bản đồ</small></h2>
        ${['Bắc', 'Trung', 'Nam'].map(regionBlock).join('')}
        ${countries.some(([ck]) => ck !== 'VN') ? `<h3><span>Nước ngoài</span><span>${countries.filter(([ck]) => ck !== 'VN').length}</span></h3>
          <div class="chips">${countries.filter(([ck]) => ck !== 'VN').map(([ck, l]) => `<button type="button" class="stamp on" data-cc="${esc(ck)}">${flagOf(l[0])} ${esc(cLabel(l[0]))}<i>${l.length}</i></button>`).join('')}</div>` : ''}
      </section>

      <section class="card panel">
        <h2>Check-in theo tháng <small>6 tháng gần đây</small></h2>
        <div class="cols">${months.map(m => `<button type="button" class="col" data-month="${m.y}-${m.m}"><div class="stack" style="height:100%"><span class="v ${m.n ? '' : 'zero'}" style="height:${m.n ? Math.max(6, (m.n / maxM) * 100) : 2}%"></span>${m.n ? `<span class="num" style="bottom:${Math.max(6, (m.n / maxM) * 100)}%">${m.n}</span>` : ''}</div><span class="m">T${m.m + 1}</span></button>`).join('')}</div>
        <p class="foot-note left">Chạm một cột để mở tháng đó trong Nhật ký.${dist ? ` Đã ghi ${kmNum(dist)} km đường đi bằng GPS.` : ''}</p>
      </section>

      ${byCat.length ? `<section class="card panel">
        <h2>Hay đi đâu nhất? <small>${rated.length ? `tim trung bình ${nf1.format(avg)}/5` : ''}</small></h2>
        <div class="bars">${byCat.map(c => `<div class="bar-row"><span class="name">${c.e} ${c.label}</span><span class="track"><span class="fill" style="width:${(c.n / maxCat) * 100}%"></span></span><span class="n">${c.n}</span></div>`).join('')}</div>
      </section>` : ''}

      ${top.length ? `<section class="card panel">
        <h2>Ba nơi thương nhất</h2>
        <div class="top-list">${top.map((p, i) => `
          <button type="button" class="top-item" data-ci="${p.latest.id}">
            <span class="rank">${i + 1}</span>
            ${p.photoId ? `<img data-photo="${p.photoId}" alt="">` : `<span class="ph">${catOf(p).e}</span>`}
            <span class="t"><b>${esc(p.name)}</b><small>${'♥'.repeat(p.rating)} · ${esc(rLabel(p))}${p.visits.length > 1 ? ` · ghé ${p.visits.length} lần` : ''}</small></span>
          </button>`).join('')}</div>
      </section>` : ''}

      ${moodN.some(m => m.n) ? `<section class="card panel">
        <h2>Tâm trạng trên đường</h2>
        <div class="moods">${moodN.map(m => `<div><span class="e">${m.e}</span><b>${m.n}</b><span>${m.l}</span></div>`).join('')}</div>
      </section>` : ''}

      ${dataPanel()}
    `;
    hydratePhotos(el);
  }

  /* ================= Dùng chung hai người ================= */
  const RULES = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /spaces/{space}/{coll}/{doc} {
      allow read, write: if space.size() >= 18;
    }
  }
}`;

  function sharePanel() {
    if (!Sync.on) {
      return `<section class="card panel share">
        <h2>Dùng chung hai người</h2>
        <p class="foot-note left">Cả hai cùng thấy và cùng thêm check-in, ảnh, kỉ niệm trên một bản đồ. Dữ liệu chung được lưu trong dự án Firebase miễn phí của bạn.</p>
        <div><button type="button" class="btn primary sm" data-act="share">${icon('heart')}Thiết lập dùng chung</button></div>
      </section>`;
    }
    const me = Sync.profile || {};
    const members = Object.entries(Sync.members);
    if (!members.some(([id]) => id === me.id) && me.id) members.unshift([me.id, { name: me.name }]);
    const bad = Sync.status === 'error';
    const status = bad ? 'Có lỗi' : Sync.status === 'connecting' ? 'Đang kết nối…' : Sync.pending ? `Đang gửi ${Sync.pending} thay đổi…` : 'Đã đồng bộ';
    return `<section class="card panel share">
      <h2>Dùng chung <small class="sync ${bad ? 'bad' : ''}"><i></i>${status}</small></h2>
      <div class="people">${members.map(([id, m]) => `<span class="person">${avatarOf(id, m.name)}${esc(m.name || 'Chưa đặt tên')}${id === me.id ? ' <em>(bạn)</em>' : ''}</span>`).join('')}</div>
      ${members.length < 2 ? '<p class="foot-note left">Chưa có ai khác. Gửi mã mời cho người ấy, rồi người ấy mở app, vào Tổng kết → Thiết lập dùng chung → Mình có mã mời.</p>' : ''}
      ${bad ? `<p class="foot-note left bad">${esc(Sync.error)}</p>` : ''}
      <div class="data-actions">
        <button type="button" class="btn primary sm" data-share="copy">Sao chép mã mời</button>
        <button type="button" class="btn line sm" data-act="share">Quản lý</button>
      </div>
    </section>`;
  }
  function refreshShare() {
    const box = $('#shareBox');
    if (box) box.innerHTML = sharePanel();
  }
  async function copyText(text, okMsg) {
    try { await navigator.clipboard.writeText(text); toast(okMsg); }
    catch { const t = $('#shCode'); if (t) { t.focus(); t.select(); toast('Hãy giữ vào ô mã và chọn Sao chép'); } else toast('Không sao chép được, hãy mở Quản lý để chép tay'); }
  }

  /** Check-in tạo trước khi bật dùng chung chưa có tên người đăng: ghi là của người đang dùng máy này. */
  async function claimMine() {
    const me = Sync.profile;
    if (!me) return;
    for (const c of await DB.all('checkins')) {
      if (c.by || c.demo) continue;
      c.by = me.id; c.byName = me.name; c.updatedAt = Date.now();
      await saveRec('checkins', c);
    }
  }

  function openShare(step) {
    const me = Sync.profile || {};
    const nameField = `<div class="field"><label for="shName">Tên của bạn <span class="hint">· hiện cạnh mỗi check-in bạn đăng</span></label><input class="input" id="shName" value="${esc(me.name || '')}" placeholder="VD: Dương" maxlength="30" autocomplete="off"></div>`;
    const head = (title, back) => `<div class="sheet-head">${back ? `<button type="button" class="icon-btn" data-sh="back" aria-label="Quay lại">${icon('back')}</button>` : ''}<h2>${title}</h2><button type="button" class="icon-btn" data-sh="close" aria-label="Đóng">${icon('x')}</button></div>`;
    const busy = (on, label) => { const b = $('#sheetFoot .btn.primary'); if (b) { b.disabled = on; b.textContent = on ? 'Đang kết nối…' : label; } };
    const finish = async (err, label) => {
      busy(false, label);
      if (err) { const e = $('#shErr'); e.textContent = err; e.hidden = false; e.scrollIntoView({ block: 'center' }); return; }
      await claimMine();
      await reloadData();
      toast('Đã bật dùng chung');
      openShare();
    };

    if (Sync.on) {
      openSheet(`
        ${head('Dùng chung')}
        ${nameField}
        <div class="field">
          <label for="shCode">Mã mời <span class="hint">· gửi cho người ấy qua Zalo, iMessage…</span></label>
          <textarea class="input code" id="shCode" readonly rows="4">${esc(Sync.inviteCode())}</textarea>
          <p class="foot-note left">Ai có mã này đều xem và sửa được dữ liệu chung, nên chỉ gửi cho đúng người.</p>
        </div>
        <div class="data-actions">
          <button type="button" class="btn primary sm" data-sh="copy">Sao chép mã mời</button>
          <button type="button" class="btn line sm" data-sh="retry">Đồng bộ lại</button>
        </div>
        <button type="button" class="btn ghost sm" data-sh="leave" style="color:var(--danger)">Ngừng dùng chung trên máy này</button>
      `, '', 'share');
      $('#shName').onchange = async e => { if (await Sync.setProfile(e.target.value)) { toast('Đã đổi tên'); bump(); } };
    } else if (step === 'create') {
      openSheet(`
        ${head('Tạo không gian chung', true)}
        ${nameField}
        <details class="more" open>
          <summary>Tạo Firebase (làm một lần, khoảng 10 phút)${icon('down')}</summary>
          <div class="in guide">
            <ol>
              <li>Mở <b>console.firebase.google.com</b>, đăng nhập Google, bấm <b>Create a project</b>. Đặt tên bất kỳ, tắt Google Analytics, bấm Create.</li>
              <li>Menu trái: <b>Build → Firestore Database → Create database</b>. Chọn vị trí gần Việt Nam (ví dụ asia-southeast1), chọn <b>production mode</b>, bấm Create.</li>
              <li>Vào thẻ <b>Rules</b>, xoá hết nội dung cũ, dán đoạn dưới đây rồi bấm <b>Publish</b>.</li>
            </ol>
            <textarea class="input code" id="shRules" readonly rows="8">${esc(RULES)}</textarea>
            <button type="button" class="btn line sm" data-sh="copyrules">Sao chép đoạn Rules</button>
            <ol start="4">
              <li>Bấm biểu tượng bánh răng → <b>Project settings</b>. Kéo xuống mục <b>Your apps</b>, bấm biểu tượng <b>&lt;/&gt;</b> (Web), đặt tên, bấm Register app.</li>
              <li>Sao chép cả đoạn <b>firebaseConfig = { … }</b> hiện ra và dán vào ô bên dưới.</li>
            </ol>
          </div>
        </details>
        <div class="field">
          <label for="shCfg">Đoạn firebaseConfig</label>
          <textarea class="input code" id="shCfg" rows="6" placeholder='const firebaseConfig = {&#10;  apiKey: "…",&#10;  projectId: "…",&#10;  appId: "…"&#10;};'></textarea>
        </div>
        <p class="foot-note left bad" id="shErr" hidden></p>
      `, `<button type="button" class="btn primary" data-sh="docreate">Tạo không gian chung</button>`, 'share');
    } else if (step === 'join') {
      openSheet(`
        ${head('Vào bằng mã mời', true)}
        ${nameField}
        <div class="field">
          <label for="shInv">Mã mời <span class="hint">· người ấy gửi cho bạn, bắt đầu bằng OJ1.</span></label>
          <textarea class="input code" id="shInv" rows="4" placeholder="OJ1.…"></textarea>
        </div>
        <p class="foot-note left">Các check-in đang có trên máy này sẽ được gộp vào không gian chung.</p>
        <p class="foot-note left bad" id="shErr" hidden></p>
      `, `<button type="button" class="btn primary" data-sh="dojoin">Tham gia</button>`, 'share');
    } else {
      openSheet(`
        ${head('Dùng chung hai người')}
        <p class="foot-note left">Hai máy cùng thấy một bản đồ, một nhật ký. Mỗi check-in ghi rõ ai đăng. Khi mất mạng app vẫn dùng được và tự gửi lên khi có mạng lại.</p>
        <div class="choice">
          <button type="button" data-sh="create"><span class="ic">${icon('plus')}</span><span class="t"><b>Mình tạo mới</b><small>Người đầu tiên: tạo Firebase rồi gửi mã mời cho người kia</small></span>${icon('chevron')}</button>
          <button type="button" data-sh="join"><span class="ic">${icon('heart')}</span><span class="t"><b>Mình có mã mời</b><small>Người thứ hai: dán mã mời là xong</small></span>${icon('chevron')}</button>
        </div>
      `, '', 'share');
    }

    const onClick = async e => {
      const b = e.target.closest('[data-sh]');
      if (!b) return;
      const a = b.dataset.sh;
      if (a === 'close') closeSheet();
      else if (a === 'back') openShare();
      else if (a === 'create' || a === 'join') openShare(a);
      else if (a === 'copy') copyText(Sync.inviteCode(), 'Đã sao chép mã mời');
      else if (a === 'copyrules') { try { await navigator.clipboard.writeText(RULES); toast('Đã sao chép đoạn Rules'); } catch { const t = $('#shRules'); t.focus(); t.select(); } }
      else if (a === 'retry') { await Sync.retry(); toast(Sync.status === 'error' ? Sync.error : 'Đang đồng bộ'); }
      else if (a === 'leave') {
        if (!(await ask('Ngừng dùng chung?', 'Máy này sẽ thôi nhận và gửi thay đổi. Dữ liệu đang có trên máy vẫn được giữ.', 'Ngừng', true))) return;
        await Sync.leave();
        closeSheet();
        bump();
        toast('Đã ngừng dùng chung trên máy này');
      } else if (a === 'docreate') { busy(true); finish(await Sync.create($('#shCfg').value, $('#shName').value), 'Tạo không gian chung'); }
      else if (a === 'dojoin') { busy(true); finish(await Sync.join($('#shInv').value, $('#shName').value), 'Tham gia'); }
    };
    $('#sheetInner').onclick = onClick;
    $('#sheetFoot').onclick = onClick;
  }

  function dataPanel() {
    const hasDemo = S.checkins.some(c => c.demo) || S.journeys.some(j => j.demo);
    return `
      <section class="card panel">
        <h2>Dữ liệu của bạn</h2>
        <p class="foot-note left">Mọi thứ được lưu ngay trên điện thoại này, không gửi lên máy chủ nào. Hãy sao lưu định kỳ để không mất kỉ niệm.</p>
        <div class="data-actions">
          <button type="button" class="btn line sm" data-act="export">${icon('download')}Sao lưu</button>
          <button type="button" class="btn line sm" data-act="import">${icon('upload')}Khôi phục</button>
          ${hasDemo
            ? `<button type="button" class="btn ghost sm" data-act="cleardemo">Xoá dữ liệu mẫu</button>`
            : `<button type="button" class="btn ghost sm" data-act="demo">${icon('sparkle')}Thêm dữ liệu mẫu</button>`}
          <button type="button" class="btn ghost sm" data-act="wipe" style="color:var(--danger)">${icon('trash')}Xoá tất cả</button>
        </div>
      </section>`;
  }

  function emptyState(ic, title, text, withDemo = false) {
    return `<div class="empty-state">
      <span class="art">${icon(ic)}</span>
      <h3>${title}</h3><p>${text}</p>
      ${withDemo && !S.checkins.length ? `<div class="row"><button type="button" class="btn soft sm" data-act="demo">${icon('sparkle')}Xem thử dữ liệu mẫu</button></div>` : ''}
    </div>`;
  }

  /* ================= Sao lưu ================= */
  const blobToData = b => new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b); });
  const dataToBlob = async u => (await fetch(u)).blob();

  async function exportData() {
    toast('Đang chuẩn bị bản sao lưu…');
    const photos = await DB.all('photos');
    const out = {
      app: 'our-journey', version: 3, exportedAt: new Date().toISOString(),
      journeys: await DB.all('journeys'), checkins: await DB.all('checkins'), trips: await DB.all('trips'),
      photos: await Promise.all(photos.map(async p => ({ id: p.id, checkinId: p.checkinId, createdAt: p.createdAt, demo: p.demo, blob: await blobToData(p.blob), thumb: await blobToData(p.thumb || p.blob) })))
    };
    const blob = new Blob([JSON.stringify(out)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `our-journey-${dayKey(Date.now())}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast('Đã tạo tệp sao lưu');
  }
  async function importData(file) {
    try {
      const data = JSON.parse(await file.text());
      if (!['dau-chan-hong', 'our-journey'].includes(data.app)) throw new Error('not ours');
      for (const p of data.photos || []) await saveRec('photos', { ...p, blob: await dataToBlob(p.blob), thumb: await dataToBlob(p.thumb) });
      for (const c of data.checkins || []) await saveRec('checkins', c);
      for (const t of data.trips || []) await saveRec('trips', t);
      for (const j of data.journeys || []) await saveRec('journeys', j.status === 'done' ? j : { ...j, status: 'done', resumedAt: null, endedAt: j.endedAt || Date.now() });
      await loadAll();
      backfillRegions();
      toast(`Đã khôi phục ${(data.checkins || []).length} check-in, ${(data.journeys || []).length} hành trình`);
    } catch {
      toast('Tệp này không phải bản sao lưu của Our Journey');
    }
  }
  async function addDemo() {
    toast('Đang thêm dữ liệu mẫu…');
    const d = await Demo.build(uid);
    for (const p of d.photos) await DB.put('photos', p);
    for (const c of d.checkins) await DB.put('checkins', c);
    for (const j of d.journeys) await DB.put('journeys', j);
    for (const t of d.trips || []) await DB.put('trips', t);
    S.cal = null;
    await loadAll();
    if (S.view === 'map') showS();
    toast('Đã thêm các chuyến đi mẫu dọc chữ S');
  }
  async function clearDemo() {
    for (const c of S.checkins.filter(c => c.demo)) {
      for (const p of c.photoIds) { await DB.del('photos', p); dropUrls(p); }
      await DB.del('checkins', c.id);
    }
    for (const j of S.journeys.filter(j => j.demo)) await DB.del('journeys', j.id);
    for (const t of S.trips.filter(t => t.demo)) await DB.del('trips', t.id);
    unfocus();
    await loadAll();
    toast('Đã xoá dữ liệu mẫu');
  }
  async function wipeAll() {
    if (!(await ask('Xoá toàn bộ dữ liệu?', 'Tất cả hành trình, check-in và ảnh sẽ bị xoá khỏi máy này. Nếu đang dùng chung, máy này sẽ ngừng dùng chung; dữ liệu trên máy người kia không bị xoá.', 'Xoá hết'))) return;
    if (Sync.on) await Sync.leave(); // chỉ xoá trên máy này, không xoá dữ liệu chung
    stopReplay();
    hideQuick();
    if (S.active) { stopWatch(); wake(false); S.active = null; }
    S.cal = null;
    unfocus();
    await Promise.all(['journeys', 'checkins', 'photos', 'trips'].map(s => DB.clear(s)));
    urlCache.forEach(u => URL.revokeObjectURL(u));
    urlCache.clear();
    unfocus();
    await loadAll();
    toast('Đã xoá toàn bộ dữ liệu');
  }

  /* ================= Tìm kiếm trên bản đồ ================= */
  async function search(q) {
    const box = $('#searchResults');
    q = q.trim();
    if (!q) { box.hidden = true; return; }
    const local = places().filter(p => [p.name, p.province].join(' ').toLowerCase().includes(q.toLowerCase())).slice(0, 4);
    const renderLocal = () => local.map(p => `<li><button type="button" data-place="${p.latest.id}"><b>${catOf(p).e} ${esc(p.name)}</b><small>Đã check-in · ${esc(rLabel(p))} · ${dDate(p.latest.visitedAt)}</small></button></li>`).join('');
    box.hidden = false;
    box.innerHTML = renderLocal() + '<li class="empty">Đang tìm trên bản đồ…</li>';
    let remote;
    try {
      const c = map.getCenter();
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(q)}&accept-language=vi&limit=8&viewbox=${c.lng - 0.5},${c.lat + 0.5},${c.lng + 0.5},${c.lat - 0.5}&bounded=0`);
      remote = res.ok ? await res.json() : [];
    } catch { remote = null; }
    box.innerHTML = renderLocal() + (remote === null
      ? '<li class="empty">Không kết nối được dịch vụ tìm kiếm.</li>'
      : remote.length
        ? remote.map(r => `<li><button type="button" data-lat="${r.lat}" data-lng="${r.lon}" data-name="${esc(r.name || r.display_name.split(',')[0])}" data-addr="${esc(r.display_name)}"><b>${esc(r.name || r.display_name.split(',')[0])}</b><small>${esc(r.display_name)}</small></button></li>`).join('')
        : (local.length ? '' : '<li class="empty">Không tìm thấy địa điểm phù hợp.</li>'));
  }
  function clearTemp() { if (tempMarker) { map.removeLayer(tempMarker); tempMarker = null; } }
  function showSearchResult(lat, lng, name, addr) {
    $('#searchResults').hidden = true;
    clearTemp();
    const el = document.createElement('div');
    el.className = 'pop';
    el.innerHTML = `<b>${esc(name)}</b><small>${esc(addr.split(',').slice(1, 4).join(','))}</small><br><button type="button">＋ Check-in tại đây</button>`;
    el.querySelector('button').onclick = () => {
      clearTemp();
      openCheckinForm({ lat, lng, name, address: addr.split(',').slice(0, 2).join(','), fromMap: true });
    };
    tempMarker = L.marker([lat, lng], { icon: L.divIcon({ className: 'mk', html: '<div class="pin"><span>🔎</span></div>', iconSize: [36, 36], iconAnchor: [18, 45], popupAnchor: [0, -42] }), zIndexOffset: 900 })
      .addTo(map).bindPopup(el, { closeButton: false });
    S.follow = false;
    map.flyTo(offsetCenter([lat, lng], 17), 17, { duration: .8 });
    setTimeout(() => tempMarker && tempMarker.openPopup(), 900);
  }

  /* ================= Điều hướng & vẽ lại ================= */
  function go(view) {
    closeMenu();
    S.view = view;
    $$('.view').forEach(v => v.classList.toggle('is-active', v.dataset.view === view));
    $$('.tab[data-go]').forEach(t => t.classList.toggle('is-on', t.dataset.go === view));
    if (view !== 'map') stopReplay();
    if (view === 'map') { map.invalidateSize(); renderScope(); }
    renderTripBar();
    renderRec();
    renderView();
  }
  function renderView() {
    if (S.view === 'diary') renderDiary();
    else if (S.view === 'trips') renderTrips();
    else if (S.view === 'me') renderMe();
  }
  /** Dữ liệu vừa đổi: tính lại danh sách địa điểm và vẽ lại mọi thứ đang hiển thị. */
  function bump() {
    S.rev++;
    S._places = null;
    S._stages = null;
    renderFilters();
    renderTripBar();
    drawPins();
    drawTrail();
    renderScope();
    renderRec();
    renderView();
  }

  async function loadAll() {
    S.journeys = (await DB.all('journeys')).sort((a, b) => b.startedAt - a.startedAt);
    S.trips = await DB.all('trips');
    S.checkins = (await DB.all('checkins')).sort((a, b) => b.visitedAt - a.visitedAt);
    S.checkins.forEach(c => { c.tags = c.tags || []; c.photoIds = c.photoIds || []; c.name = c.name || 'Điểm check-in'; });
    const live = S.journeys.find(j => j.status !== 'done');
    if (live && !S.active) {
      // Mở lại app giữa chừng: khôi phục ở trạng thái tạm dừng để không ghi nhầm khoảng trống.
      if (live.status === 'active') {
        const lastT = live.points.length ? live.points[live.points.length - 1][2] : live.resumedAt;
        live.activeMs += Math.max(0, (lastT || 0) - (live.resumedAt || lastT || 0));
        live.status = 'paused'; live.resumedAt = null;
        await DB.put('journeys', live);
      }
      S.active = live;
      toast('Hành trình đang dở. Bấm ▶ để ghi tiếp.');
    } else if (S.active) {
      S.active = S.journeys.find(j => j.id === S.active.id) || null;
    }
    drawRoutes();
    drawActive();
    bump();
  }

  function onboarding() {
    DB.setMeta('onboarded', true).catch(() => {});
    const li = (ic, t, s) => `<li><span class="ic">${icon(ic)}</span><span><b>${t}</b>${s}</span></li>`;
    openSheet(`
      <div class="onboard">
        <img class="logo" src="icons/icon.svg" alt="">
        <h2>Our Journey</h2>
        <p>Bản đồ chữ S của hai đứa. Mỗi nơi đã đến là một chiếc ghim.</p>
        <ul>
          ${li('plus', 'Một chạm là check-in', 'Bấm nút Check-in để lưu ngay chỗ đang đứng. Tên, ảnh, cảm nhận bổ sung sau.')}
          ${li('route', 'Cung đường', 'Đặt tên cho mỗi chuyến phượt. App nối các điểm theo đường thật và tổng kết từng chặng.')}
          ${li('calendar', 'Nhật ký', 'Lịch tháng có chấm ở những ngày có kỉ niệm, kèm album ảnh.')}
          ${li('heart', 'Dùng chung', 'Hai người cùng thấy và cùng thêm trên một bản đồ.')}
        </ul>
      </div>
    `, `
      <button type="button" class="btn ghost" data-act="demo">Xem thử dữ liệu mẫu</button>
      <button type="button" class="btn primary" data-act="go">Bắt đầu</button>
    `, 'onboard');
    $('#sheetFoot').onclick = async e => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (!act) return;
      closeSheet();
      if (act === 'demo') await addDemo();
    };
  }

  /* ================= Gắn sự kiện ================= */
  function bind() {
    $$('.tab[data-go]').forEach(t => t.onclick = () => go(t.dataset.go));
    $('#btnAdd').onclick = quickCheckin;
    $('#scrim').onclick = dismissSheet;
    window.addEventListener('popstate', () => {
      if (S.ignorePop > 0) { S.ignorePop--; return; }
      if (!$('#lightbox').hidden) { $('#lightbox').hidden = true; if (S.sheetOpen) history.pushState({ sheet: 1 }, ''); return; }
      if (S.sheetOpen) { if (S.sheetKind === 'form') S.draft = null; closeSheet(true); }
      S.sheetHist = false;
    });

    // Thẻ check-in nhanh
    $('#quickCard').onclick = e => { const b = e.target.closest('[data-q],[data-q-rate]'); if (b) quickAct(b); };
    $('#quickFile').onchange = e => { const files = [...e.target.files]; e.target.value = ''; quickPhotos(files); };

    // Bản đồ
    $('#recBar').onclick = e => { const b = e.target.closest('[data-act]'); if (b) doAct(b.dataset.act); };
    $('#scopeCard').onclick = e => {
      const b = e.target.closest('button');
      if (!b || b.disabled) return;
      if (b.dataset.rk) flyRegion(b.dataset.rk);
      else if (b.dataset.cc) flyCountry(b.dataset.cc);
      else if (b.dataset.place) { const p = placeOf(b.dataset.place); if (p) flyPlace(p); }
      else if (b.dataset.act) doAct(b.dataset.act);
    };
    $('#mapFilters').onclick = e => { const b = e.target.closest('[data-filter]'); if (b) { S.filter = b.dataset.filter; bump(); } };
    $('#btnHome').onclick = () => showS();
    $('#btnLocate').onclick = () => { S.follow = true; $('#btnLocate').classList.add('is-on'); locateOnce(true); };
    $('#btnLayers').onclick = () => ($('#layerMenu').hidden ? openMenu() : closeMenu());
    $('#layerMenu').onclick = e => {
      const b = e.target.closest('button');
      if (!b) return;
      closeMenu();
      if (b.dataset.tile) { setTile(b.dataset.tile); DB.setMeta('tile', S.tile).catch(() => {}); }
      else doAct(b.dataset.act);
    };
    $('#focusClose').onclick = unfocus;
    $('#replayStop').onclick = stopReplay;
    $('#pickOk').onclick = () => endPick(true);
    $('#pickCancel').onclick = () => endPick(false);

    const si = $('#searchInput');
    $('#searchForm').onsubmit = e => { e.preventDefault(); si.blur(); search(si.value); };
    si.oninput = () => { $('#searchClear').hidden = !si.value; if (!si.value) $('#searchResults').hidden = true; };
    $('#searchClear').onclick = () => { si.value = ''; $('#searchClear').hidden = true; $('#searchResults').hidden = true; clearTemp(); };
    $('#searchResults').onclick = e => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.place) { $('#searchResults').hidden = true; const p = placeOf(b.dataset.place); if (p) flyPlace(p); }
      else showSearchResult(+b.dataset.lat, +b.dataset.lng, b.dataset.name, b.dataset.addr);
    };

    // Nhật ký: lịch
    const cal = $('#calBox');
    cal.onclick = e => {
      const b = e.target.closest('button');
      if (!b || b.disabled) return;
      const c = S.cal;
      if (b.dataset.day) calGo(c.y, c.m, c.day === b.dataset.day ? null : b.dataset.day);
      else if (b.dataset.cal === 'prev') calGo(c.y, c.m - 1);
      else if (b.dataset.cal === 'next') calGo(c.y, c.m + 1);
      else if (b.dataset.cal === 'toggle') calGo(c.y, c.m);
      else if (b.dataset.cal === 'today') { const d = new Date(); calGo(d.getFullYear(), d.getMonth()); }
    };
    let sx = null;
    cal.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true });
    cal.addEventListener('touchend', e => {
      if (sx === null) return;
      const dx = e.changedTouches[0].clientX - sx;
      sx = null;
      if (Math.abs(dx) > 60) calGo(S.cal.y, S.cal.m + (dx < 0 ? 1 : -1));
    }, { passive: true });
    $('#diaryList').onclick = e => {
      const b = e.target.closest('[data-trip],[data-ci],[data-journey],[data-addday],[data-jump]');
      if (!b) return;
      if (b.dataset.trip) openTrip(b.dataset.trip);
      else if (b.dataset.ci) openDetail(b.dataset.ci);
      else if (b.dataset.journey) openJourney(b.dataset.journey);
      else if (b.dataset.addday) addForDay(b.dataset.addday);
      else if (b.dataset.jump) { const d = new Date(`${b.dataset.jump}T12:00:00`); calGo(d.getFullYear(), d.getMonth()); }
    };

    // Album
    $('#albumBody').onclick = e => {
      const b = e.target.closest('[data-lb]');
      if (b) openLightbox(S.albumIds, +b.dataset.lb, i => photoCaption(S.albumIds[i]));
    };
    $$('[data-albummode]').forEach(b => b.onclick = () => { S.albumMode = b.dataset.albummode; renderAlbum(); });
    $$('[data-diarymode]').forEach(b => b.onclick = () => { S.diaryMode = b.dataset.diarymode; renderDiary(); });

    // Cung đường
    $('#tripsBody').onclick = e => {
      const b = e.target.closest('[data-trip],[data-sug]');
      if (!b) return;
      if (b.dataset.trip) openTrip(b.dataset.trip);
      else { const [from, to, name] = b.dataset.sug.split('|'); openTripForm({ from: +from, to: +to, name }); }
    };
    $('#tripBar').onclick = e => { const b = e.target.closest('[data-trip]'); if (b) openTrip(b.dataset.trip); };
    $('#focusTitle').onclick = () => { if (S.focusTripId) openTrip(S.focusTripId); };

    // Tổng kết
    $('#meBody').onclick = e => {
      const b = e.target.closest('[data-ci],[data-rk],[data-cc],[data-month],[data-share]');
      if (!b) return;
      if (b.dataset.ci) openDetail(b.dataset.ci);
      else if (b.dataset.rk) { go('map'); flyRegion(b.dataset.rk); }
      else if (b.dataset.cc) { go('map'); flyCountry(b.dataset.cc); }
      else if (b.dataset.month) { const [y, m] = b.dataset.month.split('-').map(Number); S.cal = { y, m, day: null }; go('diary'); }
      else if (b.dataset.share === 'copy') copyText(Sync.inviteCode(), 'Đã sao chép mã mời');
    };

    // Các nút hành động chung nằm trong trang (dữ liệu mẫu, sao lưu, dùng chung…)
    document.addEventListener('click', e => {
      const b = e.target.closest('.page [data-act]');
      if (b) doAct(b.dataset.act);
    });
    $('#fileImport').onchange = e => { const f = e.target.files[0]; if (f) importData(f); e.target.value = ''; };

    $('#lbClose').onclick = () => { $('#lightbox').hidden = true; };
    $('#lbCap').onclick = () => {
      const pid = S.lb && S.lb.ids[S.lb.i];
      const c = pid && S.checkins.find(x => x.photoIds.includes(pid));
      if (c) { $('#lightbox').hidden = true; openDetail(c.id); }
    };
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      if (!$('#lightbox').hidden) $('#lightbox').hidden = true;
      else if (!$('#layerMenu').hidden) closeMenu();
      else if (S.sheetOpen) dismissSheet();
      else if (S.replay) stopReplay();
    });

    setInterval(() => { if (S.active?.status === 'active' && S.view === 'map') renderRec(); }, 1000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && S.active?.status === 'active') wake(true);
      if (document.visibilityState === 'hidden') saveActive();
    });
    window.addEventListener('pagehide', saveActive);
    window.addEventListener('resize', () => map && map.invalidateSize());
  }

  /* ================= Khởi động ================= */
  /** Người kia vừa thêm/sửa gì đó: nạp lại từ bộ nhớ máy và vẽ lại. */
  async function reloadData() {
    try { await loadAll(); } catch { /* bỏ qua */ }
  }

  async function init() {
    hydrateIcons();
    $('#vnUnits').innerHTML = Geo.UNITS.map(u => `<option value="${esc(u.name)}">`).join('');
    initMap();
    bind();
    try {
      await DB.open();
      const tile = await DB.getMeta('tile', 'voyager');
      if (tile !== S.tile) setTile(tile);
      S.trail = await DB.getMeta('trail', true);
      (await DB.all('routes')).forEach(r => routes.set(r.key, r)); // đường đi đã tính từ trước
      await Sync.init({ onChange: reloadData, onStatus: refreshShare });
      await loadAll();
    } catch {
      toast('Trình duyệt chặn bộ nhớ cục bộ, dữ liệu sẽ không được lưu.');
      bump();
    }
    showS(false);
    let onboarded = false;
    try { onboarded = await DB.getMeta('onboarded', false); } catch { /* bỏ qua */ }
    if (!onboarded) onboarding();
    else if (navigator.permissions) {
      try {
        const p = await navigator.permissions.query({ name: 'geolocation' });
        if (p.state === 'granted') locateOnce(false);
      } catch { /* bỏ qua */ }
    }
    backfillRegions();
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  init();
})();
