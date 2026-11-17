/* Dùng chung hai người: đồng bộ check-in, hành trình và ảnh qua Firebase (Cloud Firestore).
   Dữ liệu vẫn nằm trong máy (IndexedDB) để dùng được khi mất mạng; phần này chỉ đẩy thay đổi lên
   và nhận thay đổi của người kia về. Mỗi "không gian chung" là một mã bí mật: ai có mã mời thì vào được. */
const Sync = (() => {
  const STORES = ['checkins', 'journeys', 'photos'];
  const MAX_PHOTO = 900000;   // giới hạn một tài liệu Firestore là 1 MiB
  const MAX_THUMB = 110000;
  const st = {
    cfg: null, space: null, lastTs: {}, dirty: {},
    profile: null, members: {}, backend: null, unsubs: [], inflight: new Set(),
    status: 'off', error: '', lastSyncAt: 0, onChange: null, onStatus: null
  };

  /* ---------- trạng thái lưu trên máy ---------- */
  let saveTimer;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => DB.setMeta('sync', { cfg: st.cfg, space: st.space, lastTs: st.lastTs, dirty: st.dirty }).catch(() => {}), 150);
  }
  const notify = () => st.onStatus && st.onStatus();
  let changeTimer;
  const changed = () => { clearTimeout(changeTimer); changeTimer = setTimeout(() => st.onChange && st.onChange(), 250); };
  function setStatus(s, error = '') { st.status = s; st.error = error; notify(); }

  /* ---------- mã mời & cấu hình ---------- */
  const b64u = {
    enc: s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
    dec: s => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))))
  };
  /** Đọc đoạn firebaseConfig dán từ Firebase console (dạng JS hoặc JSON). */
  function parseConfig(text) {
    const get = k => { const m = String(text).match(new RegExp(`["']?${k}["']?\\s*[:=]\\s*["']([^"']+)["']`)); return m ? m[1].trim() : ''; };
    const cfg = { apiKey: get('apiKey'), projectId: get('projectId'), appId: get('appId') };
    return cfg.apiKey && cfg.projectId ? cfg : null;
  }
  const inviteCode = () => (st.cfg && st.space ? 'OJ1.' + b64u.enc(JSON.stringify({ k: st.cfg.apiKey, p: st.cfg.projectId, a: st.cfg.appId, s: st.space })) : '');
  function parseInvite(code) {
    try {
      const m = String(code).trim().match(/OJ1\.([A-Za-z0-9_-]+)/);
      const o = JSON.parse(b64u.dec(m[1]));
      if (!o.k || !o.p || !o.s) return null;
      return { cfg: { apiKey: o.k, projectId: o.p, appId: o.a || '' }, space: o.s };
    } catch { return null; }
  }
  function newSpaceId() {
    const a = new Uint8Array(18);
    crypto.getRandomValues(a);
    return [...a].map(x => 'abcdefghijkmnpqrstuvwxyz23456789'[x % 32]).join('');
  }

  /* ---------- kết nối Firestore ---------- */
  function loadScript(src) {
    return new Promise((res, rej) => {
      if (document.querySelector(`script[data-src="${src}"]`)) return res();
      const s = document.createElement('script');
      s.src = src; s.dataset.src = src;
      s.onload = res;
      s.onerror = () => { s.remove(); rej(new Error('Không tải được thư viện Firebase')); };
      document.head.appendChild(s);
    });
  }
  async function firestoreBackend(cfg, space) {
    await loadScript('vendor/firebase/firebase-app-compat.js');
    await loadScript('vendor/firebase/firebase-firestore-compat.js');
    const fb = window.firebase;
    const app = fb.initializeApp({ apiKey: cfg.apiKey, projectId: cfg.projectId, appId: cfg.appId, authDomain: `${cfg.projectId}.firebaseapp.com` }, 'oj-' + Date.now());
    const fs = app.firestore();
    const F = fb.firestore;
    const col = c => fs.collection('spaces').doc(space).collection(c);
    const enc = d => {
      const o = {};
      for (const k in d) { const v = d[k]; if (v === undefined) continue; o[k] = v instanceof Uint8Array ? F.Blob.fromUint8Array(v) : v; }
      o.ts = F.FieldValue.serverTimestamp();
      return o;
    };
    const dec = d => {
      const o = {};
      for (const k in d) { if (k === 'ts') continue; const v = d[k]; o[k] = v && typeof v.toUint8Array === 'function' ? v.toUint8Array() : v; }
      return o;
    };
    return {
      set: (c, id, data) => col(c).doc(id).set(enc(data)),
      listen: (c, since, onDoc, onErr) => col(c).where('ts', '>', F.Timestamp.fromMillis(since || 0)).orderBy('ts')
        .onSnapshot(snap => snap.docChanges().forEach(ch => {
          if (ch.type === 'removed' || ch.doc.metadata.hasPendingWrites) return;
          const d = ch.doc.data();
          if (d.ts && d.ts.toMillis) onDoc(ch.doc.id, dec(d), d.ts.toMillis());
        }), onErr),
      close: () => app.delete().catch(() => {})
    };
  }

  /* ---------- đóng gói bản ghi ---------- */
  const clean = o => JSON.parse(JSON.stringify(o));
  const toBytes = async blob => new Uint8Array(await blob.arrayBuffer());
  function decode(blob) {
    return new Promise((res, rej) => {
      const u = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(u); res(img); };
      img.onerror = () => { URL.revokeObjectURL(u); rej(new Error('decode')); };
      img.src = u;
    });
  }
  /** Nén lại ảnh cho vừa giới hạn; trả về null nếu trình duyệt không đọc được ảnh. */
  async function shrink(blob, max, sizes) {
    if (!blob) return null;
    if (blob.size <= max) return blob;
    let img;
    try { img = await decode(blob); } catch { return null; }
    for (const [dim, q] of sizes) {
      const r = Math.min(1, dim / Math.max(img.naturalWidth, img.naturalHeight));
      const cv = document.createElement('canvas');
      cv.width = Math.round(img.naturalWidth * r); cv.height = Math.round(img.naturalHeight * r);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      const out = await new Promise(r2 => cv.toBlob(r2, 'image/jpeg', q));
      if (out && out.size <= max) return out;
    }
    return null;
  }
  async function pack(store, rec) {
    if (store === 'journeys') {
      const { points, ...r } = rec;
      let pts = points || [];
      while (JSON.stringify(pts).length > 900000) pts = pts.filter((_, i) => i % 2 === 0); // lộ trình quá dài: bỏ bớt điểm
      return clean({ ...r, pts: JSON.stringify(pts), updatedAt: rec.updatedAt || rec.endedAt || rec.startedAt || 0 });
    }
    if (store === 'photos') {
      const full = await shrink(rec.blob, MAX_PHOTO, [[1600, .75], [1280, .72], [1024, .7], [800, .65]]);
      const thumb = await shrink(rec.thumb || rec.blob, MAX_THUMB, [[420, .75], [320, .7], [240, .6]]);
      if (!full || !thumb) return null;
      return { checkinId: rec.checkinId, createdAt: rec.createdAt || 0, updatedAt: rec.createdAt || 0, blob: await toBytes(full), thumb: await toBytes(thumb) };
    }
    return clean(rec);
  }
  function unpack(store, id, d) {
    if (store === 'journeys') {
      const { pts, ...r } = d;
      let points = [];
      try { points = JSON.parse(pts || '[]'); } catch { /* bỏ qua */ }
      return { ...r, id, points };
    }
    if (store === 'photos') {
      return { id, checkinId: d.checkinId, createdAt: d.createdAt, blob: new Blob([d.blob], { type: 'image/jpeg' }), thumb: new Blob([d.thumb], { type: 'image/jpeg' }) };
    }
    return { ...d, id };
  }

  /* ---------- nhận thay đổi từ người kia ---------- */
  let queue = Promise.resolve();
  function onRemote(store, id, d, ts) {
    queue = queue.then(() => apply(store, id, d, ts)).catch(() => {});
  }
  async function apply(store, id, d, ts) {
    const pendingLocal = st.dirty[store] && st.dirty[store][id];
    const local = await DB.get(store, id);
    if (d.deleted) {
      if (local && !pendingLocal) { await DB.del(store, id); changed(); }
    } else if (!local) {
      if (!pendingLocal) { await DB.put(store, unpack(store, id, d)); changed(); } // đang chờ xoá ở máy này thì không khôi phục lại
    } else if (store !== 'photos' && (d.updatedAt || 0) > (local.updatedAt || 0)) {
      await DB.put(store, unpack(store, id, d));
      changed();
    }
    if (ts > (st.lastTs[store] || 0)) { st.lastTs[store] = ts; save(); }
    st.lastSyncAt = Date.now();
    notify();
  }

  /* ---------- đẩy thay đổi của máy này lên ---------- */
  function touch(store, id) {
    if (!st.space) return;
    (st.dirty[store] = st.dirty[store] || {})[id] = Date.now();
    save();
    flush();
  }
  async function flush() {
    const be = st.backend;
    if (!be) return;
    for (const store of STORES) {
      for (const id of Object.keys(st.dirty[store] || {})) {
        const key = store + '/' + id;
        if (st.inflight.has(key)) continue;
        const stamp = st.dirty[store][id];
        const rec = await DB.get(store, id);
        const drop = () => { if (st.dirty[store] && st.dirty[store][id] === stamp) { delete st.dirty[store][id]; save(); } };
        let data;
        if (!rec) data = { deleted: true, updatedAt: stamp };
        else if (rec.demo || (store === 'journeys' && rec.status !== 'done')) { drop(); continue; } // dữ liệu mẫu và hành trình đang ghi không gửi đi
        else {
          data = await pack(store, rec);
          if (!data) { drop(); continue; }
        }
        if (st.backend !== be) return;
        st.inflight.add(key);
        be.set(store, id, data)
          .then(() => { drop(); st.lastSyncAt = Date.now(); if (st.status === 'error') setStatus('on'); else notify(); })
          .catch(err => setStatus('error', explain(err)))
          .finally(() => st.inflight.delete(key));
      }
    }
  }
  const pendingCount = () => STORES.reduce((a, s) => a + Object.keys(st.dirty[s] || {}).length, 0);

  function explain(err) {
    const code = (err && (err.code || err.message)) || '';
    if (/permission-denied|PERMISSION_DENIED/i.test(code)) return 'Firebase từ chối truy cập. Hãy kiểm tra lại phần Rules của Firestore đã dán đúng và bấm Publish chưa.';
    if (/not-found|NOT_FOUND|failed-precondition/i.test(code)) return 'Chưa tìm thấy Firestore trong dự án. Hãy tạo Firestore Database trong Firebase console.';
    if (/api-key|API key|invalid-argument/i.test(code)) return 'Cấu hình Firebase chưa đúng. Hãy dán lại đoạn firebaseConfig.';
    return 'Chưa kết nối được Firebase. Kiểm tra mạng rồi thử lại.';
  }

  async function connect() {
    disconnect();
    if (!st.cfg || !st.space) { setStatus('off'); return false; }
    setStatus('connecting');
    try {
      const make = window.__ojBackend || firestoreBackend;
      const be = st.backend = await make(st.cfg, st.space);
      const onErr = err => setStatus('error', explain(err));
      st.unsubs.push(be.listen('members', 0, (id, d) => { st.members[id] = { name: d.name || '' }; notify(); changed(); }, onErr));
      STORES.forEach(s => st.unsubs.push(be.listen(s, st.lastTs[s] || 0, (id, d, ts) => onRemote(s, id, d, ts), onErr)));
      if (st.profile) be.set('members', st.profile.id, { name: st.profile.name, updatedAt: Date.now() }).catch(onErr);
      setStatus('on');
      flush();
      return true;
    } catch (err) {
      st.backend = null;
      setStatus('error', err && /thư viện/.test(err.message) ? err.message : explain(err));
      return false;
    }
  }
  function disconnect() {
    st.unsubs.forEach(u => { try { u(); } catch { /* bỏ qua */ } });
    st.unsubs = [];
    if (st.backend) { try { st.backend.close(); } catch { /* bỏ qua */ } }
    st.backend = null;
    st.inflight.clear();
  }

  /** Kiểm tra thật sự ghi được lên Firebase (bắt lỗi Rules, sai cấu hình, mất mạng). */
  function probe() {
    const be = st.backend;
    if (!be) return Promise.resolve(st.error || 'Chưa kết nối được Firebase.');
    return new Promise(resolve => {
      const t = setTimeout(() => resolve('Firebase không phản hồi. Kiểm tra mạng, hoặc dự án chưa tạo Firestore Database.'), 12000);
      be.set('members', st.profile.id, { name: st.profile.name, updatedAt: Date.now() })
        .then(() => { clearTimeout(t); resolve(''); })
        .catch(err => { clearTimeout(t); resolve(explain(err)); });
    });
  }

  async function markAllDirty() {
    const now = Date.now();
    for (const s of STORES) {
      st.dirty[s] = st.dirty[s] || {};
      for (const r of await DB.all(s)) if (!r.demo) st.dirty[s][r.id] = now;
    }
    save();
  }

  async function setProfile(name) {
    name = String(name || '').trim().slice(0, 30);
    if (!name) return null;
    st.profile = { id: (st.profile && st.profile.id) || 'u' + newSpaceId().slice(0, 12), name };
    await DB.setMeta('profile', st.profile);
    if (st.backend) st.backend.set('members', st.profile.id, { name, updatedAt: Date.now() }).catch(() => {});
    notify();
    return st.profile;
  }

  async function enter(cfg, space) {
    st.cfg = cfg; st.space = space; st.lastTs = {}; st.members = {};
    await markAllDirty();
    if (!(await connect())) { const e = st.error; await leave(); return e || 'Chưa kết nối được Firebase.'; }
    const err = await probe();
    if (err) { await leave(); return err; }
    return '';
  }

  return {
    async init({ onChange, onStatus }) {
      st.onChange = onChange; st.onStatus = onStatus;
      try {
        st.profile = await DB.getMeta('profile', null);
        const s = await DB.getMeta('sync', null);
        if (s) Object.assign(st, { cfg: s.cfg, space: s.space, lastTs: s.lastTs || {}, dirty: s.dirty || {} });
      } catch { /* bỏ qua */ }
      if (st.cfg && st.space) connect();
      window.addEventListener('online', () => { if (st.space) (st.backend ? flush() : connect()); });
    },
    /** Tạo không gian chung mới từ đoạn firebaseConfig. Trả về chuỗi lỗi, rỗng nếu thành công. */
    async create(configText, name) {
      const cfg = parseConfig(configText);
      if (!cfg) return 'Chưa đọc được cấu hình. Hãy dán nguyên đoạn firebaseConfig có apiKey và projectId.';
      if (!(await setProfile(name))) return 'Hãy nhập tên của bạn.';
      return enter(cfg, newSpaceId());
    },
    /** Vào không gian chung bằng mã mời. */
    async join(code, name) {
      const inv = parseInvite(code);
      if (!inv) return 'Mã mời không đúng. Hãy sao chép lại toàn bộ mã, bắt đầu bằng OJ1.';
      if (!(await setProfile(name))) return 'Hãy nhập tên của bạn.';
      return enter(inv.cfg, inv.space);
    },
    /** Ngừng dùng chung trên máy này; dữ liệu trong máy được giữ nguyên. */
    async leave() { return leave(); },
    retry: () => (st.backend ? (flush(), Promise.resolve(true)) : connect()),
    push: (store, rec) => touch(store, rec.id),
    remove: (store, id) => touch(store, id),
    setProfile,
    inviteCode,
    get on() { return !!st.space; },
    get status() { return st.status; },
    get error() { return st.error; },
    get profile() { return st.profile; },
    get members() { return st.members; },
    get pending() { return pendingCount(); },
    get lastSyncAt() { return st.lastSyncAt; },
    nameOf(id, fallback = '') { return (st.members[id] && st.members[id].name) || (st.profile && st.profile.id === id ? st.profile.name : fallback); }
  };

  async function leave() {
    disconnect();
    st.cfg = null; st.space = null; st.lastTs = {}; st.dirty = {}; st.members = {};
    await DB.setMeta('sync', null).catch(() => {});
    setStatus('off');
  }
})();
