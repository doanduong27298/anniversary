/* Lưu trữ cục bộ bằng IndexedDB: check-in, cung đường, ảnh (Blob), hành trình GPS, đường đi đã tính. */
const DB = (() => {
  const NAME = 'dau-chan-hong';
  const VERSION = 2;
  let dbPromise;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(NAME, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('journeys')) db.createObjectStore('journeys', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('checkins')) {
          const s = db.createObjectStore('checkins', { keyPath: 'id' });
          s.createIndex('journeyId', 'journeyId');
        }
        if (!db.objectStoreNames.contains('photos')) {
          const s = db.createObjectStore('photos', { keyPath: 'id' });
          s.createIndex('checkinId', 'checkinId');
        }
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
        if (!db.objectStoreNames.contains('trips')) db.createObjectStore('trips', { keyPath: 'id' });   // cung đường
        if (!db.objectStoreNames.contains('routes')) db.createObjectStore('routes', { keyPath: 'key' }); // đường đi đã tính sẵn
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  const wrap = req => new Promise((res, rej) => {
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });

  async function store(name, mode = 'readonly') {
    const db = await open();
    return db.transaction(name, mode).objectStore(name);
  }

  return {
    open,
    get: async (s, k) => wrap((await store(s)).get(k)),
    all: async s => wrap((await store(s)).getAll()),
    put: async (s, v) => wrap((await store(s, 'readwrite')).put(v)),
    del: async (s, k) => wrap((await store(s, 'readwrite')).delete(k)),
    clear: async s => wrap((await store(s, 'readwrite')).clear()),
    byIndex: async (s, idx, k) => wrap((await store(s)).index(idx).getAll(k)),
    getMeta: async (k, fallback = null) => {
      const r = await wrap((await store('meta')).get(k));
      return r ? r.value : fallback;
    },
    setMeta: async (k, value) => wrap((await store('meta', 'readwrite')).put({ key: k, value }))
  };
})();
