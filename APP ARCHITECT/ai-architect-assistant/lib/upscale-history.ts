// Lưu trữ lịch sử ảnh đã upscale bằng IndexedDB.
// (Ảnh là data-URL lớn — không vừa localStorage, nên dùng IndexedDB.)

export interface UpscaleHistoryItem {
  id: string;
  before: string; // data-URL ảnh gốc
  after: string; // data-URL / URL ảnh sau upscale
  fileName: string;
  scale: number;
  engine: string; // id engine: realesrgan | supir | seedvr2
  createdAt: number; // epoch ms
}

const DB_NAME = "upscale-history";
const STORE = "items";
const MAX_ITEMS = 30; // giữ tối đa 30 bản ghi mới nhất để khỏi phình dung lượng

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function loadHistory(): Promise<UpscaleHistoryItem[]> {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const req = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
      req.onsuccess = () =>
        resolve((req.result as UpscaleHistoryItem[]).sort((a, b) => b.createdAt - a.createdAt));
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export async function addHistory(item: UpscaleHistoryItem): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(item);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
  // Cắt bớt bản ghi cũ nếu vượt giới hạn.
  const all = await loadHistory();
  if (all.length > MAX_ITEMS) {
    await Promise.all(all.slice(MAX_ITEMS).map((it) => deleteHistory(it.id)));
  }
}

export async function deleteHistory(id: string): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function clearHistory(): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
