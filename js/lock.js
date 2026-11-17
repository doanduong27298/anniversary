/* Màn hình khoá: nhập đúng mã 4 số mới vào được app. Mở khoá theo phiên (đóng hẳn app thì phải nhập lại).
   Lưu ý: đây là khoá giao diện cho người lạ khỏi xem, không phải mã hoá dữ liệu. */
(() => {
  const HASH = '48cc14fabce3ce8bb527637f01913b4ecf963d295b0213bf093af627e32003b1'; // sha256('our-journey:' + mã)
  const KEY = 'oj-unlocked';
  const el = document.getElementById('lock');
  if (!el) return;
  try { if (sessionStorage.getItem(KEY) === HASH) { el.remove(); return; } } catch { /* bỏ qua */ }
  document.documentElement.classList.add('locked');

  /* SHA-256 gọn, dùng được cả khi trình duyệt không có crypto.subtle */
  function sha256(str) {
    const K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
    const bytes = new TextEncoder().encode(str);
    const l = bytes.length, n = ((l + 9 + 63) >> 6) << 6;
    const m = new Uint8Array(n);
    m.set(bytes); m[l] = 0x80;
    const dv = new DataView(m.buffer);
    dv.setUint32(n - 4, l * 8);
    let h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    const r = (x, k) => (x >>> k) | (x << (32 - k));
    const w = new Uint32Array(64);
    for (let o = 0; o < n; o += 64) {
      for (let i = 0; i < 16; i++) w[i] = dv.getUint32(o + i * 4);
      for (let i = 16; i < 64; i++) {
        const s0 = r(w[i - 15], 7) ^ r(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        const s1 = r(w[i - 2], 17) ^ r(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
      }
      let [a, b, c, d, e, f, g, hh] = h;
      for (let i = 0; i < 64; i++) {
        const t1 = (hh + (r(e, 6) ^ r(e, 11) ^ r(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) >>> 0;
        const t2 = ((r(a, 2) ^ r(a, 13) ^ r(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
        hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      h = h.map((x, i) => (x + [a, b, c, d, e, f, g, hh][i]) >>> 0);
    }
    return h.map(x => x.toString(16).padStart(8, '0')).join('');
  }

  const dots = el.querySelector('.lk-dots');
  const msg = el.querySelector('.lk-msg');
  let code = '';
  const paint = () => { [...dots.children].forEach((d, i) => d.classList.toggle('on', i < code.length)); };
  function check() {
    if (sha256('our-journey:' + code) === HASH) {
      try { sessionStorage.setItem(KEY, HASH); } catch { /* bỏ qua */ }
      el.classList.add('open');
      document.documentElement.classList.remove('locked');
      setTimeout(() => el.remove(), 520);
    } else {
      el.classList.remove('shake');
      void el.offsetWidth;
      el.classList.add('shake');
      msg.textContent = 'Sai mã rồi, thử lại nhé';
      if (navigator.vibrate) navigator.vibrate(120);
      setTimeout(() => { code = ''; paint(); }, 380);
    }
  }
  function press(k) {
    if (el.classList.contains('open')) return;
    if (k === 'del') code = code.slice(0, -1);
    else if (code.length < 4) code += k;
    msg.textContent = 'Nhập mã để vào';
    paint();
    if (code.length === 4) setTimeout(check, 120);
  }
  el.addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (b) press(b.dataset.k); });
  document.addEventListener('keydown', e => {
    if (!document.body.contains(el)) return;
    if (/^\d$/.test(e.key)) press(e.key);
    else if (e.key === 'Backspace') press('del');
  });
})();
